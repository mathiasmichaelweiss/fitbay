import { EX, EXM, PRE } from '@fitbay/shared/exercises';
import type { Repo } from '../lib/repo';
import { HttpError, json, type Result } from '../lib/http';
import { parseJson, type Provider } from './provider';

/**
 * Перевод упражнений (translateNames и openEx прототипа). В прототипе кэш был у каждого пользователя,
 * здесь общий для всех: раз переведенное название или техника больше не стоят токенов.
 * Ключи в общей таблице: EXTR#<lang> / NAMES (map id → название), EXTR#<lang> / EX#<id> (шаги).
 */
const CHUNK = 120;
const pkOf = (lang: string) => `EXTR#${lang}`;

export async function exNames(shared: Repo, provider: Provider | null, model: string, lang: 'ru' | 'de', translate: boolean): Promise<Result> {
  const row = await shared.get(pkOf(lang), 'NAMES');
  const map = { ...((row?.map as Record<string, string>) ?? {}) };
  let miss = EX.filter((e) => !PRE[e.i] && !map[e.i]);
  if (translate && miss.length && provider) {
    const chunk = miss.slice(0, CHUNK);
    const src = Object.fromEntries(chunk.map((e) => [e.i, e.n]));
    const out = await provider.complete({
      model,
      json: true,
      prompt: `Переведи названия упражнений для фитнес-приложения ${lang === 'de' ? 'на немецкий' : 'на русский'}. Используй общепринятые в спортзале названия, коротко. Ответь только JSON-объектом с теми же ключами: ${JSON.stringify(src)}`,
    });
    let r: Record<string, unknown> = {};
    try {
      r = parseJson(out.text) as Record<string, unknown>;
    } catch {
      /* следующий заход попробует снова */
    }
    for (const id of Object.keys(src)) if (typeof r[id] === 'string') map[id] = r[id] as string;
    await shared.put({ PK: pkOf(lang), SK: 'NAMES', map });
    miss = EX.filter((e) => !PRE[e.i] && !map[e.i]);
  }
  return json(200, { map, left: miss.length, total: EX.length });
}

export async function exSteps(shared: Repo, provider: Provider | null, model: string, lang: 'ru' | 'de', id: string): Promise<Result> {
  const e = EXM[id];
  if (!e) throw new HttpError(404, 'unknown exercise');
  const cached = await shared.get(pkOf(lang), `EX#${id}`);
  if (Array.isArray(cached?.t)) return json(200, { t: cached.t });
  if (!provider) throw new HttpError(503, 'ИИ недоступен в этом окне.');
  const out = await provider.complete({
    model,
    json: true,
    prompt: `Переведи пошаговую инструкцию упражнения ${lang === 'de' ? 'на немецкий' : 'на русский'}, естественным языком тренера, сохраняя смысл и количество шагов. Ответь только JSON: {"t":["шаг 1","шаг 2"]}\n${JSON.stringify(e.t)}`,
  });
  const r = parseJson(out.text) as { t?: unknown };
  if (!Array.isArray(r.t)) throw new HttpError(502, 'Не получилось разобрать, попробуй еще раз.');
  const t = r.t.map(String);
  await shared.put({ PK: pkOf(lang), SK: `EX#${id}`, t });
  return json(200, { t });
}
