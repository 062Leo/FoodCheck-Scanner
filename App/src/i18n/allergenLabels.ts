import type { TranslationKey } from './translations';
import type { TranslateFn } from './useTranslation';
import { isEuAllergen, type EuAllergen } from '../domain/allergens/allergenProfile';

const ALLERGEN_TRANSLATION_KEYS: Record<EuAllergen, TranslationKey> = {
  gluten: 'allergen.gluten',
  crustaceans: 'allergen.crustaceans',
  eggs: 'allergen.eggs',
  fish: 'allergen.fish',
  peanuts: 'allergen.peanuts',
  soybeans: 'allergen.soybeans',
  milk: 'allergen.milk',
  nuts: 'allergen.nuts',
  celery: 'allergen.celery',
  mustard: 'allergen.mustard',
  'sesame-seeds': 'allergen.sesame',
  'sulphur-dioxide-and-sulphites': 'allergen.sulphites',
  lupin: 'allergen.lupin',
  molluscs: 'allergen.molluscs',
};

/** Name of one of the 14 EU allergens in the UI language. */
export function allergenName(allergen: EuAllergen, t: TranslateFn): string {
  return t(ALLERGEN_TRANSLATION_KEYS[allergen]);
}

/** A single tag such as "en:milk" in the UI language; unknown tags are shown readable as they are. */
export function allergenLabel(tag: string, t: TranslateFn): string {
  const trimmed = tag.trim();
  const prefix = /^[a-z]{2}:/.exec(trimmed);
  if (!prefix) {
    // Free text, e.g. the traces field ("milk, nuts, soybeans"): translate exact allergen names only.
    const id = trimmed.toLowerCase().replace(/\s+/g, '-');
    return isEuAllergen(id) ? allergenName(id, t) : trimmed;
  }
  const id = trimmed.slice(prefix[0].length);
  if (prefix[0] === 'en:' && isEuAllergen(id)) return allergenName(id, t);
  const name = id.replace(/-/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Allergen tags or the free "traces" field ("en:milk,en:nuts" or plain text) as one
 * comma-separated, de-duplicated list.
 */
export function allergenList(value: string[] | string | undefined, t: TranslateFn): string {
  const tags = Array.isArray(value) ? value : (value ?? '').split(',');
  const labels = tags.filter((tag) => tag.trim().length > 0).map((tag) => allergenLabel(tag, t));
  return [...new Set(labels)].join(', ');
}
