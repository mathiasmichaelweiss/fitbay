import { describe, expect, it } from 'vitest';
import { age, bmr, bonus, dayType, expenditure, factor, flexOf, ratio, sum, target, type CalcProfile } from './index';

const P: CalcProfile = { sex: 'm', birth: '1996-01-01', h: 180, w: 80, act: 3, goal: 'keep' };

describe('age', () => {
  it('день рождения уже был', () => expect(age('1996-03-10', '2026-10-12')).toBe(30));
  it('ещё не был', () => expect(age('1996-11-10', '2026-10-12')).toBe(29));
  it('ровно в день рождения', () => expect(age('1996-10-12', '2026-10-12')).toBe(30));
});

describe('bmr, factor, bonus', () => {
  it('bmr мужчина', () => expect(bmr(P, 80, '2026-10-12')).toBe(1780));
  it('bmr женщина', () => expect(bmr({ ...P, sex: 'f' }, 80, '2026-10-12')).toBe(1614));
  it('bmr по age без даты рождения', () => expect(bmr({ sex: 'm', h: 180, age: 40 }, 80, '2026-10-12')).toBe(1730));
  it('factor ограничен 1.375 при бонусе', () => expect(factor({ act: 5 }, 0.5)).toBe(1.375));
  it('factor без бонуса как есть', () => expect(factor({ act: 5 }, 0)).toBe(1.725));
  it('factor неизвестной активности 1.2', () => expect(factor({ act: 2 as never }, 0)).toBe(1.2));
  it('bonus 50% от 300 = 150', () => expect(bonus(300, 0.5)).toBe(150));
  it('bonus выключен', () => expect(bonus(300, 0)).toBe(0));
  it('bonus округляется до 10', () => expect(bonus(333, 1)).toBe(330));
});

describe('expenditure', () => {
  it('без активности', () => expect(Math.round(expenditure(P, '2026-10-12'))).toBe(2448));
  it('с активностью и другим весом', () => expect(Math.round(expenditure(P, '2026-10-12', { actKcal: 200, pct: 0.5 }, 78))).toBe(2520));
  it('без бонуса полный коэффициент', () => expect(Math.round(expenditure(P, '2026-10-12', { pct: 0 }))).toBe(2759));
});

describe('гибкий план и тип дня', () => {
  const flex = { on: true, days: [1, 3, 5], train: { p: 160, f: 70, c: 250 }, rest: { p: 160, f: 70, c: 150 } };
  it('flexOf профиля', () => expect(flexOf({ ...P, flex })).toBe(flex));
  it('выключенный flex', () => expect(flexOf({ ...P, flex: { ...flex, on: false } })).toBeNull());
  it('flex фазы важнее профиля', () => expect(flexOf({ ...P, flex }, { mode: 'flex', tp: 1, tf: 2, tc: 3, rp: 4, rf: 5, rc: 6 })?.train).toEqual({ p: 1, f: 2, c: 3 }));
  it('фаза без flex отключает flex профиля', () => expect(flexOf({ ...P, flex }, { mode: 'pct', pct: -10 })).toBeNull());
  it('понедельник тренировочный', () => expect(dayType('2026-10-12', P, flex)).toBe('train'));
  it('вторник отдых', () => expect(dayType('2026-10-13', P, flex)).toBe('rest'));
  it('тренировка в журнале делает день тренировочным', () => expect(dayType('2026-10-13', P, flex, true)).toBe('train'));
  it('ручной override сильнее всего', () => expect(dayType('2026-10-12', { ...P, dayOv: { '2026-10-12': 'rest' } }, flex, true)).toBe('rest'));
  it('target по flex: день отдыха', () => {
    const t = target({ ...P, flex }, '2026-10-13');
    expect(t).toMatchObject({ manual: true, dayType: 'rest', p: 160, f: 70, c: 150, k: 1870 });
  });
  it('target по flex: бонус активности добавляется к углеводам', () => {
    const t = target({ ...P, flex }, '2026-10-12', { actKcal: 400 });
    expect(t).toMatchObject({ dayType: 'train', bonus: 200, k: 2470, c: 300 });
  });
});

describe('target: граничные случаи', () => {
  it('пол нормы: не ниже 1200 у женщин', () => expect(target({ sex: 'f', age: 70, h: 150, w: 45, act: 0, goal: 'lose' }, '2026-10-12').base).toBe(1200));
  it('ручные БЖУ с нулями игнорируются', () => expect(target({ ...P, macro: { on: true, p: 0, f: 0, c: 0 } }, '2026-10-12').manual).toBeUndefined());
  it('ручные БЖУ выключены', () => expect(target({ ...P, macro: { on: false, p: 100, f: 50, c: 100 } }, '2026-10-12').manual).toBeUndefined());
});

describe('sum и ratio', () => {
  it('сумма по полям прототипа', () => expect(sum([{ kcal: 100, protein: 10 }, { kcal: 200, fat: 5 }, {}])).toEqual({ k: 300, p: 10, f: 5, c: 0 }));
  it('пустой список', () => expect(sum([])).toEqual({ k: 0, p: 0, f: 0, c: 0 }));
  it('мусор в числах', () => expect(sum([{ kcal: Number('abc') }])).toEqual({ k: 0, p: 0, f: 0, c: 0 }));
  it('ratio', () => {
    expect(ratio(50, 100)).toBe(0.5);
    expect(ratio(150, 100)).toBe(1.5);
    expect(ratio(10, 0)).toBe(0);
  });
});

import { ciAvg, ciBad } from './index';
describe('чек-ин', () => {
  it('ciAvg по отмеченным', () => expect(ciAvg({ sleep: 4, energy: 2 })).toBe(3));
  it('ciAvg пусто', () => expect(ciAvg({})).toBe(0));
  it('ciAvg все шесть', () => expect(ciAvg({ sleep: 5, energy: 5, stress: 5, hunger: 5, pain: 5, adh: 5 })).toBe(5));
  const bad = (date: string) => ({ date, sleep: 2, energy: 2 });
  it('ciBad: три плохих дня подряд', () => expect(ciBad([bad('2026-10-10'), bad('2026-10-11'), bad('2026-10-12')], '2026-10-12')).toBe(true));
  it('ciBad: меньше трёх', () => expect(ciBad([bad('2026-10-11'), bad('2026-10-12')], '2026-10-12')).toBe(false));
  it('ciBad: один нормальный день', () => expect(ciBad([bad('2026-10-10'), { date: '2026-10-11', sleep: 4 }, bad('2026-10-12')], '2026-10-12')).toBe(false));
  it('ciBad: растянуто больше 4 дней', () => expect(ciBad([bad('2026-10-05'), bad('2026-10-11'), bad('2026-10-12')], '2026-10-12')).toBe(false));
  it('ciBad: давно', () => expect(ciBad([bad('2026-10-01'), bad('2026-10-02'), bad('2026-10-03')], '2026-10-12')).toBe(false));
});
