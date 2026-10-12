import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { MemoryRepo } from '../lib/repo';
import { createServer } from '../local/server';

const H = 36e5;
let NOW = Date.UTC(2026, 9, 12, 10);
let repo = new MemoryRepo();
let base = '';
let srv: ReturnType<typeof createServer> | undefined;
afterAll(() => new Promise<void>((ok) => (srv ? srv.close(() => ok()) : ok())));

async function start() {
  if (srv) await new Promise<void>((ok) => srv!.close(() => ok()));
  repo = new MemoryRepo();
  const s = createServer(repo, { now: () => NOW });
  srv = s;
  await new Promise<void>((ok) => s.listen(0, () => ((base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`), ok())));
}
beforeEach(async () => {
  NOW = Date.UTC(2026, 9, 12, 10);
  await start();
});

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const as = (uid: string, roles = 'client') => async (method: string, path: string, body?: unknown): Promise<{ s: number; b: J }> => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-dev-user': uid, 'x-dev-roles': roles }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  return { s: r.status, b: t ? JSON.parse(t) : {} };
};
const trainer = as('t1', 'trainer');
const anna = as('anna');
const jonas = as('jonas');

async function setupTrainer() {
  await trainer('PUT', '/trainer/profile', { name: 'Andrej', packages: [{ id: 'p1', name: 'Personal Training, 10 Einheiten', price: '550 €' }] });
}
async function slot(startOffsetH: number) {
  const r = await trainer('POST', '/trainer/slots', { start: NOW + startOffsetH * H, dur: 60, place: 'gym', addr: 'Fitness First' });
  return r.b.items[0].id as string;
}
const enc = encodeURIComponent;

describe('профиль и каталог', () => {
  it('клиент не может в кабинет тренера', async () => expect((await anna('GET', '/trainer/slots')).s).toBe(403));
  it('тренер появляется в каталоге, скрытый нет', async () => {
    await setupTrainer();
    expect((await anna('GET', '/trainers')).b.items.map((t: J) => t.name)).toEqual(['Andrej']);
    await trainer('PUT', '/trainer/profile', { name: 'Andrej', hidden: true });
    expect((await anna('GET', '/trainers')).b.items).toHaveLength(0);
  });
  it('код только у партнёра, поиск по коду, код занят', async () => {
    await trainer('PUT', '/trainer/profile', { name: 'Solo', code: 'SOLO' });
    expect((await anna('GET', '/trainers/by-code/SOLO')).s).toBe(404);
    await as('t2', 'partner')('PUT', '/trainer/profile', { name: 'Брат', code: 'andrej' });
    expect((await anna('GET', '/trainers/by-code/ANDREJ')).b.name).toBe('Брат');
    expect((await as('t3', 'partner')('PUT', '/trainer/profile', { name: 'X', code: 'ANDREJ' })).s).toBe(409);
    expect((await anna('GET', '/trainers')).b.items.every((t: J) => !('code' in t))).toBe(true);
  });
});

describe('запись (bookSlot)', () => {
  it('два параллельных бронирования одного слота дают одну бронь (спека A2.4)', async () => {
    await setupTrainer();
    const id = await slot(48);
    const users = Array.from({ length: 10 }, (_, i) => as(`c${i}`));
    const res = await Promise.all(users.map((u, i) => u('POST', `/trainers/t1/slots/${enc(id)}/book`, { name: `C${i}` })));
    expect(res.filter((r) => r.s === 200)).toHaveLength(1);
    expect(res.filter((r) => r.s === 409)).toHaveLength(9);
  });
  it('без имени нельзя', async () => {
    await setupTrainer();
    const id = await slot(48);
    expect((await anna('POST', `/trainers/t1/slots/${enc(id)}/book`, { name: ' ' })).b.error).toBe('Напиши, как тебя записать.');
  });
  it('клиент видит свободные окна и свои записи, но не чужие имена', async () => {
    await setupTrainer();
    const a = await slot(48), b = await slot(50);
    await anna('POST', `/trainers/t1/slots/${enc(a)}/book`, { name: 'Anna' });
    const forJonas = (await jonas('GET', '/trainers/t1/slots')).b.items;
    expect(forJonas.map((s: J) => s.id)).toEqual([b]);
    const forAnna = (await anna('GET', '/trainers/t1/slots')).b.items;
    expect(forAnna.find((s: J) => s.id === a).bookedName).toBe('Anna');
    expect((await anna('GET', '/me/bookings')).b.items).toHaveLength(1);
  });
  it('тренер получает уведомление о записи', async () => {
    await setupTrainer();
    await anna('POST', `/trainers/t1/slots/${enc(await slot(48))}/book`, { name: 'Anna' });
    expect((await trainer('GET', '/me/notifications')).b.items[0]).toMatchObject({ type: 'booked', name: 'Anna' });
  });
});

describe('отмена (правило 24 часов)', () => {
  it('за 48 часов бесплатно: слот снова свободен, тренеру причина', async () => {
    await setupTrainer();
    const id = await slot(48);
    await anna('POST', `/trainers/t1/slots/${enc(id)}/book`, { name: 'Anna' });
    const r = await anna('POST', `/trainers/t1/slots/${enc(id)}/cancel`, { reason: 'заболела' });
    expect(r.b.late).toBe(false);
    expect(r.b.slot.bookedBy).toBeNull();
    expect((await trainer('GET', '/me/notifications')).b.items[0]).toMatchObject({ type: 'cancel', by: 'client', reason: 'заболела' });
  });
  it('за 5 часов сгорает и спишется из пакета', async () => {
    await setupTrainer();
    const id = await slot(5);
    await anna('POST', `/trainers/t1/slots/${enc(id)}/book`, { name: 'Anna' });
    const r = await anna('POST', `/trainers/t1/slots/${enc(id)}/cancel`, {});
    expect(r.b.late).toBe(true);
    expect(r.b.slot.burned).toBeTruthy();
    expect(r.b.slot.bookedBy).toBe('anna');
    expect((await trainer('GET', '/me/notifications')).b.items[0].type).toBe('burned');
  });
  it('тренер отменяет: занятие остаётся у клиента, клиент получает причину', async () => {
    await setupTrainer();
    const id = await slot(5);
    await anna('PUT', '/trainers/t1/link', { consent: true });
    await anna('POST', `/trainers/t1/slots/${enc(id)}/book`, { name: 'Anna' });
    await trainer('POST', `/trainer/slots/${enc(id)}/cancel`, { reason: 'заболел' });
    const n = (await anna('GET', '/me/notifications')).b.items[0];
    expect(n).toMatchObject({ type: 'cancel', by: 'trainer', reason: 'заболел' });
    expect((await anna('GET', '/me/bookings')).b.cancelled[0].cancel.reason).toBe('заболел');
  });
  it('занятый слот тренер не удаляет, свободный удаляет', async () => {
    await setupTrainer();
    const a = await slot(48), b = await slot(50);
    await anna('POST', `/trainers/t1/slots/${enc(a)}/book`, { name: 'Anna' });
    expect((await trainer('DELETE', `/trainer/slots/${enc(a)}`)).s).toBe(409);
    expect((await trainer('DELETE', `/trainer/slots/${enc(b)}`)).s).toBe(204);
  });
});

describe('заявки, пакет и счётчик (cabPkgClick, pkgUsage)', () => {
  async function accepted(sessions?: number) {
    await setupTrainer();
    const rq = await anna('POST', '/trainers/t1/requests', { name: 'Anna', contact: '@anna', pkg: { id: 'p1', name: 'Personal Training, 10 Einheiten', price: '550 €' } });
    expect(rq.s).toBe(201);
    const ans = await trainer('POST', `/trainer/requests/${enc(rq.b.id)}/answer`, { accept: true, ...(sessions ? { sessions } : {}) });
    return ans.b;
  }
  it('без контакта заявку не отправить', async () => {
    await setupTrainer();
    expect((await anna('POST', '/trainers/t1/requests', { pkg: { id: 'p1' } })).b.error).toBe('Напиши, как с тобой связаться.');
  });
  it('принятие: число занятий по умолчанию из названия пакета (10 Einheiten)', async () => {
    expect((await accepted()).sessions.total).toBe(10);
    expect((await anna('GET', '/me/notifications')).b.items[0]).toMatchObject({ type: 'req_accepted', sessions: 10 });
  });
  it('повторно ответить нельзя', async () => {
    const r = await accepted(3);
    expect((await trainer('POST', `/trainer/requests/${enc(r.id)}/answer`, { accept: false })).s).toBe(409);
  });
  it('автосписание: прошедшее занятие уменьшает остаток', async () => {
    await accepted(3);
    const id = await slot(2);
    await anna('POST', `/trainers/t1/slots/${enc(id)}/book`, { name: 'Anna' });
    expect((await anna('GET', '/me/requests')).b.items[0].usage).toMatchObject({ tot: 3, used: 0, left: 3 });
    NOW += 4 * H; // занятие прошло
    expect((await anna('GET', '/me/requests')).b.items[0].usage).toMatchObject({ used: 1, left: 2 });
  });
  it('ручное списание и возврат: журнал и уведомление клиенту', async () => {
    const r = await accepted(5);
    await trainer('POST', `/trainer/requests/${enc(r.id)}/adjust`, { d: 1 });
    const after = (await trainer('POST', `/trainer/requests/${enc(r.id)}/adjust`, { d: -1 })).b;
    expect(after.adj).toBe(0);
    expect(after.log.map((x: J) => x.d)).toEqual([1, -1]);
    expect(after.log[0].by).toBe('Andrej');
    const types = (await anna('GET', '/me/notifications')).b.items.map((n: J) => n.type);
    expect(types.slice(0, 2)).toEqual(['sess_returned', 'sess_charged']);
  });
  it('шаг списания только ±1', async () => {
    const r = await accepted(5);
    expect((await trainer('POST', `/trainer/requests/${enc(r.id)}/adjust`, { d: 5 })).s).toBe(400);
  });
  it('параллельные списания не теряются (оптимистичная блокировка)', async () => {
    const r = await accepted(10);
    const res = await Promise.all(Array.from({ length: 5 }, () => trainer('POST', `/trainer/requests/${enc(r.id)}/adjust`, { d: 1 })));
    const ok = res.filter((x) => x.s === 200).length;
    const final = (await trainer('GET', '/trainer/requests')).b.items[0];
    expect(final.adj).toBe(ok); // сколько прошло, столько и списано, без потерь
    expect(final.log).toHaveLength(ok);
  });
  it('чужой тренер не видит и не трогает заявку', async () => {
    const r = await accepted(5);
    expect((await as('t9', 'trainer')('POST', `/trainer/requests/${enc(r.id)}/adjust`, { d: 1 })).s).toBe(404);
  });
});

describe('связь клиент-тренер и доступ к данным', () => {
  it('без согласия тренер не читает данные, с согласием читает, после отзыва снова нет', async () => {
    await setupTrainer();
    await anna('PUT', '/me/profile', { w: 63 });
    await anna('PUT', '/trainers/t1/link', { consent: false });
    expect((await trainer('GET', '/users/anna/profile')).s).toBe(403);
    await anna('PUT', '/trainers/t1/link', { consent: true });
    expect((await trainer('GET', '/users/anna/profile')).b.w).toBe(63);
    expect((await trainer('GET', '/trainer/clients')).b.items).toHaveLength(1);
    await anna('DELETE', '/trainers/t1/link');
    expect((await trainer('GET', '/users/anna/profile')).s).toBe(403);
  });
});

describe('обзор денег', () => {
  it('выручка, чистыми с комиссией 12,5%, оплачено вперёд', async () => {
    await setupTrainer();
    const rq = await anna('POST', '/trainers/t1/requests', { name: 'Anna', contact: '@a', pkg: { id: 'p1', name: '10 Einheiten', price: '550 €' } });
    await trainer('POST', `/trainer/requests/${enc(rq.b.id)}/answer`, { accept: true });
    const f = (await trainer('GET', '/trainer/overview')).b;
    expect(f.revenue).toBe(550);
    expect(f.net).toBeCloseTo(481.25);
    expect(f.prepaid).toBe(10);
  });
});

