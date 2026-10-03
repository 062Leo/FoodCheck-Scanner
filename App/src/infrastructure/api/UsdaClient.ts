import * as SecureStore from 'expo-secure-store';
import type { Product, ProductNutriments } from '../../types/Product';
import { USER_AGENT } from './config';
import { fetchWithTimeout, NetworkError } from './fetchWithTimeout';

const SECURE_KEY = 'usda_api_key';
const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const TIMEOUT_MS = 8000;

/** Where users get their own free key (api.data.gov). */
export const USDA_KEY_SIGNUP_URL = 'https://fdc.nal.usda.gov/api-key-signup';

export type UsdaErrorCode = 'invalid-key' | 'rate-limit' | 'timeout' | 'network' | 'server';

/** A failed FoodData Central request. The message never contains the API key. */
export class UsdaError extends Error {
  constructor(
    public readonly code: UsdaErrorCode,
    message: string = code
  ) {
    super(message);
    this.name = 'UsdaError';
  }
}

interface UsdaNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
}

export interface UsdaFood {
  fdcId?: number;
  description?: string;
  gtinUpc?: string;
  brandOwner?: string;
  brandName?: string;
  ingredients?: string;
  foodCategory?: string;
  packageWeight?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  publishedDate?: string;
  modifiedDate?: string;
  foodNutrients?: UsdaNutrient[];
}

/** Leading zeros differ between UPC-A, EAN-13 and the 14-digit GTINs stored by FDC. */
function stripLeadingZeros(code: string): string {
  return code.replace(/^0+/, '');
}

/**
 * The search matches gtinUpc only literally, and FDC stores the same code as 12, 13 or
 * 14 digits. All forms are searched at once ("a OR b").
 */
export function gtinQuery(gtin: string): string {
  const core = stripLeadingZeros(gtin);
  const lengths = core.length <= 8 ? [8, 12, 13, 14] : [12, 13, 14];
  const variants = new Set(
    [
      gtin,
      ...lengths.filter((length) => length >= core.length).map((l) => core.padStart(l, '0')),
    ].filter((code) => code.length > 0)
  );
  return [...variants].join(' OR ');
}

function dateValue(food: UsdaFood): number {
  const dates = [food.publishedDate, food.modifiedDate]
    .map((date) => (date ? Date.parse(date) : NaN))
    .filter((time) => !Number.isNaN(time));
  return dates.length > 0 ? Math.max(...dates) : 0;
}

/** The result for exactly this barcode; the most recently published one if several. */
export function pickFood(foods: UsdaFood[], gtin: string): UsdaFood | null {
  const wanted = stripLeadingZeros(gtin);
  const matches = foods.filter(
    (food) => typeof food.gtinUpc === 'string' && stripLeadingZeros(food.gtinUpc.trim()) === wanted
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, food) => (dateValue(food) > dateValue(best) ? food : best));
}

/** Title case only for text written entirely in capitals ("CHEERIOS CEREAL"). */
export function readableName(text: string): string {
  const trimmed = text.trim();
  if (!/[A-Z]/.test(trimmed) || trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed.toLowerCase().replace(/(^|[\s\-/(&,.])(\p{L})/gu, (_, before, letter) => {
    return `${before}${letter.toUpperCase()}`;
  });
}

const UNITS: Record<string, string> = {
  GRM: 'g',
  G: 'g',
  MLT: 'ml',
  ML: 'ml',
  ONZ: 'oz',
  OZ: 'oz',
  FOZ: 'fl oz',
  LBR: 'lb',
};

function readableAmount(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\b([A-Za-z]+)\b/g, (unit) => UNITS[unit.toUpperCase()] ?? unit);
}

/** Nutrient ids (and the older nutrient numbers) used by FoodData Central. */
const NUTRIENTS: { key: keyof ProductNutriments; id: number; number: string }[] = [
  { key: 'energyKcal100g', id: 1008, number: '208' },
  { key: 'fat100g', id: 1004, number: '204' },
  { key: 'saturatedFat100g', id: 1258, number: '606' },
  { key: 'carbohydrates100g', id: 1005, number: '205' },
  { key: 'sugars100g', id: 2000, number: '269' },
  { key: 'fiber100g', id: 1079, number: '291' },
  { key: 'proteins100g', id: 1003, number: '203' },
  { key: 'alcohol100g', id: 1018, number: '221' },
];
const SODIUM = { id: 1093, number: '307' };

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Branded food values are per 100 g (or 100 ml). Some foods list a nutrient twice
 * (e.g. also "as prepared"); the first entry is the product as sold.
 */
function parseNutrients(list: UsdaNutrient[] | undefined): ProductNutriments | undefined {
  if (!Array.isArray(list)) return undefined;
  const find = (id: number, number: string): UsdaNutrient | undefined =>
    list.find(
      (n) =>
        (n.nutrientId === id || n.nutrientNumber === number) &&
        typeof n.value === 'number' &&
        Number.isFinite(n.value)
    );

  const result: ProductNutriments = {};
  for (const { key, id, number } of NUTRIENTS) {
    const nutrient = find(id, number);
    if (nutrient) result[key] = nutrient.value;
  }
  const sodium = find(SODIUM.id, SODIUM.number);
  if (sodium) {
    const unit = sodium.unitName?.toUpperCase();
    const grams =
      unit === 'G' ? sodium.value! : unit === 'UG' ? sodium.value! / 1e6 : sodium.value! / 1000;
    result.salt100g = round(grams * 2.5);
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Maps a branded FoodData Central food to the app's product (source 'usda'). */
export function mapUsdaFood(ean: string, food: UsdaFood): Product {
  const brandOwner = text(food.brandOwner);
  const brandName = text(food.brandName);
  const ingredients = text(food.ingredients);
  const servingUnit = text(food.servingSizeUnit);
  const servingSize =
    typeof food.servingSize === 'number' && Number.isFinite(food.servingSize)
      ? readableAmount(`${food.servingSize}${servingUnit ? ` ${servingUnit}` : ''}`)
      : undefined;

  return {
    ean,
    name: readableName(text(food.description) ?? ''),
    brand: brandName ?? brandOwner,
    brandOwner,
    ingredientsText: ingredients,
    ingredientsTextEn: ingredients,
    ingredientsTextByLang: ingredients ? { en: ingredients } : undefined,
    categories: text(food.foodCategory),
    quantity: readableAmount(food.packageWeight),
    servingSize,
    nutriments: parseNutrients(food.foodNutrients),
    source: 'usda',
  };
}

function errorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * USDA FoodData Central (public domain, CC0): a fallback for barcodes that Open Food
 * Facts does not know. Works only with the user's own api.data.gov key.
 */
export class UsdaClient {
  /** Finds the branded food with this barcode; null if FoodData Central does not know it. */
  async findByGtin(gtin: string, apiKey: string): Promise<Product | null> {
    const params = new URLSearchParams({
      query: gtinQuery(gtin),
      dataType: 'Branded',
      pageSize: '10',
    });
    let response: Response;
    try {
      // The key goes into a header so it never shows up in a URL.
      response = await fetchWithTimeout(
        `${SEARCH_URL}?${params.toString()}`,
        { headers: { 'X-Api-Key': apiKey, 'User-Agent': USER_AGENT, Accept: 'application/json' } },
        TIMEOUT_MS
      );
    } catch (error) {
      if (error instanceof NetworkError) {
        throw new UsdaError(error.reason === 'timeout' ? 'timeout' : 'network', error.message);
      }
      throw new UsdaError('network');
    }

    const body: unknown = await response.json().catch(() => null);
    const code = errorCode(body);
    if (response.status === 429 || code === 'OVER_RATE_LIMIT') {
      throw new UsdaError('rate-limit', 'USDA rate limit reached');
    }
    if (response.status === 403 || code?.startsWith('API_KEY_')) {
      throw new UsdaError('invalid-key', 'USDA API key rejected');
    }
    if (!response.ok || !body || typeof body !== 'object') {
      throw new UsdaError('server', `USDA search failed: HTTP ${response.status}`);
    }

    const foods = (body as { foods?: unknown }).foods;
    const food = pickFood(Array.isArray(foods) ? (foods as UsdaFood[]) : [], gtin);
    return food ? mapUsdaFood(gtin, food) : null;
  }

  async getApiKey(): Promise<string | null> {
    return SecureStore.getItemAsync(SECURE_KEY);
  }

  async saveApiKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(SECURE_KEY, key);
  }

  async deleteApiKey(): Promise<void> {
    await SecureStore.deleteItemAsync(SECURE_KEY);
  }
}
