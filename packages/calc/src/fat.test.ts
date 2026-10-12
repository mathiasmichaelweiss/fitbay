import { describe, expect, it } from 'vitest';
import g from './golden-fat.json';
import { dayStats, proj, weightOn, type CalcProfile } from './index';

// Эталоны: dayStats и proj прототипа на тех же данных (golden-fat.json).
describe('жир за день и прогноз совпадают с прототипом', () => {
  it.each(g.map((c) => [c.name, c] as const))('%s', (_, c) => {
    const act = Object.fromEntries((c.acts as { date: string; kcal: number }[]).map((a) => [a.date, a.kcal]));
    const D = dayStats(c.meals, c.prof as CalcProfile, c.day, c.weights, act, c.pct);
    expect(D).toHaveLength(c.expected.D.length);
    D.forEach((x, i) => {
      const e = c.expected.D[i]!;
      expect(x.d).toBe(e.d);
      for (const k of ['eat', 'prot', 'pk', 'ls', 'tdee', 'def', 'fat'] as const) expect(x[k]).toBeCloseTo(e[k], 9);
    });
    const P = proj(D, '2026-10-12');
    if (!c.expected.P) expect(P).toBeNull();
    else {
      expect(P!.n).toBe(c.expected.P.n);
      expect(P!.avg).toBeCloseTo(c.expected.P.avg, 9);
      expect(P!.month).toBeCloseTo(c.expected.P.month, 9);
    }
  });
});

describe('weightOn', () => {
  const W = [{ date: '2026-10-09', w: 80.2 }, { date: '2026-10-01', w: 81 }];
  it('последнее взвешивание до дня', () => expect(weightOn(W, '2026-10-05', 90)).toBe(81));
  it('после всех', () => expect(weightOn(W, '2026-10-12', 90)).toBe(80.2));
  it('до первого: вес профиля', () => expect(weightOn(W, '2026-09-01', 90)).toBe(90));
});
