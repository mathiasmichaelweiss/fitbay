// Общие типы и константы для web, backoffice и api (сущности из спеки, раздел 5).
export type Role = 'client' | 'trainer' | 'partner' | 'studio' | 'admin';
export type Lang = 'ru' | 'de' | 'en';
export type AiTask =
  | 'food_photo' | 'food_text' | 'food_items' | 'food_portion' | 'food_mod' | 'day_story' | 'coach'
  | 'activity' | 'recipe' | 'workout_ai' | 'plan_ai' | 'label_ocr';

/** Версии текстов согласий (спека 4.9, 7). Новая версия текста = новый номер, пользователь соглашается заново. */
export const CONSENT_VERSIONS = { health: 1, privacy: 1, trainer: 1 } as const;
export type ConsentKind = keyof typeof CONSENT_VERSIONS;
export interface Consent {
  v: number;
  at: string; // ISO
}

/** Профиль (settings.profile прототипа). act: тренировок в неделю 0|1|3|5|7. */
export interface Profile {
  id?: string;
  name?: string;
  sex: 'm' | 'f';
  birth: string;
  h: number;
  w: number;
  tw?: number; // целевой вес
  act: 0 | 1 | 3 | 5 | 7;
  goal: 'lose' | 'recomp' | 'keep' | 'gain';
  lang?: Lang;
  /** Путь из онбординга: сам с ИИ, найти тренера, код тренера. */
  path?: 'ai' | 'trainer' | 'code';
  trainerCode?: string;
  macro?: { on?: boolean; p: number; f: number; c: number };
  flex?: { on?: boolean; days: number[]; train: { p: number; f: number; c: number }; rest: { p: number; f: number; c: number } };
  dayOv?: Record<string, 'train' | 'rest'>;
  consents: Partial<Record<ConsentKind, Consent>>;
  onboarded?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Приём пищи. Поля как в прототипе (kcal, protein, fat, carbs), чтобы миграция (спека 5.4) шла без преобразований. */
export interface Meal {
  id: string;
  date: string;
  /** Необязателен: без него слот определяется groupMeals по времени и калорийности. */
  slot?: Slot;
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  grams?: number;
  thumb?: string;
  /** Как в прототипе: что ввёл пользователь, описание, состав, посуда, точность, рецепт. */
  dish?: string;
  desc?: string;
  items?: { n: string; g: number; kcal: number; p: number; f: number; c: number }[] | null;
  plate?: { type: string; size?: string; fill?: string };
  confidence?: string;
  recId?: string | null;
  /** Время приёма (мс). Для «Весь день разом» ставится по слоту, иначе время создания. */
  ts?: number;
  createdAt?: string;
}

/** Блюдо в «Моих блюдах» (recipe прототипа). p100: КБЖУ на 100 г, если известен вес порции. */
export interface Recipe {
  id: string;
  name: string;
  desc?: string;
  grams?: number | null;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  p100?: { kcal: number; protein: number; fat: number; carbs: number } | null;
  items?: Meal['items'];
  plate?: Meal['plate'];
  thumb?: string;
  used?: number;
}

/** Чек-ин (CI_M прототипа): каждый пункт 1..5, 5 = хорошо. Достаточно отметить один пункт. */
export interface Checkin {
  id: string;
  date: string;
  sleep?: number;
  energy?: number;
  stress?: number;
  hunger?: number;
  pain?: number;
  adh?: number;
  note?: string;
}

export interface Measure {
  id: string;
  date: string;
  weight?: number;
  waist?: number;
}
