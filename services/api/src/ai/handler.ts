import { age, aiCandidates, clPatterns, mealsKey, type ClSnap, target, type CalcProfile, type MealT } from '@fitbay/calc';
import type { AiTask } from '@fitbay/shared';
import { DynamoRepo, type Item, type Repo } from '../lib/repo';
import { body, caller, handle, HttpError, json, type Event, type Result } from '../lib/http';
import { communityHint, personalCorrections } from '../corrections/handler';
import { communityHintText, personalHintText } from '../prompts/hints';
import { coachPrompt, dayStoryPrompt, foodItemsPrompt, foodModPrompt, foodPortionPrompt, foodPrompt, workoutPrompt, activityPrompt, activityEditPrompt, clientAiPrompt, planPrompt, actShotsExtra, actTextExtra } from './prompts';
import { AI_EQ, D, EX, EXM } from '@fitbay/shared/exercises';
import { AiError, MockProvider, OpenAIProvider, parseJson, type Provider } from './provider';
import { AIMSG, KIND, LIMITS } from './limits';
import { JSON_TASKS, modelFor } from './config';
import { exNames, exSteps } from './extr';
import { clientSnapshot } from '../trainer/snapshot';

/** Задачи, промпты которых уже перенесены. Остальные появятся вместе с их экранами (A3.4 тренировки, A4.3 план). */
export const PORTED: AiTask[] = ['food_photo', 'food_text', 'food_items', 'food_portion', 'food_mod', 'day_story', 'coach', 'workout_ai', 'activity', 'ex_names', 'ex_steps', 'client_ai', 'plan_ai'];
const ALL: AiTask[] = ['food_photo', 'food_text', 'food_items', 'food_portion', 'food_mod', 'day_story', 'coach', 'activity', 'recipe', 'workout_ai', 'plan_ai', 'label_ocr', 'ex_names', 'ex_steps', 'client_ai'];
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
  ts: Number(i.ts) || Date.parse(String(i.createdAt ?? '')) || 0,
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

      // Перевод упражнений: общий кэш, без дневного лимита (как в прототипе, где он не считался).
      if (task === 'ex_names') return exNames(shared, provider, await modelFor(repo, task), lang, b.translate === true);
      if (task === 'ex_steps') return exSteps(shared, provider, await modelFor(repo, task), lang, String(b.id ?? ''));

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
      } else if (task === 'food_items') {
        const q = typeof b.text === 'string' ? b.text.trim().slice(0, 500) : '';
        if (!q) throw new HttpError(400, 'text required');
        prompt = foodItemsPrompt(q, lang);
      } else if (task === 'food_portion' || task === 'food_mod') {
        const rec = await repo.get(U(who.uid), `RECIPE#${String(b.recId ?? '')}`);
        if (!rec) throw new HttpError(404, 'recipe not found');
        const r = { name: String(rec.name ?? ''), desc: rec.desc as string | undefined, grams: Number(rec.grams) || undefined };
        if (task === 'food_portion') {
          const plate = typeof b.plate === 'object' && b.plate ? (b.plate as { type: string; size?: string; fill?: string }) : null;
          prompt = foodPortionPrompt(r, typeof b.said === 'string' ? b.said.slice(0, 1000) : '', plate);
        } else {
          const change = typeof b.change === 'string' ? b.change.trim().slice(0, 500) : '';
          if (!change) throw new HttpError(400, 'change required');
          prompt = foodModPrompt(r.name, typeof b.current === 'string' ? b.current.slice(0, 3000) : `состав: ${r.desc || 'не указан'}`, change);
        }
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
        // история еды за 45 дней, без повторов названий, 60 последних (qHist прототипа)
        const seen = new Set<string>();
        const hist = (await repo.query(U(who.uid), { from: `MEAL#${shift(day, -45)}`, to: `MEAL#${day}\uffff` }))
          .filter((m) => m.name && m.kcal)
          .sort((a, b) => (b.SK < a.SK ? -1 : 1))
          .filter((m) => {
            const k = String(m.name).toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .slice(0, 60)
          .map((x) => `${x.date}|${x.name}${x.desc ? ` (${String(x.desc).slice(0, 80)})` : ''}|${x.grams ? `${Math.round(Number(x.grams))} г` : '?'}|${Math.round(Number(x.kcal))} ккал, Б ${Math.round(Number(x.protein) || 0)}, Ж ${Math.round(Number(x.fat) || 0)}, У ${Math.round(Number(x.carbs) || 0)}`)
          .join('\n');
        prompt = dayStoryPrompt(txt, book, lang, hist);
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
          target: target(p, day, { pct: Number((prof as Record<string, unknown>).actPct ?? 0.5) }),
          day,
          now: typeof b.time === 'string' && /^\d{2}:\d{2}$/.test(b.time) ? b.time : 'день уже прошел',
          workoutToday: wos.length ? wos.map((w) => String(w.title ?? '')).join('; ') : 'не было',
          meals,
          week,
          lang,
        });
      } else if (task === 'activity') {
        if (!prof) throw new HttpError(400, 'profile required');
        const p = prof as unknown as CalcProfile;
        const imgs = (Array.isArray(b.images) ? b.images : []).filter((x): x is string => typeof x === 'string' && x.length < 3_000_000).slice(0, 5).map((x) => x.replace(/^data:image\/\w+;base64,/, ''));
        if (b.mode === 'edit') {
          if (!imgs.length) throw new HttpError(400, 'images required');
          const c = (typeof b.cur === 'object' && b.cur ? b.cur : {}) as { name?: string; min?: string; km?: string; steps?: string; kcal?: string };
          prompt = activityEditPrompt({ ...c, name: String(c.name ?? '') }, { w: p.w, h: p.h });
        } else {
          const txt = typeof b.text === 'string' ? b.text.trim().slice(0, 2000) : '';
          if (!txt && !imgs.length) throw new HttpError(400, 'text or images required');
          const acts = await repo.query(U(who.uid), { prefix: `ACT#${day}` });
          const list = acts.map((x) => `${x.SK.slice(4)}|${x.name}|${x.min || 0}|${x.km || ''}|${x.steps || ''}|${x.kcal}`).join('\n');
          prompt = activityPrompt(imgs.length ? actShotsExtra(imgs.length) : actTextExtra(txt), { sex: p.sex, age: p.birth ? age(p.birth, day) : (p.age ?? 30), h: p.h, w: p.w }, list, lang);
        }
        images = imgs.length ? imgs : undefined;
      } else if (task === 'client_ai') {
        const cid = String(b.cid ?? '');
        const link = await repo.get(`TRAINER#${who.uid}`, `CLIENT#${cid}`);
        if (!link?.consent) throw new HttpError(403, 'forbidden');
        const c = await clientSnapshot(repo, cid, day);
        const D = c.days.slice(-14).map((d) => ({ d: d.d, k: Math.round(d.k), p: Math.round(d.p), f: Math.round(d.f), c: Math.round(d.c), meals: d.items.map((i) => (i.ts ? `${new Date(i.ts).toTimeString().slice(0, 5)} ` : '') + `${i.name} ${i.kcal}`) }));
        prompt = clientAiPrompt(
          {
            profile: c.profile,
            targets: c.targets,
            patterns: clPatterns({ ...c, profile: c.profile ?? undefined, targets: c.targets ?? undefined } as unknown as ClSnap, day, lang).map((x) => `${x.h}: ${x.x}`).join(' | '),
            days: D,
            workouts: c.workouts.slice(0, 10).map((w) => ({ d: w.date, t: w.title, min: w.min })),
            measures: c.measures,
          },
          lang,
        );
      } else if (task === 'plan_ai') {
        // aiGenPlan прототипа: тренер описывает этапы, ИИ собирает фазы с тренировками и питанием
        const cid = String(b.cid ?? '');
        const link = await repo.get(`TRAINER#${who.uid}`, `CLIENT#${cid}`);
        if (!link?.consent) throw new HttpError(403, 'forbidden');
        const text = typeof b.text === 'string' ? b.text.trim().slice(0, 2000) : '';
        if (!text) throw new HttpError(400, 'Опиши этапы плана.');
        const place = (['gym', 'home', 'street'] as const).find((x) => x === b.place) ?? 'gym';
        const c = await clientSnapshot(repo, cid, day);
        const lm = (c.measures.at(-1) ?? {}) as Record<string, unknown>;
        const D14 = c.days.slice(-14);
        const avg = (f: 'k' | 'p') => (D14.length ? Math.round(D14.reduce((a, d) => a + d[f], 0) / D14.length) : null);
        const eq = { gym: null, home: ['body only', 'dumbbell', 'kettlebells', 'bands'], street: ['body only', 'other'] }[place];
        const ok = (e: (typeof EX)[number]) => !eq || eq.includes(e.e);
        const cand = EX.filter((e) => ['strength', 'powerlifting', 'plyometrics'].includes(e.c) && ok(e) && (e as { m?: string }).m === 'compound')
          .slice(0, 90)
          .concat(EX.filter((e) => e.c === 'strength' && ok(e) && (e as { m?: string }).m !== 'compound').slice(0, 50));
        prompt = planPrompt({
          text,
          p: c.profile ?? {},
          measures: Object.entries(lm).filter(([k]) => !['date', 'at', 'type'].includes(k)).map(([k, v]) => `${k} ${v}`).join(', '),
          avgK: avg('k'),
          avgP: avg('p'),
          place,
          cand: cand.map((e) => `${e.i} (${e.n})`).join(', '),
          lang,
        });
      } else if (task === 'workout_ai') {
        if (!prof) throw new HttpError(400, 'profile required');
        const place = (['gym', 'street', 'home'] as const).find((x) => x === b.place) ?? 'gym';
        const lvl = (['beginner', 'intermediate', 'expert'] as const).find((x) => x === b.lvl) ?? 'beginner';
        const days = Math.min(5, Math.max(2, Number(b.days) || 3));
        const eqKeys = (Array.isArray(b.eq) ? b.eq : ['none']).filter((k): k is string => AI_EQ.some((x) => x[0] === k));
        const wish = typeof b.wish === 'string' ? b.wish.trim().slice(0, 1000) : '';
        const eqRows = eqKeys.flatMap((k) => AI_EQ.filter((x) => x[0] === k));
        const homeEq = eqRows.map((x) => x[2]);
        const cand = aiCandidates(EX, place, lvl, homeEq, wish);
        const p = prof as unknown as CalcProfile;
        prompt = workoutPrompt({
          sex: p.sex,
          age: p.birth ? age(p.birth, day) : (p.age ?? 30),
          w: p.w,
          goal: p.goal,
          lvlName: D(lvl, lang),
          place,
          homeEq: eqRows.map((x) => x[1]),
          days,
          wish,
          cand: cand.map((e) => `${e.i}|${e.n}|${e.p.join(',')}`),
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

      if (task === 'client_ai') return json(200, { text: out.text.replace(/\s*[—–]\s*/g, ', ').trim() });
      if (task === 'coach') {
        const text = out.text.replace(/\s*[—–]\s*/g, ', ').trim(); // как в прототипе: без длинного тире
        await repo.put({ PK: U(who.uid), SK: `COACH#${day}`, text, key: coachKey, at: now() });
        return json(200, { text });
      }
      if (task === 'plan_ai') {
        type R = { phases?: { type?: string; name?: string; pct?: unknown; prot?: unknown; end?: { kind?: string; val?: unknown }; note?: string; workouts?: { name?: string; items?: { id?: string; sets?: unknown; reps?: unknown }[] }[]; nutrition?: { rules?: unknown[]; menu?: unknown[] } }[] };
        const r = (() => {
          try {
            return parseJson(out.text) as R;
          } catch {
            return {} as R;
          }
        })();
        const TY = ['cut', 'bulk', 'maint', 'recomp', 'custom'];
        const phases = (r.phases ?? []).map((x) => ({
          type: TY.includes(String(x.type)) ? String(x.type) : 'custom',
          name: String(x.name ?? ''),
          pct: +(x.pct as number) || 0,
          prot: +(x.prot as number) || 0,
          end: { kind: ['weeks', 'weight', 'date', 'none'].includes(String(x.end?.kind)) ? String(x.end?.kind) : 'none', val: x.end?.val ?? '' },
          note: String(x.note ?? ''),
          workouts: (x.workouts ?? [])
            .map((w) => ({ name: String(w.name ?? ''), items: (w.items ?? []).flatMap((i) => (i.id && EXM[i.id] ? [{ id: i.id, sets: +(i.sets as number) || 3, reps: String(i.reps ?? '10') }] : [])) }))
            .filter((w) => w.items.length),
          nutrition: { rules: (x.nutrition?.rules ?? []).map(String), menu: (x.nutrition?.menu ?? []).map(String) },
        }));
        if (!phases.length) throw new HttpError(502, 'Не получилось составить план, попробуй ещё раз.');
        return json(200, { result: { phases } });
      }
      if (task === 'workout_ai') {
        // Как в прототипе: только известные упражнения, пустые дни отбрасываются.
        const r = (() => {
          try {
            return parseJson(out.text) as { days?: { name?: string; exercises?: { id?: string; sets?: unknown; reps?: unknown }[] }[]; note?: string };
          } catch {
            return {};
          }
        })();
        const days = (r.days ?? [])
          .map((d) => ({ name: String(d.name ?? ''), items: (d.exercises ?? []).flatMap((x) => (x.id && EXM[x.id] ? [{ ...x, id: x.id }] : [])).map((x) => ({ id: x.id, sets: +(x.sets as number) || 3, reps: String(x.reps ?? '') })) }))
          .filter((d) => d.items.length);
        if (!days.length) throw new HttpError(502, 'Не получилось составить программу, попробуй еще раз.');
        return json(200, { result: { days, note: String(r.note ?? '') } });
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
