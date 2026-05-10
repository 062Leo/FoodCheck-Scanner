import { OpenFoodFactsClient } from '../OpenFoodFactsClient';
import { ProductNotFoundError } from '../ApiError';

jest.mock('../config', () => ({
  ...jest.requireActual('../config'),
  USE_STAGING: false,
  BASE_URL: 'https://world.openfoodfacts.org',
  USER_AGENT: 'TrueFoodScanner/1.0 (test@example.com)',
}));

global.fetch = jest.fn();

describe('OpenFoodFactsClient', () => {
  const client = new OpenFoodFactsClient();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProductByEan', () => {
    it('should call v2 API with fields param', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 1, product: { product_name: 'Test' } }),
      });

      await client.getProductByEan('1234567890123');

      expect(fetch).toHaveBeenCalledTimes(1);
      const url = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/api/v2/product/1234567890123');
      expect(url).toContain('fields=');
      expect(url).toContain('product_name');
      expect(url).toContain('nutriments');
      expect(url).toContain('misc_tags');
    });

    it('should attach User-Agent header', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 1, product: { product_name: 'Test' } }),
      });

      await client.getProductByEan('123');

      const options = (fetch as jest.Mock).mock.calls[0][1] as { headers: Record<string, string> };
      expect(options.headers['User-Agent']).toBe('TrueFoodScanner/1.0 (test@example.com)');
    });

    it('should return null when status is 0', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 0, status_verbose: 'product not found' }),
      });

      const result = await client.getProductByEan('0000000000000');

      expect(result).toBeNull();
    });

    it('should return null when product field is missing', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 1 }),
      });

      const result = await client.getProductByEan('123');

      expect(result).toBeNull();
    });

    it('should parse a full product response', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 1,
          code: '3017624010701',
          product: {
            product_name: 'Nutella',
            brands: 'Ferrero',
            categories: 'Spreads',
            nutrition_grades: 'e',
            nova_group: 4,
            ecoscore_grade: 'd',
            nutriments: {
              'energy-kcal_100g': 539,
              fat_100g: 30.9,
              'saturated-fat_100g': 10.6,
              carbohydrates_100g: 57.5,
              sugars_100g: 56.3,
              fiber_100g: 0,
              proteins_100g: 6.3,
              salt_100g: 0.107,
            },
            allergens_tags: ['en:gluten', 'en:nuts'],
            ingredients_text: 'Sugar, palm oil',
            ingredients_text_de: 'Zucker, Palmöl',
            ingredients_text_en: 'Sugar, palm oil',
            image_front_url: 'https://images.example.com/front.jpg',
            image_nutrition_url: 'https://images.example.com/nutrition.jpg',
            quantity: '400g',
            serving_size: '15g',
            misc_tags: ['en:nutriscore-computed', 'en:nutriscore-missing-category'],
            labels_tags: ['en:organic'],
          },
        }),
      });

      const product = await client.getProductByEan('3017624010701');

      expect(product).not.toBeNull();
      expect(product!.ean).toBe('3017624010701');
      expect(product!.name).toBe('Nutella');
      expect(product!.brand).toBe('Ferrero');
      expect(product!.categories).toBe('Spreads');
      expect(product!.nutritionGrades).toBe('e');
      expect(product!.novaScore).toBe(4);
      expect(product!.ecoscoreGrade).toBe('d');
      expect(product!.nutriments).toEqual({
        energyKcal100g: 539,
        fat100g: 30.9,
        saturatedFat100g: 10.6,
        carbohydrates100g: 57.5,
        sugars100g: 56.3,
        fiber100g: 0,
        proteins100g: 6.3,
        salt100g: 0.107,
      });
      expect(product!.allergensTags).toEqual(['en:gluten', 'en:nuts']);
      expect(product!.ingredientsText).toBe('Zucker, Palmöl');
      expect(product!.ingredientsTextDe).toBe('Zucker, Palmöl');
      expect(product!.ingredientsTextEn).toBe('Sugar, palm oil');
      expect(product!.imageUrl).toContain('front.jpg');
      expect(product!.imageNutritionUrl).toContain('nutrition.jpg');
      expect(product!.quantity).toBe('400g');
      expect(product!.servingSize).toBe('15g');
      expect(product!.miscTags).toContain('en:nutriscore-missing-category');
      expect(product!.labelsTags).toContain('en:organic');
    });

    it('should fall back to generic ingredients_text when _de is missing', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 1,
          product: {
            product_name: 'Test',
            ingredients_text: 'Water, sugar',
          },
        }),
      });

      const product = await client.getProductByEan('123');

      expect(product!.ingredientsText).toBe('Water, sugar');
    });

    it('should handle minimal response gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 1,
          product: {
            product_name: 'Minimal',
          },
        }),
      });

      const product = await client.getProductByEan('123');

      expect(product).not.toBeNull();
      expect(product!.name).toBe('Minimal');
      expect(product!.brand).toBeUndefined();
      expect(product!.nutriments).toBeUndefined();
      expect(product!.novaScore).toBeUndefined();
    });

    it('should throw on HTTP error', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(client.getProductByEan('123')).rejects.toThrow('Fehler beim Abrufen');
    });
  });

  describe('getProductByEanOrThrow', () => {
    it('should return product when found', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 1, product: { product_name: 'Found' } }),
      });

      const product = await client.getProductByEanOrThrow('123');

      expect(product.name).toBe('Found');
    });

    it('should throw ProductNotFoundError when not found', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 0 }),
      });

      await expect(client.getProductByEanOrThrow('000')).rejects.toThrow(ProductNotFoundError);
    });
  });

  describe('searchProducts', () => {
    it('should call search endpoint with default pagination', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ count: 0, page: 1, page_count: 0, products: [] }),
      });

      await client.searchProducts();

      const url = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/api/v2/search');
      expect(url).toContain('page=1');
      expect(url).toContain('page_size=24');
      expect(url).toContain('fields=');
    });

    it('should include filter parameters', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ count: 0, page: 1, page_count: 0, products: [] }),
      });

      await client.searchProducts({
        category: 'Orange Juice',
        nutritionGrade: 'c',
        brand: 'nestle',
        novaGroup: 4,
        label: 'en:organic',
        country: 'en:germany',
        page: 2,
        pageSize: 10,
        sortBy: 'popularity_key',
      });

      const url = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('categories_tags_en=Orange+Juice');
      expect(url).toContain('nutrition_grades_tags=c');
      expect(url).toContain('brands_tags=nestle');
      expect(url).toContain('nova_groups_tags=4');
      expect(url).toContain('labels_tags=en%3Aorganic');
      expect(url).toContain('countries_tags=en%3Agermany');
      expect(url).toContain('page=2');
      expect(url).toContain('page_size=10');
      expect(url).toContain('sort_by=popularity_key');
    });

    it('should cap pageSize at 200', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ count: 0, page: 1, page_count: 0, products: [] }),
      });

      await client.searchProducts({ pageSize: 500 });

      const url = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('page_size=200');
    });

    it('should map search results to Product array', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 2,
          page: 1,
          page_count: 1,
          products: [
            { code: '123', product_name: 'Product A', nutrition_grades: 'a', brands: 'BrandA' },
            { code: '456', product_name: 'Product B', nova_group: 3 },
          ],
        }),
      });

      const result = await client.searchProducts();

      expect(result.count).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageCount).toBe(1);
      expect(result.products).toHaveLength(2);
      expect(result.products[0].name).toBe('Product A');
      expect(result.products[0].nutritionGrades).toBe('a');
      expect(result.products[0].brand).toBe('BrandA');
      expect(result.products[1].name).toBe('Product B');
      expect(result.products[1].novaScore).toBe(3);
    });

    it('should throw on HTTP error', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(client.searchProducts()).rejects.toThrow('Fehler bei der Produktsuche');
    });
  });

  describe('getProductsByBarcodes', () => {
    it('should return empty object for empty input', async () => {
      const result = await client.getProductsByBarcodes([]);
      expect(result).toEqual({});
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should pass barcodes as comma-separated code param', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ count: 0, page: 1, page_count: 0, products: [] }),
      });

      await client.getProductsByBarcodes(['123', '456', '789']);

      const url = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/api/v2/search');
      expect(url).toContain('code=123%2C456%2C789');
    });

    it('should return map with found products and null for missing', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 2,
          page: 1,
          page_count: 1,
          products: [
            { code: '123', product_name: 'Found A' },
            { code: '456', product_name: 'Found B' },
          ],
        }),
      });

      const result = await client.getProductsByBarcodes(['123', '456', '789']);

      expect(result['123']).not.toBeNull();
      expect(result['123']!.name).toBe('Found A');
      expect(result['456']).not.toBeNull();
      expect(result['456']!.name).toBe('Found B');
      expect(result['789']).toBeNull();
    });

    it('should throw on HTTP error', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(client.getProductsByBarcodes(['123'])).rejects.toThrow(
        'Fehler beim Batch-Abruf'
      );
    });
  });

  describe('getFieldSuggestions', () => {
    it('should call suggest.pl with tagtype and term', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ['Orange Juice', 'Orange Soda'],
      });

      const result = await client.getFieldSuggestions('categories', 'oran');

      const url = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/cgi/suggest.pl');
      expect(url).toContain('tagtype=categories');
      expect(url).toContain('term=oran');
      expect(result).toEqual(['Orange Juice', 'Orange Soda']);
    });

    it('should filter non-string values from response', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ['Valid', 123, 'Also valid', null],
      });

      const result = await client.getFieldSuggestions('brands', 'test');

      expect(result).toEqual(['Valid', 'Also valid']);
    });

    it('should return empty array for non-array response', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'bad' }),
      });

      const result = await client.getFieldSuggestions('labels', 'x');

      expect(result).toEqual([]);
    });

    it('should throw on HTTP error', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(client.getFieldSuggestions('categories', 'x')).rejects.toThrow(
        'Fehler bei der Feld-Vorschlagsabfrage'
      );
    });
  });

  describe('getTaxonomySuggestions', () => {
    it('should call v3 taxonomy_suggestions endpoint', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 'en:organic', text: 'Organic' },
          { id: 'en:fair-trade', text: 'Fair Trade' },
        ],
      });

      const result = await client.getTaxonomySuggestions('labels', 'org', 'en');

      const url = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/api/v3/taxonomy_suggestions');
      expect(url).toContain('tagtype=labels');
      expect(url).toContain('string=org');
      expect(url).toContain('lc=en');
      expect(result).toEqual([
        { id: 'en:organic', text: 'Organic' },
        { id: 'en:fair-trade', text: 'Fair Trade' },
      ]);
    });

    it('should omit lc param when lang is not provided', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await client.getTaxonomySuggestions('categories', 'juice');

      const url = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).not.toContain('lc=');
    });

    it('should handle wrapped suggestions object', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          suggestions: [{ id: 'en:organic', text: 'Organic' }],
        }),
      });

      const result = await client.getTaxonomySuggestions('labels', 'org');

      expect(result).toEqual([{ id: 'en:organic', text: 'Organic' }]);
    });

    it('should fall back to name field when text is missing', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [{ id: 'en:test', name: 'Test Name' }],
      });

      const result = await client.getTaxonomySuggestions('labels', 'test');

      expect(result).toEqual([{ id: 'en:test', text: 'Test Name' }]);
    });

    it('should throw on HTTP error', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
      });

      await expect(client.getTaxonomySuggestions('labels', 'x')).rejects.toThrow(
        'Fehler bei der Taxonomie-Vorschlagsabfrage'
      );
    });
  });
});
