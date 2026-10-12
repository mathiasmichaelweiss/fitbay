import { test, expect, type Page } from '@playwright/test';
import { API, seed } from './helpers';

let uid = '';
test.beforeEach(async ({ page }) => {
  uid = await seed(page);
});
const saved = async (page: Page) => (await page.request.get(`${API}/me/profile`, { headers: { 'x-dev-user': uid } })).json();
const openProf = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Тело и цели' }).click();
  return page.getByRole('dialog', { name: 'Тело и цели' });
};

test('цель «Похудение»: норма из CALC прототипа, срок до цели, сохраняется на главную', async ({ page }) => {
  const d = await openProf(page);
  await expect(d.getByTestId('prof-sum')).toContainText('2450');
  await d.getByRole('radio', { name: 'Похудение' }).click();
  await d.getByLabel('Цель, кг').fill('72');
  await expect(d.getByTestId('prof-sum')).toContainText('2080');
  await expect(d.getByTestId('prof-sum')).toContainText('144г');
  await expect(d.getByTestId('prof-note')).toContainText('До 72 кг примерно 14 нед. в спокойном темпе.');
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('kcal-target')).toHaveText(/^2\s?080$/);
  expect(await saved(page)).toMatchObject({ goal: 'lose', tw: 72 });
});

test('ручные БЖУ: подставляются авто, калории считаются из граммов', async ({ page }) => {
  const d = await openProf(page);
  await d.getByRole('radio', { name: 'Вручную' }).click();
  await expect(d.getByLabel('Белок, г')).toHaveValue('128');
  await d.getByLabel('Белок, г').fill('150');
  await d.getByLabel('Жиры, г').fill('60');
  await d.getByLabel('Углеводы, г').fill('200');
  await expect(d.getByTestId('prof-sum')).toContainText('1940');
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('kcal-target')).toHaveText(/^1\s?940$/);
});

test('гибкий план: дни недели, тип дня на главной переключается вручную', async ({ page }) => {
  const d = await openProf(page);
  await d.getByRole('radio', { name: 'Гибкий' }).click();
  await expect(d.getByRole('radio', { name: 'Вручную' })).toHaveCount(0); // в гибком режиме выбора авто/вручную нет
  // все дни недели тренировочные: сегодня точно тренировка
  for (const wd of ['Вт', 'Чт', 'Сб', 'Вс']) await d.getByRole('group', { name: 'Тренировочные дни недели' }).getByRole('button', { name: wd }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();

  const chip = page.getByTestId('day-type');
  await expect(chip).toHaveText('🏋️ Тренировочный день');
  const trainK = await page.getByTestId('kcal-target').textContent();
  await chip.click();
  await expect(chip).toHaveText('🛋 День отдыха');
  await expect(page.getByTestId('kcal-target')).not.toHaveText(trainK!);
  const p = await saved(page);
  expect(p.flex.days).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(Object.values(p.dayOv)).toEqual(['rest']);
});

test('доля сожжённого и цели активности сохраняются', async ({ page }) => {
  const d = await openProf(page);
  await d.getByRole('radio', { name: '100%' }).click();
  await d.getByLabel('Сжечь, ккал').fill('500');
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(d).toBeHidden();
  expect(await saved(page)).toMatchObject({ actPct: 1, actGoal: { k: 500, m: 30 } });
});

test('настройки: язык и «Пройти знакомство заново»', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('radio', { name: 'Deutsch' }).click();
  await expect(page.getByRole('dialog', { name: 'Einstellungen' })).toBeVisible();
  await page.getByRole('radio', { name: 'Русский' }).click();
  await page.getByRole('button', { name: 'Пройти знакомство заново' }).click();
  await expect(page.getByRole('heading', { name: 'Привет! Это FitBay' })).toBeVisible();
});
