import type { ScanStatus } from './ScanResult';

export type NovaScore = 1 | 2 | 3 | 4;

export interface ProductRecord {
  id?: number;
  ean: string;
  name: string | null;
  brands: string | null;
  ingredients: string | null;
  nova_score: NovaScore | null;
  nutriscore: string | null;
  raw_json: string | null;
  scanned_at: string;
  rating: ScanStatus;
  data_version?: number | null;
  last_api_fetch?: string | null;
  image_url?: string | null;
  image_ingredients_url?: string | null;
  image_nutrition_url?: string | null;
  image_packaging_url?: string | null;
  visit_count?: number | null;
  last_seen_at?: string | null;
}

export interface ProductNutriments {
  energyKcal100g?: number;
  fat100g?: number;
  saturatedFat100g?: number;
  carbohydrates100g?: number;
  sugars100g?: number;
  fiber100g?: number;
  proteins100g?: number;
  salt100g?: number;
}

export interface Product {
  ean: string;
  name: string;
  brand?: string;
  ingredientsText?: string;
  ingredientsTextDe?: string;
  ingredientsTextEn?: string;
  ingredientsTextByLang?: Record<string, string>;
  novaScore?: NovaScore;
  imageUrl?: string;
  imageIngredientsUrl?: string;
  imagePackagingUrl?: string;
  nutritionGrades?: string;
  ecoscoreGrade?: string;
  allergensTags?: string[];
  traces?: string;
  additivesTags?: string[];
  categories?: string;
  miscTags?: string[];
  labelsTags?: string[];
  quantity?: string;
  servingSize?: string;
  imageNutritionUrl?: string;
  nutriments?: ProductNutriments;
  origins?: string;
  manufacturingPlaces?: string;
  stores?: string;
  lastModified?: string;
}

export function getMissingScoreTags(product: Product): string[] {
  if (!product.miscTags) return [];
  return product.miscTags.filter(
    (tag) => tag.startsWith('en:nutriscore-missing-') || tag.startsWith('en:ecoscore-')
  );
}
