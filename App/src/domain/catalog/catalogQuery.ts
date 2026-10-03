import type { ProductSummary } from '../../types/Product';
import { isScanStatus, type ScanStatus } from '../../types/ScanResult';

export type CatalogFilter = 'all' | ScanStatus | 'missingIngredients';
export type CatalogSort = 'recent' | 'name' | 'rating' | 'nova' | 'frequency';

export const CATALOG_SORTS: readonly CatalogSort[] = [
  'recent',
  'rating',
  'name',
  'nova',
  'frequency',
];

/** Worst first; unknown ratings last. */
const SEVERITY: Record<ScanStatus, number> = { Critical: 0, Warning: 1, OK: 2, Unknown: 3 };

function severity(rating: string): number {
  return isScanStatus(rating) ? SEVERITY[rating] : SEVERITY.Unknown;
}

function matchesFilter(product: ProductSummary, filter: CatalogFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'missingIngredients') return !product.has_ingredients;
  return (isScanStatus(product.rating) ? product.rating : 'Unknown') === filter;
}

function matchesSearch(product: ProductSummary, query: string): boolean {
  if (!query) return true;
  const haystack = [product.name, product.brands, product.ean]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
  return query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

const byRecent = (a: ProductSummary, b: ProductSummary) =>
  (b.last_seen_at ?? b.scanned_at).localeCompare(a.last_seen_at ?? a.scanned_at);

const COMPARATORS: Record<CatalogSort, (a: ProductSummary, b: ProductSummary) => number> = {
  recent: byRecent,
  name: (a, b) => (a.name || '￿').localeCompare(b.name || '￿', undefined, { sensitivity: 'base' }),
  rating: (a, b) => severity(a.rating) - severity(b.rating) || byRecent(a, b),
  // Most processed first; unknown NOVA last.
  nova: (a, b) => (b.nova_score ?? 0) - (a.nova_score ?? 0) || byRecent(a, b),
  frequency: (a, b) => (b.visit_count ?? 1) - (a.visit_count ?? 1) || byRecent(a, b),
};

/** Filters, searches (all words must match name, brand or EAN) and sorts the catalog. */
export function queryCatalog(
  products: readonly ProductSummary[],
  options: { filter: CatalogFilter; search: string; sort: CatalogSort }
): ProductSummary[] {
  const search = options.search.trim();
  return products
    .filter((p) => matchesFilter(p, options.filter) && matchesSearch(p, search))
    .sort(COMPARATORS[options.sort]);
}

export interface CatalogCounts {
  all: number;
  Critical: number;
  Warning: number;
  OK: number;
  Unknown: number;
  missingIngredients: number;
  scans: number;
  ultraProcessedShare: number;
}

export function countCatalog(products: readonly ProductSummary[]): CatalogCounts {
  const counts: CatalogCounts = {
    all: products.length,
    Critical: 0,
    Warning: 0,
    OK: 0,
    Unknown: 0,
    missingIngredients: 0,
    scans: 0,
    ultraProcessedShare: 0,
  };
  let nova4 = 0;
  for (const product of products) {
    counts[isScanStatus(product.rating) ? product.rating : 'Unknown']++;
    if (!product.has_ingredients) counts.missingIngredients++;
    counts.scans += product.visit_count ?? 1;
    if (product.nova_score === 4) nova4++;
  }
  counts.ultraProcessedShare = products.length > 0 ? nova4 / products.length : 0;
  return counts;
}
