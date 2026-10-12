// @fitbay/calc: единственный источник правды для всех производных чисел (спека 4.1).
// ВНИМАНИЕ: factor, target и пороги ниже временные (стандартные формулы).
// В A1.1 они заменяются портом CALC из kalorii.html и сверяются на 10 эталонных профилях.

export type Sex = 'm' | 'f';
export type Activity = 'low' | 'light' | 'mid' | 'high';
export type Goal = 'lose' | 'keep' | 'gain';

export interface CalcProfile {
  sex: Sex;
  birth: string; // YYYY-MM-DD
  h: number; // см
  w: number; // кг
  act: Activity;
  goal: Goal;
}

export interface Target {
  kcal: number;
  p: number; // белок, г
  f: number; // жир, г
  c: number; // углеводы, г
}

/** Базовый обмен по Миффлину-Сан Жеору, ккал/день. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'm' ? base + 5 : base - 161);
}

/** Полных лет на дату. */
export function age(birth: string, on: string): number {
  const [by, bm, bd] = birth.split('-').map(Number) as [number, number, number];
  const [y, m, d] = on.split('-').map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

const FACTORS: Record<Activity, number> = { low: 1.2, light: 1.375, mid: 1.55, high: 1.725 };
/** Коэффициент активности (временный). */
export const factor = (a: Activity): number => FACTORS[a];

const GOAL_DELTA: Record<Goal, number> = { lose: -0.15, keep: 0, gain: 0.1 };

/** Авто-норма по цели (временная): калории от расхода, белок 1,8 г/кг, жир 0,9 г/кг, остальное углеводы. */
export function target(p: CalcProfile, on: string): Target {
  const exp = bmr(p.sex, p.w, p.h, age(p.birth, on)) * factor(p.act);
  const kcal = Math.round(exp * (1 + GOAL_DELTA[p.goal]));
  const prot = Math.round(1.8 * p.w);
  const fat = Math.round(0.9 * p.w);
  const carbs = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return { kcal, p: prot, f: fat, c: carbs };
}

export interface MacroSum {
  kcal: number;
  p: number;
  f: number;
  c: number;
}
/** Сумма КБЖУ по приёмам пищи. */
export function sum(items: Partial<MacroSum>[]): MacroSum {
  const r = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const i of items) for (const k of ['kcal', 'p', 'f', 'c'] as const) r[k] += Number(i[k] ?? 0) || 0;
  return { kcal: Math.round(r.kcal), p: Math.round(r.p), f: Math.round(r.f), c: Math.round(r.c) };
}

/** Доля выполнения 0..1+ (для колец). Норма 0 даёт 0. */
export const ratio = (eaten: number, goal: number): number => (goal > 0 ? eaten / goal : 0);
