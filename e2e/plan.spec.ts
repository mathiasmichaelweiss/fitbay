import { test, expect, type Page } from '@playwright/test';
import { API, seed } from './helpers';

test.describe.configure({ timeout: 60000 });

const toClients = async (page: Page) => {
  await page.goto('/');
  await page.getByTestId('modesw').getByRole('button', { name: 'Клиенты' }).click();
};

test('тренер: заявка на пакет, принять с числом занятий, списать вручную, обзор денег', async ({
  page,
  request,
}) => {
  const tid = await seed(page, 'client,trainer');
  const h = { 'x-dev-user': tid, 'x-dev-roles': 'client,trainer' };
  await request.put(`${API}/trainer/profile`, {
    headers: h,
    data: {
      name: 'Лукас',
      packages: [{ id: 'p1', name: 'Техника, 3 тренировки', price: '150 €' }],
      rates: { on: 40, gym: 60, food: 50 },
    },
  });
  const cid = `e2e-cl-${Date.now()}`;
  await request.post(`${API}/trainers/${tid}/requests`, {
    headers: { 'x-dev-user': cid, 'x-dev-roles': 'client' },
    data: {
      name: 'Матиас',
      pkg: { id: 'p1', name: 'Техника, 3 тренировки', price: '150 €' },
      msg: 'Хочу присед',
      contact: '@m',
    },
  });
  await toClients(page);
  const card = page.getByTestId('req-card');
  await expect(card).toContainText('Матиас');
  await card.getByLabel('Занятий в пакете').fill('3');
  await card.getByPlaceholder('Ответ клиенту (необязательно)').fill('Жду!');
  await card.getByRole('button', { name: 'Принять' }).click();
  await expect(card.getByTestId('usage')).toContainText('Осталось 3 из 3');
  await card.getByRole('button', { name: /Списать занятие/ }).click();
  await page.getByTestId('confirm').getByRole('button', { name: 'Списать' }).click();
  await expect(card.getByTestId('usage')).toContainText('Осталось 2 из 3');
  const n = await (
    await request.get(`${API}/me/notifications`, { headers: { 'x-dev-user': cid, 'x-dev-roles': 'client' } })
  ).json();
  expect(n.items.map((x: { type: string }) => x.type)).toEqual(['sess_charged', 'req_accepted']);
  // свой пакет
  await page
    .getByTestId('my-pkgs')
    .getByRole('button', { name: /Мои пакеты/ })
    .click();
  await page.getByLabel('Название').fill('Онлайн, 5 тренировок');
  await page.getByLabel('Цена').fill('180 €');
  await page.getByRole('button', { name: 'Добавить пакет' }).click();
  await expect(page.getByTestId('my-pkgs')).toContainText('Мои пакеты · 2');
  // обзор
  await page.getByRole('radio', { name: 'Обзор' }).click();
  await expect(page.getByTestId('fin-tile').first()).toContainText('150 €');
  await expect(page.getByTestId('fin')).toContainText('Скоро закончатся пакеты');
});

test('тренер: план целей клиенту из шаблона и ИИ, клиент видит маршрут и норму фазы', async ({
  page,
  request,
  browser,
}) => {
  const tid = await seed(page, 'client,trainer');
  const h = { 'x-dev-user': tid, 'x-dev-roles': 'client,trainer' };
  await request.put(`${API}/trainer/profile`, { headers: h, data: { name: 'Лукас' } });
  // клиент делится данными
  const ctx = await browser.newContext();
  const cp = await ctx.newPage();
  const cid = await seed(cp);
  const ch = { 'x-dev-user': cid, 'x-dev-roles': 'client' };
  await request.put(`${API}/trainers/${tid}/link`, { headers: ch, data: { consent: true, name: 'Матиас' } });
  await toClients(page);
  await page.getByTestId('cl-row').first().click();
  await expect(page.getByTestId('cl-plan')).toContainText('Плана нет, сейчас стандартная цель');
  await page.getByTestId('cl-plan').click();
  const ed = page.getByTestId('plan-ed');
  // ИИ (заглушка): сушка и удержание, неизвестное упражнение отброшено
  await ed.getByLabel('Сгенерировать план с ИИ').fill('сушка 8 недель, потом удержание');
  await ed.getByRole('button', { name: 'Сгенерировать' }).click();
  await expect(ed.getByTestId('ph-ed')).toHaveCount(2);
  // шаблон «Похудение» заменяет фазы
  await ed.getByRole('button', { name: 'Похудение', exact: true }).click();
  await expect(ed.getByTestId('ph-ed')).toHaveCount(2);
  await ed.getByTestId('ph-ed').first().getByLabel('Заметка для клиента').fill('Держим белок');
  await ed.getByRole('button', { name: 'Сохранить план' }).click();
  await expect(ed.getByRole('button', { name: 'Сохранено ✓' })).toBeVisible();
  const plan = await (await request.get(`${API}/me/plan`, { headers: ch })).json();
  expect(plan.phases.map((p: { type: string }) => p.type)).toEqual(['cut', 'maint']);
  expect(plan.by).toBe('Лукас');
  // клиент: новый план, плитка и «Мой путь»
  await cp.goto('/');
  await expect(cp.getByTestId('phase-new')).toContainText('ТВОЙ ПЛАН ГОТОВ');
  await cp.getByRole('button', { name: 'Поехали' }).click();
  await expect(cp.getByTestId('plan-tile')).toContainText('Фаза 1 из 2');
  await cp.getByTestId('plan-tile').click();
  await expect(cp.getByTestId('path-hero')).toContainText('Держим белок');
  await expect(cp.getByTestId('path-step')).toHaveCount(2);
  await ctx.close();
});
