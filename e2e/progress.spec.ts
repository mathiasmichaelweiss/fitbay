import { test, expect } from '@playwright/test';
import path from 'node:path';
import { seed } from './helpers';

test.beforeEach(({ page }) => seed(page));

test('напоминание о замерах ведет к замерам, история с разницей, «Позже» прячет', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('ms-remind')).toContainText('Пора замериться');
  await page.getByTestId('ms-remind').click();
  const ms = page.getByTestId('ms-card');
  await ms.getByLabel('Талия').fill('90');
  await ms.getByRole('button', { name: 'Сохранить замер за сегодня' }).click();
  await expect(ms.getByTestId('ms-hist')).toContainText('Талия 90');
  await ms.getByLabel('Талия').fill('89.5');
  await ms.getByLabel('Вес, кг').fill('79');
  await ms.getByRole('button', { name: 'Сохранить замер за сегодня' }).click();
  await expect(ms.getByTestId('ms-hist')).toContainText('Вес 79 · Талия 89,5');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('ms-remind')).toHaveCount(0);
});

test('«Позже» откладывает напоминание', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('ms-remind').getByRole('button', { name: 'Позже' }).click();
  await expect(page.getByTestId('ms-remind')).toHaveCount(0);
});

test('до и после: оба фото обязательны, отправка на проверку, удаление', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Тело и цели' }).click();
  const ba = page.getByTestId('ba-card');
  await ba.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(ba.getByRole('alert')).toHaveText('Добавь оба фото: до и после.');
  const img = path.join(__dirname, 'plate.jpg');
  const pick = async (n: number) => {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), ba.getByRole('button', { name: 'Добавить фото' }).nth(n).click()]);
    await fc.setFiles(img);
  };
  await pick(0);
  await expect(ba.getByRole('img', { name: 'До' })).toBeVisible();
  await pick(0);
  await expect(ba.getByRole('img', { name: 'После' })).toBeVisible();
  await ba.getByText('Скрыть лицо при публикации').click();
  await ba.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(ba).toContainText('Статус: На проверке');
  await ba.getByRole('button', { name: 'Удалить фото и отозвать согласие' }).click();
  await page.getByTestId('confirm').getByRole('button', { name: 'Удалить' }).click();
  await expect(ba).toContainText('Статус: Черновик');
});

test('тепловая карта самочувствия: день по нажатию', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('ci-tile').getByText('🙂').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click();
  await page.getByTestId('ci-tile').click();
  const grid = page.getByTestId('ci-grid');
  await expect(grid).toBeVisible();
  await grid.getByRole('button', { name: '🙂' }).click();
  await expect(page.getByTestId('ci-day')).toContainText('4,0');
});
