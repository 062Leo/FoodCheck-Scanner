import type { FilterRule } from '../types/FilterRule';
import type { ScanStatus } from '../types/ScanResult';
import { ProductRepository } from '../infrastructure/db/ProductRepository';
import { getMetaValue, setMetaValue } from '../infrastructure/db/DatabaseService';
import { rateProduct } from '../domain/analysis/rateProduct';
import { productFromRecord } from './ProductLookupService';

/**
 * Bump when the rating logic changes in a way that alters results, so stored
 * catalog ratings are recomputed on the next start.
 */
export const RATING_LOGIC_VERSION = 2;

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
  constructor(private readonly repository = new ProductRepository()) {}

  /** Re-rates every stored product. Returns the number of changed ratings. */
  async rerateAll(rules: FilterRule[]): Promise<number> {
    const rows = await this.repository.findAllForRating();
    const changes: Array<{ ean: string; rating: ScanStatus }> = [];

    for (const [index, row] of rows.entries()) {
      // Yield to the UI thread regularly so large catalogs do not freeze the app.
      if (index > 0 && index % RATING_BATCH_SIZE === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const product = productFromRecord(row);
      const status = rateProduct(product, rules).status;
      if (status !== row.rating) {
        changes.push({ ean: row.ean, rating: status });
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
