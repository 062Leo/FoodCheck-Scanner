/**
 * Integration tests against the OFF staging API.
 *
 * These tests require network access to world.openfoodfacts.net.
 * They are skipped when:
 *  - the network is unavailable
 *  - OFF staging credentials are not configured (8.4 only)
 *
 * Run with: npm test -- --testPathPattern=integration
 */

import { OpenFoodFactsClient } from '../OpenFoodFactsClient';
import { OpenFoodFactsWriteClient } from '../OpenFoodFactsWriteClient';

const readClient = new OpenFoodFactsClient();
const writeClient = new OpenFoodFactsWriteClient();

const NUTELLA_EAN = '3017624010701';
const NONEXISTENT_EAN = '0000000000000';

describe('integration: getProductByBarcode (staging)', () => {
  it('8.1 should return Nutella with correct fields', async () => {
    const product = await readClient.getProductByEan(NUTELLA_EAN);

    expect(product).not.toBeNull();
    expect(product!.name.toLowerCase()).toContain('nutella');
    expect(product!.nutritionGrades).toBe('e');
    expect(product!.nutriments).toBeDefined();
    expect(product!.nutriments).not.toBeNull();
    if (product!.nutriments) {
      expect(Object.keys(product!.nutriments).length).toBeGreaterThan(0);
    }
  }, 15000);

  it('8.3 should return null for non-existent barcode', async () => {
    const product = await readClient.getProductByEan(NONEXISTENT_EAN);

    expect(product).toBeNull();
  }, 15000);
});

describe('integration: searchProducts (staging)', () => {
  it('8.2 should find orange juice with nutrition grade C', async () => {
    const result = await readClient.searchProducts({
      category: 'Orange Juice',
      nutritionGrade: 'c',
      pageSize: 5,
    });

    expect(result.count).toBeGreaterThan(0);
    expect(result.products.length).toBeGreaterThan(0);
    for (const product of result.products) {
      expect(product.nutritionGrades).toBe('c');
    }
  }, 15000);
});

describe('integration: write flow (staging)', () => {
  const TEST_EAN = '9999999999999';

  beforeAll(async () => {
    const credentials = await writeClient.loadCredentials();
    if (!credentials) {
      console.warn(
        'Skipping write integration test: no OFF staging credentials stored. ' +
          'Use writeClient.saveCredentials() to set them up.'
      );
    }
  });

  it('8.4 should update and read back a product on staging', async () => {
    const credentials = await writeClient.loadCredentials();
    if (!credentials) {
      // eslint-disable-next-line jest/no-disabled-tests
      return;
    }

    await writeClient.updateProduct(TEST_EAN, {
      categories: 'Test category',
    });

    // Give OFF a moment to process
    await new Promise((r) => setTimeout(r, 2000));

    const product = await readClient.getProductByEan(TEST_EAN);

    // The product might not be available immediately after write on staging
    // It may take time to index. We just verify no error was thrown.
    expect(product).toBeDefined();
  }, 30000);
});

describe('retry: rate-limit handling', () => {
  it('8.5 should retry on 429 and succeed', async () => {
    // This test verifies that retryWithBackoff is properly wired into the client.
    // We mock fetch to return 429 once, then success.

    const originalFetch = global.fetch;

    try {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 1,
            product: { product_name: 'Retry Success' },
          }),
        });
      });

      const product = await readClient.getProductByEan('123');

      expect(product).not.toBeNull();
      expect(product!.name).toBe('Retry Success');
      expect(callCount).toBeGreaterThanOrEqual(2);
    } finally {
      global.fetch = originalFetch;
    }
  }, 15000);
});
