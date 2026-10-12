/**
 * Клиент API. Два режима с одинаковым интерфейсом:
 * - local: всё в localStorage браузера (пока нет Auth0 и задеплоенного API);
 * - http: REST из services/api (маршруты /me/...), включается переменной VITE_API_URL.
 * Семантика local повторяет сервер: коллекции с id, «одна запись в день» по дате, единичные сущности.
 */
export type Single = 'profile' | 'plan' | 'tips';
export type Collection = 'meals' | 'measures' | 'checkins' | 'workouts' | 'activities';
type Row = Record<string, unknown> & { id: string };

const BY_DATE: Collection[] = ['measures', 'checkins'];

export interface Api {
  getOne<T>(e: Single): Promise<T | null>;
  putOne<T>(e: Single, data: T): Promise<T>;
  list<T>(e: Collection, range?: { from?: string; to?: string }): Promise<T[]>;
  create<T>(e: Collection, data: Partial<T> & { date: string }): Promise<T>;
  update<T>(e: Collection, id: string, data: Partial<T>): Promise<T>;
  remove(e: Collection, id: string): Promise<void>;
}

const KEY = 'fitbay.local.v1';
type Db = { single: Partial<Record<Single, Row>>; col: Partial<Record<Collection, Row[]>> };

const memory: { db: Db } = { db: { single: {}, col: {} } };
const load = (): Db => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory.db = JSON.parse(raw) as Db;
  } catch {
    /* приватный режим: работаем в памяти */
  }
  return memory.db;
};
const save = (db: Db) => {
  memory.db = db;
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* нет места или приватный режим */
  }
};
const now = () => new Date().toISOString();
const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).slice(0, 13);

export const localApi: Api = {
  async getOne<T>(e: Single) {
    return (load().single[e] as T | undefined) ?? null;
  },
  async putOne<T>(e: Single, data: T) {
    const db = load();
    const prev = db.single[e];
    const row = { ...(data as object), id: e, createdAt: prev?.createdAt ?? now(), updatedAt: now() } as Row;
    db.single[e] = row;
    save(db);
    return row as T;
  },
  async list<T>(e: Collection, range: { from?: string; to?: string } = {}) {
    const rows = load().col[e] ?? [];
    return rows
      .filter((r) => (!range.from || String(r.date) >= range.from) && (!range.to || String(r.date) <= range.to))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt).localeCompare(String(b.createdAt))) as T[];
  },
  async create<T>(e: Collection, data: Partial<T> & { date: string }) {
    const db = load();
    const rows = (db.col[e] ??= []);
    const id = BY_DATE.includes(e) ? data.date : `${data.date}#${uid()}`;
    if (rows.some((r) => r.id === id)) throw new Error('exists');
    const row = { ...(data as object), id, createdAt: now(), updatedAt: now() } as Row;
    rows.push(row);
    save(db);
    return row as T;
  },
  async update<T>(e: Collection, id: string, data: Partial<T>) {
    const db = load();
    const rows = (db.col[e] ??= []);
    const i = rows.findIndex((r) => r.id === id);
    const prev = rows[i];
    if (!prev && !BY_DATE.includes(e)) throw new Error('not found');
    const row = { ...(prev ?? { date: id, createdAt: now() }), ...(data as object), id, updatedAt: now() } as Row;
    if (i >= 0) rows[i] = row;
    else rows.push(row);
    save(db);
    return row as T;
  },
  async remove(e: Collection, id: string) {
    const db = load();
    db.col[e] = (db.col[e] ?? []).filter((r) => r.id !== id);
    save(db);
  },
};

/** HTTP-режим: те же операции поверх /me/... (токен Auth0 подставляется в A2.2). */
export function httpApi(base: string, token: () => Promise<string | null> = async () => null): Api {
  const req = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const t = await token();
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 404 && method === 'GET') return null as T;
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
    return (r.status === 204 ? undefined : await r.json()) as T;
  };
  return {
    getOne: (e) => req('GET', `/me/${e}`),
    putOne: (e, d) => req('PUT', `/me/${e}`, d),
    list: async (e, range = {}) => {
      const q = new URLSearchParams(Object.entries(range).filter(([, v]) => v) as [string, string][]);
      return (await req<{ items: never[] }>('GET', `/me/${e}${q.size ? `?${q}` : ''}`)).items;
    },
    create: (e, d) => req('POST', `/me/${e}`, d),
    update: (e, id, d) => req('PUT', `/me/${e}/${encodeURIComponent(id)}`, d),
    remove: (e, id) => req('DELETE', `/me/${e}/${encodeURIComponent(id)}`),
  };
}

const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
export const api: Api = apiUrl ? httpApi(apiUrl) : localApi;
export const API_MODE = apiUrl ? 'http' : 'local';
