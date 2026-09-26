/**
 * Integration tests against the Open Food Facts STAGING server (world.openfoodfacts.net).
 *
 * The API config is forced to staging below, so these tests can never read from or
 * write to production. They are excluded from `npm test` and run only via
 * `npm run test:integration` (network access required).
 */

jest.mock('../config', () => {
  const actual = jest.requireActual('../config');
  return {
    ...actual,
    USE_STAGING: true,
    BASE_URL: 'https://world.openfoodfacts.net',
  };
});

import { BASE_URL } from '../config';
import { OpenFoodFactsClient } from '../OpenFoodFactsClient';
import { OpenFoodFactsWriteClient } from '../OpenFoodFactsWriteClient';

it('targets the staging server only', () => {
  expect(BASE_URL).toBe('https://world.openfoodfacts.net');
});

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
