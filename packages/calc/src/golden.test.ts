import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { fatFromDeficit, leanShare, target, type CalcProfile, type Phase } from './index';

// Эталоны сняты запуском CALC прототипа (docs/prototype/kalorii.html). Расхождение = ошибка порта.
describe('target совпадает с прототипом', () => {
  it.each(golden.targets.map((g) => [g.name, g] as const))('%s', (_, g) => {
    const t = target(g.prof as CalcProfile, '2026-10-12', { pct: g.pct, actKcal: g.actKcal, phase: (g as { phase?: Phase }).phase ?? null });
    expect(t).toEqual(g.expected);
  });
});

describe('вспомогательные совпадают с прототипом', () => {
  it.each(golden.misc.leanShare)('leanShare(%d)', (pk, v) => expect(leanShare(pk)).toBeCloseTo(v, 10));
  it.each(golden.misc.fatFromDeficit)('fatFromDeficit(%d, %d)', (d, pk, v) => expect(fatFromDeficit(d, pk)).toBeCloseTo(v, 10));
});
