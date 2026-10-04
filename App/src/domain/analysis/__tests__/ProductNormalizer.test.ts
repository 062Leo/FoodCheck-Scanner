import { ProductNormalizer } from '../ProductNormalizer';
import type { Product } from '../../../types/Product';

describe('ProductNormalizer', () => {
  it('keeps allergen and traces data through storage', () => {
    const product: Product = {
      ean: '4000000000001',
      name: 'Kekse',
      allergensTags: ['en:gluten'],
      traces: 'Haselnüsse',
      tracesTags: ['en:nuts'],
    };

    const stored = ProductNormalizer.normalize(product).fullJson;
    const restored = ProductNormalizer.denormalize(stored, { ean: product.ean });

    expect(restored).toMatchObject({
      allergensTags: ['en:gluten'],
      traces: 'Haselnüsse',
      tracesTags: ['en:nuts'],
    });
  });

  it('keeps the mineral values of a water through storage', () => {
    const product: Product = {
      ean: '4001513007704',
      name: 'Mineralwasser',
      nutriments: { sodium100g: 0.012, calcium100g: 0.0348, nitrate100g: 0.0005 },
    };

    const stored = ProductNormalizer.normalize(product).fullJson;
    const restored = ProductNormalizer.denormalize(stored, { ean: product.ean });

    expect(restored.nutriments).toEqual({
      sodium100g: 0.012,
      calcium100g: 0.0348,
      nitrate100g: 0.0005,
    });
  });

  it('reads mineral values stored under the Open Food Facts keys', () => {
    const stored = JSON.stringify({ product: { nutriments: { sulphate_100g: 0.0009 } } });
    expect(ProductNormalizer.denormalize(stored, { ean: '1' }).nutriments).toEqual({
      sulphate100g: 0.0009,
    });
  });
});
