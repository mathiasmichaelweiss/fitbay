import { describe, expect, it } from 'vitest';
import { MemoryRepo } from '../lib/repo';
import type { Event } from '../lib/http';
import { recordCorrection } from '../corrections/handler';
import { makeHandler } from './handler';
import { AiError, MockProvider, type CompleteArgs } from './provider';

const NOW = Date.UTC(2026, 9, 12, 12);
const PROFILE = { PK: 'USER#u1', SK: 'PROFILE', sex: 'm', birth: '1996-01-15', h: 180, w: 80, tw: 80, act: 3, goal: 'keep' };

function setup(provider: MockProvider | null = new MockProvider()) {
  const repo = new MemoryRepo(), shared = new MemoryRepo();
  const h = makeHandler(repo, shared, provider, () => NOW);
  const call = async (task: string, b: Record<string, unknown> = {}) => {
    const r = await h({ routeKey: 'POST /ai/{task}', rawPath: `/ai/${task}`, requestContext: { http: { method: 'POST' }, authorizer: { lambda: { uid: 'u1', roles: 'client' } } }, pathParameters: { task }, body: JSON.stringify(b) } as unknown as Event);
    return { s: r.statusCode!, b: r.body ? JSON.parse(r.body) : {} };
  };
  return { repo, shared, call, provider };
}

describe('ИИ-прокси', () => {
  it('без ключа: 503 с текстом из прототипа', async () => {
    const { call } = setup(null);
    expect(await call('food_text', { dish: 'Плов' })).toEqual({ s: 503, b: { error: 'ИИ недоступен в этом окне.' } });
  });
  it('неизвестная задача 404, ещё не перенесённая 501', async () => {
    const { call } = setup();
    expect((await call('poem')).s).toBe(404);
    expect((await call('plan_ai')).s).toBe(501);
  });
  it('еда по тексту: JSON-ответ, учёт задач и токенов', async () => {
    const { call, repo, provider } = setup();
    const r = await call('food_text', { dish: 'Плов', grams: 300 });
    expect(r.b.result).toMatchObject({ kcal: 400, protein: 25 });
    expect(provider!.calls[0]!.json).toBe(true);
    expect(provider!.calls[0]!.model).toBe('gpt-5.6-luna');
    const u = await repo.get('USER#u1', 'USAGE#2026-10-12');
    expect(u?.c).toEqual({ food: 1 });
    expect((u?.tokens as Record<string, { in: number }>).food_text!.in).toBeGreaterThan(100);
    expect(u?.ttl).toBeGreaterThan(NOW / 1000);
  });
  it('без названия, описания и фото нельзя (текст прототипа)', async () => {
    const { call } = setup();
    expect((await call('food_text', {})).b.error).toBe('Напиши название или добавь фото.');
  });
  it('в промпт попадают подсказки общей базы и личных взвешиваний', async () => {
    const { call, repo, shared, provider } = setup();
    await recordCorrection(repo, shared, 'u1', 'Гречка', 100, 42, 1);
    await recordCorrection(repo, shared, 'u2', 'Гречка', 100, 44, 2);
    await call('food_text', { dish: 'Гречка' });
    const p = provider!.calls[0]!.prompt;
    expect(p).toContain('×0,43 от прежней оценки ИИ');
    expect(p).toContain('Гречка: оценка 100 г, на весах 42 г');
    expect(p).toContain('Посуда и размер неизвестны');
  });
  it('посуда из прототипа: тип, размер, заполненность', async () => {
    const { call, provider } = setup();
    await call('food_text', { dish: 'Суп', plate: { type: 'deep', size: 'M', fill: 'half' } });
    expect(provider!.calls[0]!.prompt).toContain('Посуда: Глубокая, размер 22 см, заполнена: Половина.');
  });
  it('лимит: после 30 блюд мягкое сообщение без слова «лимит»', async () => {
    const { call } = setup();
    for (let i = 0; i < 30; i++) expect((await call('food_text', { dish: `d${i}` })).s).toBe(200);
    const r = await call('food_text', { dish: 'еще' });
    expect(r.s).toBe(429);
    expect(r.b.message).toBe('На сегодня AI отдыхает: можно ввести цифры вручную или выбрать из «Моих блюд». Завтра снова.');
    expect(r.b.message).not.toMatch(/лимит/i);
  });
  it('пробный период: 10 блюд', async () => {
    const { call, repo } = setup();
    await repo.put({ ...PROFILE, entitlement: 'trial' });
    for (let i = 0; i < 10; i++) await call('food_text', { dish: `d${i}` });
    expect((await call('food_text', { dish: 'x' })).s).toBe(429);
  });
  it('модель меняется для задачи без релиза (CONFIG / AI)', async () => {
    const { call, repo, provider } = setup();
    await repo.put({ PK: 'CONFIG', SK: 'AI', models: { food_text: 'gpt-mini-test' } });
    await call('food_text', { dish: 'Плов' });
    expect(provider!.calls[0]!.model).toBe('gpt-mini-test');
  });
  it('фото не прошло: пересчёт по описанию, как в прототипе', async () => {
    const calls: CompleteArgs[] = [];
    const p = new MockProvider();
    const orig = p.complete.bind(p);
    p.complete = async (a) => {
      calls.push(a);
      if (a.images?.length) throw new AiError('image_rejected');
      return orig(a);
    };
    const { call } = setup(p);
    const r = await call('food_photo', { dish: 'Плов', image: 'aGVsbG8=' });
    expect(r.b.imageSkipped).toBe(true);
    expect(calls[1]!.prompt).toContain('Фото нет.');
  });
  it('мусор вместо JSON: понятная ошибка', async () => {
    const { call } = setup(new MockProvider({ 'Ответь только JSON': 'не json' }));
    expect((await call('food_text', { dish: 'x' })).b.error).toBe('Не получилось разобрать, попробуй еще раз.');
  });
});

describe('коуч', () => {
  async function withMeals() {
    const s = setup(new MockProvider({ 'персональный коуч': 'Белка мало — добавь творог.' }));
    await s.repo.put(PROFILE);
    await s.repo.put({ PK: 'USER#u1', SK: 'MEAL#2026-10-12#1', name: 'Овсянка', kcal: 410, protein: 14, fat: 9, carbs: 68, createdAt: '2026-10-12T07:30:00Z' });
    return s;
  }
  it('промпт из прототипа: норма из calc, съеденное с приёмами, без длинного тире в ответе', async () => {
    const { call, provider } = await withMeals();
    const r = await call('coach', { day: '2026-10-12', time: '14:00' });
    expect(r.b.text).toBe('Белка мало, добавь творог.');
    const p = provider!.calls[0]!.prompt;
    expect(p).toContain('Норма на день: 2450 ккал, белок 128 г');
    expect(p).toContain('[завтрак] Овсянка: 410 ккал, Б 14, Ж 9, У 68');
    expect(p).toContain('Уже были: завтрак.');
    expect(p).toContain('сейчас: 14:00');
    expect(provider!.calls[0]!.json).toBe(false);
  });
  it('без новой еды повторный запрос не вызывает ИИ и не тратит лимит', async () => {
    const { call, provider, repo } = await withMeals();
    await call('coach', { day: '2026-10-12' });
    const r = await call('coach', { day: '2026-10-12' });
    expect(r.b.cached).toBe(true);
    expect(provider!.calls).toHaveLength(1);
    expect((await repo.get('USER#u1', 'USAGE#2026-10-12'))?.c).toEqual({ coach: 1 });
  });
  it('после новой еды совет пересчитывается', async () => {
    const { call, provider, repo } = await withMeals();
    await call('coach', { day: '2026-10-12' });
    await repo.put({ PK: 'USER#u1', SK: 'MEAL#2026-10-12#2', name: 'Творог', kcal: 200, protein: 30, fat: 5, carbs: 6, createdAt: '2026-10-12T11:00:00Z' });
    await call('coach', { day: '2026-10-12' });
    expect(provider!.calls).toHaveLength(2);
  });
  it('кэш коуча работает и без ключа', async () => {
    const s = await withMeals();
    await s.call('coach', { day: '2026-10-12' });
    const off = makeHandler(s.repo, s.shared, null, () => NOW);
    const r = await off({ routeKey: 'POST /ai/{task}', requestContext: { http: { method: 'POST' }, authorizer: { lambda: { uid: 'u1', roles: 'client' } } }, pathParameters: { task: 'coach' }, body: '{"day":"2026-10-12"}' } as unknown as Event);
    expect(JSON.parse(r.body!).cached).toBe(true);
  });
});

describe('рассказ за день', () => {
  it('книга рецептов попадает в промпт', async () => {
    const { call, repo, provider } = setup(new MockProvider({ 'Разбери рассказ': '{"items":[{"slot":"breakfast","name":"Сырники","recId":"r1","grams":200}]}' }));
    await repo.put({ PK: 'USER#u1', SK: 'RECIPE#r1', name: 'Сырники', grams: 200, p100: { kcal: 220 } });
    const r = await call('day_story', { text: 'утром сырники, днём суп' });
    expect(provider!.calls[0]!.prompt).toContain('r1|Сырники|порция 200 г|220 ккал/100г');
    expect(r.b.result.items[0].recId).toBe('r1');
  });
});

describe('добавить ингредиенты', () => {
  it('промпт addIng из прототипа, считается в лимит еды', async () => {
    const { call, provider, repo } = setup(new MockProvider({ 'Посчитай КБЖУ этих продуктов': '{"items":[{"n":"Масло","g":10,"kcal":90,"p":0,"f":10,"c":0}]}' }));
    const r = await call('food_items', { text: '1 ст. л. масла' });
    expect(r.b.result.items[0].n).toBe('Масло');
    expect(provider!.calls[0]!.prompt).toContain('Посчитай КБЖУ этих продуктов, каждый отдельно: 1 ст. л. масла');
    expect((await repo.get('USER#u1', 'USAGE#2026-10-12'))?.c).toEqual({ food: 1 });
  });
});

describe('блюда из книги рецептов', () => {
  it('сколько грамм съел: рецепт берётся из базы, посуда из прототипа', async () => {
    const { call, repo, provider } = setup(new MockProvider({ 'Оцени, сколько грамм': '{"grams":320}' }));
    await repo.put({ PK: 'USER#u1', SK: 'RECIPE#r1', name: 'Плов', desc: 'рис, говядина', grams: 300 });
    const r = await call('food_portion', { recId: 'r1', said: 'большая тарелка', plate: { type: 'flat', size: 'L', fill: 'full' } });
    expect(r.b.result.grams).toBe(320);
    const p = provider!.calls[0]!.prompt;
    expect(p).toContain('Блюдо из его книги рецептов: Плов. Состав: рис, говядина. Его обычная порция: 300 г.');
    expect(p).toContain('посуда: Плоская, размер 28 см, заполнена: Полная.');
  });
  it('сегодня по-другому: изменения применяются к составу', async () => {
    const { call, repo, provider } = setup(new MockProvider({ 'сегодня изменил состав': '{"items":[{"n":"Скир","g":160,"kcal":100,"p":17,"f":0,"c":6}],"note":"без фиников"}' }));
    await repo.put({ PK: 'USER#u1', SK: 'RECIPE#r2', name: 'Скир с финиками', grams: 250 });
    const r = await call('food_mod', { recId: 'r2', current: 'Скир: 200 г', change: 'без фиников' });
    expect(r.b.result.note).toBe('без фиников');
    expect(provider!.calls[0]!.prompt).toContain('Изменения сегодня: без фиников');
  });
  it('чужой или несуществующий рецепт: 404', async () => {
    const { call } = setup();
    expect((await call('food_portion', { recId: 'nope' })).s).toBe(404);
  });
  it('AI-тренер: промпт прототипа, только упражнения из базы, лимит trainer', async () => {
    const { call, repo, provider } = setup();
    await repo.put(PROFILE);
    const r = await call('workout_ai', { place: 'home', lvl: 'beginner', days: 2, eq: ['dumbbell'], wish: '', lang: 'ru' });
    expect(r.s).toBe(200);
    expect(r.b.result.days).toEqual([
      { name: 'День 1: Верх тела', items: [{ id: 'Pushups', sets: 3, reps: '8-12' }, { id: 'Pullups', sets: 3, reps: '5-8' }] },
      { name: 'День 2: Ноги и пресс', items: [{ id: 'Bodyweight_Squat', sets: 3, reps: '15' }, { id: 'Plank', sets: 3, reps: '30-60' }] },
    ]);
    const prompt = provider!.calls[0]!.prompt;
    expect(prompt).toContain('Клиент: мужчина, 30 лет, 80 кг. Цель: поддержание. Уровень: Новичок. Где тренируется: дома. Инвентарь дома: Гантели. Используй только этот инвентарь. Тренировок в неделю: 2.');
    expect(prompt).toContain('Pushups|Pushups|chest');
    expect(prompt).not.toContain('Barbell_Deadlift|');
    expect((await repo.get('USER#u1', 'USAGE#2026-10-12'))?.c).toEqual({ trainer: 1 });
  });
});
