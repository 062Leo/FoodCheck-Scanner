import type { Translator } from '../domain/translation/Translator';
import { SEARCH_LANGUAGES } from '../domain/rules/ingredientTranslations';
import { TranslationRouter } from '../infrastructure/translation/TranslationRouter';

/**
 * Translates a user-defined ingredient keyword into all search languages, so a rule
 * like "Kokosfett" also matches "coconut fat" on an English label. Requests run in
 * parallel through the translation service chosen in the settings; failures are
 * skipped. Returns the JSON stored in filter_rules.translations, or null.
 */
export async function translateRuleKeyword(
  keyword: string,
  translator: Translator = new TranslationRouter()
): Promise<string | null> {
  const results = await Promise.allSettled(
    SEARCH_LANGUAGES.map(async (lang) => [lang, await translator.translate(keyword, lang)] as const)
  );

  const translations: Record<string, string> = {};
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const [lang, translated] = result.value;
    const cleaned = translated?.trim();
    if (cleaned && cleaned.toLowerCase() !== keyword.trim().toLowerCase()) {
      translations[lang] = cleaned;
    }
  }
  return Object.keys(translations).length > 0 ? JSON.stringify(translations) : null;
}
