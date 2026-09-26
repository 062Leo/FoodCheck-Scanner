import type { Product } from '../../types/Product';

/** The 14 EU allergens as Open Food Facts taxonomy ids (the part after "en:"). */
export const EU_ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame-seeds',
  'sulphur-dioxide-and-sulphites',
  'lupin',
  'molluscs',
] as const;

export type EuAllergen = (typeof EU_ALLERGENS)[number];

export function isEuAllergen(value: string): value is EuAllergen {
  return (EU_ALLERGENS as readonly string[]).includes(value);
}

/** Allergens of the user's profile that a product declares. */
export interface AllergenMatch {
  contains: EuAllergen[];
  traces: EuAllergen[];
}

/**
 * Allergen ids named by tags ("en:milk") or by the free traces text ("milk, nuts").
 * Only exact EU allergen names count; anything else is ignored.
 */
function declaredAllergens(values: string[]): Set<EuAllergen> {
  const found = new Set<EuAllergen>();
  for (const value of values) {
    const id = value.trim().toLowerCase().replace(/^en:/, '').replace(/\s+/g, '-');
    if (isEuAllergen(id)) found.add(id);
  }
  return found;
}

/**
 * Compares a product's declared allergens with the user's profile. The result only says what
 * Open Food Facts lists – an empty match never means the product is safe.
 */
export function matchAllergens(product: Product, profile: readonly EuAllergen[]): AllergenMatch {
  if (profile.length === 0) return { contains: [], traces: [] };
  const contains = declaredAllergens(product.allergensTags ?? []);
  const traces = declaredAllergens((product.traces ?? '').split(','));
  return {
    contains: profile.filter((allergen) => contains.has(allergen)),
    traces: profile.filter((allergen) => traces.has(allergen) && !contains.has(allergen)),
  };
}

/** Parses a stored profile, dropping anything that is not an EU allergen id. */
export function parseAllergenProfile(stored: string | null): EuAllergen[] {
  if (!stored) return [];
  try {
    const value: unknown = JSON.parse(stored);
    if (!Array.isArray(value)) return [];
    return EU_ALLERGENS.filter((allergen) => value.includes(allergen));
  } catch {
    return [];
  }
}
