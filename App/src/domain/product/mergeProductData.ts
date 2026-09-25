import type { Product, ProductNutriments } from '../../types/Product';
import { hasProductName } from './productName';

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

/**
 * Combines fresh Open Food Facts data with the locally stored product.
 *
 * - Not edited on this device: the fresh data wins completely, so corrections made on
 *   Open Food Facts reach the app.
 * - Edited on this device: the user's values win for every editable field they hold;
 *   everything else (images, scores, tags) comes from the fresh data.
 */
export function mergeProductData(
  fresh: Product,
  local: Product | null,
  isEdited: boolean
): Product {
  if (!local || !isEdited) {
    return fresh;
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
