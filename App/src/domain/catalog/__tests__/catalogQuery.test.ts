import { countCatalog, queryCatalog } from '../catalogQuery';
import type { ProductSummary } from '../../../types/Product';

function product(overrides: Partial<ProductSummary>): ProductSummary {
  return {
    id: 1,
    ean: '4000000000001',
    name: 'Produkt',
    brands: null,
    nova_score: null,
    nutriscore: null,
    scanned_at: '2026-01-01T00:00:00.000Z',
    last_seen_at: null,
    rating: 'OK',
    visit_count: 1,
    image_url: null,
    edited_at: null,
    has_ingredients: 1,
    ...overrides,
  };
}

const catalog = [
  product({ ean: '1', name: 'Apfelmus', rating: 'OK', nova_score: 1, scanned_at: '2026-01-03' }),
  product({
    ean: '2',
    name: 'Cola',
    brands: 'Brausehaus',
    rating: 'Critical',
    nova_score: 4,
    visit_count: 5,
    scanned_at: '2026-01-01',
  }),
  product({ ean: '3', name: 'Brot', rating: 'Warning', nova_score: 3, scanned_at: '2026-01-02' }),
  product({ ean: '4', name: '', rating: 'Unknown', has_ingredients: 0, scanned_at: '2026-01-04' }),
  product({ ean: '5', name: 'Chips', rating: 'Critical', nova_score: 4, scanned_at: '2026-01-05' }),
];

const names = (items: ProductSummary[]) => items.map((p) => p.ean);

describe('queryCatalog', () => {
  it('sorts by rating with the worst first and unknown last', () => {
    expect(names(queryCatalog(catalog, { filter: 'all', search: '', sort: 'rating' }))).toEqual([
      '5',
      '2',
      '3',
      '1',
      '4',
    ]);
  });

  it('sorts by most recent scan by default', () => {
    expect(names(queryCatalog(catalog, { filter: 'all', search: '', sort: 'recent' }))).toEqual([
      '5',
      '4',
      '1',
      '3',
      '2',
    ]);
  });

  it('sorts names alphabetically with unnamed products last', () => {
    expect(names(queryCatalog(catalog, { filter: 'all', search: '', sort: 'name' }))).toEqual([
      '1',
      '3',
      '5',
      '2',
      '4',
    ]);
  });

  it('filters by status and by missing ingredients', () => {
    expect(
      names(queryCatalog(catalog, { filter: 'Critical', search: '', sort: 'recent' }))
    ).toEqual(['5', '2']);
    expect(names(queryCatalog(catalog, { filter: 'Unknown', search: '', sort: 'recent' }))).toEqual(
      ['4']
    );
    expect(
      names(queryCatalog(catalog, { filter: 'missingIngredients', search: '', sort: 'recent' }))
    ).toEqual(['4']);
  });

  it('searches name, brand and EAN; all words must match', () => {
    expect(
      names(queryCatalog(catalog, { filter: 'all', search: 'brause', sort: 'recent' }))
    ).toEqual(['2']);
    expect(
      names(queryCatalog(catalog, { filter: 'all', search: 'cola brause', sort: 'recent' }))
    ).toEqual(['2']);
    expect(
      names(queryCatalog(catalog, { filter: 'all', search: 'cola chips', sort: 'recent' }))
    ).toEqual([]);
    expect(names(queryCatalog(catalog, { filter: 'all', search: ' 3 ', sort: 'recent' }))).toEqual([
      '3',
    ]);
  });
});

describe('countCatalog', () => {
  it('counts statuses, scans and the share of ultra-processed products', () => {
    expect(countCatalog(catalog)).toEqual({
      all: 5,
      Critical: 2,
      Warning: 1,
      OK: 1,
      Unknown: 1,
      missingIngredients: 1,
      scans: 9,
      ultraProcessedShare: 0.4,
    });
  });
});
