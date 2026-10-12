// Общие типы и константы для web, backoffice и api (сущности из спеки, раздел 5).
export type Role = 'client' | 'trainer' | 'partner' | 'studio' | 'admin';
export type Lang = 'ru' | 'de' | 'en';
export type AiTask =
  | 'food_photo' | 'food_text' | 'day_story' | 'coach'
  | 'activity' | 'recipe' | 'workout_ai' | 'plan_ai' | 'label_ocr';
