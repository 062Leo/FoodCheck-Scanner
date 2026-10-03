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

/**
 * Names that declare an allergen in the allergen and traces fields: Open Food Facts ids,
 * the app's own German and English labels, and common words people type into these fields
 * (edit form, traces text in the product's language). Matched as whole words.
 */
const ALLERGEN_NAMES: Record<EuAllergen, string[]> = {
  gluten: [
    'gluten',
    'wheat',
    'weizen',
    'rye',
    'roggen',
    'barley',
    'gerste',
    'oats',
    'hafer',
    'spelt',
    'dinkel',
  ],
  crustaceans: [
    'crustaceans',
    'crustacean',
    'krebstiere',
    'krebstier',
    'shrimps',
    'shrimp',
    'prawns',
    'garnelen',
    'garnele',
    'crab',
    'krabben',
    'lobster',
    'hummer',
  ],
  eggs: ['eggs', 'egg', 'eier', 'ei', 'hühnerei', 'hühnereier', 'vollei'],
  fish: ['fish', 'fisch'],
  peanuts: ['peanuts', 'peanut', 'erdnüsse', 'erdnuss'],
  soybeans: ['soybeans', 'soybean', 'soy', 'soya', 'soja', 'sojabohnen', 'sojabohne'],
  milk: ['milk', 'milch', 'lactose', 'laktose', 'milchprodukte', 'milcherzeugnisse'],
  nuts: [
    'nuts',
    'tree nuts',
    'schalenfrüchte',
    'nüsse',
    'nuss',
    'hazelnuts',
    'hazelnut',
    'haselnüsse',
    'haselnuss',
    'almonds',
    'almond',
    'mandeln',
    'mandel',
    'walnuts',
    'walnut',
    'walnüsse',
    'walnuss',
    'cashews',
    'cashew',
    'cashewnüsse',
    'pecans',
    'pecan',
    'pekannüsse',
    'pistachios',
    'pistachio',
    'pistazien',
    'pistazie',
    'macadamia',
    'macadamianüsse',
    'paranüsse',
    'paranuss',
  ],
  celery: ['celery', 'sellerie'],
  mustard: ['mustard', 'senf'],
  'sesame-seeds': ['sesame seeds', 'sesame', 'sesam', 'sesamsamen'],
  'sulphur-dioxide-and-sulphites': [
    'sulphur dioxide',
    'sulfur dioxide',
    'sulphites',
    'sulfites',
    'sulphite',
    'sulfite',
    'schwefeldioxid',
  ],
  lupin: ['lupin', 'lupins', 'lupine', 'lupinen'],
  molluscs: [
    'molluscs',
    'mollusks',
    'mollusc',
    'weichtiere',
    'weichtier',
    'muscheln',
    'muschel',
    'tintenfisch',
    'squid',
  ],
};

/** German and English plural/case endings, so "Haselnüssen" or "Eiern" still count. */
const WORD_ENDINGS = ['', 'e', 'n', 'en', 's', 'es', 'er', 'ern'];

const NAME_WORDS: [EuAllergen, string[]][] = EU_ALLERGENS.flatMap((allergen) =>
  ALLERGEN_NAMES[allergen].map((name) => [allergen, name.split(' ')] as [EuAllergen, string[]])
);

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/(^|[\s,;])[a-z]{2}:/g, '$1') // taxonomy prefixes such as "en:" or "de:"
    .split(/[^a-zß-öø-ÿ]+/) // Latin letters incl. umlauts and ß
    .filter(Boolean);
}

function matchesAt(text: string[], index: number, name: string[]): boolean {
  if (index + name.length > text.length) return false;
  return name.every((part, offset) => {
    const word = text[index + offset];
    // Short names such as "ei" only count exactly, otherwise "ein" would be an egg.
    if (offset < name.length - 1 || part.length <= 3) return word === part;
    return WORD_ENDINGS.some((ending) => word === part + ending);
  });
}

/** EU allergens named anywhere in an allergen or traces text ("Kann Spuren von Haselnüssen enthalten"). */
export function allergensNamedIn(value: string): Set<EuAllergen> {
  const text = words(value);
  const found = new Set<EuAllergen>();
  for (let index = 0; index < text.length; index++) {
    for (const [allergen, name] of NAME_WORDS) {
      if (matchesAt(text, index, name)) found.add(allergen);
    }
  }
  return found;
}

/** The allergen a single tag or entry stands for as a whole ("en:milk", "Milch", "Soy"), if any. */
export function allergenNamed(value: string): EuAllergen | undefined {
  const text = words(value);
  if (text.length === 0) return undefined;
  return NAME_WORDS.find(
    ([, name]) => name.length === text.length && matchesAt(text, 0, name)
  )?.[0];
}

/** Allergens of the user's profile that a product declares. */
export interface AllergenMatch {
  contains: EuAllergen[];
  traces: EuAllergen[];
  /** A profile is set but the product has no allergen or traces information at all. */
  noData: boolean;
}

function declared(values: string[]): Set<EuAllergen> {
  const found = new Set<EuAllergen>();
  for (const value of values) for (const allergen of allergensNamedIn(value)) found.add(allergen);
  return found;
}

/**
 * Compares a product's declared allergens with the user's profile. The result only says what
 * Open Food Facts (or the user's own edit) lists – an empty match never means the product is safe.
 */
export function matchAllergens(product: Product, profile: readonly EuAllergen[]): AllergenMatch {
  const allergenValues = product.allergensTags ?? [];
  const traceValues = [...(product.tracesTags ?? []), product.traces ?? ''];
  const noData = [...allergenValues, ...traceValues].every((value) => !value.trim());
  if (profile.length === 0) return { contains: [], traces: [], noData: false };
  const contains = declared(allergenValues);
  const traces = declared(traceValues);
  return {
    contains: profile.filter((allergen) => contains.has(allergen)),
    traces: profile.filter((allergen) => traces.has(allergen) && !contains.has(allergen)),
    noData,
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

export function hasAllergenMatch(match: AllergenMatch): boolean {
  return match.contains.length > 0 || match.traces.length > 0;
}
