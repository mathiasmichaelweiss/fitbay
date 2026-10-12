import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { API, seed } from './helpers';

let uid = '';
test.beforeEach(async ({ page }) => {
  uid = await seed(page);
});
const apiGet = (page: Page, p: string) => page.request.get(`${API}${p}`, { headers: { 'x-dev-user': uid } }).then((r) => r.json());

async function openAdd(page: Page) {
  await page.goto('/');
  await page.getByTestId('add-food').click();
  await expect(page.getByRole('dialog', { name: 'Добавить еду' })).toBeVisible();
}

test('выбор способа: 4 варианта, последний выбранный наверху с меткой', async ({ page }) => {
  await openAdd(page);
  await expect(page.getByRole('radio')).toHaveCount(4);
  await page.getByRole('radio', { name: /Описать словами/ }).click();
  await expect(page.getByRole('dialog', { name: 'Описать словами' })).toBeVisible();
  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByRole('radio').first()).toContainText('последний');
  await expect(page.getByRole('radio').first()).toContainText('Описать словами');
});

test('описать словами: посуда, расчёт ИИ, масштаб, ингредиент, сохранение и поправка веса', async ({ page }) => {
  await openAdd(page);
  await page.getByRole('radio', { name: /Описать словами/ }).click();
  await page.getByRole('button', { name: 'Посчитать' }).click();
  await expect(page.getByRole('alert')).toHaveText('Напиши название или добавь фото.');

  await page.getByLabel('Блюдо').fill('Плов');
  await page.getByRole('button', { name: /Уточнить порцию/ }).click();
  await page.getByRole('radio', { name: 'Глубокая' }).click();
  await page.getByRole('radio', { name: 'L · 26 см' }).click();
  await page.getByRole('radio', { name: 'Полная' }).click();
  await page.getByRole('button', { name: 'Посчитать' }).click();

  const res = page.getByTestId('result');
  await expect(res.getByTestId('res-name')).toHaveText('Тестовое блюдо, ~250 г');
  await expect(res.getByLabel('ккал', { exact: true })).toHaveValue('400');
  await expect(page.getByRole('button', { name: 'Пересчитать' })).toBeVisible();

  // ½ порции: состав и итог масштабируются (scaleAll)
  await res.getByRole('button', { name: '½', exact: true }).click();
  await expect(res.getByLabel('ккал', { exact: true })).toHaveValue('200');
  await expect(res.getByLabel('Вся порция, г')).toHaveValue('125');
  // добавить ингредиент через ИИ
  await res.getByLabel('Добавить: 1 ст. л. масла, 30 г сыра').fill('1 ст. л. масла');
  await res.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(res.getByLabel('Масло', { exact: true })).toHaveValue('10');
  await expect(res.getByLabel('ккал', { exact: true })).toHaveValue('290');

  await res.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('kcal-eaten')).toHaveText('290');

  // ИИ оценил 250 г, сохранено 135 г: поправка записана (разница больше 15%)
  const wc = await apiGet(page, '/me/weight-corrections');
  expect(wc.list[0]).toMatchObject({ n: 'Плов', est: 250, real: 135 });
  // посуда сохранена с блюдом
  const meals = await apiGet(page, '/me/meals');
  expect(meals.items[0].plate).toEqual({ type: 'deep', size: 'L', fill: 'full' });
});

test('фото: превью, расчёт по фото', async ({ page }) => {
  await openAdd(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('radio', { name: /Сфотографировать/ }).click();
  await (await chooser).setFiles(path.join(__dirname, 'plate.jpg'));
  await expect(page.getByRole('button', { name: 'Заменить' })).toBeVisible();
  await page.getByRole('button', { name: 'Посчитать' }).click();
  await expect(page.getByTestId('res-name')).toContainText('Тестовое блюдо');
  await page.getByTestId('result').getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('row')).toHaveCount(1);
  await expect(page.getByTestId('row').locator('img')).toBeVisible(); // миниатюра в списке
});

test('мои блюда: сохранить рецепт, потом добавить из книги на другой вес', async ({ page }) => {
  await openAdd(page);
  await page.getByRole('radio', { name: /Описать словами/ }).click();
  await page.getByLabel('Блюдо').fill('Сырники');
  await page.getByRole('button', { name: 'Посчитать' }).click();
  const res = page.getByTestId('result');
  await res.getByText('Сохранить в мои блюда').click();
  await res.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('kcal-eaten')).toHaveText('400');

  await page.getByTestId('add-food').click();
  await page.getByRole('radio', { name: /Из моих блюд/ }).click();
  await page.getByRole('button', { name: /Тестовое блюдо/ }).first().click();
  await expect(page.getByTestId('res-name')).toHaveText('Тестовое блюдо, ~250 г');
  await page.getByTestId('result').getByLabel('Вся порция, г').fill('125');
  await expect(page.getByTestId('result').getByLabel('ккал', { exact: true })).toHaveValue('200');
  await page.getByTestId('result').getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('kcal-eaten')).toHaveText('600');
  const recs = await apiGet(page, '/me/recipes');
  expect(recs.items[0].used).toBe(2);
  // из книги поправка веса не пишется
  expect((await page.request.get(`${API}/me/weight-corrections`, { headers: { 'x-dev-user': uid } })).status()).toBe(404);
});

test('изменить блюдо: нажать на строку, поправить, сменить приём пищи', async ({ page }) => {
  await openAdd(page);
  await page.getByRole('radio', { name: /Описать словами/ }).click();
  await page.getByLabel('Блюдо').fill('Суп');
  await page.getByRole('button', { name: 'Посчитать' }).click();
  await page.getByTestId('result').getByRole('button', { name: 'Сохранить' }).click();

  await page.getByRole('button', { name: /Изменить блюдо: Тестовое блюдо/ }).click();
  await expect(page.getByRole('dialog', { name: 'Изменить блюдо' })).toBeVisible();
  const res = page.getByTestId('result');
  await res.getByLabel('ккал', { exact: true }).fill('350');
  await res.getByRole('radio', { name: 'Ужин' }).click();
  await res.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('kcal-eaten')).toHaveText('350');
  await expect(page.getByText('УЖИН ·', { exact: false })).toBeVisible();
  expect((await apiGet(page, '/me/meals')).items).toHaveLength(1);
});

test('весь день разом: разбор, снять галочку, добавить в дневник', async ({ page }) => {
  await openAdd(page);
  await page.getByRole('radio', { name: /Весь день разом/ }).click();
  await expect(page.getByRole('dialog', { name: 'Рассказать про день' })).toBeVisible();
  await page.getByRole('button', { name: 'Разобрать' }).click();
  await expect(page.getByRole('alert')).toHaveText('Напиши или надиктуй, что ел.');
  await page.getByLabel('Что ел сегодня').fill('на завтрак омлет, на обед лосось с рисом, днём батончик');
  await page.getByRole('button', { name: 'Разобрать' }).click();
  await expect(page.getByTestId('q-row')).toHaveCount(3);
  await page.getByRole('checkbox', { name: 'Протеиновый батончик' }).click();
  await page.getByRole('button', { name: /Добавить в дневник \(840 kcal\)/ }).click();
  await expect(page.getByTestId('kcal-eaten')).toHaveText('840');
  await expect(page.getByTestId('row')).toHaveCount(2);
});

test('коуч: недоступен без еды, отвечает через ИИ, повторно без новой еды не спрашивает', async ({ page }) => {
  await page.goto('/');
  const ask = page.getByRole('button', { name: 'Спросить коуча' });
  await expect(ask).toBeDisabled();
  await page.getByTestId('add-food').click();
  await page.getByRole('radio', { name: /Описать словами/ }).click();
  await page.getByLabel('Блюдо').fill('Каша');
  await page.getByRole('button', { name: 'Посчитать' }).click();
  await page.getByTestId('result').getByRole('button', { name: 'Сохранить' }).click();

  await ask.click();
  await expect(page.getByTestId('coach')).toHaveText('Тестовый совет коуча.');
  await expect(page.getByTestId('coach-meta')).toContainText('Совет от');
  await page.getByRole('button', { name: 'Обновить совет' }).click();
  await expect(page.getByTestId('coach-meta')).toHaveText('Совет актуален. Новый появится после следующего приема пищи.');
  await page.reload();
  await expect(page.getByTestId('coach')).toHaveText('Тестовый совет коуча.'); // сохранён на сервере
});

test('жир сегодня и календарь с кольцами', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('fat-num')).toBeVisible();
  await page.getByTestId('title').click();
  const cal = page.getByRole('dialog', { name: 'Календарь' });
  await expect(cal).toBeVisible();
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (tomorrow.slice(0, 7) === new Date().toISOString().slice(0, 7)) await expect(cal.getByRole('button', { name: tomorrow })).toBeDisabled();
  d.setDate(d.getDate() - 2);
  const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (y.slice(0, 7) !== new Date().toISOString().slice(0, 7)) await cal.getByRole('button', { name: 'Назад' }).click();
  await cal.getByRole('button', { name: y }).click();
  await expect(cal).toBeHidden();
  await expect(page.getByTestId('add-food')).toContainText('День закрыт');
  await expect(page.getByText('ЖИР ЗА ДЕНЬ', { exact: false })).toBeVisible();
});
