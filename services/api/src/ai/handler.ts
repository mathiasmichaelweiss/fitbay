import { age, mealsKey, target, type CalcProfile, type MealT } from '@fitbay/calc';
import type { AiTask } from '@fitbay/shared';
import { DynamoRepo, type Item, type Repo } from '../lib/repo';
import { body, caller, handle, HttpError, json, type Event, type Result } from '../lib/http';
import { communityHint, personalCorrections } from '../corrections/handler';
import { communityHintText, personalHintText } from '../prompts/hints';
import { coachPrompt, dayStoryPrompt, foodPrompt } from './prompts';
import { AiError, MockProvider, OpenAIProvider, parseJson, type Provider } from './provider';
import { AIMSG, KIND, LIMITS } from './limits';
import { JSON_TASKS, modelFor } from './config';

/** Задачи, промпты которых уже перенесены. Остальные появятся вместе с их экранами (A3.4 тренировки, A4.3 план). */
export const PORTED: AiTask[] = ['food_photo', 'food_text', 'day_story', 'coach'];
const ALL: AiTask[] = ['food_photo', 'food_text', 'day_story', 'coach', 'activity', 'recipe', 'workout_ai', 'plan_ai', 'label_ocr'];
const UNAVAILABLE = 'ИИ недоступен в этом окне.';
const DAY = 864e5;
const U = (uid: string) => `USER#${uid}`;

export function providerFromEnv(env = process.env): Provider | null {
  if (env.AI_MOCK === '1') return new MockProvider();
  if (env.OPENAI_API_KEY) return new OpenAIProvider(env.OPENAI_API_KEY, env.OPENAI_BASE_URL);
  return null;
}

const asMeal = (i: Item): MealT => ({
  id: i.SK.slice(i.SK.indexOf('#') + 1), name: String(i.name ?? ''), kcal: +(i.kcal ?? 0) || 0, protein: +(i.protein ?? 0) || 0,
  fat: +(i.fat ?? 0) || 0, carbs: +(i.carbs ?? 0) || 0, slot: i.slot as MealT['slot'], desc: i.desc as string | undefined,
  ts: Date.parse(String(i.createdAt ?? '')) || 0,
});
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/**
 * POST /ai/{task} (спека 4.3). Промпт собирается на сервере из данных пользователя, ключ провайдера только здесь.
 * Дневной счётчик USAGE#<дата> с TTL, мягкое сообщение при исчерпании, токены в счётчик и в лог (без персональных данных).
 */
export function makeHandler(repo: Repo, shared: Repo, provider: Provider | null, now: () => number = Date.now) {
  return (e: Event): Promise<Result> =>
    handle(e, async () => {
      const who = caller(e);
      const task = String(e.pathParameters?.task ?? '') as AiTask;
      if (!ALL.includes(task)) throw new HttpError(404, 'unknown task');
      if (!PORTED.includes(task)) throw new HttpError(501, 'not ported yet');
      const b = body(e);
      const lang = b.lang === 'de' ? 'de' : 'ru';
      const day = typeof b.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.day) ? b.day : new Date(now()).toISOString().slice(0, 10);

      // Коуч: если после прошлого совета еды не прибавилось, отдаём тот же совет, без вызова и без счётчика.
      let coachKey = '';
      if (task === 'coach') {
        const meals = (await repo.query(U(who.uid), { prefix: `MEAL#${day}` })).map(asMeal);
        coachKey = mealsKey(meals);
        const cached = await repo.get(U(who.uid), `COACH#${day}`);
        if (cached?.key === coachKey && cached.text) return json(200, { text: cached.text, cached: true });
      }

      if (!provider) throw new HttpError(503, UNAVAILABLE);

      // Лимит на день: проверка до вызова, учёт после успешного ответа.
      const kind = KIND[task];
      const prof = await repo.get(U(who.uid), 'PROFILE');
      const plan = (['trial', 'full', 'unlimited'] as const).find((p) => p === prof?.entitlement) ?? 'full';
      const usageKey = `USAGE#${new Date(now()).toISOString().slice(0, 10)}`;
      const usage = (await repo.get(U(who.uid), usageKey)) ?? { PK: U(who.uid), SK: usageKey, c: {}, tokens: {} };
      const c = (usage.c ?? {}) as Record<string, number>;
      if ((c[kind] ?? 0) >= LIMITS[plan][kind]) return json(429, { error: 'daily', message: AIMSG[kind] });

      // Сборка промпта
      let prompt = '';
      let images: string[] | undefined;
      if (task === 'food_photo' || task === 'food_text') {
        const dish = typeof b.dish === 'string' ? b.dish.slice(0, 200) : '';
        const desc = typeof b.desc === 'string' ? b.desc.slice(0, 2000) : '';
        images = task === 'food_photo' && typeof b.image === 'string' && b.image.length < 3_000_000 ? [b.image.replace(/^data:image\/\w+;base64,/, '')] : undefined;
        if (!dish && !desc && !images) throw new HttpError(400, 'Напиши название или добавь фото.');
        const plate = typeof b.plate === 'object' && b.plate ? (b.plate as { type: string; size?: string; fill?: string }) : null;
        prompt = foodPrompt(
          { dish, desc, plate, grams: Number(b.grams) || null, hasImage: !!images, lang },
          communityHintText(dish, await communityHint(shared, dish)),
          personalHintText(await personalCorrections(repo, who.uid)),
        );
      } else if (task === 'day_story') {
        const txt = typeof b.text === 'string' ? b.text.trim().slice(0, 4000) : '';
        if (!txt) throw new HttpError(400, 'text required');
        const recs = await repo.query(U(who.uid), { prefix: 'RECIPE#' });
        const book = recs
          .map((r) => {
            const id = r.SK.slice(7);
            const p100 = r.p100 as { kcal?: number } | undefined;
            return `${id}|${r.name}|порция ${r.grams || '?'} г|${p100?.kcal ? `${Math.round(p100.kcal)} ккал/100г` : `${r.kcal} ккал на порцию`}`;
          })
          .join('\n');
        prompt = dayStoryPrompt(txt, book, lang);
      } else if (task === 'coach') {
        if (!prof) throw new HttpError(400, 'profile required');
        const meals = (await repo.query(U(who.uid), { prefix: `MEAL#${day}` })).map(asMeal);
        const wk = await repo.query(U(who.uid), { from: `MEAL#${shift(day, -7)}`, to: `MEAL#${day}` });
        const byDay: Record<string, { k: number; p: number }> = {};
        for (const m of wk) {
          const d = m.SK.slice(5, 15);
          if (d >= day) continue;
          const x = (byDay[d] ??= { k: 0, p: 0 });
          x.k += +(m.kcal ?? 0) || 0;
          x.p += +(m.protein ?? 0) || 0;
        }
        const week = Object.entries(byDay).sort().map(([d, v]) => `${d}: ${v.k} ккал, белок ${v.p} г`).join('\n');
        const wos = await repo.query(U(who.uid), { prefix: `WORKOUT#${day}` });
        const p = prof as unknown as CalcProfile & { tw?: number };
        prompt = coachPrompt({
          profile: { sex: p.sex, age: p.birth ? age(p.birth, day) : (p.age ?? 30), h: p.h, w: p.w, tw: p.tw, act: p.act, goal: p.goal },
          target: target(p, day),
          day,
          now: typeof b.time === 'string' && /^\d{2}:\d{2}$/.test(b.time) ? b.time : 'день уже прошел',
          workoutToday: wos.length ? wos.map((w) => String(w.title ?? '')).join('; ') : 'не было',
          meals,
          week,
          lang,
        });
      }

      const model = await modelFor(repo, task);
      let out;
      try {
        out = await provider.complete({ model, prompt, json: JSON_TASKS.has(task), images });
      } catch (err) {
        // Как в прототипе: если фото не прошло, считаем по описанию и весу.
        if (images && err instanceof AiError && err.code !== 'invalid_json') {
          out = await provider.complete({ model, prompt: prompt.replace('Фото приложено, используй его для оценки состава и объема.', 'Фото нет.'), json: true });
          images = undefined;
        } else throw err;
      }

      // Учёт: счётчик задач и токенов за день, запись живёт 3 дня (TTL).
      const tk = (usage.tokens ?? {}) as Record<string, { in: number; out: number }>;
      tk[task] = { in: (tk[task]?.in ?? 0) + out.usage.input, out: (tk[task]?.out ?? 0) + out.usage.output };
      await repo.put({ ...usage, c: { ...c, [kind]: (c[kind] ?? 0) + 1 }, tokens: tk, ttl: Math.floor(now() / 1000) + 3 * 86400 });
      console.log(JSON.stringify({ ai: task, model, in: out.usage.input, out: out.usage.output }));

      if (task === 'coach') {
        const text = out.text.replace(/\s*[—–]\s*/g, ', ').trim(); // как в прототипе: без длинного тире
        await repo.put({ PK: U(who.uid), SK: `COACH#${day}`, text, key: coachKey, at: now() });
        return json(200, { text });
      }
      try {
        return json(200, { result: parseJson(out.text), ...(task === 'food_photo' && !images ? { imageSkipped: true } : {}) });
      } catch {
        throw new HttpError(502, 'Не получилось разобрать, попробуй еще раз.');
      }
    });
}

export const handler = makeHandler(
  new DynamoRepo(process.env.TABLE_MAIN ?? 'fitbay-main'),
  new DynamoRepo(process.env.TABLE_SHARED_FOOD ?? 'fitbay-shared-food'),
  providerFromEnv(),
);
