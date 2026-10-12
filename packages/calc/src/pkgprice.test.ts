import { describe, expect, it } from 'vitest';
import g from './golden-pkgprice.json';
import { pkgPrice, rates, tPrice, type GenCfg } from './pkgprice';

// Эталоны: rates, pkgPrice, tPrice прототипа (scripts/golden-pkgprice.mjs).
describe('генератор пакетов = прототип', () => {
  it.each(g.map((x, i) => [i, x] as const))('тренер #%d', (_, x) => {
    expect(rates(x.t)).toEqual(x.r);
    expect(tPrice(x.t)).toBe(x.tPrice);
    for (const { c, p } of x.prices) expect(pkgPrice(rates(x.t), c as GenCfg)).toEqual(p);
  });
});
