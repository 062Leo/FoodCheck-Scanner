import type { FilterRule } from '../types/FilterRule';
import { ProductRepository } from '../infrastructure/db/ProductRepository';
import { isOnline } from '../infrastructure/network/connectivity';
import { PRODUCT_DATA_VERSION } from '../domain/analysis/ProductNormalizer';
import { ProductLookupService } from './ProductLookupService';

/** Pause before each request: at most 10 product requests per minute to Open Food Facts. */
export const REFRESH_INTERVAL_MS = 6_000;

export interface StoredProductRefreshDependencies {
  repository?: Pick<ProductRepository, 'findEansWithDataVersionBelow'>;
  lookup?: Pick<ProductLookupService, 'refreshStored'>;
  isOnline?: () => Promise<boolean>;
  wait?: (ms: number) => Promise<void>;
}

/**
 * Completes products stored with an older Open Food Facts field set (data_version), so
 * checks that need the newer fields (categories, packaging, brand owner, alcohol, packer
 * codes) also work for products that are not opened again. Runs in the background,
 * one request at a time and slowly; it stops when the device is offline or a request
 * fails (e.g. rate limit) and continues with the remaining products on the next start.
 * Edited fields, USDA data and visits are kept (see ProductLookupService.refreshStored).
 */
export class StoredProductRefreshService {
  private running: Promise<number> | null = null;
  private readonly repository: Pick<ProductRepository, 'findEansWithDataVersionBelow'>;
  private readonly lookup: Pick<ProductLookupService, 'refreshStored'>;
  private readonly checkOnline: () => Promise<boolean>;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(dependencies: StoredProductRefreshDependencies = {}) {
    this.repository = dependencies.repository ?? new ProductRepository();
    this.lookup = dependencies.lookup ?? new ProductLookupService();
    this.checkOnline = dependencies.isOnline ?? isOnline;
    this.wait =
      dependencies.wait ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  }

  /**
   * Starts the refresh unless it is already running. `getRules` is read for every
   * product, so rule changes made meanwhile are used; `onRefreshed` is called after
   * each product that got new data. Resolves to the number of refreshed products.
   */
  start(getRules: () => FilterRule[], onRefreshed?: (ean: string) => void): Promise<number> {
    this.running ??= this.run(getRules, onRefreshed).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(
    getRules: () => FilterRule[],
    onRefreshed?: (ean: string) => void
  ): Promise<number> {
    const eans = await this.repository.findEansWithDataVersionBelow(PRODUCT_DATA_VERSION);
    let refreshed = 0;
    for (const ean of eans) {
      await this.wait(REFRESH_INTERVAL_MS);
      if (!(await this.checkOnline())) break;
      try {
        if (await this.lookup.refreshStored(ean, getRules())) {
          refreshed++;
          onRefreshed?.(ean);
        }
      } catch (error) {
        // Offline, rate limit or server trouble: try the rest on the next start.
        console.warn(`Background refresh stopped at product ${ean}:`, error);
        break;
      }
    }
    return refreshed;
  }
}
