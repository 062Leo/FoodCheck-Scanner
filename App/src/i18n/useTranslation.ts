import { useMemo } from 'react';
import { useLanguageStore } from '../store/languageStore';
import { getTranslations, type SupportedLanguage, type TranslationKey } from './translations';

export type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

export function createTranslator(language: SupportedLanguage): TranslateFn {
  const translations = getTranslations(language);
  return (key, params) => {
    let text: string = translations[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.split(`{{${k}}}`).join(String(v));
      }
    }
    return text;
  };
}

const LOCALES: Record<SupportedLanguage, string> = { de: 'de-DE', en: 'en-GB' };

export function formatDate(iso: string | null | undefined, language: SupportedLanguage): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(LOCALES[language]);
}

/** Formats a number with the decimal separator of the UI language. */
export function formatNumber(
  value: number,
  language: SupportedLanguage,
  maximumFractionDigits = 1
): string {
  return value.toLocaleString(LOCALES[language], { maximumFractionDigits });
}

/** `t` is stable for a given language, so it can be used in hook dependencies. */
export function useTranslation() {
  const language = useLanguageStore((s) => s.language);
  return useMemo(() => ({ t: createTranslator(language), language }), [language]);
}
