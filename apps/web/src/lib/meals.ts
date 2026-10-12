import type { Meal, Slot } from '@fitbay/shared';

export type MealT = Meal & { ts: number };
export interface MealGroup {
  slot: Slot;
  items: MealT[];
  first: number;
  last: number;
  kcal: number;
}

/**
 * groupMeals прототипа: приёмы ближе 20 минут склеиваются; первый кластер дня завтрак,
 * крупные кластеры (≥ max(250, 12% нормы)) обед и ужин, остальное перекусы. Явный slot важнее.
 */
export function groupMeals(list: MealT[], targetK: number): MealGroup[] {
  const ms = [...list].sort((a, b) => a.ts - b.ts);
  const cl: { items: MealT[]; last: number; auto?: Slot }[] = [];
  for (const m of ms) {
    const c = cl[cl.length - 1];
    if (c && m.ts - c.last <= 20 * 60000) {
      c.items.push(m);
      c.last = m.ts;
    } else cl.push({ items: [m], last: m.ts });
  }
  const big = Math.max(250, (targetK || 2000) * 0.12);
  let mains = 0;
  for (const c of cl) {
    const k = c.items.reduce((a, m) => a + (+m.kcal || 0), 0);
    if (mains === 0) {
      c.auto = 'breakfast';
      mains++;
    } else if (k >= big && mains < 3) {
      c.auto = (['breakfast', 'lunch', 'dinner'] as const)[mains];
      mains++;
    } else c.auto = 'snack';
  }
  const out: MealGroup[] = [];
  const map: Record<string, MealGroup> = {};
  cl.forEach((c, ci) =>
    c.items.forEach((m) => {
      const sl = m.slot || c.auto!;
      const key = sl === 'snack' ? `snack${m.slot ? 'm' : ci}` : sl;
      let g = map[key];
      if (!g) {
        g = map[key] = { slot: sl, items: [], first: m.ts, last: m.ts, kcal: 0 };
        out.push(g);
      }
      g.items.push(m);
      g.first = Math.min(g.first, m.ts);
      g.last = Math.max(g.last, m.ts);
      g.kcal += +m.kcal || 0;
    }),
  );
  out.forEach((g) => g.items.sort((a, b) => b.ts - a.ts));
  return out.sort((a, b) => b.last - a.last);
}

export const SLOTN: Record<Slot, string> = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' };
export const withTs = (m: Meal): MealT => ({ ...m, ts: m.createdAt ? Date.parse(m.createdAt) : 0 });
