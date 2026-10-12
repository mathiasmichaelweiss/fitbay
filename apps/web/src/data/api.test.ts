import { beforeEach, describe, expect, it } from 'vitest';
import { localApi } from './api';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  } as Storage;
});

describe('localApi', () => {
  it('профиль: нет, сохранить, прочитать', async () => {
    expect(await localApi.getOne('profile')).toBeNull();
    await localApi.putOne('profile', { w: 80 });
    expect(await localApi.getOne('profile')).toMatchObject({ w: 80 });
  });
  it('еда: создать, фильтр по дню, удалить', async () => {
    const a = await localApi.create<{ id: string; kcal: number }>('meals', { date: '2026-10-12', kcal: 100 });
    await localApi.create('meals', { date: '2026-10-13', kcal: 200 });
    expect(await localApi.list('meals', { from: '2026-10-12', to: '2026-10-12' })).toHaveLength(1);
    await localApi.remove('meals', a.id);
    expect(await localApi.list('meals')).toHaveLength(1);
  });
  it('чек-ин один в день, update по дате создаёт запись', async () => {
    await localApi.create('checkins', { date: '2026-10-12', sleep: 3 });
    await expect(localApi.create('checkins', { date: '2026-10-12' })).rejects.toThrow();
    await localApi.update('checkins', '2026-10-13', { sleep: 5 });
    expect(await localApi.list('checkins')).toHaveLength(2);
  });
  it('данные переживают перезагрузку (лежат в localStorage)', async () => {
    await localApi.putOne('profile', { w: 70 });
    expect(store.get('fitbay.local.v1')).toContain('"w":70');
  });
});
