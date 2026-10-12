import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Lang } from '@fitbay/shared';
import protoDe from './proto-de.json';
import { extraDe } from './extra-de';

/**
 * i18n по схеме прототипа: ключ = русский текст (как T("...") в kalorii.html),
 * немецкий берётся из словаря DE прототипа (proto-de.json, 1244 строки) и extra-de.ts.
 * Для ru ресурсов нет: i18next возвращает сам ключ.
 */
export const DE: Record<string, string> = { ...(protoDe as Record<string, string>), ...extraDe };

const KEY = 'fitbay.lang';
const stored = (() => {
  try {
    return localStorage.getItem(KEY) as Lang | null;
  } catch {
    return null;
  }
})();

void i18n.use(initReactI18next).init({
  resources: { de: { translation: DE }, ru: { translation: {} } },
  lng: stored ?? 'ru',
  fallbackLng: false,
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: false,
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
