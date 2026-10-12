import { test, expect } from '@playwright/test';
import { seed } from './helpers';

test.beforeEach(({ page }) => seed(page));

test('навигация как в прототипе: пилюли Питание / Тренировки, без нижнего меню', async ({ page }) => {
  await page.goto('/');
  const sw = page.getByTestId('modesw');
  await expect(page.getByTestId('tabbar')).toHaveCount(0);
  await expect(sw.getByRole('button')).toHaveCount(2);
  await expect(sw.getByRole('button', { name: 'Питание' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('date')).toBeVisible();
  await sw.getByRole('button', { name: 'Тренировки' }).click();
  await expect(sw.getByRole('button', { name: 'Тренировки' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('date')).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('modesw').getByRole('button', { name: 'Тренировки' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('radio', { name: 'Deutsch' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('modesw')).toContainText('Training');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});

test('тренер видит режим Клиенты с переключателем cabSw', async ({ page }) => {
  await page.goto('/#/trainer');
  await page.getByTestId('modesw').getByRole('button', { name: 'Клиенты' }).click();
  const cl = page.getByTestId('clients');
  await expect(cl.getByRole('radio', { name: 'Расписание' })).toBeVisible();
  await expect(cl.getByRole('radio', { name: 'Обзор' })).toBeVisible();
});
