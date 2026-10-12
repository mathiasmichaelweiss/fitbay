// Общие типы и константы для web, backoffice и api (сущности из спеки, раздел 5).
export type Role = 'client' | 'trainer' | 'partner' | 'studio' | 'admin';
export type Lang = 'ru' | 'de' | 'en';
export type AiTask =
  | 'food_photo' | 'food_text' | 'day_story' | 'coach'
  | 'activity' | 'recipe' | 'workout_ai' | 'plan_ai' | 'label_ocr';

/** Версии текстов согласий (спека 4.9, 7). Новая версия текста = новый номер, пользователь соглашается заново. */
export const CONSENT_VERSIONS = { health: 1, privacy: 1, trainer: 1 } as const;
export type ConsentKind = keyof typeof CONSENT_VERSIONS;
export interface Consent {
  v: number;
  at: string; // ISO
}

export interface Profile {
  id?: string;
  name?: string;
  sex: 'm' | 'f';
  birth: string;
  h: number;
  w: number;
  tw?: number; // целевой вес
  act: 'low' | 'light' | 'mid' | 'high';
  goal: 'lose' | 'keep' | 'gain';
  lang?: Lang;
  consents: Partial<Record<ConsentKind, Consent>>;
  createdAt?: string;
  updatedAt?: string;
}

export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface Meal {
  id: string;
  date: string;
  slot: Slot;
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  grams?: number;
  createdAt?: string;
}

/** Чек-ин: шкалы 1..5 (5 = лучше; для стресса, голода и боли 5 = сильнее). */
export interface Checkin {
  id: string;
  date: string;
  sleep: number;
  energy: number;
  stress: number;
  hunger: number;
  pain: number;
  adh: number;
  note?: string;
}

export interface Measure {
  id: string;
  date: string;
  weight?: number;
  waist?: number;
}
