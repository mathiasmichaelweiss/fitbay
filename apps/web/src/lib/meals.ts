import type { Meal } from '@fitbay/shared';
import type { MealT } from '@fitbay/calc';

export { groupMeals, SLOTN, type MealGroup, type MealT } from '@fitbay/calc';
export const withTs = (m: Meal): MealT => ({ ...m, ts: m.ts ?? (m.createdAt ? Date.parse(m.createdAt) : 0) });
