import type { FilterRule, FilterRuleOperator } from '../../types/FilterRule';
import type { Product } from '../../types/Product';
import type { RedFlagFinding } from '../../types/ScanResult';
import { mentionsRawMilk } from '../product/rawMilk';
import { IngredientParser } from './IngredientParser';

/**
 * Checks that look at the whole product (categories, packaging, labels, nutrients)
 * instead of single words in the ingredient list. Each one is a rule of type "check"
 * in the user's rule list, so it can be removed or, for the ingredient count, tuned.
 */
export type CheckKey =
  | 'ingredient_count'
  | 'canned'
  | 'mercury_fish'
  | 'rice_arsenic'
  | 'pesticide_risk'
  | 'not_raw_milk'
  | 'alcoholic'
  | 'meat_substitute'
  | 'farmed_fish';

export const CHECK_KEYS: readonly CheckKey[] = [
  'ingredient_count',
  'canned',
  'mercury_fish',
  'rice_arsenic',
  'pesticide_risk',
  'not_raw_milk',
  'alcoholic',
  'meat_substitute',
  'farmed_fish',
];

export function isCheckKey(key: string): key is CheckKey {
  return (CHECK_KEYS as readonly string[]).includes(key);
}

/** Crops whose residue findings stand out in the German monitoring report 2023. */
export type PesticideCrop = 'mango' | 'pepper' | 'rice' | 'tea' | 'peanut' | 'greenBean' | 'cherry';

export interface CheckDetail {
  key: CheckKey;
  /** ingredient_count: number of ingredients found. */
  count?: number;
  /** ingredient_count: the rule's limit. */
  threshold?: number;
  operator?: FilterRuleOperator;
  /** pesticide_risk: the crop that matched. */
  crop?: PesticideCrop;
}

export interface CheckSeed {
  key: CheckKey;
  category: string;
  threshold?: number;
  operator?: FilterRuleOperator;
}

/** The checks a new installation starts with (all of them). */
export const CHECK_SEEDS: readonly CheckSeed[] = [
  { key: 'ingredient_count', category: 'Verarbeitung', threshold: 5, operator: 'gt' },
  { key: 'canned', category: 'Verpackung' },
  { key: 'mercury_fish', category: 'Schadstoffe' },
  { key: 'rice_arsenic', category: 'Schadstoffe' },
  { key: 'pesticide_risk', category: 'Schadstoffe' },
  { key: 'not_raw_milk', category: 'Erhitzte Milch' },
  { key: 'alcoholic', category: 'Alkohol' },
  { key: 'meat_substitute', category: 'Proteine & Fleischersatz' },
  { key: 'farmed_fish', category: 'Zuchtfisch' },
];

export const DEFAULT_INGREDIENT_LIMIT = 5;

const parser = new IngredientParser();

/** Lines that are part of an ingredient text but not ingredients. */
const NOT_AN_INGREDIENT =
  /^(\*|kann |kann$|enthält|may contain|contains|hergestellt|produziert|aus kontrolliert|aus ökolog|aus biolog|von kontrolliert|zutaten aus|spuren|traces|peut contenir|issu de l'agriculture|from organic|organic farming)/;

/**
 * Number of ingredients in a list. Compound ingredients count with their parts, not
 * as an extra one: "Schokolade (Zucker, Kakaomasse)" are two ingredients.
 */
export function countIngredients(ingredientsText: string): number {
  // "1,5 %" or "2.5%" must not split the list.
  const text = ingredientsText.replace(/(\d)[,.](\d)/g, '$1$2');
  const tokens = parser
    .parse(text)
    .filter((token) => token.normalized.length > 1 && !NOT_AN_INGREDIENT.test(token.normalized))
    .filter((token) => !/^[\d\s%]+$/.test(token.normalized));
  const parents = new Set(
    tokens.filter((token) => token.parentToken).map((token) => token.parentToken!.toLowerCase())
  );
  return tokens.filter((token) => token.isSubIngredient || !parents.has(token.text.toLowerCase()))
    .length;
}

const ORGANIC_LABELS = new Set([
  'en:organic',
  'en:eu-organic',
  'en:demeter',
  'en:bioland',
  'en:naturland',
  'en:biodynamic-agriculture',
]);
/** National organic control body codes, e.g. "en:de-oko-001", "en:fr-bio-13". */
const ORGANIC_CODE = /^[a-z]{2}:[a-z]{2}-(bio|oko|oeko|eko|ekol|org|ecol)-\d{2,3}$/;
const ORGANIC_TEXT =
  /kontrolliert[- ]biologische[mn]? anbau|ökologische[mnr]? (landbau|landwirtschaft|erzeugung)|biologische[mnr]? (landbau|landwirtschaft)|agriculture biologique|organic farming|organically grown/;

/** True if labels or the ingredient text say the product is organic. */
export function isOrganic(product: Product): boolean {
  const labels = product.labelsTags ?? [];
  if (labels.some((tag) => ORGANIC_LABELS.has(tag) || ORGANIC_CODE.test(tag))) return true;
  return ORGANIC_TEXT.test((product.ingredientsText ?? '').toLowerCase());
}

const LETTER = /\p{L}/u;

/** True if `term` occurs in `text` at the start of a word. */
function hasWordStart(text: string, term: string): boolean {
  let index = text.indexOf(term);
  while (index !== -1) {
    if (index === 0 || !LETTER.test(text[index - 1])) return true;
    index = text.indexOf(term, index + 1);
  }
  return false;
}

/** True if `term` occurs as a whole word or as the end of a compound ("Basmatireis"). */
function hasWordOrCompoundEnd(text: string, term: string): boolean {
  let index = text.indexOf(term);
  while (index !== -1) {
    const end = index + term.length;
    const startsWord = index === 0 || !LETTER.test(text[index - 1]);
    const endsWord = end >= text.length || !LETTER.test(text[end]);
    if (startsWord || endsWord) return true;
    index = text.indexOf(term, index + 1);
  }
  return false;
}

function hasTag(tags: string[] | undefined, test: (tag: string) => boolean): boolean {
  return (tags ?? []).some(test);
}

const CAN_SHAPE = /^[a-z]{2}:(food-|drink-|beverage-)?(can|cans|tin|tins|tin-can|tin-cans)$/;
const METAL_MATERIAL = /^[a-z]{2}:(metal|steel|tinplate|tin-plate|tinned-steel)$/;

function isCanned(product: Product): boolean {
  if (hasTag(product.packagingTags, (tag) => CAN_SHAPE.test(tag))) return true;
  return (
    hasTag(product.categoriesTags, (tag) => tag === 'en:canned-foods') &&
    hasTag(product.packagingTags, (tag) => METAL_MATERIAL.test(tag))
  );
}

const MERCURY_FISH_TAG = /(^|[:-])(tunas?|swordfish(es)?|sharks?|marlins?)($|-)/;
const MERCURY_FISH_WORDS = [
  'thunfisch',
  'tuna',
  'thon',
  'tonno',
  'atún',
  'atun',
  'tonijn',
  'tuńczyk',
  'schwertfisch',
  'swordfish',
  'espadon',
  'pez espada',
  'pesce spada',
  'haifisch',
  'dornhai',
  'schillerlocke',
  'shark',
  'requin',
  'marlin',
];

function containsMercuryFish(product: Product, lowerText: string): boolean {
  if (hasTag(product.categoriesTags, (tag) => MERCURY_FISH_TAG.test(tag))) return true;
  return MERCURY_FISH_WORDS.some((word) => hasWordStart(lowerText, word));
}

const RICE_WORDS = ['reis', 'rice', 'riz', 'riso', 'arroz', 'rijst', 'ryż'];

function isRiceBased(product: Product, lowerText: string): boolean {
  if (hasTag(product.categoriesTags, (tag) => tag === 'en:rices' || /(^|[:-])rice-/.test(tag))) {
    return true;
  }
  const first = parser.parse(lowerText)[0]?.normalized ?? '';
  return RICE_WORDS.some((word) => hasWordOrCompoundEnd(first, word));
}

const PESTICIDE_CROPS: { crop: PesticideCrop; tags: RegExp }[] = [
  { crop: 'mango', tags: /^en:(mangoes|dried-mangoes)$/ },
  { crop: 'pepper', tags: /^en:(black-peppers|white-peppers|peppercorns|white-peppercorns)$/ },
  { crop: 'rice', tags: /^en:rices$/ },
  { crop: 'tea', tags: /^en:(black-teas|green-teas)$/ },
  { crop: 'peanut', tags: /^en:(peanuts|peanut-butters)$/ },
  { crop: 'greenBean', tags: /^en:green-beans$/ },
  { crop: 'cherry', tags: /^en:cherries$/ },
];

function pesticideCrop(product: Product): PesticideCrop | undefined {
  if (isOrganic(product)) return undefined;
  return PESTICIDE_CROPS.find(({ tags }) => hasTag(product.categoriesTags, (tag) => tags.test(tag)))
    ?.crop;
}

function isDairyWithoutRawMilk(product: Product, lowerText: string): boolean {
  if (!hasTag(product.categoriesTags, (tag) => tag === 'en:dairies')) return false;
  // A negated mention ("nicht aus Rohmilch", "pas au lait cru") means heated milk.
  const raw =
    mentionsRawMilk(lowerText, { inCompounds: true }) ||
    hasTag(product.categoriesTags, (tag) => /raw-milk|lait-cru/.test(tag)) ||
    hasTag(product.labelsTags, (tag) => /raw-milk|lait-cru|rohmilch/.test(tag));
  return !raw;
}

function isAlcoholic(product: Product): boolean {
  if (hasTag(product.categoriesTags, (tag) => tag === 'en:alcoholic-beverages')) return true;
  const alcohol = product.nutriments?.alcohol100g;
  return typeof alcohol === 'number' && alcohol > 0;
}

function isMeatSubstitute(product: Product): boolean {
  return hasTag(product.categoriesTags, (tag) =>
    /^en:(meat-analogues|meat-alternatives)$|meat-analogues-/.test(tag)
  );
}

function isFarmedFish(product: Product): boolean {
  return (
    hasTag(product.labelsTags, (tag) => tag.startsWith('en:responsible-aquaculture')) ||
    hasTag(product.categoriesTags, (tag) => /(^|[:-])farmed-/.test(tag))
  );
}

function compare(value: number, operator: FilterRuleOperator, threshold: number): boolean {
  if (operator === 'lt') return value < threshold;
  if (operator === 'eq') return value === threshold;
  return value > threshold;
}

function evaluate(rule: FilterRule, product: Product, lowerText: string): CheckDetail | null {
  const key = rule.key as CheckKey;
  switch (key) {
    case 'ingredient_count': {
      if (!lowerText.trim()) return null;
      const threshold = rule.threshold ?? DEFAULT_INGREDIENT_LIMIT;
      const operator = rule.operator ?? 'gt';
      const count = countIngredients(lowerText);
      return compare(count, operator, threshold) ? { key, count, threshold, operator } : null;
    }
    case 'canned':
      return isCanned(product) ? { key } : null;
    case 'mercury_fish':
      return containsMercuryFish(product, lowerText) ? { key } : null;
    case 'rice_arsenic':
      return isRiceBased(product, lowerText) ? { key } : null;
    case 'pesticide_risk': {
      const crop = pesticideCrop(product);
      return crop ? { key, crop } : null;
    }
    case 'not_raw_milk':
      return isDairyWithoutRawMilk(product, lowerText) ? { key } : null;
    case 'alcoholic':
      return isAlcoholic(product) ? { key } : null;
    case 'meat_substitute':
      return isMeatSubstitute(product) ? { key } : null;
    case 'farmed_fish':
      return isFarmedFish(product) ? { key } : null;
    default:
      return null;
  }
}

/** Runs the user's "check" rules against a product. */
export function runProductChecks(product: Product, rules: FilterRule[]): RedFlagFinding[] {
  const lowerText = (product.ingredientsText ?? '').toLowerCase();
  const findings: RedFlagFinding[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    if (rule.type !== 'check' || rule.severity !== 'red_flag' || seen.has(rule.key)) continue;
    const detail = evaluate(rule, product, lowerText);
    if (!detail) continue;
    seen.add(rule.key);
    findings.push({
      ingredient: rule.key,
      category: rule.category,
      severity: 'critical',
      check: detail,
    });
  }
  return findings;
}
