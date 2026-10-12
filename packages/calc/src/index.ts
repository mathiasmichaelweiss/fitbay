// @fitbay/calc: единственный источник правды для всех производных чисел (спека 4.1).
// Порт CALC из прототипа kalorii.html делается в задаче A1.1.

export type Sex = 'm' | 'f';

/** Базовый обмен по Миффлину-Сан Жеору, ккал/день. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'm' ? base + 5 : base - 161);
}
