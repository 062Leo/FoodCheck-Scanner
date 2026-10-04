import type { Product, ProductNutriments } from '../../types/Product';
import { hasProductName } from './productName';
import { applyEditedFields, type EditedFields } from './editedFields';

/** Fields the user can correct on the edit screen. */
const USER_EDITABLE_FIELDS = [
  'brand',
  'categories',
  'ingredientsText',
  'ingredientsTextDe',
  'ingredientsTextEn',
  'novaScore',
  'quantity',
  'servingSize',
  'allergensTags',
  'traces',
  'origins',
  'manufacturingPlaces',
  'stores',
] as const satisfies readonly (keyof Product)[];

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function definedNutriments(nutriments: ProductNutriments | undefined): ProductNutriments {
  const result: ProductNutriments = {};
  if (!nutriments) return result;
  for (const [key, value] of Object.entries(nutriments) as [keyof ProductNutriments, unknown][]) {
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  return result;
}

function hasIngredients(product: Product): boolean {
  return (
    isPresent(product.ingredientsText) ||
    isPresent(product.ingredientsTextDe) ||
    isPresent(product.ingredientsTextEn) ||
    Object.values(product.ingredientsTextByLang ?? {}).some(isPresent)
  );
}

/** Fields taken over one by one from stored USDA data when Open Food Facts lacks them. */
const USDA_FILL_FIELDS = [
  'brand',
  'brandOwner',
  'categories',
  'quantity',
  'servingSize',
] as const satisfies readonly (keyof Product)[];

/**
 * Combines a fresh Open Food Facts entry with a product stored from USDA FoodData
 * Central, so a sparse entry (e.g. only a photo) does not throw away the USDA data.
 * Open Food Facts wins wherever it has a value; fields it lacks come from USDA.
 * Ingredients (all language texts together) and nutriments are taken as a whole, never
 * mixed. Source rule: the result keeps source 'usda' whenever it uses the USDA
 * ingredient text or USDA nutriments, so the USDA source line stays visible; otherwise
 * it is an Open Food Facts product.
 */
export function fillFromUsda(fresh: Product, stored: Product | null): Product {
  if (stored?.source !== 'usda') return fresh;

  const merged: Product = { ...fresh };
  delete merged.source;
  const target = merged as unknown as Record<string, unknown>;
  for (const field of USDA_FILL_FIELDS) {
    if (!isPresent(fresh[field]) && isPresent(stored[field])) target[field] = stored[field];
  }
  if (!hasProductName(fresh.name) && hasProductName(stored.name)) merged.name = stored.name;

  let usesUsdaData = false;
  if (!hasIngredients(fresh) && hasIngredients(stored)) {
    merged.ingredientsText = stored.ingredientsText;
    merged.ingredientsTextDe = stored.ingredientsTextDe;
    merged.ingredientsTextEn = stored.ingredientsTextEn;
    merged.ingredientsTextByLang = stored.ingredientsTextByLang;
    usesUsdaData = true;
  }
  const freshNutriments = definedNutriments(fresh.nutriments);
  const storedNutriments = definedNutriments(stored.nutriments);
  if (Object.keys(freshNutriments).length === 0 && Object.keys(storedNutriments).length > 0) {
    merged.nutriments = storedNutriments;
    usesUsdaData = true;
  }
  if (usesUsdaData) merged.source = 'usda';
  return merged;
}

/**
 * Combines fresh Open Food Facts data with the locally stored product.
 *
 * - Not edited on this device: the fresh data wins completely, so corrections made on
 *   Open Food Facts reach the app.
 * - Edited fields known: exactly those fields keep the user's value (also an
 *   intentionally emptied one); everything else comes from Open Food Facts.
 * - Edited before field tracking existed ('all'): every editable field the local
 *   product holds wins, as the app always did.
 */
export function mergeProductData(
  fresh: Product,
  local: Product | null,
  edited: EditedFields | null
): Product {
  if (!local || !edited) {
    return fresh;
  }
  if (edited !== 'all') {
    const merged: Product = { ...fresh };
    applyEditedFields(merged, local, edited);
    return merged;
  }

  const merged: Product = { ...fresh };
  const target = merged as unknown as Record<string, unknown>;
  for (const field of USER_EDITABLE_FIELDS) {
    const value = local[field];
    if (isPresent(value)) {
      target[field] = value;
    }
  }

  if (hasProductName(local.name)) {
    merged.name = local.name;
  }

  const nutriments = {
    ...definedNutriments(fresh.nutriments),
    ...definedNutriments(local.nutriments),
  };
  if (Object.keys(nutriments).length > 0) {
    merged.nutriments = nutriments;
  }

  if (local.ingredientsTextByLang && isPresent(local.ingredientsTextByLang)) {
    merged.ingredientsTextByLang = {
      ...(fresh.ingredientsTextByLang ?? {}),
      ...local.ingredientsTextByLang,
    };
  }

  return merged;
}
