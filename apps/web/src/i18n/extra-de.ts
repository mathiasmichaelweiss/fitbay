/**
 * Строки, которых нет в словаре прототипа (proto-de.json).
 * Ключ: русский текст, как в прототипе. Новые строки добавлять сюда, юнит-тест проверяет полноту.
 */
export const extraDe: Record<string, string> = {
  'Сегодня': 'Heute',
  'Тренировки': 'Training',
  'Прогресс': 'Fortschritt',
  'Тренер': 'Trainer',
  'Я': 'Ich',
  'Кабинет': 'Cockpit',
  'Клиенты': 'Kunden',
  'Расписание': 'Kalender',
  'Обзор': 'Übersicht',
  'Шаблоны': 'Vorlagen',
  'Язык': 'Sprache',
  'Уведомления': 'Benachrichtigungen',
  'Настройки': 'Einstellungen',
  'Скоро здесь будет раздел': 'Dieser Bereich kommt bald',
  'Выберите дату': 'Datum wählen',
  'Шаг {{n}} из {{total}}': 'Schritt {{n}} von {{total}}',
  'Старт': 'Start',
  'Изменение': 'Veränderung',
  'Записать вес': 'Gewicht eintragen',
  'Вес сегодня, кг': 'Gewicht heute, kg',
  'История веса': 'Gewichtsverlauf',
  'Пока нет записей': 'Noch keine Einträge',
  'Пока пусто': 'Noch leer',
  // из прототипа (render(), инлайн-ветка lang === "de")
  'День чистый. Начни с белкового завтрака, так проще закрыть средний круг.': 'Der Tag ist leer. Starte mit einem eiweißreichen Frühstück, dann schließt du den mittleren Ring leichter.',
  'Все круги закрыты. Отличный день.': 'Alle Ringe geschlossen. Starker Tag.',
  'Выбрать другое блюдо': 'Anderes Gericht wählen',
  'без фиников, скира на 20% меньше': 'ohne Datteln, 20% weniger Skyr',
  'средняя': 'mittel',
};
