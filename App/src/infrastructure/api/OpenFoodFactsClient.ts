import { Product, NovaScore, ProductNutriments } from '../../types/Product';
import { BASE_URL, USER_AGENT, STAGING_AUTH, USE_STAGING } from './config';
import { ApiError } from './ApiError';
import { retryWithBackoff } from './retry';
import { fetchWithTimeout, NetworkError } from './fetchWithTimeout';

interface OffProductResponse {
  status: number;
  status_verbose?: string;
  code: string;
  product?: Record<string, unknown>;
}

const PRODUCT_FIELDS = [
  'product_name',
  'brands',
  'categories',
  'nutrition_grades',
  'nova_group',
  'ecoscore_grade',
  'nutriments',
  'allergens_tags',
  'traces',
  'traces_tags',
  'additives_tags',
  'ingredients_text',
  'ingredients_text_de',
  'ingredients_text_en',
  'ingredients_text_fr',
  'ingredients_text_it',
  'ingredients_text_es',
  'ingredients_text_nl',
  'ingredients_text_pt',
  'ingredients_text_pl',
  'image_front_url',
  'image_nutrition_url',
  'image_ingredients_url',
  'image_packaging_url',
  'quantity',
  'serving_size',
  'misc_tags',
  'labels_tags',
  'origins',
  'manufacturing_places',
  'stores',
  'last_modified_t',
  'code',
].join(',');

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
  };
  if (USE_STAGING) {
    headers['Authorization'] = STAGING_AUTH;
  }
  return headers;
}

function parseNutriments(raw: unknown): ProductNutriments | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const n = raw as Record<string, unknown>;
  const get = (key: string): number | undefined => {
    const v = n[key];
    return typeof v === 'number' ? v : undefined;
  };
  return {
    energyKcal100g: get('energy-kcal_100g'),
    fat100g: get('fat_100g'),
    saturatedFat100g: get('saturated-fat_100g'),
    carbohydrates100g: get('carbohydrates_100g'),
    sugars100g: get('sugars_100g'),
    fiber100g: get('fiber_100g'),
    proteins100g: get('proteins_100g'),
    salt100g: get('salt_100g'),
  };
}

function mapOffProduct(ean: string, p: Record<string, unknown>): Product {
  const ingredientsTextByLang: Record<string, string> = {};
  Object.entries(p).forEach(([key, value]) => {
    if (key.startsWith('ingredients_text_') && typeof value === 'string') {
      const lang = key.replace('ingredients_text_', '');
      ingredientsTextByLang[lang] = value;
    }
  });

  return {
    ean,
    name: typeof p.product_name === 'string' ? p.product_name.trim() : '',
    brand: p.brands as string | undefined,
    ingredientsText:
      (p.ingredients_text_de as string) ||
      (p.ingredients_text as string) ||
      (p.ingredients_text_en as string) ||
      Object.values(ingredientsTextByLang).find((text) => text.trim().length > 0),
    ingredientsTextDe: p.ingredients_text_de as string | undefined,
    ingredientsTextEn: p.ingredients_text_en as string | undefined,
    ingredientsTextByLang,
    novaScore: p.nova_group as NovaScore | undefined,
    imageUrl: p.image_front_url as string | undefined,
    imageIngredientsUrl: p.image_ingredients_url as string | undefined,
    imagePackagingUrl: p.image_packaging_url as string | undefined,
    nutritionGrades: p.nutrition_grades as string | undefined,
    ecoscoreGrade: p.ecoscore_grade as string | undefined,
    allergensTags: Array.isArray(p.allergens_tags) ? (p.allergens_tags as string[]) : undefined,
    traces: p.traces as string | undefined,
    tracesTags: Array.isArray(p.traces_tags) ? (p.traces_tags as string[]) : undefined,
    additivesTags: Array.isArray(p.additives_tags) ? (p.additives_tags as string[]) : undefined,
    categories: p.categories as string | undefined,
    miscTags: Array.isArray(p.misc_tags) ? (p.misc_tags as string[]) : undefined,
    labelsTags: Array.isArray(p.labels_tags) ? (p.labels_tags as string[]) : undefined,
    quantity: p.quantity as string | undefined,
    servingSize: p.serving_size as string | undefined,
    imageNutritionUrl: p.image_nutrition_url as string | undefined,
    nutriments: parseNutriments(p.nutriments),
    origins: p.origins as string | undefined,
    manufacturingPlaces: p.manufacturing_places as string | undefined,
    stores: p.stores as string | undefined,
  };
}

export class OpenFoodFactsClient {
  /**
   * Looks a product up by barcode. Returns null if Open Food Facts does not know it.
   * Throws NetworkError on timeout/no connection so callers can fall back to the cache.
   */
  async getProductByEan(ean: string, options: { retries?: number } = {}): Promise<Product | null> {
    return retryWithBackoff(
      async () => {
        try {
          const url = `${BASE_URL}/api/v2/product/${encodeURIComponent(ean)}?fields=${PRODUCT_FIELDS}`;
          const response = await fetchWithTimeout(url, { headers: buildHeaders() });

          if (response.status === 404) {
            return null;
          }

          if (!response.ok) {
            throw ApiError.fromHttpStatus(response.status);
          }

          const data = (await response.json()) as OffProductResponse;

          if (data.status === 0 || !data.product) {
            return null;
          }

          return mapOffProduct(ean, data.product);
        } catch (_error) {
          if (_error instanceof ApiError && _error.retryable) throw _error;
          if (_error instanceof NetworkError) throw _error;
          const detail = _error instanceof Error ? _error.message : String(_error);
          throw new Error(`Failed to fetch product data: ${detail}`, { cause: _error });
        }
      },
      { retries: options.retries ?? 1, baseDelayMs: 1000 }
    );
  }
}
