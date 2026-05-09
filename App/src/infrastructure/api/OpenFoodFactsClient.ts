import { Product, NovaScore } from '../../types/Product';

export class OpenFoodFactsClient {
  private readonly baseUrl = 'https://world.openfoodfacts.org/api/v0/product/';
  private readonly userAgent = 'FoodScanner/1.0 (privat)';

  async getProductByEan(ean: string): Promise<Product | null> {
    try {
      const response = await fetch(`${this.baseUrl}${ean}.json`, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      const data = await response.json();

      if (data.status === 0 || !data.product) {
        return null;
      }

      const { product } = data;

      const ingredientsTextByLang: Record<string, string> = {};
      Object.entries(product).forEach(([key, value]) => {
        if (key.startsWith('ingredients_text_') && typeof value === 'string') {
          const lang = key.replace('ingredients_text_', '');
          ingredientsTextByLang[lang] = value;
        }
      });

      return {
        ean,
        name: product.product_name || 'Unbekanntes Produkt',
        brand: product.brands,
        ingredientsText: product.ingredients_text_de || product.ingredients_text,
        ingredientsTextDe: product.ingredients_text_de,
        ingredientsTextEn: product.ingredients_text_en,
        ingredientsTextByLang,
        novaScore: product.nova_group as NovaScore,
        imageUrl: product.image_url,
      };
    } catch (error) {
      throw new Error('Fehler beim Abrufen der Produktdaten');
    }
  }
}
