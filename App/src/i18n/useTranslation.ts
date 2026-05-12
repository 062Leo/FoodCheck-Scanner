import { useLanguageStore } from '../store/languageStore';
import { getTranslations, type TranslationKey } from './translations';

export function useTranslation() {
  const language = useLanguageStore((s) => s.language);
  const translations = getTranslations(language);
  return {
    t: (key: TranslationKey, params?: Record<string, string | number>) => {
      let text = translations[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{{${k}}}`, String(v));
        }
      }
      return text;
    },
    language,
  };
}
