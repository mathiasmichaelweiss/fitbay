import { describe, expect, it } from 'vitest';
import g from './golden-pkg.json';
import { finOverview, isLateCancel, pkgSessDefault, pkgUsage, priceNum, type PkgRequest, type SlotLike } from './index';

// Эталоны: запуск pkgSessDefault, pkgUsage, priceNum из прототипа (golden-pkg.json).
describe('пакеты совпадают с прототипом', () => {
  it.each(g.sessDefault.map(([r, v]) => [JSON.stringify(r), r, v] as const))('pkgSessDefault %s', (_, r, v) => expect(pkgSessDefault(r as PkgRequest)).toBe(v));
  it.each(g.usage.map((u) => [u.name, u] as const))('pkgUsage: %s', (_, u) => expect(pkgUsage(u.r as PkgRequest, u.slots as SlotLike[], g.now)).toEqual(u.expected));
  it.each(g.price.map(([p, v]) => [String(p), p, v] as const))('priceNum(%s)', (_, p, v) => expect(priceNum(p)).toBe(v));
});

describe('отмена за 24 часа', () => {
  const now = Date.UTC(2026, 9, 12, 12);
  it('за 25 часов бесплатно', () => expect(isLateCancel(now + 25 * 36e5, now)).toBe(false));
  it('за 23 часа сгорает', () => expect(isLateCancel(now + 23 * 36e5, now)).toBe(true));
  it('ровно 24 часа бесплатно', () => expect(isLateCancel(now + 24 * 36e5, now)).toBe(false));
});

describe('обзор денег (renderFin)', () => {
  const now = new Date(2026, 9, 12, 12).getTime();
  const D = 864e5;
  const reqs: PkgRequest[] = [
    { uid: 'c1', trainer: 't1', name: 'Anna', status: 'accepted', pkg: { price: '550 €' }, sessions: { total: 10 }, answeredAt: now - 5 * D },
    { uid: 'c2', trainer: 't1', name: 'Jonas', status: 'accepted', pkg: { price: '150 €' }, sessions: { total: 3 }, answeredAt: new Date(2026, 8, 20).getTime() },
    { uid: 'c3', trainer: 't1', name: 'Max', status: 'new', pkg: { price: '999 €' } },
  ];
  const slots: SlotLike[] = [
    { trainer: 't1', bookedBy: 'c1', start: now - 2 * D, dur: 60 },
    { trainer: 't1', bookedBy: 'c2', start: now - 3 * D, dur: 60 },
    { trainer: 't1', bookedBy: 'c2', start: now + 3 * 36e5, burned: { at: now } },
  ];
  const f = finOverview(reqs, slots, [{ updatedAt: now - D }, { updatedAt: now - 30 * D }], false, now);
  it('выручка за месяц только по принятым', () => expect(f.revenue).toBe(550));
  it('прошлый месяц', () => expect(f.revenuePrev).toBe(150));
  it('чистыми минус 12,5%', () => expect(f.net).toBeCloseTo(481.25));
  it('партнёр без комиссии', () => expect(finOverview(reqs, slots, [], true, now).net).toBe(550));
  it('6 месяцев, последний текущий', () => expect(f.months.map((x) => x.v)).toEqual([0, 0, 0, 0, 150, 550]));
  it('проведено и сгорело', () => expect([f.done, f.burned]).toEqual([2, 1]));
  it('активные за 14 дней', () => expect([f.activeClients, f.clients]).toEqual([1, 2]));
  it('скоро закончатся: у Jonas 1 из 3', () => expect(f.ending.map((x) => [x.r.name, x.u.left])).toEqual([['Jonas', 1]]));
  it('оплачено вперёд', () => expect(f.prepaid).toBe(9 + 1));
  it('топ по выручке', () => expect(f.top).toEqual([['Anna', 550], ['Jonas', 150]]));
});
