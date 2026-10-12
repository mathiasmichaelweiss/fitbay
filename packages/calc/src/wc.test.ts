import { describe, expect, it } from 'vitest';
import g from './golden-wc.json';
import { addCorrection, communityFor, communityIndex, wcAgg, wcKey, type WeightCorr } from './index';

describe('поправки веса совпадают с прототипом', () => {
  it.each(g.keys.map(([n, k]) => [n, k] as const))('wcKey(%j)', (n, k) => expect(wcKey(n)).toBe(k));
  it.each(g.agg.map((a) => [a.name, a] as const))('%s', (_, a) => {
    const idx = communityIndex(a.docs as Record<string, WeightCorr[]>);
    const res = wcAgg(idx[a.key]!);
    expect(res.n).toBe(a.expected.n);
    expect(res.users).toBe(a.expected.users);
    expect(res.avg).toBeCloseTo(a.expected.avg, 10);
  });
  it('спека A2.6: 0,42 и 0,44 дают 0,43, выброс ×8 отсеян', () => {
    const idx = communityIndex({ a: [{ n: 'Гречка', est: 100, real: 42, at: 1 }], b: [{ n: 'Гречка', est: 100, real: 44, at: 2 }], c: [{ n: 'Гречка', est: 100, real: 800, at: 3 }] });
    expect(communityFor(idx, 'гречка')?.avg).toBeCloseTo(0.43, 10);
  });
});

describe('addCorrection', () => {
  it('разница меньше 15% не пишется', () => expect(addCorrection([], 'Суп', 300, 320, 1)).toBeNull());
  it('разница больше 15% пишется с округлением', () => expect(addCorrection([], 'Суп', 300.4, 380.6, 1)).toEqual([{ n: 'Суп', est: 300, real: 381, at: 1 }]));
  it('то же блюдо заменяется', () => expect(addCorrection([{ n: 'Суп', est: 1, real: 2, at: 0 }], 'Суп', 300, 400, 1)).toHaveLength(1));
  it('хранятся последние 30', () => {
    const L = Array.from({ length: 30 }, (_, i) => ({ n: `d${i}`, est: 100, real: 200, at: i }));
    const r = addCorrection(L, 'new', 100, 200, 99)!;
    expect(r).toHaveLength(30);
    expect(r[0]!.n).toBe('d1');
    expect(r.at(-1)!.n).toBe('new');
  });
  it('без оценки не пишется', () => expect(addCorrection([], 'X', 0, 200, 1)).toBeNull());
});

describe('communityFor', () => {
  const idx = communityIndex({ a: [{ n: 'Гречка с курицей', est: 100, real: 50, at: 1 }] });
  it('похожее название находится', () => expect(communityFor(idx, 'гречка с курицей и луком')?.n).toBe(1));
  it('короткие ключи не сравниваются вхождением', () => expect(communityFor(communityIndex({ a: [{ n: 'чай', est: 100, real: 50, at: 1 }] }), 'чайник')).toBeNull());
  it('пустое имя', () => expect(communityFor(idx, '')).toBeNull());
});
