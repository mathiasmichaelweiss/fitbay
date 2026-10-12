import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRepo } from '../lib/repo';
import type { Event } from '../lib/http';
import { makeHandler } from './handler';
import { ENTITIES } from './entities';

let repo: MemoryRepo;
let h: ReturnType<typeof makeHandler>;

type Req = { method: string; path: string; uid?: string; roles?: string; body?: unknown; query?: Record<string, string> };

/** Собирает событие HTTP API так же, как API Gateway (маршруты из CDK-стека). */
async function call({ method, path, uid = 'u1', roles = 'client', body, query }: Req) {
  const parts = path.split('/').filter(Boolean);
  const params: Record<string, string> = {};
  let rest = parts;
  if (parts[0] === 'users') {
    params.uid = parts[1]!;
    rest = parts.slice(2);
  } else rest = parts.slice(1); // 'me'
  if (rest[0] && rest[0] !== 'export') params.entity = rest[0];
  if (rest[1]) params.id = rest[1];
  const e = {
    rawPath: path,
    routeKey: `${method} ${path}`,
    requestContext: { http: { method }, authorizer: { lambda: { uid, roles } } },
    pathParameters: params,
    queryStringParameters: query,
    body: body === undefined ? undefined : JSON.stringify(body),
    isBase64Encoded: false,
  } as unknown as Event;
  const r = await h(e);
  return { status: r.statusCode!, body: r.body ? JSON.parse(r.body) : undefined };
}

beforeEach(() => {
  repo = new MemoryRepo();
  h = makeHandler(repo);
});

describe('единичные сущности: PUT, GET, DELETE', () => {
  const singles = Object.entries(ENTITIES).filter(([, v]) => v.kind === 'single').map(([k]) => k);
  it.each(singles)('%s', async (name) => {
    expect((await call({ method: 'GET', path: `/me/${name}` })).status).toBe(404);
    const put = await call({ method: 'PUT', path: `/me/${name}`, body: { a: 1 } });
    expect(put.status).toBe(200);
    const got = await call({ method: 'GET', path: `/me/${name}` });
    expect(got.body.a).toBe(1);
    expect(got.body.PK).toBeUndefined();
    expect((await call({ method: 'DELETE', path: `/me/${name}` })).status).toBe(204);
    expect((await call({ method: 'GET', path: `/me/${name}` })).status).toBe(404);
  });
});

describe('коллекции: POST, список, GET, PUT, DELETE', () => {
  const cols = Object.entries(ENTITIES).filter(([, v]) => v.kind === 'collection').map(([k]) => k);
  it.each(cols)('%s', async (name) => {
    const created = await call({ method: 'POST', path: `/me/${name}`, body: { date: '2026-10-12', kcal: 500 } });
    expect(created.status).toBe(201);
    const id = encodeURIComponent(created.body.id);
    const list = await call({ method: 'GET', path: `/me/${name}` });
    expect(list.body.items).toHaveLength(1);
    expect((await call({ method: 'GET', path: `/me/${name}/${id}` })).body.kcal).toBe(500);
    const upd = await call({ method: 'PUT', path: `/me/${name}/${id}`, body: { kcal: 600 } });
    expect(upd.body.kcal).toBe(600);
    expect(upd.body.createdAt).toBe(created.body.createdAt);
    expect((await call({ method: 'DELETE', path: `/me/${name}/${id}` })).status).toBe(204);
    expect((await call({ method: 'GET', path: `/me/${name}` })).body.items).toHaveLength(0);
  });
});

describe('фильтры и валидация', () => {
  it('еда за период from/to', async () => {
    for (const date of ['2026-10-10', '2026-10-11', '2026-10-12']) await call({ method: 'POST', path: '/me/meals', body: { date } });
    const r = await call({ method: 'GET', path: '/me/meals', query: { from: '2026-10-11', to: '2026-10-11' } });
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].date).toBe('2026-10-11');
  });
  it('чек-ин один в день: второй POST 409, PUT по дате работает как upsert', async () => {
    expect((await call({ method: 'POST', path: '/me/checkins', body: { date: '2026-10-12', sleep: 3 } })).status).toBe(201);
    expect((await call({ method: 'POST', path: '/me/checkins', body: { date: '2026-10-12' } })).status).toBe(409);
    expect((await call({ method: 'PUT', path: '/me/checkins/2026-10-13', body: { sleep: 4 } })).status).toBe(200);
  });
  it('кривая дата: 400', async () => {
    expect((await call({ method: 'POST', path: '/me/meals', body: { date: '12.10.2026' } })).status).toBe(400);
  });
  it('неизвестная сущность: 404', async () => {
    expect((await call({ method: 'GET', path: '/me/secrets' })).status).toBe(404);
  });
  it('нельзя подменить ключи, роль и подписку', async () => {
    await repo.put({ PK: 'USER#u1', SK: 'PROFILE', role: 'client', entitlement: 'trial' });
    await call({ method: 'PUT', path: '/me/profile', body: { PK: 'USER#u2', role: 'admin', entitlement: 'unlimited', w: 80 } });
    const p = await repo.get('USER#u1', 'PROFILE');
    expect(p).toMatchObject({ role: 'client', entitlement: 'trial', w: 80 });
    expect(await repo.get('USER#u2', 'PROFILE')).toBeUndefined();
  });
  it('без контекста авторизации: 401', async () => {
    const e = { rawPath: '/me/profile', requestContext: { http: { method: 'GET' } }, pathParameters: { entity: 'profile' } } as unknown as Event;
    expect((await h(e)).statusCode).toBe(401);
  });
});

describe('права доступа (спека 5.3)', () => {
  beforeEach(async () => {
    await call({ method: 'PUT', path: '/me/profile', uid: 'client1', body: { w: 70 } });
  });
  it('другой клиент читает чужие данные: 403', async () => {
    expect((await call({ method: 'GET', path: '/users/client1/profile', uid: 'u2' })).status).toBe(403);
  });
  it('другой клиент пишет в чужие данные: 403', async () => {
    expect((await call({ method: 'PUT', path: '/users/client1/profile', uid: 'u2', body: { w: 1 } })).status).toBe(403);
  });
  it('тренер без связи: 403', async () => {
    expect((await call({ method: 'GET', path: '/users/client1/profile', uid: 't1', roles: 'trainer' })).status).toBe(403);
  });
  it('тренер со связью, но без согласия: 403', async () => {
    await repo.put({ PK: 'TRAINER#t1', SK: 'CLIENT#client1', consent: false });
    expect((await call({ method: 'GET', path: '/users/client1/profile', uid: 't1', roles: 'trainer' })).status).toBe(403);
  });
  it('тренер со связью и согласием читает, но не пишет', async () => {
    await repo.put({ PK: 'TRAINER#t1', SK: 'CLIENT#client1', consent: true });
    expect((await call({ method: 'GET', path: '/users/client1/profile', uid: 't1', roles: 'trainer' })).body.w).toBe(70);
    expect((await call({ method: 'PUT', path: '/users/client1/profile', uid: 't1', roles: 'trainer', body: {} })).status).toBe(403);
  });
  it('админ читает', async () => {
    expect((await call({ method: 'GET', path: '/users/client1/profile', uid: 'boss', roles: 'admin' })).status).toBe(200);
  });
});

describe('Мои данные: экспорт и удаление', () => {
  it('экспорт отдаёт все записи владельца и ничего чужого', async () => {
    await call({ method: 'PUT', path: '/me/profile', body: { w: 80 } });
    await call({ method: 'POST', path: '/me/meals', body: { date: '2026-10-12', kcal: 300 } });
    await call({ method: 'PUT', path: '/me/profile', uid: 'other', body: { w: 1 } });
    const r = await call({ method: 'GET', path: '/me/export' });
    expect(r.body.items).toHaveLength(2);
    expect(JSON.stringify(r.body)).not.toContain('other');
  });
  it('удаление аккаунта стирает только свои данные', async () => {
    await call({ method: 'PUT', path: '/me/profile', body: { w: 80 } });
    await call({ method: 'POST', path: '/me/meals', body: {} });
    await call({ method: 'PUT', path: '/me/profile', uid: 'other', body: { w: 1 } });
    expect((await call({ method: 'DELETE', path: '/me' })).body.deleted).toBe(2);
    expect(await repo.query('USER#u1')).toHaveLength(0);
    expect(await repo.query('USER#other')).toHaveLength(1);
  });
  it('админ не может удалить чужой аккаунт этим путём', async () => {
    await call({ method: 'PUT', path: '/me/profile', uid: 'c', body: {} });
    expect((await call({ method: 'DELETE', path: '/users/c', uid: 'boss', roles: 'admin' })).status).toBe(403);
  });
});
