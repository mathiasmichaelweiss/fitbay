import type { Meal, Recipe } from '@fitbay/shared';

/** Чистая логика редактора результата (normItems, scaleIt, scaleAll, p100 прототипа). Тестируется отдельно. */
export type It = { n: string; g: number; kcal: number; p: number; f: number; c: number };
export interface Res {
  name: string;
  names?: string[];
  grams?: number | null;
  confidence?: string;
  note?: string;
  items?: unknown;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
}

export function normItems(a: unknown): It[] | null {
  if (!Array.isArray(a) || !a.length) return null;
  const it = a
    .map((x: Record<string, unknown>) => ({
      n: String(x.n || x.name || ''),
      g: +(x.g as number) || 0,
      kcal: +(x.kcal as number) || 0,
      p: +(x.p as number) || +(x.protein as number) || 0,
      f: +(x.f as number) || +(x.fat as number) || 0,
      c: +(x.c as number) || +(x.carbs as number) || 0,
    }))
    .filter((x) => x.n && x.g > 0);
  return it.length ? it : null;
}

export const sumItems = (it: It[]) => {
  const S = (k: keyof It) => it.reduce((a, x) => a + (x[k] as number), 0);
  return { g: S('g'), kcal: S('kcal'), p: S('p'), f: S('f'), c: S('c') };
};

/** Масштабировать ингредиент до нового веса. */
export const scaleIt = (x: It, ng: number): It => (x.g ? { ...x, g: ng, kcal: (x.kcal * ng) / x.g, p: (x.p * ng) / x.g, f: (x.f * ng) / x.g, c: (x.c * ng) / x.g } : x);
/** Масштабировать весь состав до общего веса. */
export const scaleAll = (it: It[], ng: number): It[] => {
  const g = sumItems(it).g;
  return g ? it.map((x) => scaleIt(x, (x.g * ng) / g)) : it;
};

export function p100(r: Pick<Recipe, 'p100' | 'grams' | 'kcal' | 'protein' | 'fat' | 'carbs'>) {
  if (r.p100) return r.p100;
  if (r.grams) return { kcal: (r.kcal * 100) / r.grams, protein: (r.protein * 100) / r.grams, fat: (r.fat * 100) / r.grams, carbs: (r.carbs * 100) / r.grams };
  return null;
}

/** Блюдо из книги на g грамм (useRec прототипа, ветка с весом). */
export function recipeAt(r: Recipe, g: number): Res {
  const h = p100(r)!;
  return {
    name: r.name,
    grams: g,
    items: r.items && r.grams ? r.items.map((x) => ({ ...x, g: (x.g * g) / r.grams!, kcal: (x.kcal * g) / r.grams!, p: (x.p * g) / r.grams!, f: (x.f * g) / r.grams!, c: (x.c * g) / r.grams! })) : null,
    kcal: (h.kcal * g) / 100,
    protein: (h.protein * g) / 100,
    fat: (h.fat * g) / 100,
    carbs: (h.carbs * g) / 100,
  };
}
/** Блюдо из книги порциями, если вес неизвестен. */
export const recipeTimes = (r: Recipe, m: number): Res => ({ name: r.name, grams: r.grams ? r.grams * m : null, kcal: r.kcal * m, protein: r.protein * m, fat: r.fat * m, carbs: r.carbs * m });

/** Рецепт из сохраняемого блюда («Сохранить в мои блюда»). */
export function recipeFrom(m: Omit<Meal, 'id'>): Omit<Recipe, 'id'> {
  const g = m.grams ?? 0;
  return {
    name: m.name, desc: m.desc, items: m.items ?? null, kcal: m.kcal, protein: m.protein, fat: m.fat, carbs: m.carbs, grams: m.grams ?? null,
    p100: g ? { kcal: (m.kcal * 100) / g, protein: (m.protein * 100) / g, fat: (m.fat * 100) / g, carbs: (m.carbs * 100) / g } : null,
    plate: m.plate, thumb: m.thumb, used: 1,
  };
}

/** Часы по слоту для «Весь день разом» (SLOT_H прототипа). */
export const SLOT_H: Record<string, number> = { breakfast: 8, lunch: 13, snack: 16, dinner: 19 };
