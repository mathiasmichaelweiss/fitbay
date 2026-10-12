import { test, expect, type Page } from '@playwright/test';
import { seed } from './helpers';

/** Владелец создает тестового тренера (A6.1) и входит под ним. */
async function asTestTrainer(page: Page) {
  await seed(page, 'client,trainer,admin');
  await page.goto('/');
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: '🧪 Тестовые пользователи' }).click();
  await page.getByTestId('tu-new-trainer_de').click();
  await expect(page.getByTestId('tu-bar')).toBeVisible({ timeout: 25000 });
  await page.getByTestId('modesw').getByRole('button', { name: 'Клиенты' }).click();
}

test.describe.configure({ timeout: 60000 });

test('тестовый тренер: клиенты, карточка, разделы, тренировка с клиентом', async ({ page }) => {
  await asTestTrainer(page);
  await expect(page.getByTestId('cl-row')).toHaveCount(4);
  await page.getByTestId('cl-row').first().click();
  await page
    .getByRole('button', { name: /ТРЕНИРОВКИ/ })
    .first()
    .click();
  const sec = page.getByRole('dialog', { name: 'Тренировки' });
  await sec.getByRole('button', { name: '▶ Начать тренировку с клиентом' }).click();
  await expect(page.getByText(/🤝/).first()).toBeVisible();
  // отмена занятия: своя тренировка не создается
  await page.getByRole('button', { name: 'Отменить тренировку' }).click();
  await page.getByTestId('confirm').getByRole('button').last().click();
  await expect(page.getByRole('button', { name: 'Отменить тренировку' })).toHaveCount(0);
});

test('расписание: добавить свободное время, план и удаление слота', async ({ page }) => {
  await asTestTrainer(page);
  await page.getByRole('radio', { name: 'Расписание' }).click();
  await expect(page.getByTestId('sched')).toBeVisible();
  await page.getByRole('button', { name: 'Добавить свободное время' }).click();
  const f = page.getByRole('dialog', { name: 'Свободное время' });
  // завтра, через пикер даты
  await f.getByRole('button', { name: 'Дата' }).click();
  const tm = new Date(Date.now() + 864e5);
  await page
    .getByRole('gridcell', { name: new RegExp(`, ${tm.getDate()} `) })
    .getByRole('button')
    .click();
  await page.getByRole('button', { name: 'Готово' }).click();
  await f.getByRole('button', { name: 'Добавить' }).click();
  await expect(f).toHaveCount(0);
  const slot = page.getByTestId('slot').filter({ hasText: 'Свободно' }).first();
  await expect(slot).toBeVisible();
  await slot.getByRole('button', { name: '+ План тренировки' }).click();
  const pl = page.getByRole('dialog', { name: 'План тренировки' });
  await pl.getByPlaceholder('Например: Ноги и ягодицы').fill('Ноги');
  await pl.getByPlaceholder('Найти упражнение: присед, жим, тяга...').fill('присед');
  await pl.getByRole('button', { name: /^\+ / }).first().click();
  await pl.getByRole('button', { name: 'Сохранить план' }).click();
  await expect(slot).toContainText('Ноги');
  await slot.getByRole('button', { name: 'Удалить' }).click();
  await page.getByTestId('confirm').getByRole('button').last().click();
  await expect(page.getByTestId('slot').filter({ hasText: 'Ноги' })).toHaveCount(0);
});
