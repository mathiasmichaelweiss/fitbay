import type { Page } from '@playwright/test';

export const API = 'http://localhost:8787';
export const PROFILE = {
  sex: 'm', birth: '1996-01-15', h: 180, w: 80, tw: 80, act: 3, goal: 'keep', lang: 'ru', path: 'ai',
  consents: { health: { v: 1, at: '2026-10-12T00:00:00Z' } },
};

let n = 0;
/** Новый dev-пользователь на каждый тест: данные тестов не пересекаются в общей локальной базе. */
export async function asNewUser(page: Page, roles = 'client') {
  const uid = `e2e-${Date.now()}-${process.pid}-${n++}`;
  await page.addInitScript(([u, r]) => localStorage.setItem('fitbay.devUser', JSON.stringify({ uid: u, roles: r })), [uid, roles] as const);
  return uid;
}

/** Пользователь с заполненным профилем (онбординг пройден), профиль пишется через локальный API. */
export async function seed(page: Page, roles = 'client') {
  const uid = await asNewUser(page, roles);
  const r = await page.request.put(`${API}/me/profile`, { data: PROFILE, headers: { 'x-dev-user': uid, 'x-dev-roles': roles } });
  if (!r.ok()) throw new Error(`seed failed: ${r.status()}`);
  return uid;
}
