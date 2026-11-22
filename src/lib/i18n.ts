import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

export const LANGUAGES = [
  { code: 'ar', label: 'العربية', dir: 'rtl' as const },
  { code: 'en', label: 'English', dir: 'ltr' as const },
];

const STORAGE_KEY = 'sudamind.lang';

export function storedLanguage(): string {
  return localStorage.getItem(STORAGE_KEY) ?? 'ar';
}

/**
 * Sets `lang` and `dir` on <html> alongside the i18next language. Direction is a document
 * concern, not a component concern — every layout in the app is written with logical
 * properties (start/end, ms/me) so the whole dashboard mirrors from this one switch.
 */
export function applyLanguage(code: string) {
  const lang = LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
  localStorage.setItem(STORAGE_KEY, lang.code);
  document.documentElement.lang = lang.code;
  document.documentElement.dir = lang.dir;
  if (i18n.language !== lang.code) void i18n.changeLanguage(lang.code);
}

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
