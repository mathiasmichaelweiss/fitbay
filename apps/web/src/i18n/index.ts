import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Lang } from '@fitbay/shared';
import { ru } from './ru';
import { de } from './de';

const KEY = 'fitbay.lang';
const stored = (() => {
  try {
    return localStorage.getItem(KEY) as Lang | null;
  } catch {
    return null;
  }
})();

void i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, de: { translation: de } },
  lng: stored ?? 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(KEY, lng);
  } catch {
    /* приватный режим: язык просто не запомнится */
  }
});

export const LANGS: Lang[] = ['ru', 'de'];
export default i18n;
