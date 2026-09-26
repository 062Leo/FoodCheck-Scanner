import type { TranslationKey } from './translations';
import type { TranslateFn } from './useTranslation';

/** The 14 EU allergens as Open Food Facts tags them (taxonomy ids without language prefix). */
const ALLERGEN_TRANSLATION_KEYS: Record<string, TranslationKey> = {
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

/** A single tag such as "en:milk" in the UI language; unknown tags are shown readable as they are. */
export function allergenLabel(tag: string, t: TranslateFn): string {
  const trimmed = tag.trim();
  const prefix = /^[a-z]{2}:/.exec(trimmed);
  if (!prefix) {
    // Free text, e.g. the traces field ("milk, nuts, soybeans"): translate exact allergen names only.
    const known = ALLERGEN_TRANSLATION_KEYS[trimmed.toLowerCase().replace(/\s+/g, '-')];
    return known ? t(known) : trimmed;
  }
  const id = trimmed.slice(prefix[0].length);
  const key = prefix[0] === 'en:' ? ALLERGEN_TRANSLATION_KEYS[id] : undefined;
  if (key) return t(key);
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
