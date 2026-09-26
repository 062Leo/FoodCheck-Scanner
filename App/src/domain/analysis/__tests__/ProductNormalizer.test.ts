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
});
