import { test, expect } from '@playwright/test';
import { seed } from './helpers';

test.beforeEach(({ page }) => seed(page));

test('плитки как в прототипе: калории, белок, добавить еду', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('kcal-eaten')).toHaveText('0');
  await expect(page.getByTestId('kcal-target')).toHaveText(/^2\s?450$/);
  await expect(page.getByText('КРУГИ ПИТАНИЯ')).toBeVisible();
  await expect(page.getByTestId('coach')).toHaveText('День чистый. Начни с белкового завтрака, так проще закрыть средний круг.');
});

test('коуч пересчитывается после еды, удаление возвращает цифры', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('add-food').click();
  await page.getByRole('radio', { name: /Описать словами/ }).click();
  await page.getByLabel('Блюдо').fill('Гречка с курицей');
  await page.getByRole('button', { name: 'Посчитать' }).click();
  await page.getByTestId('result').getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('kcal-eaten')).toHaveText('400');
  await expect(page.getByText('ЗАВТРАК ·', { exact: false })).toBeVisible(); // первый приём дня = завтрак (groupMeals)
  await expect(page.getByTestId('coach')).toHaveText('103г белка до цели. Осталось 2050 ккал, этого хватит.');
  await page.reload();
  await page.getByRole('button', { name: 'Удалить: Тестовое блюдо' }).click();
  await expect(page.getByTestId('kcal-eaten')).toHaveText('0');
});

test('чек-ин: быстрый смайлик заполняет все пункты, плитка показывает итог', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('ci-tile').getByRole('button', { name: '4 / 5' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('radiogroup', { name: 'Сон' }).getByRole('radio', { name: 'Хорошо' })).toHaveAttribute('aria-checked', 'true');
  await sheet.getByRole('radiogroup', { name: 'Стресс' }).getByRole('radio', { name: 'Нет' }).click();
  await sheet.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('САМОЧУВСТВИЕ СЕГОДНЯ')).toBeVisible();
  await expect(page.getByTestId('ci-tile')).toContainText('4,2 из 5');
});

test('чек-ин: пустой нельзя сохранить', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('ci-tile').getByText('Как ты сегодня?').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Отметь хотя бы один пункт.')).toBeVisible();
});

test('вес: запись за сегодня обновляется, а не дублируется', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('fat-tile').click();
  const input = page.getByLabel('Вес сегодня, кг');
  await input.fill('79,4');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await input.fill('79,1');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('row')).toHaveCount(1);
  await expect(page.getByTestId('w-current')).toContainText('79,1');
  await expect(page.getByTestId('w-change')).toContainText('0');
});

test('экран без горизонтального скролла на 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
