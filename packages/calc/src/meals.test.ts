import { describe, expect, it } from 'vitest';
import { groupMeals, type MealT } from './index';

const at = (h: number, m = 0) => new Date(2026, 9, 12, h, m).getTime();
const meal = (ts: number, kcal: number, slot?: MealT['slot']): MealT =>
  ({ id: String(ts), date: '2026-10-12', name: 'x', kcal, protein: 0, fat: 0, carbs: 0, ts, ...(slot ? { slot } : {}) }) as MealT;

describe('groupMeals (порт прототипа)', () => {
  it('первый приём завтрак, крупные обед и ужин, мелкие перекусы', () => {
    const g = groupMeals([meal(at(8), 400), meal(at(11), 150), meal(at(13), 700), meal(at(19), 600)], 2400);
    expect(g.map((x) => x.slot)).toEqual(['dinner', 'lunch', 'snack', 'breakfast']);
  });
  it('приёмы в пределах 20 минут склеиваются', () => {
    const g = groupMeals([meal(at(8), 300), meal(at(8, 15), 100)], 2000);
    expect(g).toHaveLength(1);
    expect(g[0]!.kcal).toBe(400);
  });
  it('явный слот важнее автоматического', () => {
    const g = groupMeals([meal(at(8), 300, 'lunch')], 2000);
    expect(g[0]!.slot).toBe('lunch');
  });
});
