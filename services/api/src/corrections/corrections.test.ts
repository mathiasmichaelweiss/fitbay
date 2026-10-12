import { describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { MemoryRepo } from '../lib/repo';
import { createServer } from '../local/server';
import { communityHint, personalCorrections, recordCorrection } from './handler';
import { communityHintText, personalHintText } from '../prompts/hints';

describe('A2.6 общая база поправок', () => {
  it('сценарий спеки: 0,42 и 0,44 от двух людей дают 0,43, выброс ×8 отсеян', async () => {
    const main = new MemoryRepo(), shared = new MemoryRepo();
    await recordCorrection(main, shared, 'a', 'Гречка', 100, 42, 1);
    await recordCorrection(main, shared, 'b', 'Гречка', 100, 44, 2);
    await recordCorrection(main, shared, 'c', 'Гречка', 100, 800, 3);
    const h = await communityHint(shared, 'гречка');
    expect(h?.avg).toBeCloseTo(0.43, 10);
    expect(h?.users).toBe(2);
    expect(communityHintText('Гречка', h)).toContain('×0,43');
  });
  it('мелкая разница не пишется ни в личный список, ни в общую базу', async () => {
    const main = new MemoryRepo(), shared = new MemoryRepo();
    expect(await recordCorrection(main, shared, 'a', 'Суп', 300, 310, 1)).toBe(false);
    expect(await shared.query('WCORR')).toHaveLength(0);
  });
  it('личная подсказка: последние 12, текст из прототипа', async () => {
    const main = new MemoryRepo(), shared = new MemoryRepo();
    for (let i = 0; i < 15; i++) await recordCorrection(main, shared, 'a', `Блюдо ${i}`, 100, 200, i);
    const txt = personalHintText(await personalCorrections(main, 'a'));
    expect(txt.match(/оценка 100 г/g)).toHaveLength(12);
    expect(txt).toContain('Блюдо 14: оценка 100 г, на весах 200 г');
  });
  it('HTTP: ответ не выдаёт общую базу, только saved', async () => {
    const main = new MemoryRepo(), shared = new MemoryRepo();
    const srv = createServer(main, { shared });
    await new Promise<void>((ok) => srv.listen(0, () => ok()));
    const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    const r = await fetch(`${base}/me/corrections`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-dev-user': 'a' }, body: JSON.stringify({ dish: 'Плов', est: 300, real: 420 }) });
    expect(await r.json()).toEqual({ saved: true });
    expect(await shared.get('WCORR', 'a')).toBeTruthy();
    expect((await fetch(`${base}/me/corrections`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-dev-user': 'a' }, body: '{}' })).status).toBe(400);
    await new Promise<void>((ok) => srv.close(() => ok()));
  });
});
