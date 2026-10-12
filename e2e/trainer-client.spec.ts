import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { API, seed } from './helpers';

/** Тестовый тренер через API: профиль в каталоге, пакеты, ставки, два свободных окна послезавтра. */
async function makeTrainer(req: APIRequestContext) {
  const tid = `tr-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const h = { 'x-dev-user': tid, 'x-dev-roles': 'trainer' };
  const name = `Лукас ${tid.slice(-4)}`;
  await req.put(`${API}/trainer/profile`, {
    headers: h,
    data: { name, spec: 'Сила и техника', city: 'Stuttgart', level: 'Personal Trainer', price: 'ab 60 €', exp: 8, sex: 'm', edu: ['trainer'], tags: ['Kraft'], formats: ['Online'],
      packages: [{ id: 'p1', name: 'Техника, 3 тренировки', price: '150 €', desc: 'Три занятия' }], rates: { on: 40, gym: 60, food: 50 } },
  });
  const d = new Date(Date.now() + 2 * 864e5);
  d.setHours(10, 0, 0, 0);
  await req.post(`${API}/trainer/slots`, { headers: h, data: { start: +d, dur: 60, n: 2, place: 'gym', addr: 'FitX Mitte' } });
  return { tid, h, name };
}
const toTrain = async (page: Page) => {
  await page.goto('/');
  await page.getByTestId('modesw').getByRole('button', { name: 'Тренировки' }).click();
};

test('клиент: каталог, запись, бесплатная отмена с причиной, тренер получает уведомление', async ({ page, request }) => {
  await seed(page);
  const tr = await makeTrainer(request);
  await toTrain(page);
  await expect(page.getByTestId('tr-tile')).toContainText('Найти тренера');
  await page.getByTestId('tr-tile').click();
  const cat = page.getByRole('dialog', { name: 'Тренеры' });
  await cat.getByLabel('Поиск по имени или специализации').fill(tr.name);
  await expect(cat.getByTestId('cat-count')).toHaveText('Найдено: 1');
  await cat.getByTestId('tr-row').click();
  const sh = page.getByRole('dialog', { name: tr.name });
  await sh.getByLabel('Как тебя записать').fill('Матиас');
  await sh.getByTestId('slot').first().click();
  await page.getByTestId('confirm').getByRole('button', { name: 'Записаться' }).click();
  await expect(sh.getByTestId('my-bookings')).toContainText('FitX Mitte');
  await expect(sh.getByTestId('slot')).toHaveCount(1);
  await sh.getByRole('button', { name: 'Отменить' }).click();
  await expect(page.getByTestId('confirm')).toContainText('Бесплатная отмена');
  await page.getByTestId('confirm').getByLabel('Причина для тренера (необязательно)').fill('заболел');
  await page.getByTestId('confirm').getByRole('button', { name: 'Отменить запись' }).click();
  await expect(sh.getByTestId('my-bookings')).toHaveCount(0);
  const n = await (await request.get(`${API}/me/notifications`, { headers: tr.h })).json();
  expect(n.items.map((x: { type: string; reason?: string }) => [x.type, x.reason ?? ''])).toEqual([['cancel', 'заболел'], ['booked', '']]);
});

test('клиент: заявка на пакет, ответ тренера в колокольчике, остаток занятий; свой пакет с ценой', async ({ page, request }) => {
  const uid = await seed(page);
  const tr = await makeTrainer(request);
  await toTrain(page);
  await page.getByTestId('tr-tile').click();
  await page.getByRole('dialog', { name: 'Тренеры' }).getByLabel('Поиск по имени или специализации').fill(tr.name);
  await page.getByTestId('tr-row').click();
  const pk = page.getByTestId('pkg');
  await pk.getByRole('button', { name: 'Оставить заявку' }).click();
  await pk.getByRole('button', { name: 'Отправить заявку' }).click();
  await expect(pk.getByRole('alert')).toHaveText('Напиши, как с тобой связаться.');
  await pk.getByLabel('Как с тобой связаться').fill('@matthias');
  await pk.getByRole('button', { name: 'Отправить заявку' }).click();
  await expect(pk.getByTestId('req-status')).toContainText('Заявка отправлена');
  // свой пакет: 2×/нед онлайн 3 мес с питанием: (26 × 40 + 3 × 50) − 5% = 1131 €
  const gen = page.getByTestId('gen');
  await gen.getByRole('button', { name: 'Собрать свой пакет' }).click();
  await expect(gen.getByTestId('gen-total')).toHaveText('1131 €');
  // тренер принимает заявку
  const reqs = await (await request.get(`${API}/trainer/requests`, { headers: tr.h })).json();
  const rid = reqs.items.find((r: { uid: string }) => r.uid === uid).id;
  await request.post(`${API}/trainer/requests/${encodeURIComponent(rid)}/answer`, { headers: tr.h, data: { accept: true, answer: 'Жду!', sessions: 3 } });
  await page.reload();
  await expect(page.getByTestId('bell-n')).toBeVisible();
  await page.getByRole('button', { name: 'Уведомления' }).click();
  const bell = page.getByTestId('bell-list');
  await expect(bell).toContainText(`${tr.name}: заявка принята`);
  await expect(bell).toContainText('Техника, 3 тренировки · Жду!');
  await bell.getByTestId('nt').filter({ hasText: 'заявка принята' }).click();
  await expect(page.getByTestId('pkg').getByTestId('usage')).toContainText('Осталось 3 из 3');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('bell-n')).toHaveCount(0);
});

test('клиент: согласие на доступ тренера, рекомендация тренера на главной, отметка «выполнено»', async ({ page, request }) => {
  const uid = await seed(page);
  const tr = await makeTrainer(request);
  await page.goto('/');
  await page.getByRole('button', { name: 'Тело и цели' }).click();
  const box = page.getByTestId('share-box');
  await expect(box).toContainText('Тренер пока не видит твои данные.');
  await box.getByRole('button', { name: 'Поделиться с тренером' }).click();
  const share = page.getByRole('dialog', { name: 'Поделиться с тренером' });
  await share.getByRole('button', { name: new RegExp(tr.name) }).click();
  await share.getByLabel('Как тебя называть тренеру').fill('Матиас');
  await share.getByRole('button', { name: 'Даю согласие и делюсь' }).click();
  await expect(share.getByRole('alert')).toHaveText('Отметь оба пункта, чтобы поделиться.');
  await share.getByText('Я согласен(на)').click();
  await share.getByText('Я понимаю').click();
  await share.getByRole('button', { name: 'Даю согласие и делюсь' }).click();
  await expect(box).toContainText(`${tr.name} видит твои данные с`);
  // тренер отправляет рекомендацию
  const r = await request.put(`${API}/users/${uid}/tips`, { headers: tr.h, data: { items: [{ id: 't1', text: 'Добавь 30 г белка к завтраку', cat: 'food', ts: Date.now(), from: tr.name, done: false }] } });
  expect(r.ok()).toBeTruthy();
  await page.reload();
  const tile = page.getByTestId('tip-food');
  await expect(tile).toContainText('Добавь 30 г белка к завтраку');
  await expect(tile).toContainText(`1 открыто · ${tr.name}`);
  await tile.click();
  await page.getByTestId('tip').getByRole('button', { name: 'Выполнено' }).click();
  await page.keyboard.press('Escape');
  await expect(tile).toContainText('Все рекомендации выполнены');
});
