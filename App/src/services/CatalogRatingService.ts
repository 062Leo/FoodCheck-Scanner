import type { FilterRule } from '../types/FilterRule';
import { ProductRepository } from '../infrastructure/db/ProductRepository';
import { getMetaValue, setMetaValue } from '../infrastructure/db/DatabaseService';
import { rateProduct } from '../domain/analysis/rateProduct';
import { productFromRecord } from './ProductLookupService';

/**
 * Bump when the rating logic changes in a way that alters results, so stored
 * catalog ratings are recomputed on the next start.
 */
export const RATING_LOGIC_VERSION = 6;

const META_RATING_FINGERPRINT = 'rating_fingerprint';
const RATING_BATCH_SIZE = 25;

/** Changes whenever the rating logic or any rule changes. */
export function ratingFingerprint(rules: FilterRule[]): string {
  let hash = 5381;
  const text = rules
    .map((r) =>
      [
        r.id,
        r.type,
        r.key,
        r.severity,
        r.threshold ?? '',
        r.operator ?? '',
        r.translations ?? '',
      ].join('|')
    )
    .sort()
    .join('\n');
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return `${RATING_LOGIC_VERSION}:${rules.length}:${(hash >>> 0).toString(16)}`;
}

/**
 * Keeps the stored traffic-light ratings in the catalog consistent with the current
 * rules and rating logic.
 */
export class CatalogRatingService {
  private queue: Promise<unknown> = Promise.resolve();
  private generation = 0;
  private pendingForce = false;

  constructor(private readonly repository = new ProductRepository()) {}

  /**
   * Runs re-ratings one after another. Requests arriving while one runs are merged:
   * only the latest runs, with the rules current at that moment, so quick successive
   * rule changes cannot overtake each other and leave wrong traffic lights.
   */
  schedule(getRules: () => FilterRule[], force: boolean): Promise<number> {
    const generation = ++this.generation;
    this.pendingForce = this.pendingForce || force;
    const run = this.queue.then(async () => {
      if (generation !== this.generation) return 0;
      const runForced = this.pendingForce;
      this.pendingForce = false;
      const rules = getRules();
      return runForced ? this.rerateAll(rules) : this.rerateIfOutdated(rules);
    });
    this.queue = run.catch(() => 0);
    return run;
  }

  /** Re-rates every stored product. Returns the number of changed ratings. */
  async rerateAll(rules: FilterRule[]): Promise<number> {
    const rows = await this.repository.findAllForRating();
    const changes: Parameters<ProductRepository['updateRatings']>[0] = [];

    for (const [index, row] of rows.entries()) {
      // Yield to the UI thread regularly so large catalogs do not freeze the app.
      if (index > 0 && index % RATING_BATCH_SIZE === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const product = productFromRecord(row);
      const status = rateProduct(product, rules).status;
      if (status !== row.rating) {
        changes.push({ ean: row.ean, rating: status, basedOn: row });
      }
    }

    await this.repository.updateRatings(changes);
    await setMetaValue(META_RATING_FINGERPRINT, ratingFingerprint(rules));
    return changes.length;
  }

  /** Re-rates only if rules or rating logic changed since the last run. */
  async rerateIfOutdated(rules: FilterRule[]): Promise<number> {
    const stored = await getMetaValue(META_RATING_FINGERPRINT);
    if (stored === ratingFingerprint(rules)) {
      return 0;
    }
    return this.rerateAll(rules);
  }
}
