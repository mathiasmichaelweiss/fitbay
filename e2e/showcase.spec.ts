import { test, expect } from '@playwright/test';

test('витрина: без горизонтального скролла на 390 px, поля 16 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ui');
  await expect(page.getByRole('heading', { name: 'Витрина компонентов' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  const fs = await page.locator('input').first().evaluate((el) => getComputedStyle(el).fontSize);
  expect(fs).toBe('16px');
  await page.getByRole('button', { name: 'Открыть шторку' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('витрина открывается из шапки в режиме разработки', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'UI kit' }).click();
  await expect(page).toHaveURL(/\/ui$/);
  await expect(page.getByRole('heading', { name: 'Витрина компонентов' })).toBeVisible();
});
