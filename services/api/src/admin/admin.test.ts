import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { MemoryRepo } from '../lib/repo';
import { createServer } from '../local/server';

const NOW = Date.UTC(2026, 9, 12, 10);
const repo = new MemoryRepo();
let base = '';
const srv = createServer(repo, { now: () => NOW });
beforeAll(() => new Promise<void>((ok) => srv.listen(0, () => ((base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`), ok()))));
afterAll(() => new Promise<void>((ok) => srv.close(() => ok())));

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const call = async (method: string, path: string, h: Record<string, string>, body?: unknown): Promise<{ s: number; b: J }> => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...h }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  return { s: r.status, b: t ? JSON.parse(t) : {} };
};
const owner = { 'x-dev-user': 'own', 'x-dev-roles': 'client,trainer,admin' };

describe('A6.1 тестовые пользователи', () => {
  it('только владелец (admin), тренер DE с 4 клиентами открывается через x-act-as, удаляется целиком', async () => {
    expect((await call('GET', '/admin/testusers', { 'x-dev-user': 'x' })).s).toBe(403);
    const made = await call('POST', '/admin/testusers', owner, { kind: 'trainer_de' });
    expect(made.s).toBe(201);
    expect(made.b.uid).toBe(`own~${made.b.id}`);
    const tu = { ...owner, 'x-act-as': made.b.uid, 'x-act-roles': made.b.roles };
    const cl = await call('GET', '/trainer/clients', tu);
    expect(cl.b.items.map((c: J) => c.name).sort()).toEqual(['Anna Schmidt', 'Jonas Becker', 'Lena Hoffmann', 'Max Müller']);
    const anna = cl.b.items.find((c: J) => c.name === 'Anna Schmidt');
    expect(anna.days).toHaveLength(14);
    expect(anna.workouts).toHaveLength(6);
    expect(anna.targets.k).toBeGreaterThan(1000);
    expect(anna.checkins).toHaveLength(14);
    expect((await call('GET', '/me/active-workout', tu)).b.forClient.name).toBe('Lena Hoffmann');
    // чужого пользователя через x-act-as не открыть
    expect((await call('GET', '/me/profile', { ...owner, 'x-act-as': 'someone' })).s).toBe(404); // остался собой, профиля у владельца нет
    expect((await call('GET', '/trainer/clients', { 'x-dev-user': 'own', 'x-dev-roles': 'client', 'x-act-as': made.b.uid, 'x-act-roles': 'trainer' })).s).toBe(403);
    expect((await call('GET', '/admin/testusers', owner)).b.items).toHaveLength(1);
    expect((await call('DELETE', `/admin/testusers/${made.b.id}`, owner)).s).toBe(204);
    expect((await call('GET', '/trainer/clients', tu)).b.items).toHaveLength(0);
    expect((await repo.query(`USER#${made.b.uid}_anna`)).length).toBe(0);
  });
  it('совместная тренировка: занятие «сейчас», live, итог с заметкой видит клиент', async () => {
    const made = await call('POST', '/admin/testusers', owner, { kind: 'trainer_de' });
    const tu = { ...owner, 'x-act-as': made.b.uid, 'x-act-roles': made.b.roles };
    const cid = `${made.b.uid}_max`;
    const sl = await call('POST', '/trainer/slots', tu, { start: NOW, dur: 60, place: 'gym', bookedBy: cid });
    expect(sl.s).toBe(201);
    const id = sl.b.items[0].id;
    expect((await call('POST', `/trainer/slots/${id}/live`, tu, { on: true })).b.live.start).toBe(NOW);
    expect((await call('POST', `/trainer/slots/${id}/session`, tu, { session: { title: 'X', start: NOW, items: [] } })).s).toBe(400);
    const fin = await call('POST', `/trainer/slots/${id}/session`, tu, { session: { title: 'X', start: NOW, items: [{ id: 'Plank', name: 'Planke', sets: [{ r: 60, w: 0 }] }], tags: ['easy'], note: 'gut' } });
    expect(fin.b.live).toBeNull();
    expect(fin.b.tnote).toMatchObject({ tags: ['easy'], note: 'gut', by: 'Lukas Weber' });
    const mine = await call('GET', '/me/bookings', { ...owner, 'x-act-as': cid, 'x-act-roles': 'client' });
    expect(mine.b.items.find((s: J) => s.id === id).session.items).toHaveLength(1);
    // рекомендации и проверку «до и после» тренер пишет, остальное только читает
    expect((await call('PUT', `/users/${cid}/tips`, tu, { items: [] })).s).toBe(200);
    expect((await call('PUT', `/users/${cid}/before-after`, tu, { status: 'verified' })).s).toBe(200);
    expect((await call('PUT', `/users/${cid}/profile`, tu, { w: 1 })).s).toBe(403);
  });
});
