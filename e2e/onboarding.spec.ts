import { test, expect, type Page } from '@playwright/test';

async function pickBirth(page: Page, year: string, monthRe: RegExp, dayLabel: RegExp) {
  await page.getByRole('button', { name: 'Дата рождения' }).click();
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('combobox', { name: /year/i }).click();
  await page.getByRole('option', { name: year }).click();
  await drawer.getByRole('combobox', { name: /month/i }).click();
  await page.getByRole('option', { name: monthRe }).click();
  await drawer.getByRole('button', { name: dayLabel }).click();
  await drawer.getByRole('button', { name: 'Готово' }).click();
}

test('онбординг как в прототипе: 5 шагов, норма совпадает с CALC прототипа', async ({ page }) => {
  await page.goto('/');
  // шаг 1: приветствие
  await expect(page.getByRole('heading', { name: 'Привет! Это FitBay' })).toBeVisible();
  await page.getByRole('button', { name: 'Начать' }).click();
  // шаг 2: цель (4 варианта, по умолчанию «Держать форму»)
  await expect(page.getByRole('heading', { name: 'Какая у тебя цель?' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(4);
  await expect(page.getByRole('radio', { name: /Держать форму/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Дальше' }).click();
  // шаг 3: о себе + согласие
  const next = page.getByRole('button', { name: 'Дальше' });
  await expect(next).toBeDisabled();
  await pickBirth(page, '1996', /январь/i, /15 января 1996/i);
  await page.getByLabel('Рост, см').fill('180');
  await page.getByLabel('Вес сейчас, кг').fill('80');
  await expect(page.getByLabel('Цель, кг')).toHaveCount(0); // при «Держать форму» целевого веса нет
  await page.getByRole('radio', { name: '3–4' }).click();
  await expect(next).toBeDisabled(); // без согласия дальше нельзя
  await page.getByText('ст. 9 DSGVO').click();
  await next.click();
  // шаг 4: норма. Эталон из CALC прототипа: м, 30 лет, 180 см, 80 кг, 3-4 тренировки, удержание = 2450 ккал, 128 г белка
  await expect(page.getByTestId('norm-kcal')).toHaveText(/^2\s?450$/);
  await expect(page.getByTestId('norm-p')).toHaveText('128г');
  await expect(page.getByTestId('norm-f')).toHaveText('72г');
  await expect(page.getByTestId('norm-c')).toHaveText('322г');
  await next.click();
  // шаг 5: путь
  const done = page.getByRole('button', { name: 'Готово' });
  await expect(done).toBeDisabled();
  await page.getByRole('radio', { name: /Сам, с ИИ-коучем/ }).click();
  await done.click();

  await expect(page.getByTestId('title')).toHaveText('Сегодня');
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('fitbay.local.v1')!).single.profile);
  expect(saved).toMatchObject({ birth: '1996-01-15', h: 180, w: 80, tw: 80, act: 3, goal: 'keep', path: 'ai' });
  expect(saved.consents.health.v).toBe(1);
});

test('цель «Похудеть»: появляется целевой вес, норма ниже', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать' }).click();
  await page.getByRole('radio', { name: /Похудеть/ }).click();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page.getByLabel('Цель, кг')).toBeVisible();
  await pickBirth(page, '1996', /январь/i, /15 января 1996/i);
  await page.getByLabel('Рост, см').fill('180');
  await page.getByLabel('Вес сейчас, кг').fill('80');
  await page.getByRole('radio', { name: '3–4' }).click();
  await page.getByText('ст. 9 DSGVO').click();
  await page.getByRole('button', { name: 'Дальше' }).click();
  // эталон прототипа: тот же профиль на сушке = 2080 ккал, белок 1.8 г/кг = 144 г
  await expect(page.getByTestId('norm-kcal')).toHaveText(/^2\s?080$/);
  await expect(page.getByTestId('norm-p')).toHaveText('144г');
});

test('язык DE на первом шаге: тексты из словаря прототипа', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'DE' }).click();
  await expect(page.getByRole('heading', { name: 'Hallo! Das ist FitBay' })).toBeVisible();
  await page.getByRole('button', { name: 'Starten' }).click();
  await expect(page.getByRole('heading', { name: 'Was ist dein Ziel?' })).toBeVisible();
});
