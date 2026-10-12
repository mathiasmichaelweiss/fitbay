/**
 * База упражнений и словари раздела «Тренировки», извлечены из прототипа
 * скриптом scripts/extract-exercises.mjs (exdb, DICT, PRE, GROUPS, EQ, WTAGS, AI_EQ).
 */
import exdb from './exdb.json';
import dicts from './dicts.json';

export interface Exercise {
  /** id (как в free-exercise-db) */
  i: string;
  /** английское название */
  n: string;
  /** категория: strength, stretching, cardio… */
  c: string;
  /** уровень: beginner | intermediate | expert */
  l: string;
  /** оборудование */
  e: string;
  /** основные мышцы */
  p: string[];
  /** вспомогательные мышцы */
  s: string[];
  /** шаги техники (англ.) */
  t: string[];
  m?: string;
}

export const EX = exdb as Exercise[];
export const EXM: Record<string, Exercise> = Object.fromEntries(EX.map((e) => [e.i, e]));
/** Перевод мышц, оборудования, категорий и уровней: [ru, de]. */
export const DICT = dicts.DICT as unknown as Record<string, [string, string]>;
/** Готовые названия популярных упражнений: [ru, de]. */
export const PRE = dicts.PRE as unknown as Record<string, [string, string]>;
/** Группы мышц для фильтра: [ключ, подпись, мышцы | null]. */
export const GROUPS = dicts.GROUPS as unknown as [string, string, string[] | null][];
/** Фильтр оборудования: [ключ, подпись]. */
export const EQ = dicts.EQ as unknown as [string, string][];
/** Метки к упражнению и тренировке: [ключ, эмодзи, подпись]. */
export const WTAGS = dicts.WTAGS as unknown as [string, string, string][];
/** Инвентарь дома для AI-тренера: [ключ, подпись, оборудование в базе]. */
export const AI_EQ = dicts.AI_EQ as unknown as [string, string, string][];

export type ExLang = 'ru' | 'de' | 'en';
/** D() прототипа */
export const D = (k: string, lang: ExLang) => (DICT[k]?.[lang === 'de' ? 1 : 0] ?? k);
/** exName() прототипа; names: переведенные названия (кэш), если есть. */
export const exName = (e: Exercise | undefined, lang: ExLang, names: Record<string, string> = {}) =>
  !e ? '' : (PRE[e.i]?.[lang === 'de' ? 1 : 0] ?? (names[e.i] || e.n));
