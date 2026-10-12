import { test, expect } from '@playwright/test';

test('web app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.topbar__title')).toHaveText('Сегодня');
  await expect(page.locator('.tabbar')).toBeVisible();
});
