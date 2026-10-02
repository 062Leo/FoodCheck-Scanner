import { OpenFoodFactsClient } from '../OpenFoodFactsClient';

jest.mock('../config', () => ({
  ...jest.requireActual('../config'),
  USE_STAGING: false,
  BASE_URL: 'https://world.openfoodfacts.org',
  USER_AGENT: 'FoodCheck/1.0',
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
      expect(options.headers['User-Agent']).toBe('FoodCheck/1.0');
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
            traces: 'Milch',
            traces_tags: ['en:milk'],
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
      expect(product!.traces).toBe('Milch');
      expect(product!.tracesTags).toEqual(['en:milk']);
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

    it('keeps the main-language text under its own language', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 1,
          product: { product_name: 'Kofola', lang: 'cs', ingredients_text: 'voda, cukr' },
        }),
      });

      const product = await client.getProductByEan('123');

      expect(product!.ingredientsTextByLang).toEqual({ cs: 'voda, cukr' });
      expect(product!.ingredientsText).toBe('voda, cukr');
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

      await expect(client.getProductByEan('123')).rejects.toThrow('Failed to fetch product data');
    });
  });
});
