import { ProductLookupService, isStale } from '../ProductLookupService';
import { ProductRepository } from '../../infrastructure/db/ProductRepository';
import { NetworkError } from '../../infrastructure/api/fetchWithTimeout';
import { SEEDED_RULES } from '../../domain/analysis/__fixtures__/goldenRuleSets';
import { productRecord, useTestDatabase } from '../../testing/testDatabase';
import type { Product } from '../../types/Product';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

const EAN = '4000000000001';
const NOW = new Date('2026-06-01T12:00:00.000Z');

const freshProduct: Product = {
  ean: EAN,
  name: 'Frische Limo',
  brand: 'OFF-Marke',
  ingredientsText: 'Wasser, Glukose-Fruktose-Sirup',
  novaScore: 4,
  imageUrl: 'https://images.example/front.jpg',
  nutriments: { sugars100g: 9 },
};

describe('ProductLookupService', () => {
  useTestDatabase();
  const repository = new ProductRepository();
  let api: { getProductByEan: jest.Mock };
  let online: boolean;
  let service: ProductLookupService;

  beforeEach(() => {
    api = { getProductByEan: jest.fn() };
    online = true;
    service = new ProductLookupService({
      repository,
      api,
      isOnline: async () => online,
      now: () => NOW,
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('fetches, rates and stores an unknown product on scan', async () => {
    api.getProductByEan.mockResolvedValue(freshProduct);

    const result = await service.lookup(EAN, 'scan', SEEDED_RULES);

    expect(result).toMatchObject({ status: 'found', source: 'network', networkFailed: false });
    if (result.status !== 'found') throw new Error('expected found');
    expect(result.rating.status).toBe('Critical');
    expect(result.record?.id).toBe(1);
    expect(await repository.findByEan(EAN)).toMatchObject({
      name: 'Frische Limo',
      rating: 'Critical',
      visit_count: 1,
      last_api_fetch: NOW.toISOString(),
    });
  });

  it('shows the cached product when offline and still counts the scan', async () => {
    await repository.saveScan(
      productRecord({
        raw_json: JSON.stringify({ product: freshProduct }),
        ingredients: freshProduct.ingredientsText,
        rating: 'Critical',
      })
    );
    online = false;

    const result = await service.lookup(EAN, 'scan', SEEDED_RULES);

    expect(result).toMatchObject({ status: 'found', source: 'cache', networkFailed: false });
    expect(api.getProductByEan).not.toHaveBeenCalled();
    expect(await repository.findByEan(EAN)).toMatchObject({
      visit_count: 2,
      scanned_at: NOW.toISOString(),
    });
  });

  it('reports offline when nothing is cached', async () => {
    online = false;
    expect(await service.lookup(EAN, 'scan', SEEDED_RULES)).toEqual({ status: 'offline' });
  });

  it('falls back to the cache on a timeout', async () => {
    await repository.saveScan(
      productRecord({ raw_json: JSON.stringify({ product: freshProduct }) })
    );
    api.getProductByEan.mockRejectedValue(new NetworkError('timeout', 'timeout'));

    const result = await service.lookup(EAN, 'view', SEEDED_RULES);

    expect(result).toMatchObject({ status: 'found', source: 'cache', networkFailed: true });
  });

  it('maps a timeout without cache to offline and other errors to error', async () => {
    api.getProductByEan.mockRejectedValueOnce(new NetworkError('timeout', 'timeout'));
    expect(await service.lookup(EAN, 'scan', SEEDED_RULES)).toEqual({ status: 'offline' });

    api.getProductByEan.mockRejectedValueOnce(new Error('HTTP 500'));
    expect(await service.lookup(EAN, 'scan', SEEDED_RULES)).toEqual({ status: 'error' });
  });

  it('reports not-found for a product unknown to Open Food Facts and the cache', async () => {
    api.getProductByEan.mockResolvedValue(null);
    expect(await service.lookup(EAN, 'scan', SEEDED_RULES)).toEqual({ status: 'not-found' });
  });

  it('viewing a product refreshes its data without counting a scan', async () => {
    await repository.saveScan(productRecord({ name: 'Alt' }));
    api.getProductByEan.mockResolvedValue(freshProduct);

    await service.lookup(EAN, 'view', SEEDED_RULES);

    expect(await repository.findByEan(EAN)).toMatchObject({
      name: 'Frische Limo',
      visit_count: 1,
      scanned_at: '2026-01-01T10:00:00.000Z',
    });
  });

  it('keeps local corrections of an edited product but takes fresh images', async () => {
    await repository.saveScan(
      productRecord({ raw_json: JSON.stringify({ product: { ean: EAN, name: 'x' } }) })
    );
    await repository.updateProduct({
      ean: EAN,
      name: 'Meine Limo',
      ingredients: 'Wasser, Zucker',
    });
    api.getProductByEan.mockResolvedValue(freshProduct);

    const result = await service.lookup(EAN, 'view', SEEDED_RULES);

    if (result.status !== 'found') throw new Error('expected found');
    expect(result.product).toMatchObject({
      name: 'Meine Limo',
      ingredientsText: 'Wasser, Zucker',
      imageUrl: freshProduct.imageUrl,
      brand: 'Marke',
    });
    expect((await repository.findByEan(EAN))?.edited_at).toEqual(expect.any(String));
  });

  it('replaces stale data of a product that was not edited', async () => {
    await repository.saveScan(
      productRecord({
        raw_json: JSON.stringify({ product: { ean: EAN, name: 'Alt', ingredientsText: 'Alt' } }),
      })
    );
    api.getProductByEan.mockResolvedValue(freshProduct);

    const result = await service.lookup(EAN, 'view', SEEDED_RULES);

    if (result.status !== 'found') throw new Error('expected found');
    expect(result.product.name).toBe('Frische Limo');
    expect(result.product.ingredientsText).toBe(freshProduct.ingredientsText);
  });

  it('marks cached data older than seven days as stale', () => {
    const now = NOW.getTime();
    expect(isStale({ last_api_fetch: '2026-05-20T12:00:00.000Z' }, now)).toBe(true);
    expect(isStale({ last_api_fetch: '2026-05-30T12:00:00.000Z' }, now)).toBe(false);
    expect(isStale({ last_api_fetch: null }, now)).toBe(false);
  });
});
