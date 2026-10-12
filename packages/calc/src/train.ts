/**
 * Тренировки: порт функций прототипа (libList, lastSets, woKcal, setsText, pvf, aiCandidates,
 * а также правил активной тренировки из обработчиков #woList и #woFinish).
 * Эталоны: golden-train.json (scripts/golden-train.mjs запускает код прототипа).
 * База упражнений передается параметром, чтобы calc оставался без данных.
 */

export interface ExLike {
  i: string;
  n: string;
  c: string;
  l: string;
  e: string;
  p: string[];
}

export interface WSet {
  r: number | string;
  w?: number | string;
  d?: boolean;
}
export interface WItem {
  id?: string;
  name?: string;
  sets: WSet[];
  tags?: string[];
  note?: string;
}
export interface PlanItem {
  id: string;
  sets: number;
  reps: string;
  kg?: number;
}
export interface WorkoutLike {
  items?: WItem[];
  plan?: { week?: number; items?: PlanItem[] };
}

/** libList(): фильтр библиотеки по группе мышц, оборудованию и поиску (по локальному и английскому имени). */
export function libList<E extends ExLike>(ex: E[], groupMuscles: string[] | null, eq: string, q: string, name: (e: E) => string): E[] {
  const s = q.trim().toLowerCase();
  return ex.filter(
    (e) => (!groupMuscles || e.p.some((m) => groupMuscles.includes(m))) && (eq === 'all' || e.e === eq) && (!s || name(e).toLowerCase().includes(s) || e.n.toLowerCase().includes(s)),
  );
}

/** lastSets(): выполненные подходы упражнения в самой свежей тренировке (workouts по убыванию). */
export function lastSets(workouts: WorkoutLike[], id: string): WSet[] {
  const w = workouts.find((x) => (x.items ?? []).some((i) => i.id === id));
  return (w?.items ?? []).find((i) => i.id === id)?.sets.filter((s) => s.d) ?? [];
}

/** woKcal(): оценка ккал тренировки (5 MET), не больше 120 мин; короткая запись считается по 2,5 мин на подход. */
export function woKcal(start: number, end: number, items: { sets?: unknown[] }[] | undefined, stored: number | undefined, weight: number | undefined): number {
  if (stored) return stored;
  const sets = (items ?? []).reduce((n, i) => n + (i.sets ?? []).length, 0);
  let min = Math.min(120, Math.max(0, (end - start) / 60000));
  if (min < 5) min = Math.max(min, sets * 2.5);
  return Math.round((5 * (weight || 80) * min) / 60);
}

/** setsText(): «10×20кг, 8» по выполненным подходам, «–» если их нет. kg: подпись единицы. */
export const setsText = (s: WSet[] | undefined, kg = 'кг') =>
  (s ?? [])
    .filter((x) => x.d)
    .map((x) => `${x.r || 0}${x.w ? '×' + x.w + kg : ''}`)
    .join(', ') || '–';

/** Объем тренировки, кг (повторы × вес). */
export const volume = (items: WItem[]) => items.reduce((a, i) => a + i.sets.reduce((b, s) => b + (+s.r || 0) * (+(s.w ?? 0) || 0), 0), 0);

export type PvfState = 'ok' | 'over' | 'under' | 'miss';
export interface PvfRow {
  pi: PlanItem;
  S: WSet[];
  score: number;
  st: PvfState;
}
/** pvf(): план и факт. names: возможные имена упражнения плана (англ. и локальное) для старых записей без id. */
export function pvf(w: WorkoutLike, names: (id: string) => string[] = () => []): { rows: PvfRow[]; pct: number; week?: number } | null {
  const P = w?.plan;
  if (!P || !(P.items ?? []).length) return null;
  const rows = (P.items ?? []).map((pi): PvfRow => {
    const nm = names(pi.id);
    const f = (w.items ?? []).find((i) => i.id && i.id === pi.id) || (w.items ?? []).find((i) => nm.length > 0 && nm.includes(i.name ?? ''));
    const S = f?.sets ?? [];
    const tr = parseInt(pi.reps) || 0;
    const sc = Math.min(1, S.length / (pi.sets || 1));
    const rr = tr ? S.reduce((a, x) => a + Math.min(1, (+x.r || 0) / tr), 0) / Math.max(1, pi.sets) : 1;
    const wk = pi.kg ? Math.min(1, Math.max(0, ...S.map((x) => +(x.w ?? 0) || 0)) / pi.kg) : 1;
    const over = S.length > 0 && ((tr && S.some((x) => +x.r > tr)) || (pi.kg && S.some((x) => +(x.w ?? 0) > (pi.kg ?? 0))) || S.length > pi.sets);
    const score = f ? Math.min(sc, 1) * 0.5 + Math.min(rr, 1) * 0.3 + Math.min(wk, 1) * 0.2 : 0;
    return { pi, S, score, st: !f || !S.length ? 'miss' : score >= 0.95 ? (over ? 'over' : 'ok') : 'under' };
  });
  const tot = rows.reduce((a, r) => a + r.score, 0) / rows.length;
  return { rows, pct: Math.round(tot * 100), week: P.week };
}

/** aiCandidates(): упражнения, которые можно дать AI-тренеру (до 260). wish: если есть пожелания, оборудование не ограничиваем. */
export function aiCandidates<E extends ExLike>(ex: E[], place: 'gym' | 'street' | 'home', lvl: string, homeEq: string[], wish: string): E[] {
  const eqOk = wish.trim() ? null : { gym: null, street: ['body only', 'bands', 'other'], home: [...new Set(['body only', ...homeEq])] }[place];
  const lv: Record<string, number> = { beginner: 0, intermediate: 1, expert: 2 };
  const easy = (e: E) => (['body only', 'kettlebells', 'dumbbell'].includes(e.e) ? 1 : 0);
  return ex
    .filter((e) => ['strength', 'powerlifting', 'plyometrics'].includes(e.c) && (!eqOk || eqOk.includes(e.e)) && (lv[e.l] ?? 9) <= (lv[lvl] ?? 0))
    .sort((a, b) => easy(b) - easy(a))
    .slice(0, 260);
}

/* ---------- активная тренировка (обработчики #woList прототипа) ---------- */

export interface ASet {
  r: string;
  w: string;
  d: boolean;
}
export interface AItem {
  id: string;
  target: string;
  sets: ASet[];
  tags?: string[];
  note?: string;
}

/** Метки: «легко» и «тяжело» взаимоисключающие, повторное нажатие снимает. */
export function toggleTag(tags: string[] | undefined, t: string): string[] {
  const cur = tags ?? [];
  return cur.includes(t) ? cur.filter((x) => x !== t) : [...cur.filter((x) => !((t === 'easy' && x === 'hard') || (t === 'hard' && x === 'easy'))), t];
}

/** Галочка подхода: пустые повторы подставляются из прошлого раза или из цели, вес из прошлого раза. */
export function toggleDone(item: AItem, j: number, prev: WSet[]): ASet {
  const s: ASet = { r: '', w: '', d: false, ...item.sets[j] };
  if (!s.d && !s.r) {
    const pv = prev[j];
    s.r = pv ? String(pv.r) : String(parseInt(item.target) || '');
    if (!s.w && pv && pv.w) s.w = String(pv.w);
  }
  s.d = !s.d;
  return s;
}

/** Новое упражнение: подходы как в прошлый раз (без галочек) или 3 пустых. */
export const newItem = (id: string, prev: WSet[]): AItem => ({
  id,
  target: '',
  sets: (prev.length ? prev : [{}, {}, {}]).map((x) => ({ r: String((x as WSet).r || ''), w: String((x as WSet).w || ''), d: false })),
});

/** Упражнения из программы: цель «повторы · вес», N подходов с весом из программы. */
export const itemsFromProgram = (items: { id: string; sets?: number | string; reps?: string; w?: number | string | null }[], kg = 'кг'): AItem[] =>
  items.map((i) => ({
    id: i.id,
    target: (i.reps || '') + (i.w != null && i.w !== '' ? ' · ' + i.w + ' ' + kg : ''),
    sets: Array.from({ length: +(i.sets ?? 0) || 3 }, () => ({ r: '', w: i.w != null ? String(i.w) : '', d: false })),
  }));

/** + Подход: копирует последний. */
export const addSet = (item: AItem): AItem => {
  const l = item.sets[item.sets.length - 1];
  return { ...item, sets: [...item.sets, { r: l?.r || '', w: l?.w || '', d: false }] };
};

/** Завершение: в историю идут только отмеченные подходы, упражнения без них отбрасываются. */
export function finishItems(items: AItem[], name: (id: string) => string): { id: string; name: string; sets: { r: number; w: number; d: true }[]; tags?: string[]; note?: string }[] {
  return items
    .map((it) => ({
      id: it.id,
      name: name(it.id),
      sets: it.sets.filter((s) => s.d).map((s) => ({ r: +s.r || 0, w: +s.w || 0, d: true as const })),
      ...((it.tags ?? []).length ? { tags: it.tags } : {}),
      ...(it.note && it.note.trim() ? { note: it.note.trim() } : {}),
    }))
    .filter((it) => it.sets.length);
}

/** Начало недели (понедельник), ISO-дата. */
export function weekStart(d = new Date()): string {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
