import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryRepo } from '../lib/repo';
import { FileRepo } from '../lib/file-repo';
import { createServer } from './server';
import { resolve } from '../routes';

let base = '';
const server = createServer(new MemoryRepo());
beforeAll(() => new Promise<void>((ok) => server.listen(0, () => ((base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`), ok()))));
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

const req = (method: string, p: string, body?: unknown, user = 'u1', roles = 'client') =>
  fetch(base + p, { method, headers: { 'content-type': 'application/json', 'x-dev-user': user, 'x-dev-roles': roles }, body: body === undefined ? undefined : JSON.stringify(body) });

describe('маршрутизация', () => {
  it('конкретный маршрут важнее шаблона', () => expect(resolve('GET', '/me/export')?.route.path).toBe('/me/export'));
  it('параметры извлекаются', () => expect(resolve('PUT', '/users/u%7C1/meals/2026-10-12%231')?.params).toEqual({ uid: 'u|1', entity: 'meals', id: '2026-10-12#1' }));
  it('неизвестный путь', () => expect(resolve('GET', '/nope')).toBeNull());
});

describe('локальный сервер', () => {
  it('health открыт', async () => expect((await fetch(`${base}/health`)).status).toBe(200));
  it('профиль: PUT и GET через HTTP', async () => {
    expect((await req('PUT', '/me/profile', { w: 80 })).status).toBe(200);
    expect(await (await req('GET', '/me/profile')).json()).toMatchObject({ w: 80 });
  });
  it('у каждого dev-пользователя свои данные', async () => {
    await req('PUT', '/me/profile', { w: 50 }, 'u2');
    expect(await (await req('GET', '/me/profile', undefined, 'u2')).json()).toMatchObject({ w: 50 });
    expect((await req('GET', '/users/u1/profile', undefined, 'u2')).status).toBe(403);
  });
  it('еда за день через query', async () => {
    await req('POST', '/me/meals', { date: '2026-10-12', kcal: 300 });
    const r = (await (await req('GET', '/me/meals?from=2026-10-12&to=2026-10-12')).json()) as { items: unknown[] };
    expect(r.items).toHaveLength(1);
  });
  it('некорректный пользователь: 401', async () => expect((await req('GET', '/me/profile', undefined, 'bad user!')).status).toBe(401));
  it('неизвестный маршрут: 404', async () => expect((await req('GET', '/nope')).status).toBe(404));
  it('CORS для dev-сервера web', async () => {
    const r = await fetch(`${base}/me/profile`, { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(r.headers.get('access-control-allow-headers')).toContain('x-dev-user');
  });
  it('чужой origin не получает CORS', async () => {
    const r = await fetch(`${base}/health`, { headers: { origin: 'https://evil.example' } });
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('FileRepo', () => {
  it('данные переживают перезапуск', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fb-')), 'db.json');
    const a = new FileRepo(file);
    await a.put({ PK: 'USER#x', SK: 'PROFILE', w: 70 });
    const b = new FileRepo(file);
    expect(await b.get('USER#x', 'PROFILE')).toMatchObject({ w: 70 });
    await b.delete('USER#x', 'PROFILE');
    expect(await new FileRepo(file).get('USER#x', 'PROFILE')).toBeUndefined();
  });
});
