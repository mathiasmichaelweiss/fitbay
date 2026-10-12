import { test, expect } from '@playwright/test';

test('онбординг: без согласий дальше нельзя, после заполнения открывается «Сегодня»', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Добро пожаловать в FitBay' })).toBeVisible();
  const next = page.getByRole('button', { name: 'Дальше' });
  await expect(next).toBeDisabled();
  await page.getByText('обработку моих данных о здоровье').click();
  await expect(next).toBeDisabled();
  await page.getByText('политику конфиденциальности').click();
  await next.click();

  await page.getByLabel('Дата рождения').fill('1996-01-01');
  await page.getByLabel('Рост, см').fill('180');
  await page.getByLabel('Вес, кг').fill('80');
  await next.click();

  await page.getByRole('button', { name: 'Средняя' }).click();
  await expect(page.getByText('Ваша норма на день')).toBeVisible();
  await page.getByRole('button', { name: 'Начать' }).click();

  await expect(page.locator('.topbar__title')).toHaveText('Сегодня');
  await page.reload();
  await expect(page.locator('.topbar__title')).toHaveText('Сегодня');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('fitbay.local.v1')!).single.profile);
  expect(saved.consents.health.v).toBe(1);
  expect(saved.consents.trainer).toBeUndefined();
});
