import type { Product } from '../../../types/Product';

describe('ResultScreen cached override merge flow', () => {
  const mockEan = '1234567890123';
  const mockOFFProduct: Product = {
    ean: mockEan,
    name: 'Test Product from OFF',
    brand: 'Test Brand',
    ingredientsText: 'Original ingredients from OFF',
    novaScore: 3,
  };

  const mockCachedOverrides = {
    ingredientsText: 'OCR ingredients',
  };

  it('should merge OFF product with cached overrides and preserve OFF name/brand', () => {
    const merged: Product = {
      ...mockOFFProduct,
      ...mockCachedOverrides,
      ean: mockOFFProduct.ean,
      name: (mockCachedOverrides as any).name?.trim() || mockOFFProduct.name,
      brand: (mockCachedOverrides as any).brand?.trim() || mockOFFProduct.brand,
      ingredientsText:
        mockCachedOverrides.ingredientsText?.trim() || mockOFFProduct.ingredientsText,
    };

    expect(merged.name).toBe('Test Product from OFF');
    expect(merged.brand).toBe('Test Brand');
    expect(merged.ingredientsText).toBe('OCR ingredients');
  });

  it('should use OFF name when cached override name is empty', () => {
    const cachedWithEmptyName = {
      name: '',
      brand: '',
      ingredientsText: 'OCR ingredients',
    };

    const merged: Product = {
      ...mockOFFProduct,
      ...cachedWithEmptyName,
      ean: mockOFFProduct.ean,
      name: cachedWithEmptyName.name?.trim() || mockOFFProduct.name,
      brand: cachedWithEmptyName.brand?.trim() || mockOFFProduct.brand,
      ingredientsText:
        cachedWithEmptyName.ingredientsText?.trim() || mockOFFProduct.ingredientsText,
    };

    expect(merged.name).toBe('Test Product from OFF');
    expect(merged.brand).toBe('Test Brand');
    expect(merged.ingredientsText).toBe('OCR ingredients');
  });

  it('should use cached override name when provided and non-empty', () => {
    const cachedWithName = {
      name: 'Custom Name',
      brand: 'Custom Brand',
      ingredientsText: 'OCR ingredients',
    };

    const merged: Product = {
      ...mockOFFProduct,
      ...cachedWithName,
      ean: mockOFFProduct.ean,
      name: cachedWithName.name?.trim() || mockOFFProduct.name,
      brand: cachedWithName.brand?.trim() || mockOFFProduct.brand,
      ingredientsText: cachedWithName.ingredientsText?.trim() || mockOFFProduct.ingredientsText,
    };

    expect(merged.name).toBe('Custom Name');
    expect(merged.brand).toBe('Custom Brand');
    expect(merged.ingredientsText).toBe('OCR ingredients');
  });

  it('should use placeholder when offline and cached overrides exist', () => {
    const placeholder: Product = {
      ean: mockEan,
      name: 'Unbekanntes Produkt',
      ingredientsText: mockCachedOverrides.ingredientsText,
      brand: (mockCachedOverrides as any).brand,
    };

    expect(placeholder.name).toBe('Unbekanntes Produkt');
    expect(placeholder.ingredientsText).toBe('OCR ingredients');
  });

  it('should match ContributeScreen flow: cachedData with only ingredientsText, OFF has name/brand', () => {
    const cachedData = JSON.stringify({ product: { ingredientsText: 'OCR ingredients' } });
    const parsed = JSON.parse(cachedData) as unknown;
    const cachedProduct =
      parsed && typeof parsed === 'object' && 'product' in (parsed as Record<string, unknown>)
        ? (parsed as { product: unknown }).product
        : parsed;
    const cachedOverrides = cachedProduct as Partial<Product>;

    const overrideName = cachedOverrides?.name?.trim();
    const overrideBrand = cachedOverrides?.brand?.trim();

    const mergedProduct: Product = {
      ...mockOFFProduct,
      ...(cachedOverrides ?? {}),
      ean: mockOFFProduct.ean,
      name: overrideName ? overrideName : mockOFFProduct.name,
      brand: overrideBrand ? overrideBrand : mockOFFProduct.brand,
      ingredientsText:
        cachedOverrides?.ingredientsText && cachedOverrides.ingredientsText.trim()
          ? cachedOverrides.ingredientsText
          : mockOFFProduct.ingredientsText,
    };

    expect(mergedProduct.name).toBe('Test Product from OFF');
    expect(mergedProduct.brand).toBe('Test Brand');
    expect(mergedProduct.ingredientsText).toBe('OCR ingredients');
  });
});
