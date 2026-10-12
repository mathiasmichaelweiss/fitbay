import type { Page } from '@playwright/test';

export const PROFILE = {
  id: 'profile', sex: 'm', birth: '1996-01-01', h: 180, w: 80, act: 'mid', goal: 'keep', lang: 'ru',
  consents: { health: { v: 1, at: '2026-10-12T00:00:00Z' }, privacy: { v: 1, at: '2026-10-12T00:00:00Z' } },
};

/** Локальные данные до загрузки страницы (режим local API). */
export async function seed(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([db]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('fitbay.local.v1', JSON.stringify(db));
        sessionStorage.setItem('seeded', '1');
      }
    },
    [{ single: { profile: PROFILE }, col: {}, ...extra }],
  );
}
