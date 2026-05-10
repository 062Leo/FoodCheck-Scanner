import { Product, NovaScore, ProductNutriments } from '../../types/Product';
import { BASE_URL, USER_AGENT, STAGING_AUTH, USE_STAGING } from './config';
import { ApiError, ProductNotFoundError } from './ApiError';
import { retryWithBackoff } from './retry';

interface OffProductResponse {
  status: number;
  status_verbose?: string;
  code: string;
  product?: Record<string, unknown>;
}

interface OffSearchResponse {
  count: number;
  page: number;
  page_count: number;
  page_size: number;
  products: Record<string, unknown>[];
  skip: number;
}

export interface SearchOptions {
  category?: string;
  nutritionGrade?: 'a' | 'b' | 'c' | 'd' | 'e';
  brand?: string;
  novaGroup?: 1 | 2 | 3 | 4;
  label?: string;
  country?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'last_modified_t' | 'popularity_key' | 'product_name';
}

export interface SearchResponse {
  products: Product[];
  count: number;
  page: number;
  pageCount: number;
}

export interface TaxonomySuggestion {
  id: string;
  text: string;
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

const SEARCH_FIELDS = [
  'code',
  'product_name',
  'nutrition_grades',
  'nova_group',
  'image_front_url',
  'brands',
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
    name: (p.product_name as string) || 'Unbekanntes Produkt',
    brand: p.brands as string | undefined,
    ingredientsText: (p.ingredients_text_de as string) || (p.ingredients_text as string),
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
    lastModified: p.last_modified_t as string | undefined,
  };
}

export class OpenFoodFactsClient {
  async getProductByEan(ean: string): Promise<Product | null> {
    return retryWithBackoff(async () => {
      try {
        const url = `${BASE_URL}/api/v2/product/${ean}?fields=${PRODUCT_FIELDS}`;
        const response = await fetch(url, { headers: buildHeaders() });

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
        throw new Error('Fehler beim Abrufen der Produktdaten', { cause: _error });
      }
    });
  }

  async getProductByEanOrThrow(ean: string): Promise<Product> {
    const product = await this.getProductByEan(ean);
    if (!product) {
      throw new ProductNotFoundError(ean);
    }
    return product;
  }

  async searchProducts(options: SearchOptions = {}): Promise<SearchResponse> {
    return retryWithBackoff(async () => {
      try {
        const params = new URLSearchParams();
        params.set('fields', SEARCH_FIELDS);
        params.set('page', String(options.page ?? 1));
        params.set('page_size', String(Math.min(options.pageSize ?? 24, 200)));

        if (options.category) params.set('categories_tags_en', options.category);
        if (options.nutritionGrade) params.set('nutrition_grades_tags', options.nutritionGrade);
        if (options.brand) params.set('brands_tags', options.brand);
        if (options.novaGroup) params.set('nova_groups_tags', String(options.novaGroup));
        if (options.label) params.set('labels_tags', options.label);
        if (options.country) params.set('countries_tags', options.country);
        if (options.sortBy) params.set('sort_by', options.sortBy);

        const url = `${BASE_URL}/api/v2/search?${params.toString()}`;
        const response = await fetch(url, { headers: buildHeaders() });

        if (!response.ok) {
          throw ApiError.fromHttpStatus(response.status);
        }

        const data = (await response.json()) as OffSearchResponse;

        const products = (data.products || []).map((p) =>
          mapOffProduct((p.code as string) || '', p as Record<string, unknown>)
        );

        return {
          products,
          count: data.count,
          page: data.page,
          pageCount: data.page_count,
        };
      } catch (_error) {
        if (_error instanceof ApiError && _error.retryable) throw _error;
        throw new Error('Fehler bei der Produktsuche', { cause: _error });
      }
    });
  }

  async getProductsByBarcodes(barcodes: string[]): Promise<Record<string, Product | null>> {
    if (barcodes.length === 0) return {};

    return retryWithBackoff(async () => {
      try {
        const params = new URLSearchParams();
        params.set('fields', SEARCH_FIELDS);
        params.set('code', barcodes.join(','));
        params.set('page_size', String(barcodes.length));

        const url = `${BASE_URL}/api/v2/search?${params.toString()}`;
        const response = await fetch(url, { headers: buildHeaders() });

        if (!response.ok) {
          throw ApiError.fromHttpStatus(response.status);
        }

        const data = (await response.json()) as OffSearchResponse;

        const result: Record<string, Product | null> = {};
        for (const barcode of barcodes) {
          result[barcode] = null;
        }

        for (const p of data.products || []) {
          const code = (p.code as string) || '';
          if (Object.hasOwn(result, code)) {
            result[code] = mapOffProduct(code, p as Record<string, unknown>);
          }
        }

        return result;
      } catch (_error) {
        if (_error instanceof ApiError && _error.retryable) throw _error;
        throw new Error('Fehler beim Batch-Abruf der Produktdaten', { cause: _error });
      }
    });
  }

  async getFieldSuggestions(tagtype: string, term: string): Promise<string[]> {
    try {
      const url = `${BASE_URL}/cgi/suggest.pl?tagtype=${encodeURIComponent(tagtype)}&term=${encodeURIComponent(term)}`;
      const response = await fetch(url, { headers: buildHeaders() });

      if (!response.ok) {
        throw new Error(`OFF suggest returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) return [];
      return data.filter((item): item is string => typeof item === 'string');
    } catch (_error) {
      throw new Error('Fehler bei der Feld-Vorschlagsabfrage', { cause: _error });
    }
  }

  async getTaxonomySuggestions(
    tagtype: string,
    query: string,
    lang?: string
  ): Promise<TaxonomySuggestion[]> {
    try {
      const params = new URLSearchParams();
      params.set('tagtype', tagtype);
      params.set('string', query);
      if (lang) params.set('lc', lang);

      const url = `${BASE_URL}/api/v3/taxonomy_suggestions?${params.toString()}`;
      const response = await fetch(url, { headers: buildHeaders() });

      if (!response.ok) {
        throw new Error(`OFF taxonomy suggestions returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const suggestions = Array.isArray(data) ? data : data?.suggestions || [];

      return suggestions.map(
        (item: Record<string, unknown>): TaxonomySuggestion => ({
          id: (item.id as string) || '',
          text: (item.text as string) || (item.name as string) || '',
        })
      );
    } catch (_error) {
      throw new Error('Fehler bei der Taxonomie-Vorschlagsabfrage', { cause: _error });
    }
  }
}
