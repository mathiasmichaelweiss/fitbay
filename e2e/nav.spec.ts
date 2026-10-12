import { test, expect } from '@playwright/test';
import { seed } from './helpers';

test.beforeEach(({ page }) => seed(page));

test('4 раздела клиента и переключение языка без перезагрузки', async ({ page }) => {
  await page.goto('/');
  for (const name of ['Сегодня', 'Тренировки', 'Прогресс', 'Тренер']) {
    await page.getByTestId('tabbar').getByRole('button', { name }).click();
    await expect(page.getByTestId('title')).toHaveText(name);
  }
  await page.getByRole('button', { name: 'Язык' }).click();
  await expect(page.getByTestId('tabbar')).toContainText('Heute');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});

test('тренер видит переключатель Я / Кабинет', async ({ page }) => {
  await page.goto('/#/trainer');
  await page.getByRole('radio', { name: 'Кабинет' }).click();
  await expect(page.getByTestId('tabbar')).toContainText('Клиенты');
  await expect(page.getByTestId('tabbar')).toContainText('Расписание');
});
