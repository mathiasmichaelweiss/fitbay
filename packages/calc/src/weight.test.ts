import { describe, expect, it } from 'vitest';
import g from './golden-weight.json';
import { weightAnalyze, type WeightPoint } from './weight';

// Эталоны: WEIGHT.analyze прототипа на тех же данных (scripts/golden-weight.mjs).
describe('weightAnalyze = WEIGHT.analyze прототипа', () => {
  it.each(g.map((c) => [c.name, c] as const))('%s', (_, c) => {
    const r = weightAnalyze(c.D, c.prev as WeightPoint, c.newW, c.newDate, c.wos, [...c.meals].sort()[0]);
    for (const [k, v] of Object.entries(c.v)) typeof v === 'number' ? expect(r[k as keyof typeof r]).toBeCloseTo(v, 9) : expect(r[k as keyof typeof r]).toBe(v);
  });
});
