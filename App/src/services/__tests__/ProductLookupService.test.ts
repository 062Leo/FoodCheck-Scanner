import { ProductLookupService, isStale } from '../ProductLookupService';
import { ProductRepository } from '../../infrastructure/db/ProductRepository';
import { ProductEditService } from '../ProductEditService';
import { NetworkError } from '../../infrastructure/api/fetchWithTimeout';
import { UsdaError } from '../../infrastructure/api/UsdaClient';
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
  let usda: { findByGtin: jest.Mock };
  let usdaKey: string | null;
  let online: boolean;
  let service: ProductLookupService;

  beforeEach(() => {
    api = { getProductByEan: jest.fn() };
    usda = { findByGtin: jest.fn() };
    usdaKey = null;
    online = true;
    service = new ProductLookupService({
      repository,
      api,
      usda,
      getUsdaKey: async () => usdaKey,
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

  it('keeps exactly the fields the user edited and updates everything else', async () => {
    await repository.saveScan(
      productRecord({
        raw_json: JSON.stringify({
          product: { ean: EAN, name: 'Alt', brand: 'Alte Marke', traces: 'Nüsse' },
        }),
      })
    );
    const editor = new ProductEditService({ repository });
    const session = await editor.open(EAN);
    await editor.save(
      session,
      {
        ...session.initial,
        name: 'Meine Limo',
        traces: '',
        ingredients: { de: 'Wasser, Rohrzucker' },
      },
      SEEDED_RULES
    );
    api.getProductByEan.mockResolvedValue({ ...freshProduct, traces: 'Soja' });

    const result = await service.lookup(EAN, 'view', SEEDED_RULES);

    if (result.status !== 'found') throw new Error('expected found');
    expect(result.product).toMatchObject({
      name: 'Meine Limo',
      ingredientsText: 'Wasser, Rohrzucker',
      brand: 'OFF-Marke',
      imageUrl: freshProduct.imageUrl,
      nutriments: { sugars100g: 9 },
    });
    expect(result.product.traces).toBeUndefined();
    // NOVA was not edited, so Open Food Facts' NOVA 4 applies.
    expect(result.rating.status).toBe('Critical');
  });

  it('keeps all local fields of products edited before field tracking existed', async () => {
    await repository.saveEdit(
      productRecord({
        name: 'Meins',
        brands: 'Eigene Marke',
        raw_json: JSON.stringify({ product: { ean: EAN, name: 'Meins', brand: 'Eigene Marke' } }),
        edited_at: '2025-01-01T00:00:00.000Z',
      }),
      null
    );
    api.getProductByEan.mockResolvedValue(freshProduct);

    const result = await service.lookup(EAN, 'view', SEEDED_RULES);

    if (result.status !== 'found') throw new Error('expected found');
    expect(result.product).toMatchObject({ name: 'Meins', brand: 'Eigene Marke' });
  });

  it('marks device data as such when Open Food Facts does not know the product', async () => {
    await repository.saveScan(
      productRecord({ raw_json: JSON.stringify({ product: freshProduct }) })
    );
    api.getProductByEan.mockResolvedValue(null);

    expect(await service.lookup(EAN, 'view', SEEDED_RULES)).toMatchObject({
      status: 'found',
      source: 'device',
      networkFailed: false,
    });
  });

  it('does not retry the network when a cached product can be shown', async () => {
    await repository.saveScan(
      productRecord({ raw_json: JSON.stringify({ product: freshProduct }) })
    );
    api.getProductByEan.mockResolvedValue(freshProduct);

    await service.lookup(EAN, 'view', SEEDED_RULES);

    expect(api.getProductByEan).toHaveBeenCalledWith(EAN, { retries: 0 });
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

  describe('USDA FoodData Central fallback', () => {
    const usdaProduct: Product = {
      ean: EAN,
      name: 'Oat Cereal Rings',
      brand: 'Oat Rings',
      ingredientsText: 'WHOLE GRAIN OATS, SUGAR, PALM OIL, SALT',
      ingredientsTextEn: 'WHOLE GRAIN OATS, SUGAR, PALM OIL, SALT',
      nutriments: { sugars100g: 5.1, salt100g: 1.2 },
      source: 'usda',
    };

    it('asks USDA with the user key when Open Food Facts does not know the barcode', async () => {
      api.getProductByEan.mockResolvedValue(null);
      usda.findByGtin.mockResolvedValue(usdaProduct);
      usdaKey = 'test-key';

      const result = await service.lookup(EAN, 'scan', SEEDED_RULES);

      expect(usda.findByGtin).toHaveBeenCalledWith(EAN, 'test-key');
      if (result.status !== 'found') throw new Error('expected found');
      expect(result.product.source).toBe('usda');
      expect(result.rating.redFlags.length).toBeGreaterThan(0);
      const stored = await repository.findByEan(EAN);
      expect(stored).toMatchObject({ name: 'Oat Cereal Rings', visit_count: 1 });
      expect(JSON.parse(stored!.raw_json!).product.source).toBe('usda');
    });

    it('never asks USDA without a key', async () => {
      api.getProductByEan.mockResolvedValue(null);

      expect(await service.lookup(EAN, 'scan', SEEDED_RULES)).toEqual({ status: 'not-found' });
      expect(usda.findByGtin).not.toHaveBeenCalled();
    });

    it('does not ask USDA for products Open Food Facts knows', async () => {
      api.getProductByEan.mockResolvedValue(freshProduct);
      usdaKey = 'test-key';

      await service.lookup(EAN, 'scan', SEEDED_RULES);

      expect(usda.findByGtin).not.toHaveBeenCalled();
    });

    it('does not ask USDA when Open Food Facts cannot be reached', async () => {
      api.getProductByEan.mockRejectedValue(new NetworkError('timeout', 'timeout'));
      usdaKey = 'test-key';

      expect(await service.lookup(EAN, 'scan', SEEDED_RULES)).toEqual({ status: 'offline' });
      expect(usda.findByGtin).not.toHaveBeenCalled();
    });

    it('keeps the not-found flow when USDA does not know the barcode either', async () => {
      api.getProductByEan.mockResolvedValue(null);
      usda.findByGtin.mockResolvedValue(null);
      usdaKey = 'test-key';

      expect(await service.lookup(EAN, 'scan', SEEDED_RULES)).toEqual({ status: 'not-found' });
    });

    it.each(['invalid-key', 'rate-limit', 'timeout'] as const)(
      'reports not-found with a hint when USDA fails (%s)',
      async (code) => {
        api.getProductByEan.mockResolvedValue(null);
        usda.findByGtin.mockRejectedValue(new UsdaError(code));
        usdaKey = 'test-key';

        expect(await service.lookup(EAN, 'scan', SEEDED_RULES)).toEqual({
          status: 'not-found',
          usdaError: code,
        });
        expect(await repository.findByEan(EAN)).toBeNull();
      }
    );

    it('shows a stored USDA product again without asking USDA or overwriting it', async () => {
      api.getProductByEan.mockResolvedValue(null);
      usda.findByGtin.mockResolvedValue(usdaProduct);
      usdaKey = 'test-key';
      await service.lookup(EAN, 'scan', SEEDED_RULES);
      usda.findByGtin.mockClear();

      const result = await service.lookup(EAN, 'view', SEEDED_RULES);

      expect(usda.findByGtin).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: 'found', source: 'device' });
      if (result.status !== 'found') throw new Error('expected found');
      expect(result.product).toMatchObject({ name: 'Oat Cereal Rings', source: 'usda' });
    });

    it('replaces a USDA product once Open Food Facts knows the barcode', async () => {
      api.getProductByEan.mockResolvedValueOnce(null);
      usda.findByGtin.mockResolvedValue(usdaProduct);
      usdaKey = 'test-key';
      await service.lookup(EAN, 'scan', SEEDED_RULES);
      api.getProductByEan.mockResolvedValue(freshProduct);

      const result = await service.lookup(EAN, 'view', SEEDED_RULES);

      if (result.status !== 'found') throw new Error('expected found');
      expect(result.product.name).toBe('Frische Limo');
      expect(result.product.source).toBeUndefined();
    });

    it('keeps the USDA data when the Open Food Facts entry holds only a photo', async () => {
      api.getProductByEan.mockResolvedValueOnce(null);
      usda.findByGtin.mockResolvedValue(usdaProduct);
      usdaKey = 'test-key';
      await service.lookup(EAN, 'scan', SEEDED_RULES);
      api.getProductByEan.mockResolvedValue({
        ean: EAN,
        name: '',
        imageUrl: 'https://images.example/front.jpg',
        nutriments: { sugars100g: undefined },
      });

      const result = await service.lookup(EAN, 'view', SEEDED_RULES);

      if (result.status !== 'found') throw new Error('expected found');
      expect(result.product).toMatchObject({
        name: 'Oat Cereal Rings',
        brand: 'Oat Rings',
        ingredientsText: usdaProduct.ingredientsText,
        nutriments: usdaProduct.nutriments,
        imageUrl: 'https://images.example/front.jpg',
        source: 'usda',
      });
      const stored = await repository.findByEan(EAN);
      expect(stored?.ingredients).toBe(usdaProduct.ingredientsText);
      expect(JSON.parse(stored!.raw_json!).product.source).toBe('usda');
    });

    it('fills only what Open Food Facts lacks and drops the USDA source once unused', async () => {
      api.getProductByEan.mockResolvedValueOnce(null);
      usda.findByGtin.mockResolvedValue({ ...usdaProduct, quantity: '12 oz' });
      usdaKey = 'test-key';
      await service.lookup(EAN, 'scan', SEEDED_RULES);
      api.getProductByEan.mockResolvedValue({ ...freshProduct, brand: undefined });

      const result = await service.lookup(EAN, 'view', SEEDED_RULES);

      if (result.status !== 'found') throw new Error('expected found');
      expect(result.product).toMatchObject({
        name: 'Frische Limo',
        brand: 'Oat Rings',
        quantity: '12 oz',
        ingredientsText: freshProduct.ingredientsText,
        nutriments: { sugars100g: 9 },
      });
      expect(result.product.source).toBeUndefined();
    });

    it('keeps the USDA source when only the nutriments still come from USDA', async () => {
      api.getProductByEan.mockResolvedValueOnce(null);
      usda.findByGtin.mockResolvedValue(usdaProduct);
      usdaKey = 'test-key';
      await service.lookup(EAN, 'scan', SEEDED_RULES);
      api.getProductByEan.mockResolvedValue({ ...freshProduct, nutriments: undefined });

      const result = await service.lookup(EAN, 'view', SEEDED_RULES);

      if (result.status !== 'found') throw new Error('expected found');
      expect(result.product.ingredientsText).toBe(freshProduct.ingredientsText);
      expect(result.product.nutriments).toEqual(usdaProduct.nutriments);
      expect(result.product.source).toBe('usda');
    });
  });
});
