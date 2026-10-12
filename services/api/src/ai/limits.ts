import type { AiTask } from '@fitbay/shared';

/** Дневные лимиты из прототипа (LIMITS). Unlimited: мягкий потолок 100 в день (спека 4.3). */
export type Kind = 'food' | 'coach' | 'act' | 'trainer' | 'recipe';
export const LIMITS: Record<'trial' | 'full' | 'unlimited', Record<Kind, number>> = {
  trial: { food: 10, coach: 6, act: 3, trainer: 1, recipe: 5 },
  full: { food: 30, coach: 15, act: 10, trainer: 5, recipe: 20 },
  unlimited: { food: 100, coach: 100, act: 100, trainer: 100, recipe: 100 },
};
export const KIND: Record<AiTask, Kind> = {
  food_photo: 'food', food_text: 'food', food_items: 'food', food_portion: 'food', food_mod: 'food', day_story: 'food', label_ocr: 'food',
  coach: 'coach', activity: 'act', workout_ai: 'trainer', plan_ai: 'trainer', recipe: 'recipe',
  ex_names: 'trainer', ex_steps: 'trainer', // не считаются: общий кэш, см. extr.ts
};
/** Мягкие сообщения без слова «лимит» (AIMSG прототипа). */
export const AIMSG: Record<Kind, string> = {
  food: 'На сегодня AI отдыхает: можно ввести цифры вручную или выбрать из «Моих блюд». Завтра снова.',
  coach: 'Коуч на сегодня все сказал. Завтра продолжим.',
  act: 'На сегодня распознавание активностей отдыхает: можно ввести цифры вручную. Завтра снова.',
  trainer: 'На сегодня программ хватит, завтра составлю новую.',
  recipe: 'На сегодня AI отдыхает: цифры рецепта можно ввести вручную. Завтра снова.',
};
