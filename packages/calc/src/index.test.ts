import { describe, expect, it } from 'vitest';
import { age, bmr, factor, ratio, sum, target, type CalcProfile } from './index';

describe('bmr', () => {
  it('мужчина', () => expect(bmr('m', 80, 180, 30)).toBe(1780));
  it('женщина', () => expect(bmr('f', 60, 165, 30)).toBe(1320));
  it('граничный: возраст 0', () => expect(bmr('m', 0, 0, 0)).toBe(5));
});

describe('age', () => {
  it('день рождения уже был', () => expect(age('1996-03-10', '2026-10-12')).toBe(30));
  it('день рождения ещё не был', () => expect(age('1996-11-10', '2026-10-12')).toBe(29));
  it('ровно в день рождения', () => expect(age('1996-10-12', '2026-10-12')).toBe(30));
});

describe('factor', () => {
  it('минимум', () => expect(factor('low')).toBe(1.2));
  it('средняя', () => expect(factor('mid')).toBe(1.55));
  it('высокая', () => expect(factor('high')).toBe(1.725));
});

describe('target', () => {
  const p: CalcProfile = { sex: 'm', birth: '1996-01-01', h: 180, w: 80, act: 'mid', goal: 'keep' };
  it('удержание = расход', () => expect(target(p, '2026-10-12')).toEqual({ kcal: 2759, p: 144, f: 72, c: 384 }));
  it('сушка ниже удержания на 15%', () => expect(target({ ...p, goal: 'lose' }, '2026-10-12').kcal).toBe(2345));
  it('набор выше на 10%', () => expect(target({ ...p, goal: 'gain' }, '2026-10-12').kcal).toBe(3035));
  it('углеводы не уходят в минус', () => expect(target({ ...p, w: 300, act: 'low', goal: 'lose' }, '2026-10-12').c).toBe(0));
});

describe('sum и ratio', () => {
  it('сумма с пустыми полями', () => expect(sum([{ kcal: 100.4, p: 10 }, { kcal: 200, f: 5 }, {}])).toEqual({ kcal: 300, p: 10, f: 5, c: 0 }));
  it('пустой список', () => expect(sum([])).toEqual({ kcal: 0, p: 0, f: 0, c: 0 }));
  it('мусор в числах', () => expect(sum([{ kcal: Number('abc') }])).toEqual({ kcal: 0, p: 0, f: 0, c: 0 }));
  it('ratio', () => {
    expect(ratio(50, 100)).toBe(0.5);
    expect(ratio(150, 100)).toBe(1.5);
    expect(ratio(10, 0)).toBe(0);
  });
});
