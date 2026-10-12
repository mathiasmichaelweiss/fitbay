import { test, expect, type Page } from '@playwright/test';
import { seed } from './helpers';

test.beforeEach(({ page }) => seed(page));

const openTrain = async (page: Page) => {
  await page.goto('/');
  await page.getByTestId('modesw').getByRole('button', { name: 'Тренировки' }).click();
  await expect(page.getByTestId('t-lib')).toContainText('876');
};
/** Добавить упражнение из библиотеки по поиску (лист тренировки открыт). */
const addEx = async (page: Page, q: string, name: string) => {
  await page.getByRole('button', { name: '+ Упражнение' }).click();
  const lib = page.getByRole('dialog', { name: 'Библиотека упражнений' });
  await lib.getByLabel('Поиск упражнения').fill(q);
  await lib.getByTestId('exrow').filter({ hasText: name }).first().getByRole('button', { name: 'Добавить' }).click();
};

test('библиотека: группы, оборудование, поиск, карточка упражнения', async ({ page }) => {
  await openTrain(page);
  await page.getByTestId('t-lib').click();
  const lib = page.getByRole('dialog', { name: 'Библиотека упражнений' });
  await expect(lib.getByTestId('lib-count')).toHaveText('876 упражнений');
  await lib.getByRole('radio', { name: 'Грудь' }).click();
  await expect(lib.getByTestId('lib-count')).toHaveText('84 упражнений');
  await lib.getByRole('radio', { name: 'Все' }).click();
  await lib.getByLabel('Поиск упражнения').fill('жим');
  await expect(lib.getByTestId('lib-count')).toHaveText('8 упражнений');
  await lib.getByText('Жим штанги лежа').click();
  const ex = page.getByRole('dialog', { name: 'Жим штанги лежа' });
  await expect(ex.getByText('Основные мышцы:')).toBeVisible();
  await expect(ex.getByText('Техника')).toBeVisible();
  await expect(ex.getByRole('button', { name: 'Начать тренировку с этим упражнением' })).toBeVisible();
});

test('тренировка: подходы, «прошлый раз», завершение, история, счетчик недели', async ({ page }) => {
  await openTrain(page);
  await page.getByTestId('t-start').click();
  const wo = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Завершить тренировку' }) });
  await expect(wo.getByText('Добавь первое упражнение.')).toBeVisible();
  await addEx(page, 'Отжимания', 'Отжимания');
  await expect(wo.getByText('Первый раз')).toBeVisible();
  await wo.getByRole('button', { name: 'Завершить тренировку' }).click();
  await expect(wo.getByRole('alert')).toHaveText('Отметь хотя бы один выполненный подход галочкой.');
  await wo.getByLabel('Повт. 1').fill('12');
  await wo.getByRole('button', { name: 'Подход 1' }).click();
  await wo.getByLabel('Повт. 2').fill('10');
  await wo.getByLabel('Кг 2').fill('5');
  await wo.getByRole('button', { name: 'Подход 2' }).click();
  await wo.getByRole('button', { name: 'Комментарий', exact: false }).first().click();
  await wo.getByRole('button', { name: '🤕 боль' }).click();
  await wo.getByRole('button', { name: 'Завершить тренировку' }).click();
  await expect(wo).toBeHidden();
  await expect(page.getByTestId('t-start')).toContainText('1 / 3');
  await expect(page.getByTestId('t-hist')).toContainText('Тренировка');

  // вторая тренировка: подходы из прошлого раза, галочка подставляет повторы
  await page.getByTestId('t-start').click();
  await addEx(page, 'Отжимания', 'Отжимания');
  await expect(wo.getByText('Прошлый раз: 12, 10×5кг')).toBeVisible();
  await expect(wo.getByTestId('setrow')).toHaveCount(2);
  await wo.getByLabel('Повт. 1').fill('');
  await wo.getByRole('button', { name: 'Подход 1' }).click();
  await expect(wo.getByLabel('Повт. 1')).toHaveValue('12');
  await wo.getByRole('button', { name: 'Отменить тренировку' }).click();
  await page.getByTestId('confirm').getByRole('button', { name: 'Удалить' }).click();
  await expect(wo).toBeHidden();

  // история: раскрыть, метка боли, удалить
  await page.getByTestId('t-hist').click();
  const item = page.getByTestId('hist-item');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('🤕');
  await item.locator('summary').click();
  await expect(item).toContainText('Отжимания: 12, 10×5кг');
  await item.getByRole('button', { name: 'Удалить' }).click();
  await page.getByTestId('confirm').getByRole('button', { name: 'Удалить' }).click();
  await expect(page.getByText('Тренировок пока нет.').last()).toBeVisible();
});

test('идущая тренировка: плашка и восстановление после перезагрузки', async ({ page }) => {
  await openTrain(page);
  await page.getByTestId('t-start').click();
  await addEx(page, 'Планка', 'Планка');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('wobar')).toContainText('0/3');
  await expect(page.getByTestId('t-start')).toContainText('Продолжить тренировку');
  await page.waitForTimeout(800); // сохранение с задержкой 500 мс
  await page.reload();
  await expect(page.getByTestId('wobar')).toBeVisible();
  await page.getByTestId('wobar').getByRole('button').click();
  await expect(page.getByRole('dialog').getByText('Планка')).toBeVisible();
});

test('программа: сохранить тренировку как программу, изменить, начать', async ({ page }) => {
  await openTrain(page);
  await page.getByTestId('t-start').click();
  const wo = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Завершить тренировку' }) });
  await wo.getByLabel('Название тренировки').fill('Верх');
  await addEx(page, 'Отжимания', 'Отжимания');
  await wo.getByLabel('Повт. 1').fill('10');
  await wo.getByRole('button', { name: 'Подход 1' }).click();
  await wo.getByText('Сохранить как программу').click();
  await wo.getByRole('button', { name: 'Завершить тренировку' }).click();
  await expect(page.getByTestId('t-prog')).toContainText('1 сохранено');

  await page.getByTestId('t-prog').click();
  const progs = page.getByRole('dialog', { name: 'Мои программы' });
  await expect(progs.getByTestId('program')).toContainText('Отжимания 3×');
  await progs.getByText('Верх').click();
  const pe = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Сохранить и начать' }) });
  await pe.getByLabel('Подходы').fill('2');
  await pe.getByLabel('Повторения').fill('15');
  await pe.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(progs.getByTestId('program')).toContainText('Отжимания 2×15');
  await progs.getByRole('button', { name: 'Начать' }).click();
  await expect(wo.getByText('Цель: 15')).toBeVisible();
  await expect(wo.getByTestId('setrow')).toHaveCount(2);
});

test('AI-тренер: программа по дням сохраняется в «Мои программы»', async ({ page }) => {
  await openTrain(page);
  await page.getByTestId('t-ai').click();
  const ai = page.getByRole('dialog', { name: 'AI-тренер' });
  await expect(ai.getByRole('radio', { name: '3' })).toHaveAttribute('aria-checked', 'true');
  await ai.getByRole('radio', { name: 'Дома' }).click();
  await expect(ai.getByText('Что есть дома')).toBeVisible();
  await ai.getByRole('button', { name: 'Составить программу' }).click();
  await expect(ai.getByTestId('ai-res')).toContainText('День 1: Верх тела');
  await expect(ai.getByTestId('ai-res')).toContainText('Отжимания 3×8-12');
  await ai.getByRole('button', { name: 'Сохранить в мои программы' }).click();
  await expect(page.getByRole('dialog', { name: 'Мои программы' }).getByTestId('program')).toHaveCount(2);
});

test('активность: текстом через ИИ, круги, норма питания, правка и удаление', async ({ page }) => {
  await openTrain(page);
  await expect(page.getByTestId('act-k')).toHaveText('0 / 400');
  await page.getByTestId('t-act').click();
  const sh = page.getByRole('dialog', { name: 'Активность сегодня' });
  await expect(sh.getByText('Пока ничего.')).toBeVisible();
  await sh.getByRole('button', { name: '+ Добавить активность' }).click();
  const add = page.getByRole('dialog', { name: 'Добавить активность' });
  await add.getByLabel('Словами или голосом').fill('час гулял');
  await add.getByRole('button', { name: 'Разобрать текст' }).click();
  await expect(add.getByTestId('act-res')).toContainText('новая запись · 60 мин · 5 km · 7000 шагов');
  await add.getByTestId('act-res').getByRole('button', { name: 'Добавить активность' }).click();
  await expect(add).toBeHidden();
  await expect(sh.getByTestId('act-list')).toContainText('Ходьба');
  await sh.getByText('Ходьба').click();
  const ed = page.getByRole('dialog', { name: 'Ходьба: изменить' });
  await ed.getByLabel('Ккал').fill('300');
  await ed.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(sh.getByTestId('act-list')).toContainText('300');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('act-k')).toHaveText('300 / 400');
  // половина сожжённого идет в норму питания (доля по умолчанию 0,5)
  await page.getByTestId('modesw').getByRole('button', { name: 'Питание' }).click();
  await expect(page.getByTestId('kcal-target')).toContainText('+ 150 за активность');
});

test('тренировки без горизонтального скролла на 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await openTrain(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
