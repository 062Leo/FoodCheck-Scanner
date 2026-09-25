import type { FilterRule } from '../types/FilterRule';
import type { Product, ProductRecord } from '../types/Product';
import type { ScanResult } from '../types/ScanResult';
import { ProductRepository } from '../infrastructure/db/ProductRepository';
import { OpenFoodFactsClient } from '../infrastructure/api/OpenFoodFactsClient';
import { NetworkError } from '../infrastructure/api/fetchWithTimeout';
import { isOnline } from '../infrastructure/network/connectivity';
import { ProductNormalizer, PRODUCT_DATA_VERSION } from '../domain/analysis/ProductNormalizer';
import { rateProduct } from '../domain/analysis/rateProduct';
import { mergeProductData } from '../domain/product/mergeProductData';
import { toNovaScore } from '../domain/analysis/ProductRating';

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
      /** Where the shown data comes from. */
      source: 'network' | 'cache';
      /** True if cached data is shown although fresh data could not be loaded. */
      networkFailed: boolean;
      isStale: boolean;
    }
  | { status: LookupFailure };

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
  isOnline?: () => Promise<boolean>;
  now?: () => Date;
}

/**
 * Cache-first product lookup used by the scanner and the product screen.
 *
 * - Online: fetches fresh data (with timeout), merges it with local edits, rates and
 *   stores it. On timeout/server error the cached product is shown instead.
 * - Offline: shows the cached product if there is one.
 * - A scan counts as a visit; merely viewing a product does not.
 */
export class ProductLookupService {
  private readonly repository: ProductRepository;
  private readonly api: Pick<OpenFoodFactsClient, 'getProductByEan'>;
  private readonly checkOnline: () => Promise<boolean>;
  private readonly now: () => Date;

  constructor(dependencies: ProductLookupDependencies = {}) {
    this.repository = dependencies.repository ?? new ProductRepository();
    this.api = dependencies.api ?? new OpenFoodFactsClient();
    this.checkOnline = dependencies.isOnline ?? isOnline;
    this.now = dependencies.now ?? (() => new Date());
  }

  async lookup(ean: string, intent: LookupIntent, rules: FilterRule[]): Promise<LookupResult> {
    const record = await this.repository.findByEan(ean).catch(() => null);
    const cached = record ? productFromRecord(record) : null;

    if (!(await this.checkOnline())) {
      return cached ? this.fromCache(record!, cached, intent, rules, false) : { status: 'offline' };
    }

    let fresh: Product | null;
    try {
      fresh = await this.api.getProductByEan(ean);
    } catch (error) {
      if (cached) return this.fromCache(record!, cached, intent, rules, true);
      return { status: error instanceof NetworkError ? 'offline' : 'error' };
    }

    if (!fresh) {
      return cached
        ? this.fromCache(record!, cached, intent, rules, false)
        : { status: 'not-found' };
    }

    const product = mergeProductData(fresh, cached, Boolean(record?.edited_at));
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

  /** Re-reads a stored product without network access (e.g. after editing it). */
  async lookupLocal(ean: string, rules: FilterRule[]): Promise<LookupResult> {
    const record = await this.repository.findByEan(ean).catch(() => null);
    if (!record) return { status: 'not-found' };
    return this.fromCache(record, productFromRecord(record), 'view', rules, false);
  }

  private async fromCache(
    record: ProductRecord,
    product: Product,
    intent: LookupIntent,
    rules: FilterRule[],
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
      source: 'cache',
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
