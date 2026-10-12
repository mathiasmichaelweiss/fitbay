/**
 * WEIGHT.analyze прототипа: «Почему вес изменился?». Разница на весах раскладывается на жир, сухую массу,
 * мышцы и воду с гликогеном по дефициту калорий между взвешиваниями. Эталоны: golden-weight.json.
 */
import { fatFromDeficit } from './index';

export type WeightKind = 'plan' | 'water_start' | 'water_loss' | 'water_gain' | 'surplus_train' | 'surplus' | 'water_loss2';
export interface WeightPoint {
  w: number;
  date: string;
  /** нет прошлого взвешивания: старт с веса профиля */
  start?: boolean;
}
export interface WeightAnalysis {
  diff: number;
  days: number;
  def: number;
  fat: number;
  lean: number;
  muscle: number;
  water: number;
  pk: number;
  wo: number;
  logged: number;
  kind: WeightKind;
  firstWeeks: boolean;
}

const shift = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

/**
 * D: dayStats; workoutDates: даты тренировок; firstMeal: дата первой записи еды.
 */
export function weightAnalyze(D: { d: string; def: number; pk: number }[], prev: WeightPoint, newW: number, newDate: string, workoutDates: string[], firstMeal: string | undefined): WeightAnalysis {
  const L = D.filter((x) => x.d >= prev.date && x.d < newDate);
  const days = Math.max(1, Math.round((Date.parse(`${newDate}T12:00:00`) - Date.parse(`${prev.date}T12:00:00`)) / 864e5));
  const def = L.reduce((a, x) => a + x.def, 0);
  const fatG = L.reduce((a, x) => a + fatFromDeficit(x.def, x.pk), 0);
  const tissue = -def / 7700;
  const pk = L.length ? L.reduce((a, x) => a + x.pk, 0) / L.length : 0;
  const wo = workoutDates.filter((d) => d >= prev.date && d < newDate).length;
  const diff = newW - prev.w;
  const other = diff - tissue;
  const fat = -fatG / 1000;
  const lean = tissue - fat;
  const firstWeeks = !!prev.start || (firstMeal ?? newDate) >= shift(newDate, -14);
  let kind: WeightKind;
  if (Math.abs(other) < 0.4) kind = 'plan';
  else if (diff < 0 && other < 0) kind = firstWeeks ? 'water_start' : 'water_loss';
  else if (diff > 0 && tissue <= 0) kind = 'water_gain';
  else if (diff > 0) kind = wo >= 2 && pk >= 1.6 ? 'surplus_train' : 'surplus';
  else kind = 'water_loss2';
  let muscle = 0;
  if (diff > 0 && wo >= 1 && pk >= 1.6) muscle = Math.min(Math.max(0, diff - Math.max(0, fat)), 0.035 * days * (wo >= 2 ? 1 : 0.5));
  const sur = kind.startsWith('surplus');
  const water = diff - fat - (sur ? Math.max(0, lean) : lean) - muscle;
  return { diff, days, def, fat, lean: sur ? Math.max(0, lean) : lean, muscle, water, pk, wo, logged: L.length, kind, firstWeeks };
}

/** Тексты WEIGHT.text прототипа: заголовок и пояснение по типу (ключи i18n). */
export const WEIGHT_TEXT: Record<WeightKind, [string, string]> = {
  plan: ['Всё по плану', 'Вес меняется ровно так, как говорят калории. Продолжай в том же темпе.'],
  water_start: [
    'Это в основном вода, и это нормально',
    'В первые дни учёта люди обычно едят меньше соли, сахара и быстрых углеводов. Организм отдаёт запас гликогена, а с ним и воду: каждый грамм гликогена держит около 3 г воды. Плюс в кишечнике меньше содержимого. Такой «быстрый минус» бывает только на старте, дальше нормальный темп при рекомпозиции 0,2-0,5 кг в неделю.',
  ],
  water_loss: [
    'Больше, чем объясняют калории',
    'Часть минуса это вода: меньше соли или углеводов, жарко, много ходил, сходил в туалет перед взвешиванием. Завтра вес может немного вернуться, смотри на средний вес за неделю.',
  ],
  water_gain: [
    'Это не жир',
    'Ты был в дефиците, значит жир уходил. Плюс на весах это вода: солёная или углеводная еда накануне, поздний ужин, новая или тяжёлая тренировка (мышцы задерживают воду для восстановления), мало сна или стресс. Через 2-4 дня обычно уходит.',
  ],
  surplus_train: [
    'Набор: мышцы, гликоген и немного жира',
    'Ты ел больше расхода, тренировался и добирал белок. Часть прибавки это мышцы и запас гликогена с водой в мышцах, часть жир. Для набора это ожидаемо, держи профицит небольшим, 200-300 ккал.',
  ],
  surplus: ['Прибавка от профицита', 'Ты ел больше расхода, а тренировок или белка было мало. Прибавка в основном жир и вода. Если цель не набор, верни дефицит и добавь силовые.'],
  water_loss2: ['Колебание воды', 'Калорий было больше расхода, поэтому настоящего похудения тут нет. Минус на весах это вода и содержимое кишечника.'],
};
