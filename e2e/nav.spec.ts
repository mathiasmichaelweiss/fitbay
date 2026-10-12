import { test, expect } from '@playwright/test';

test('4 раздела клиента и переключение языка без перезагрузки', async ({ page }) => {
  await page.goto('/');
  for (const name of ['Сегодня', 'Тренировки', 'Прогресс', 'Тренер']) {
    await page.locator('.tabbar').getByRole('button', { name }).click();
    await expect(page.locator('.topbar__title')).toHaveText(name);
  }
  await page.getByRole('button', { name: 'Язык' }).click();
  await expect(page.locator('.tabbar')).toContainText('Heute');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});

test('тренер видит переключатель Я / Кабинет', async ({ page }) => {
  await page.goto('/#/trainer');
  await page.getByRole('button', { name: 'Кабинет' }).click();
  await expect(page.locator('.tabbar')).toContainText('Клиенты');
  await expect(page.locator('.tabbar')).toContainText('Расписание');
});
