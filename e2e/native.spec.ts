import { test, expect } from '@playwright/test';
import { asNewUser, seed } from './helpers';

/** Требование: никаких нативных select, date-инпутов и диалогов браузера, всё в стиле приложения. */
for (const path of ['/', '/ui']) {
  test(`нет нативных select и date-полей: ${path}`, async ({ page }) => {
    await seed(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const native = await page.locator('select, input[type=date], input[type=datetime-local], input[type=month], input[type=time], datalist').count();
    expect(native).toBe(0);
  });
}

test('онбординг без нативных контролов', async ({ page }) => {
  await asNewUser(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать' }).click();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Дата рождения' }).click();
  expect(await page.locator('select, input[type=date]').count()).toBe(0);
});
