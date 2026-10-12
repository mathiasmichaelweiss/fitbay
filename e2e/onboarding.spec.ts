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

  // кастомный пикер: шторка, год и месяц через свой Select, день в календаре
  await page.getByRole('button', { name: 'Дата рождения' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toHaveCSS('transform', 'none'); // шторка доехала
  await drawer.getByRole('combobox', { name: /year|год/i }).click();
  await page.getByRole('option', { name: '1996' }).click();
  await drawer.getByRole('combobox', { name: /month|месяц/i }).click();
  await page.getByRole('option', { name: /январь/i }).click();
  await drawer.getByRole('button', { name: /15 января 1996/i }).click();
  await drawer.getByRole('button', { name: 'Готово' }).click();
  await expect(page.getByRole('button', { name: 'Дата рождения' })).toContainText('15 января 1996');
  await page.getByLabel('Рост, см').fill('180');
  await page.getByLabel('Вес, кг').fill('80');
  await next.click();

  await page.getByRole('radio', { name: 'Средняя' }).click();
  await expect(page.getByText('Ваша норма на день')).toBeVisible();
  await page.getByRole('button', { name: 'Начать' }).click();

  await expect(page.getByTestId('title')).toHaveText('Сегодня');
  await page.reload();
  await expect(page.getByTestId('title')).toHaveText('Сегодня');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('fitbay.local.v1')!).single.profile);
  expect(saved.consents.health.v).toBe(1);
  expect(saved.birth).toBe('1996-01-15');
  expect(saved.consents.trainer).toBeUndefined();
});
