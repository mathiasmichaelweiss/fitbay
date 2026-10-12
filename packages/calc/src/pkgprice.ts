/**
 * Генератор пакетов тренера (rates, volPct, pkgPrice, tPrice прототипа). Эталоны: golden-pkgprice.json.
 */
export interface Rates {
  on: number;
  gym: number;
  food: number;
  dur: Record<number, number>;
  vol: { min: number; pct: number }[];
}
export interface GenCfg {
  freq: number;
  place: 'online' | 'gym';
  months: number;
  food: boolean;
}
type TrainerRates = { rates?: Partial<Omit<Rates, 'dur'>> & { dur?: Record<number, number> }; price?: string };

/** Ставки тренера со значениями по умолчанию (онлайн 30, зал 45, питание 50 €/мес, скидки 3 мес 5%, 6 мес 10%). */
export function rates(t?: TrainerRates | null): Rates {
  const r = t?.rates ?? {};
  return { on: r.on ?? 30, gym: r.gym ?? 45, food: r.food ?? 50, dur: { 3: 5, 6: 10, ...(r.dur ?? {}) }, vol: Array.isArray(r.vol) ? r.vol : [] };
}
/** Скидка за количество: самый большой процент среди порогов, которые пройдены. */
export function volPct(r: Rates, ses: number): number {
  let p = 0;
  for (const v of r.vol ?? []) if (ses >= +v.min && +v.pct > p) p = +v.pct;
  return p;
}
/** Цена пакета: тренировок = частота × 4,33 × месяцы, скидка срок + объём не больше 40%. */
export function pkgPrice(r: Rates, c: GenCfg) {
  const ses = Math.round(c.freq * 4.33 * c.months);
  const per = c.place === 'gym' ? r.gym : r.on;
  const base = ses * per + (c.food ? r.food * c.months : 0);
  const dP = +(r.dur[c.months] || 0);
  const vP = volPct(r, ses);
  const disc = Math.min(0.4, (dP + vP) / 100);
  const total = Math.round(base * (1 - disc));
  return { ses, base: Math.round(base), disc, dP, vP, total, month: Math.round(total / c.months), perSes: ses ? Math.round(total / ses) : 0 };
}
/** «от N €» в каталоге: меньшая из ставок, иначе число из строки цены. */
export function tPrice(t: TrainerRates): number | null {
  const r = t.rates;
  const v = r ? [r.on, r.gym].filter((x): x is number => +(x ?? 0) > 0) : [];
  if (v.length) return Math.min(...v);
  const m = String(t.price || '').match(/\d+/);
  return m ? +m[0] : null;
}
