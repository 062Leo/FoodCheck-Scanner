import type { Product, ProductNutriments } from '../../types/Product';

export const PRODUCT_DATA_VERSION = 1;

export interface NormalizedProduct {
  ean: string;
  name: string | null;
  brand: string | null;
  ingredientsText: string | null;
  novaScore: number | null;
  nutritionGrades: string | null;
  ecoscoreGrade: string | null;
  imageUrl: string | null;
  imageIngredientsUrl: string | null;
  imageNutritionUrl: string | null;
  imagePackagingUrl: string | null;
  categories: string | null;
  labels: string | null;
  allergens: string | null;
  traces: string | null;
  additives: string | null;
  origins: string | null;
  manufacturingPlaces: string | null;
  stores: string | null;
  quantity: string | null;
  servingSize: string | null;
  lastModified: string | null;
  nutriments: ProductNutriments | null;
  ingredientsTextByLang: Record<string, string> | null;
  ingredientsTextDe: string | null;
  ingredientsTextEn: string | null;
  fullJson: string;
}

export class ProductNormalizer {
  static normalize(product: Product): NormalizedProduct {
    return {
      ean: product.ean,
      name: product.name || null,
      brand: product.brand || null,
      ingredientsText: product.ingredientsText || null,
      novaScore: product.novaScore ?? null,
      nutritionGrades: product.nutritionGrades || null,
      ecoscoreGrade: product.ecoscoreGrade || null,
      imageUrl: product.imageUrl || null,
      imageIngredientsUrl: product.imageIngredientsUrl || null,
      imageNutritionUrl: product.imageNutritionUrl || null,
      imagePackagingUrl: product.imagePackagingUrl || null,
      categories: product.categories || null,
      labels: product.labelsTags?.join(', ') || null,
      allergens: product.allergensTags?.join(', ') || null,
      traces: product.traces || null,
      additives: product.additivesTags?.join(', ') || null,
      origins: product.origins || null,
      manufacturingPlaces: product.manufacturingPlaces || null,
      stores: product.stores || null,
      quantity: product.quantity || null,
      servingSize: product.servingSize || null,
      lastModified: product.lastModified || null,
      nutriments: product.nutriments || null,
      ingredientsTextByLang: product.ingredientsTextByLang || null,
      ingredientsTextDe: product.ingredientsTextDe || null,
      ingredientsTextEn: product.ingredientsTextEn || null,
      fullJson: JSON.stringify({
        product: product,
        _dataVersion: PRODUCT_DATA_VERSION,
      }),
    };
  }

  static denormalize(
    json: string,
    fallbackFields: {
      ean: string;
      name?: string | null;
      brand?: string | null;
      ingredientsText?: string | null;
      novaScore?: number | null;
    }
  ): Product {
    const product: Product = {
      ean: fallbackFields.ean,
      name: fallbackFields.name || 'Unbekanntes Produkt',
      brand: fallbackFields.brand || undefined,
      ingredientsText: fallbackFields.ingredientsText || undefined,
      novaScore: (fallbackFields.novaScore as Product['novaScore']) ?? undefined,
    };

    if (!json) return product;

    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      const p = (parsed.product || parsed) as Record<string, unknown>;

      if (typeof p.ingredientsText === 'string') product.ingredientsText = p.ingredientsText;
      if (typeof p.ingredients_text === 'string' && !product.ingredientsText)
        product.ingredientsText = p.ingredients_text;
      if (typeof p.ingredients_text_de === 'string')
        product.ingredientsTextDe = p.ingredients_text_de;
      if (typeof p.ingredients_text_en === 'string')
        product.ingredientsTextEn = p.ingredients_text_en;
      if (typeof p.ingredientsTextDe === 'string') product.ingredientsTextDe = p.ingredientsTextDe;
      if (typeof p.ingredientsTextEn === 'string') product.ingredientsTextEn = p.ingredientsTextEn;

      const langTexts: Record<string, string> = {};
      const byLang = p.ingredientsTextByLang;
      if (byLang && typeof byLang === 'object' && !Array.isArray(byLang)) {
        Object.assign(langTexts, byLang as Record<string, string>);
      }
      for (const [key, value] of Object.entries(p)) {
        if (key.startsWith('ingredients_text_') && typeof value === 'string') {
          const lang = key.replace('ingredients_text_', '');
          if (!langTexts[lang]) langTexts[lang] = value;
        }
      }
      if (Object.keys(langTexts).length > 0) {
        product.ingredientsTextByLang = langTexts;
      }

      const strOr = (...keys: string[]): string | undefined => {
        for (const k of keys) {
          const v = p[k];
          if (typeof v === 'string' && v.length > 0) return v;
        }
        return undefined;
      };

      product.imageUrl = strOr('imageUrl', 'image_front_url');
      product.imageIngredientsUrl = strOr('imageIngredientsUrl', 'image_ingredients_url');
      product.imageNutritionUrl = strOr('imageNutritionUrl', 'image_nutrition_url');
      product.imagePackagingUrl = strOr('imagePackagingUrl', 'image_packaging_url');
      product.nutritionGrades = strOr('nutritionGrades', 'nutrition_grades');
      product.ecoscoreGrade = strOr('ecoscoreGrade', 'ecoscore_grade');
      product.categories = strOr('categories');
      product.quantity = strOr('quantity');
      product.servingSize = strOr('servingSize', 'serving_size');
      product.origins = strOr('origins');
      product.manufacturingPlaces = strOr('manufacturingPlaces', 'manufacturing_places');
      product.stores = strOr('stores');
      product.traces = strOr('traces');
      product.lastModified = strOr('lastModified', 'last_modified_t');

      if (typeof p.brand === 'string') product.brand = p.brand;
      if (typeof p.brands === 'string' && !product.brand) product.brand = p.brands;
      if (typeof p.name === 'string' && product.name === 'Unbekanntes Produkt')
        product.name = p.name;
      if (typeof p.product_name === 'string' && product.name === 'Unbekanntes Produkt')
        product.name = p.product_name;
      if (typeof p.novaScore === 'number') product.novaScore = p.novaScore as Product['novaScore'];
      if (typeof p.nova_group === 'number' && product.novaScore === undefined)
        product.novaScore = p.nova_group as Product['novaScore'];

      const allergens = p.allergensTags ?? p.allergens_tags;
      if (Array.isArray(allergens)) product.allergensTags = allergens as string[];

      const addTags = p.additivesTags ?? p.additives_tags;
      if (Array.isArray(addTags)) product.additivesTags = addTags as string[];

      const nutriments = p.nutriments;
      if (nutriments && typeof nutriments === 'object' && !Array.isArray(nutriments)) {
        const n = nutriments as Record<string, unknown>;
        const getNut = (camel: string, snake: string): number | undefined => {
          const v = n[camel] ?? n[snake];
          return typeof v === 'number' ? v : undefined;
        };
        const nut: Product['nutriments'] = {};
        const setNut = (key: keyof ProductNutriments, camel: string, snake: string) => {
          const val = getNut(camel, snake);
          if (val !== undefined) nut[key] = val;
        };
        setNut('energyKcal100g', 'energyKcal100g', 'energy-kcal_100g');
        setNut('fat100g', 'fat100g', 'fat_100g');
        setNut('saturatedFat100g', 'saturatedFat100g', 'saturated-fat_100g');
        setNut('carbohydrates100g', 'carbohydrates100g', 'carbohydrates_100g');
        setNut('sugars100g', 'sugars100g', 'sugars_100g');
        setNut('fiber100g', 'fiber100g', 'fiber_100g');
        setNut('proteins100g', 'proteins100g', 'proteins_100g');
        setNut('salt100g', 'salt100g', 'salt_100g');
        if (Object.keys(nut).length > 0) product.nutriments = nut;
      }
    } catch {
      // Ignore parse errors, use fallback fields
    }

    return product;
  }
}
