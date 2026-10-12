/**
 * @fitbay/calc: единственный источник правды для всех производных чисел (спека 4.1).
 * Порт CALC из прототипа docs/prototype/kalorii.html (строки ~714-740), один в один по формулам.
 * Отличие только в том, что функции чистые: всё, что прототип брал из глобального st
 * (доля сожжённого, активности дня, фаза плана, тренировки и записи), передаётся аргументами.
 * Эталоны: src/golden.json сняты запуском настоящего CALC прототипа (см. golden.test.ts).
 */

export type Sex = 'm' | 'f';
/** Тренировок в неделю, как в прототипе: 0, 1 (1-2), 3 (3-4), 5 (5-6), 7 (7+). */
export type Activity = 0 | 1 | 3 | 5 | 7;
export type Goal = 'lose' | 'recomp' | 'keep' | 'gain';
export type DayType = 'train' | 'rest';

export const ACTS: { value: Activity; label: string }[] = [
  { value: 0, label: '0' },
  { value: 1, label: '1–2' },
  { value: 3, label: '3–4' },
  { value: 5, label: '5–6' },
  { value: 7, label: '7+' },
];
export const GOALS: Goal[] = ['lose', 'recomp', 'keep', 'gain'];

export const ACT: Record<number, number> = { 0: 1.2, 1: 1.375, 3: 1.55, 5: 1.725, 7: 1.9 };
export const GOAL_K: Record<Goal, number> = { lose: 0.85, recomp: 0.9, gain: 1.1, keep: 1 };
export const PROT_PER_KG: Record<Goal, number> = { lose: 1.8, recomp: 2.2, keep: 1.6, gain: 2.0 };
export const KCAL_PER_G_FAT = 7.7;
/** Доля сожжённого на тренировках, которая добавляется к норме (по умолчанию 50%). */
export const DEFAULT_ACT_PCT = 0.5;

export interface Macros {
  p: number;
  f: number;
  c: number;
}
export interface Flex {
  on?: boolean;
  /** Дни недели 1..7 (пн = 1), которые считаются тренировочными. */
  days: number[];
  train: Macros;
  rest: Macros;
}
export interface Phase {
  type?: string; // cut, bulk, keep, recomp, custom
  mode?: 'pct' | 'abs' | 'macro' | 'flex';
  pct?: number;
  kcal?: number;
  prot?: number;
  mp?: number; mf?: number; mc?: number;
  tp?: number; tf?: number; tc?: number;
  rp?: number; rf?: number; rc?: number;
  days?: number[];
}
export interface CalcProfile {
  sex: Sex;
  /** Дата рождения YYYY-MM-DD; если нет, используется age. */
  birth?: string;
  age?: number;
  h: number;
  w: number;
  act: Activity;
  goal: Goal;
  tw?: number;
  macro?: Macros & { on?: boolean };
  flex?: Flex;
  /** Ручной тип дня: { '2026-10-12': 'train' }. */
  dayOv?: Record<string, DayType>;
}
export interface DayContext {
  /** Доля сожжённого 0 | 0.5 | 1. */
  pct?: number;
  /** Сожжено за день (тренировки + активности), ккал. */
  actKcal?: number;
  /** Текущая фаза плана тренера, если есть. */
  phase?: Phase | null;
  /** В этот день есть тренировка в журнале или запись к тренеру. */
  hasWorkout?: boolean;
}
export interface Target {
  k: number;
  p: number;
  f: number;
  c: number;
  base: number;
  bonus: number;
  tdee: number;
  bmr: number;
  manual?: boolean;
  dayType?: DayType | null;
}

/** Полных лет на дату (ageOf прототипа). */
export function age(birth: string, on: string): number {
  const [by, bm, bd] = birth.split('-').map(Number) as [number, number, number];
  const [y, m, d] = on.split('-').map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}
const ageAt = (p: CalcProfile, day: string) => (p.birth ? age(p.birth, day) : (p.age ?? 30));

/** Базовый обмен (Миффлин-Сан Жеор), без округления, как в прототипе. */
export function bmr(p: Pick<CalcProfile, 'sex' | 'h' | 'birth' | 'age'>, w: number, day: string): number {
  return 10 * w + 6.25 * p.h - 5 * ageAt(p as CalcProfile, day) + (p.sex === 'm' ? 5 : -161);
}

/** Коэффициент активности. Если бонус за активность включён, коэффициент не выше 1.375 (чтобы не считать тренировки дважды). */
export function factor(p: Pick<CalcProfile, 'act'>, pct = DEFAULT_ACT_PCT): number {
  const f0 = ACT[p.act] ?? 1.2;
  return pct > 0 ? Math.min(f0, 1.375) : f0;
}

/** Бонус к норме за активность дня: доля сожжённого, округлено до 10. */
export function bonus(actKcal: number, pct = DEFAULT_ACT_PCT): number {
  return pct > 0 ? Math.round((actKcal * pct) / 10) * 10 : 0;
}

/** Расход за день. weight: вес на этот день (последнее взвешивание), иначе вес профиля. */
export function expenditure(p: CalcProfile, day: string, ctx: DayContext = {}, weight = p.w): number {
  const pct = ctx.pct ?? DEFAULT_ACT_PCT;
  return bmr(p, weight, day) * factor(p, pct) + (ctx.actKcal ?? 0) * pct;
}

/** Гибкий план: из фазы (mode flex) или из профиля клиента. */
export function flexOf(p: CalcProfile, phase?: Phase | null): Flex | null {
  if (phase) {
    return phase.mode === 'flex'
      ? { days: phase.days ?? [1, 3, 5], train: { p: phase.tp ?? 0, f: phase.tf ?? 0, c: phase.tc ?? 0 }, rest: { p: phase.rp ?? 0, f: phase.rf ?? 0, c: phase.rc ?? 0 } }
      : null;
  }
  return p.flex?.on ? p.flex : null;
}

/** Тип дня: ручной override → тренировка или запись в этот день → день недели из гибкого плана. */
export function dayType(day: string, p: CalcProfile, fx: Flex | null, hasWorkout = false): DayType {
  const ov = p.dayOv?.[day];
  if (ov) return ov;
  if (hasWorkout) return 'train';
  const wd = ((new Date(`${day}T12:00:00`).getDay() + 6) % 7) + 1;
  return fx?.days?.includes(wd) ? 'train' : 'rest';
}

const r10 = (n: number) => Math.round(n / 10) * 10;

/**
 * Норма на день. Приоритет источников (спека 4.1):
 * гибкий план фазы → БЖУ фазы → калории фазы (% или ккал) → ручные БЖУ клиента → гибкий план клиента → авто по цели.
 */
export function target(p: CalcProfile, day: string, ctx: DayContext = {}): Target {
  const pct = ctx.pct ?? DEFAULT_ACT_PCT;
  const ph = ctx.phase ?? null;
  const b = bmr(p, p.w, day);
  const tdee = b * factor(p, pct);
  const fx = flexOf(p, ph);
  const dt = fx ? dayType(day, p, fx, ctx.hasWorkout) : null;
  const bon = bonus(ctx.actKcal ?? 0, pct);

  const M: Macros | null = fx && dt
    ? { p: +fx[dt].p || 0, f: +fx[dt].f || 0, c: +fx[dt].c || 0 }
    : ph
      ? ph.mode === 'macro' ? { p: +(ph.mp ?? 0), f: +(ph.mf ?? 0), c: +(ph.mc ?? 0) } : null
      : p.macro?.on ? { p: +p.macro.p || 0, f: +p.macro.f || 0, c: +p.macro.c || 0 } : null;

  if (M && (M.p || M.f || M.c)) {
    const base = M.p * 4 + M.f * 9 + M.c * 4;
    return { manual: true, dayType: dt, bonus: bon, base: r10(base), k: r10(base + bon), p: Math.round(M.p), f: Math.round(M.f), c: Math.round(M.c + bon / 4), tdee: Math.round(tdee), bmr: Math.round(b) };
  }

  let k = ph ? (ph.mode === 'abs' && +(ph.kcal ?? 0) > 0 ? +(ph.kcal ?? 0) : tdee * (1 + +(ph.pct ?? 0) / 100)) : tdee * (GOAL_K[p.goal] ?? 1);
  const floor = Math.max(b, p.sex === 'm' ? 1500 : 1200);
  if (k < floor) k = floor;
  const base = k;
  k = base + bon;
  const pr = p.w * (ph && +(ph.prot ?? 0) > 0 ? +(ph.prot ?? 0) : (PROT_PER_KG[p.goal] ?? 1.6));
  const fat = p.w * ((ph ? ph.type === 'recomp' : p.goal === 'recomp') ? 0.8 : 0.9);
  const c = Math.max(0, (k - pr * 4 - fat * 9) / 4);
  return { bonus: bon, base: r10(base), k: r10(k), p: Math.round(pr), f: Math.round(fat), c: Math.round(c), tdee: Math.round(tdee), bmr: Math.round(b) };
}

/** Доля мышц в потере веса при дефиците (зависит от белка г/кг). */
export const leanShare = (pk: number) => Math.min(0.35, Math.max(0.1, 0.35 - (pk - 0.8) * 0.2));
/** Сколько граммов жира даёт дефицит (или профицит) в ккал. */
export const fatFromDeficit = (def: number, pk: number) => (def > 0 ? (def / KCAL_PER_G_FAT) * (1 - leanShare(pk)) : def / KCAL_PER_G_FAT);

export interface MacroSum {
  k: number;
  p: number;
  f: number;
  c: number;
}
/** Сумма по приёмам пищи (sums прототипа; поля приёма: kcal, protein, fat, carbs). */
export function sum(items: { kcal?: number; protein?: number; fat?: number; carbs?: number }[]): MacroSum {
  return items.reduce((a, m) => ({ k: a.k + (Number(m.kcal) || 0), p: a.p + (Number(m.protein) || 0), f: a.f + (Number(m.fat) || 0), c: a.c + (Number(m.carbs) || 0) }), { k: 0, p: 0, f: 0, c: 0 });
}

/** Доля выполнения 0..1+ (для колец). Норма 0 даёт 0. */
export const ratio = (eaten: number, goal: number): number => (goal > 0 ? eaten / goal : 0);

/* ---- самочувствие (CI_M, ciAvg, ciBad прототипа) ---- */
export const CI_KEYS = ['sleep', 'energy', 'stress', 'hunger', 'pain', 'adh'] as const;
export type CiKey = (typeof CI_KEYS)[number];
/** Шкала 1..5 у всех пунктов, 5 = хорошо (для стресса, голода и боли 5 = «Нет»). */
export type CheckinValues = Partial<Record<CiKey, number>> & { date: string };

/** Среднее по отмеченным пунктам; 0, если ничего не отмечено. */
export function ciAvg(x: Partial<Record<CiKey, number>>): number {
  const v = CI_KEYS.map((k) => Number(x[k])).filter(Boolean);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

const shiftDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Сигнал тренеру: 3 последних чек-ина в пределах 4 дней, все со средним ≤ 2.5, последний не старше 2 дней. */
export function ciBad(list: CheckinValues[], today: string): boolean {
  const r = [...list].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-3);
  if (r.length < 3) return false;
  const days = (new Date(`${r[2]!.date}T12:00:00`).getTime() - new Date(`${r[0]!.date}T12:00:00`).getTime()) / 864e5;
  return days <= 4 && r.every((x) => ciAvg(x) <= 2.5) && r[2]!.date >= shiftDay(today, -2);
}
