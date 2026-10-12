/**
 * Провайдер ИИ. Ключ только на сервере (спека 4.3). Модель задаётся для каждой задачи (config.ts).
 * - OpenAIProvider: Chat Completions, JSON-режим для задач с JSON-ответом, фото как data URL.
 * - MockProvider: для тестов и локальной разработки без ключа (AI_MOCK=1).
 */
export interface Completion {
  text: string;
  usage: { input: number; output: number };
}
export interface CompleteArgs {
  model: string;
  prompt: string;
  json: boolean;
  /** base64 JPEG без префикса data: */
  images?: string[];
}
export interface Provider {
  complete(a: CompleteArgs): Promise<Completion>;
}

export class AiError extends Error {
  constructor(public code: 'invalid_json' | 'upstream_error' | 'image_rejected' | 'unavailable', public text = '') {
    super(code);
  }
}

export class OpenAIProvider implements Provider {
  constructor(private key: string, private base = 'https://api.openai.com/v1') {}
  async complete({ model, prompt, json, images }: CompleteArgs): Promise<Completion> {
    const content = images?.length
      ? [{ type: 'text', text: prompt }, ...images.map((b64) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }))]
      : prompt;
    const r = await fetch(`${this.base}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content }], ...(json ? { response_format: { type: 'json_object' } } : {}) }),
    });
    if (!r.ok) throw new AiError(r.status === 400 && images?.length ? 'image_rejected' : 'upstream_error', await r.text().catch(() => ''));
    const d = (await r.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    return { text: d.choices?.[0]?.message?.content ?? '', usage: { input: d.usage?.prompt_tokens ?? 0, output: d.usage?.completion_tokens ?? 0 } };
  }
}

/** Типовые ответы заглушки по задачам (для AI_MOCK=1 и e2e). */
const MOCK_DEFAULTS: Record<string, string> = {
  'Человек описал свою активность': JSON.stringify({ items: [{ name: 'Ходьба', min: 60, km: 5, steps: 7000, kcal: 280, replaceId: null }] }),
  'Обнови одну запись активности': JSON.stringify({ min: 70, km: 6, steps: 8200, kcal: 330 }),
  'Составь недельную программу': JSON.stringify({
    days: [
      { name: 'День 1: Верх тела', exercises: [{ id: 'Pushups', sets: 3, reps: '8-12' }, { id: 'Pullups', sets: 3, reps: '5-8' }, { id: 'Nope', sets: 3, reps: '10' }] },
      { name: 'День 2: Ноги и пресс', exercises: [{ id: 'Bodyweight_Squat', sets: 3, reps: '15' }, { id: 'Plank', sets: 3, reps: '30-60' }] },
    ],
    note: 'Чередуй дни 1 и 2. Добавляй повторы каждую неделю.',
  }),
  'Разбери рассказ': JSON.stringify({ items: [
    { slot: 'breakfast', name: 'Омлет из трёх яиц', recId: null, grams: 180, kcal: 280, protein: 20, fat: 21, carbs: 2, desc: '3 яйца' },
    { slot: 'lunch', name: 'Лосось с рисом', recId: null, grams: 350, kcal: 560, protein: 35, fat: 18, carbs: 60, desc: '' },
    { slot: 'snack', name: 'Протеиновый батончик', recId: null, grams: 60, kcal: 210, protein: 20, fat: 7, carbs: 18, desc: '' },
  ] }),
  'Посчитай КБЖУ этих продуктов': JSON.stringify({ items: [{ n: 'Масло', g: 10, kcal: 90, p: 0, f: 10, c: 0 }] }),
  'Оцени, сколько грамм': JSON.stringify({ grams: 300 }),
  'сегодня изменил состав': JSON.stringify({ items: [{ n: 'Скир', g: 200, kcal: 130, p: 22, f: 0, c: 8 }], note: 'без фиников' }),
};

/** Ответы-заглушки по задаче; prompt пишется в calls для тестов. */
export class MockProvider implements Provider {
  calls: CompleteArgs[] = [];
  constructor(private answers: Record<string, string> = {}) {}
  async complete(a: CompleteArgs): Promise<Completion> {
    this.calls.push(a);
    // перевод упражнений: те же ключи, к названию приписываем «(пер.)»
    if (a.prompt.startsWith('Переведи названия упражнений')) {
      const src = JSON.parse(a.prompt.slice(a.prompt.indexOf('{'))) as Record<string, string>;
      const text = JSON.stringify(Object.fromEntries(Object.entries(src).map(([k, v]) => [k, `${v} (пер.)`])));
      return { text, usage: { input: 1, output: 1 } };
    }
    if (a.prompt.startsWith('Переведи пошаговую')) return { text: JSON.stringify({ t: ['Шаг первый (пер.)', 'Шаг второй (пер.)'] }), usage: { input: 1, output: 1 } };
    const key = Object.keys({ ...MOCK_DEFAULTS, ...this.answers }).reverse().find((k) => a.prompt.includes(k));
    const text = key
      ? ({ ...MOCK_DEFAULTS, ...this.answers } as Record<string, string>)[key]!
      : a.json
        ? JSON.stringify({ name: 'Тестовое блюдо', names: ['Тестовое блюдо'], grams: 250, kcal: 400, protein: 25, fat: 15, carbs: 40, confidence: 'средняя', note: 'mock', items: [{ n: 'Тест', g: 250, kcal: 400, p: 25, f: 15, c: 40 }] })
        : 'Тестовый совет коуча.';
    return { text, usage: { input: Math.ceil(a.prompt.length / 4), output: Math.ceil(text.length / 4) } };
  }
}

/** JSON из ответа модели, даже если вокруг есть текст (parse прототипа). */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = String(text || '').match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* ниже */
      }
    }
    throw new AiError('invalid_json', text);
  }
}
