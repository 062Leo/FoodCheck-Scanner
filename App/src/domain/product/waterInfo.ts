import type { Product, ProductNutriments } from '../../types/Product';

/**
 * Bottled water: what Open Food Facts' categories, packaging and nutriments say about it.
 * Used by the water checks (productChecks) and the information note on the product page.
 */

/** "en:waters" and its children in the Open Food Facts category taxonomy. */
const WATER_CATEGORIES = new Set([
  'en:waters',
  'en:table-waters',
  'en:spring-waters',
  'en:mineral-waters',
  'en:natural-mineral-waters',
  'en:carbonated-natural-mineral-waters',
  'en:non-carbonated-natural-mineral-waters',
  'en:carbonated-mineral-waters',
  'en:low-mineral-bottled-waters',
  'en:flavored-waters',
  'en:flavored-spring-waters',
  'en:carbonated-waters',
  'en:mountain-waters',
  'en:medicinal-waters',
  'en:drinking-water',
  'en:distilled-waters',
  'en:vitamin-waters',
]);

const NATURAL_MINERAL_WATER = new Set([
  'en:natural-mineral-waters',
  'en:carbonated-natural-mineral-waters',
  'en:non-carbonated-natural-mineral-waters',
]);

/** Why a water is no natural mineral water. */
export type WaterKind = 'table' | 'spring' | 'other';

export function isWater(product: Product): boolean {
  return (product.categoriesTags ?? []).some((tag) => WATER_CATEGORIES.has(tag));
}

export function isNaturalMineralWater(product: Product): boolean {
  return (product.categoriesTags ?? []).some((tag) => NATURAL_MINERAL_WATER.has(tag));
}

/**
 * For a water that is no natural mineral water: which kind it is, else null. A table
 * water always counts, even if it is also tagged as natural mineral water.
 */
export function nonMineralWaterKind(product: Product): WaterKind | null {
  if (!isWater(product)) return null;
  const tags = product.categoriesTags ?? [];
  if (tags.includes('en:table-waters')) return 'table';
  if (isNaturalMineralWater(product)) return null;
  if (tags.includes('en:spring-waters')) return 'spring';
  return 'other';
}

/** The part after the language prefix, e.g. "pet-polyethylene-terephthalate". */
function packagingWords(product: Product): string[] {
  return (product.packagingTags ?? []).map((tag) => tag.replace(/^[a-z]{2}:/, ''));
}

const PLASTIC =
  /(^|-)(plastics?|pet|r-?pet|kunststoff|kunststoffflasche|plastique|plastica|plastico|plástico|plastik|plastikflasche|petflasche|pet-?flaschen?|polyethylene?-?terephthalate?|polyethylenterephtalat|polyethylenterephthalat)(-|$)/;
const GLASS = /(^|-)(glass|glas|glasflasche|glasflaschen|verre|vetro|vidrio|vidro|szklo)(-|$)/;

export function hasPlasticPackaging(product: Product): boolean {
  return packagingWords(product).some((word) => PLASTIC.test(word));
}

export function hasGlassPackaging(product: Product): boolean {
  return packagingWords(product).some((word) => GLASS.test(word));
}

/** Open Food Facts stores g per 100 g; for water 1 l ≈ 1 kg, so mg/l = value × 10000. */
export function toMgPerLitre(gramsPer100g: number): number {
  return Math.round(gramsPer100g * 10000 * 10000) / 10000;
}

export type WaterMineral = 'nitrate' | 'nitrite' | 'sodium' | 'sulphate' | 'fluoride' | 'manganese';

/**
 * Limits for "geeignet für die Zubereitung von Säuglingsnahrung" in mg/l
 * (Mineral- und Tafelwasser-Verordnung, Anlage 6).
 */
export const INFANT_FOOD_LIMITS: readonly {
  mineral: WaterMineral;
  field: keyof ProductNutriments;
  limit: number;
}[] = [
  { mineral: 'nitrate', field: 'nitrate100g', limit: 10 },
  { mineral: 'nitrite', field: 'nitrite100g', limit: 0.02 },
  { mineral: 'sodium', field: 'sodium100g', limit: 20 },
  { mineral: 'sulphate', field: 'sulphate100g', limit: 240 },
  { mineral: 'fluoride', field: 'fluoride100g', limit: 0.7 },
  { mineral: 'manganese', field: 'manganese100g', limit: 0.05 },
];

export interface ExceededValue {
  mineral: WaterMineral;
  /** mg/l */
  value: number;
  /** mg/l */
  limit: number;
}

/** Values of a water above the infant-food limits; only values that are given count. */
export function exceededInfantFoodLimits(product: Product): ExceededValue[] {
  if (!isWater(product)) return [];
  const nutriments = product.nutriments ?? {};
  return INFANT_FOOD_LIMITS.flatMap(({ mineral, field, limit }) => {
    const raw = nutriments[field];
    if (typeof raw !== 'number') return [];
    const value = toMgPerLitre(raw);
    return value > limit ? [{ mineral, value, limit }] : [];
  });
}

const ION_FIELDS: (keyof ProductNutriments)[] = [
  'sodium100g',
  'calcium100g',
  'magnesium100g',
  'potassium100g',
  'bicarbonate100g',
  'chloride100g',
  'sulphate100g',
  'nitrate100g',
  'fluoride100g',
];

const INFANT_LABEL = /s[aä]ugling|infant|nourrisson|baby|lattanti|lactantes/;
const NOT_FOR_INFANTS = /not-recommended|nicht-empfohlen|nicht-geeignet|not-suitable/;

export interface WaterInfo {
  naturalMineral: boolean;
  infantLabel: boolean;
  /** Glass bottle and no plastic in the packaging data. */
  glass: boolean;
  /** Sum of the given ion values below 50 mg/l (an approximation of the dry residue). */
  mineralPoor: boolean;
  /** Calcium above 150 mg/l. */
  calciumRich: boolean;
  /** Magnesium above 50 mg/l. */
  magnesiumRich: boolean;
}

/** Information notes for a water (not part of the rating), or null for other products. */
export function waterInfo(product: Product): WaterInfo | null {
  if (!isWater(product)) return null;
  const nutriments = product.nutriments ?? {};
  const ions = ION_FIELDS.map((field) => nutriments[field]).filter(
    (value): value is number => typeof value === 'number'
  );
  const ionSum = ions.reduce((sum, value) => sum + toMgPerLitre(value), 0);
  const mgPerLitre = (value: number | undefined) =>
    typeof value === 'number' ? toMgPerLitre(value) : 0;
  return {
    naturalMineral: isNaturalMineralWater(product),
    infantLabel: (product.labelsTags ?? []).some(
      (tag) => INFANT_LABEL.test(tag.toLowerCase()) && !NOT_FOR_INFANTS.test(tag.toLowerCase())
    ),
    glass: hasGlassPackaging(product) && !hasPlasticPackaging(product),
    mineralPoor: ions.length >= 3 && ionSum < 50,
    calciumRich: mgPerLitre(nutriments.calcium100g) > 150,
    magnesiumRich: mgPerLitre(nutriments.magnesium100g) > 50,
  };
}
