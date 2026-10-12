import { test, expect } from '@playwright/test';
import { seed } from './helpers';

test.beforeEach(({ page }) => seed(page));

test('еда: добавить вручную, кольцо пересчитывается, удалить', async ({ page }) => {
  await page.goto('/');
  const left = page.getByTestId('kcal-left');
  const before = Number(await left.textContent());
  expect(before).toBeGreaterThan(1000);

  await page.getByRole('button', { name: 'Добавить: Обед' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  await sheet.getByLabel('Название').fill('Гречка с курицей');
  await sheet.getByLabel('Вес, г').fill('350');
  await sheet.getByLabel('Калории').fill('520');
  await sheet.getByLabel('Белки, г').fill('42');
  await sheet.getByRole('button', { name: 'Сохранить' }).click();

  await expect(sheet).toBeHidden();
  await expect(page.getByText('Гречка с курицей')).toBeVisible();
  await expect(left).toHaveText(String(before - 520));

  await page.reload();
  await expect(page.getByText('Гречка с курицей')).toBeVisible();
  await page.getByRole('button', { name: 'Удалить: Гречка с курицей' }).click();
  await expect(left).toHaveText(String(before));
});

test('чек-ин: все шкалы обязательны, после сохранения видно сводку', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Отметить самочувствие' }).click();
  const sheet = page.getByRole('dialog');
  const save = sheet.getByRole('button', { name: 'Сохранить' });
  for (const k of ['Сон', 'Энергия', 'Стресс', 'Голод', 'Боль']) await sheet.getByRole('group', { name: k }).getByRole('button', { name: '4' }).click();
  await expect(save).toBeDisabled();
  await sheet.getByRole('group', { name: 'Соблюдение плана' }).getByRole('button', { name: '5' }).click();
  await save.click();
  await expect(page.getByText('Соблюдение плана 5')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Изменить' })).toBeVisible();
});

test('вес: запись за сегодня обновляется, а не дублируется', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tabbar').getByRole('button', { name: 'Прогресс' }).click();
  const input = page.getByLabel('Вес сегодня, кг');
  await input.fill('79,4');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await input.fill('79,1');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.locator('.meal')).toHaveCount(1);
  await expect(page.locator('.tile').filter({ hasText: 'Сейчас' })).toContainText('79,1');
  await expect(page.locator('.tile').filter({ hasText: 'Изменение' })).toContainText('0');
});

test('экран «Сегодня» без горизонтального скролла на 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
