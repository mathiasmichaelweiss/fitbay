import { test, expect } from '@playwright/test';
import { seed } from './helpers';

test.beforeEach(({ page }) => seed(page));

test('web app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('title')).toHaveText('Сегодня');
  await expect(page.getByTestId('tabbar')).toBeVisible();
});
