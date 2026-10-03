import type { TranslationKey } from './translations';
import type { TranslateFn } from './useTranslation';

/** Languages the app offers for ingredient lists (all supported by Open Food Facts). */
export const INGREDIENT_LANGUAGES = ['de', 'en', 'fr', 'it', 'es', 'nl', 'pt', 'pl'] as const;

/** Display name of a language code, e.g. "de" → "Deutsch"; "?" → "Original". */
export function languageLabel(code: string, t: TranslateFn): string {
  if (code === '?') return t('product.original');
  const key = `product.lang.${code}` as TranslationKey;
  const label = t(key);
  return label === key ? code.toUpperCase() : label;
}
