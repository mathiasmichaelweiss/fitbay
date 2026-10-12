import { describe, expect, it } from 'vitest';
import { normItems, p100, recipeAt, recipeFrom, recipeTimes, scaleAll, scaleIt, sumItems } from './logic';

describe('редактор результата (порт прототипа)', () => {
  it('normItems: поддерживает оба формата и выкидывает пустые', () => {
    expect(normItems([{ name: 'Рис', g: 150, kcal: 200, protein: 4 }, { n: '', g: 10 }, { n: 'Соус', g: 0 }])).toEqual([{ n: 'Рис', g: 150, kcal: 200, p: 4, f: 0, c: 0 }]);
    expect(normItems([])).toBeNull();
    expect(normItems('x')).toBeNull();
  });
  it('scaleIt пропорционально', () => expect(scaleIt({ n: 'Рис', g: 100, kcal: 130, p: 3, f: 0, c: 28 }, 200)).toEqual({ n: 'Рис', g: 200, kcal: 260, p: 6, f: 0, c: 56 }));
  it('scaleAll до общего веса', () => {
    const r = scaleAll([{ n: 'a', g: 100, kcal: 100, p: 10, f: 0, c: 0 }, { n: 'b', g: 300, kcal: 300, p: 0, f: 10, c: 0 }], 200);
    expect(sumItems(r)).toEqual({ g: 200, kcal: 200, p: 5, f: 5, c: 0 });
  });
  it('p100 из веса порции', () => expect(p100({ grams: 200, kcal: 300, protein: 20, fat: 10, carbs: 30 })).toEqual({ kcal: 150, protein: 10, fat: 5, carbs: 15 }));
  it('p100 без веса: null', () => expect(p100({ kcal: 300, protein: 20, fat: 10, carbs: 30 })).toBeNull());
  it('блюдо из книги на 150 г', () => {
    const r = recipeAt({ id: 'r', name: 'Плов', grams: 300, kcal: 600, protein: 30, fat: 20, carbs: 60, items: [{ n: 'рис', g: 300, kcal: 600, p: 30, f: 20, c: 60 }] }, 150);
    expect(r).toMatchObject({ grams: 150, kcal: 300, protein: 15 });
    expect((r.items as { g: number }[])[0]!.g).toBe(150);
  });
  it('порция ½ без веса', () => expect(recipeTimes({ id: 'r', name: 'X', kcal: 400, protein: 20, fat: 10, carbs: 40 }, 0.5)).toMatchObject({ kcal: 200, grams: null }));
  it('рецепт из блюда: p100 считается', () => expect(recipeFrom({ date: '2026-10-12', name: 'X', kcal: 200, protein: 10, fat: 5, carbs: 20, grams: 100 } as never).p100).toEqual({ kcal: 200, protein: 10, fat: 5, carbs: 20 }));
});
