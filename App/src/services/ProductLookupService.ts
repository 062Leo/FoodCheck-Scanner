import type { FilterRule } from '../types/FilterRule';
import type { Product, ProductRecord } from '../types/Product';
import type { ScanResult } from '../types/ScanResult';
import { ProductRepository } from '../infrastructure/db/ProductRepository';
import { OpenFoodFactsClient } from '../infrastructure/api/OpenFoodFactsClient';
import { NetworkError } from '../infrastructure/api/fetchWithTimeout';
import { UsdaClient, UsdaError, type UsdaErrorCode } from '../infrastructure/api/UsdaClient';
import { isOnline } from '../infrastructure/network/connectivity';
import { ProductNormalizer, PRODUCT_DATA_VERSION } from '../domain/analysis/ProductNormalizer';
import { rateProduct } from '../domain/analysis/rateProduct';
import { fillFromUsda, mergeProductData } from '../domain/product/mergeProductData';
import { toNovaScore } from '../domain/analysis/ProductRating';
import { parseEditedFields } from '../domain/product/editedFields';

export const STALE_THRESHOLD_DAYS = 7;

/** 'scan' counts as a visit in the catalog; 'view' (catalog, favorites) does not. */
export type LookupIntent = 'scan' | 'view';

export type LookupFailure = 'offline' | 'not-found' | 'error';

export type LookupResult =
  | {
      status: 'found';
      product: Product;
      rating: ScanResult;
      record: ProductRecord | null;
      /**
       * Where the shown data comes from: fresh from Open Food Facts (or, for a barcode
       * Open Food Facts does not know, from USDA FoodData Central; see product.source),
       * from the device because the network is unavailable ('cache'), or from the
       * device by choice ('device': just saved, or unknown to Open Food Facts).
       */
      source: 'network' | 'cache' | 'device';
      /** True if cached data is shown although fresh data could not be loaded. */
      networkFailed: boolean;
      isStale: boolean;
    }
  | {
      status: LookupFailure;
      /** Set when the USDA fallback was tried for an unknown barcode and failed. */
      usdaError?: UsdaErrorCode;
    };

export function isStale(record: Pick<ProductRecord, 'last_api_fetch'>, now = Date.now()): boolean {
  if (!record.last_api_fetch) return false;
  const lastFetch = new Date(record.last_api_fetch).getTime();
  if (Number.isNaN(lastFetch)) return false;
  return (now - lastFetch) / (1000 * 60 * 60 * 24) > STALE_THRESHOLD_DAYS;
}

export function productFromRecord(
  record: Pick<ProductRecord, 'ean' | 'name' | 'brands' | 'ingredients' | 'nova_score' | 'raw_json'>
): Product {
  return ProductNormalizer.denormalize(record.raw_json || '', {
    ean: record.ean,
    name: record.name,
    brand: record.brands,
    ingredientsText: record.ingredients,
    novaScore: record.nova_score ?? undefined,
  });
}

export function toProductRecord(
  product: Product,
  rating: ScanResult,
  timestamp: string,
  lastApiFetch: string | null
): ProductRecord {
  const normalized = ProductNormalizer.normalize(product);
  return {
    ean: product.ean,
    name: normalized.name,
    brands: normalized.brand,
    ingredients: normalized.ingredientsText,
    nova_score: toNovaScore(normalized.novaScore) ?? null,
    nutriscore: normalized.nutritionGrades,
    raw_json: normalized.fullJson,
    scanned_at: timestamp,
    last_seen_at: timestamp,
    rating: rating.status,
    data_version: PRODUCT_DATA_VERSION,
    last_api_fetch: lastApiFetch,
    image_url: normalized.imageUrl,
    image_ingredients_url: normalized.imageIngredientsUrl,
    image_nutrition_url: normalized.imageNutritionUrl,
    image_packaging_url: normalized.imagePackagingUrl,
  };
}

export interface ProductLookupDependencies {
  repository?: ProductRepository;
  api?: Pick<OpenFoodFactsClient, 'getProductByEan'>;
  usda?: Pick<UsdaClient, 'findByGtin'>;
  /** The user's own api.data.gov key; without one USDA is never asked. */
  getUsdaKey?: () => Promise<string | null>;
  isOnline?: () => Promise<boolean>;
  now?: () => Date;
}

/**
 * Cache-first product lookup used by the scanner and the product screen.
 *
 * - Online: fetches fresh data (with timeout), merges it with local edits, rates and
 *   stores it. On timeout/server error the cached product is shown instead.
 * - Unknown to Open Food Facts and not stored: asks USDA FoodData Central, but only
 *   with the user's own key. A stored product is never asked for again, so a product
 *   that came from USDA stays as it is until Open Food Facts knows the barcode; even
 *   then the USDA data fills whatever the Open Food Facts entry lacks.
 * - Offline: shows the cached product if there is one.
 * - A scan counts as a visit; merely viewing a product does not.
 */
export class ProductLookupService {
  private readonly repository: ProductRepository;
  private readonly api: Pick<OpenFoodFactsClient, 'getProductByEan'>;
  private readonly usda: Pick<UsdaClient, 'findByGtin'>;
  private readonly getUsdaKey: () => Promise<string | null>;
  private readonly checkOnline: () => Promise<boolean>;
  private readonly now: () => Date;

  constructor(dependencies: ProductLookupDependencies = {}) {
    this.repository = dependencies.repository ?? new ProductRepository();
    this.api = dependencies.api ?? new OpenFoodFactsClient();
    const usdaClient = new UsdaClient();
    this.usda = dependencies.usda ?? usdaClient;
    this.getUsdaKey = dependencies.getUsdaKey ?? (() => usdaClient.getApiKey());
    this.checkOnline = dependencies.isOnline ?? isOnline;
    this.now = dependencies.now ?? (() => new Date());
  }

  async lookup(ean: string, intent: LookupIntent, rules: FilterRule[]): Promise<LookupResult> {
    const record = await this.repository.findByEan(ean).catch(() => null);
    const cached = record ? productFromRecord(record) : null;

    if (!(await this.checkOnline())) {
      return cached
        ? this.fromCache(record!, cached, intent, rules, 'cache', false)
        : { status: 'offline' };
    }

    let fresh: Product | null;
    let usdaError: UsdaErrorCode | undefined;
    try {
      // With a cached product at hand, do not keep the user waiting for a retry.
      fresh = await this.api.getProductByEan(ean, { retries: cached ? 0 : 1 });
    } catch (error) {
      if (cached) return this.fromCache(record!, cached, intent, rules, 'cache', true);
      return { status: error instanceof NetworkError ? 'offline' : 'error' };
    }

    if (!fresh && cached) {
      return this.fromCache(record!, cached, intent, rules, 'device', false);
    }
    if (!fresh) {
      const usda = await this.lookupUsda(ean);
      fresh = usda.product;
      usdaError = usda.error;
    }
    if (!fresh) {
      return usdaError ? { status: 'not-found', usdaError } : { status: 'not-found' };
    }

    const product = mergeProductData(
      fillFromUsda(fresh, cached),
      cached,
      parseEditedFields(record?.edited_fields, record?.edited_at)
    );
    const rating = rateProduct(product, rules);
    const timestamp = this.now().toISOString();
    const saved = toProductRecord(product, rating, timestamp, timestamp);
    await this.persist(saved, intent);
    const stored = await this.repository.findByEan(ean).catch(() => null);

    return {
      status: 'found',
      product,
      rating,
      record: stored ?? saved,
      source: 'network',
      networkFailed: false,
      isStale: false,
    };
  }

  /** Fallback for barcodes unknown to Open Food Facts; errors never stop the lookup. */
  private async lookupUsda(
    ean: string
  ): Promise<{ product: Product | null; error?: UsdaErrorCode }> {
    const key = (await this.getUsdaKey().catch(() => null))?.trim();
    if (!key) return { product: null };
    try {
      return { product: await this.usda.findByGtin(ean, key) };
    } catch (error) {
      return { product: null, error: error instanceof UsdaError ? error.code : 'server' };
    }
  }

  /** Re-reads a stored product without network access (e.g. after editing it). */
  async lookupLocal(ean: string, rules: FilterRule[]): Promise<LookupResult> {
    const record = await this.repository.findByEan(ean).catch(() => null);
    if (!record) return { status: 'not-found' };
    return this.fromCache(record, productFromRecord(record), 'view', rules, 'device', false);
  }

  private async fromCache(
    record: ProductRecord,
    product: Product,
    intent: LookupIntent,
    rules: FilterRule[],
    source: 'cache' | 'device',
    networkFailed: boolean
  ): Promise<LookupResult> {
    const rating = rateProduct(product, rules);
    if (intent === 'scan' || rating.status !== record.rating) {
      const timestamp = this.now().toISOString();
      await this.persist(
        {
          ...record,
          rating: rating.status,
          scanned_at: intent === 'scan' ? timestamp : record.scanned_at,
          last_seen_at: intent === 'scan' ? timestamp : record.last_seen_at,
        },
        intent
      );
    }

    return {
      status: 'found',
      product,
      rating,
      record,
      source,
      networkFailed,
      isStale: isStale(record, this.now().getTime()),
    };
  }

  private async persist(record: ProductRecord, intent: LookupIntent): Promise<void> {
    try {
      if (intent === 'scan') {
        await this.repository.saveScan(record);
      } else {
        await this.repository.saveRefresh(record);
      }
    } catch (error) {
      // Showing the product matters more than caching it.
      console.error(`Failed to store product ${record.ean}:`, error);
    }
  }
}
