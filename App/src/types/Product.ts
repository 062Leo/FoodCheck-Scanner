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
  /** Set when the user edited the product on this device. */
  edited_at?: string | null;
  /** JSON array of the fields the user edited (see domain/product/editedFields). */
  edited_fields?: string | null;
}

/** Lightweight row for lists (no raw_json). */
export type ProductSummary = Pick<
  ProductRecord,
  | 'id'
  | 'ean'
  | 'name'
  | 'brands'
  | 'nova_score'
  | 'nutriscore'
  | 'scanned_at'
  | 'rating'
  | 'visit_count'
  | 'last_seen_at'
  | 'image_url'
  | 'edited_at'
> & {
  /** 1 if an ingredient list is stored. */
  has_ingredients: number;
};

export interface ProductNutriments {
  energyKcal100g?: number;
  fat100g?: number;
  saturatedFat100g?: number;
  carbohydrates100g?: number;
  sugars100g?: number;
  fiber100g?: number;
  proteins100g?: number;
  salt100g?: number;
  /** Alcohol in % vol. */
  alcohol100g?: number;
  /**
   * Minerals in g per 100 g as Open Food Facts stores them (water: × 10000 = mg/l).
   */
  sodium100g?: number;
  calcium100g?: number;
  magnesium100g?: number;
  potassium100g?: number;
  bicarbonate100g?: number;
  chloride100g?: number;
  sulphate100g?: number;
  nitrate100g?: number;
  nitrite100g?: number;
  fluoride100g?: number;
  manganese100g?: number;
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
  /** Normalised traces from Open Food Facts, e.g. "en:nuts" (not editable in the app). */
  tracesTags?: string[];
  additivesTags?: string[];
  categories?: string;
  /** Normalised categories including their parents, e.g. "en:canned-tunas", "en:fishes". */
  categoriesTags?: string[];
  miscTags?: string[];
  labelsTags?: string[];
  /** Packaging shapes, materials and free tags, e.g. "en:can", "en:metal". */
  packagingTags?: string[];
  /** Company that owns the brand (from GS1 data at Open Food Facts). */
  brandOwner?: string;
  /** Packager codes (identification marks), e.g. "de-by-123-eg". */
  embCodesTags?: string[];
  /** Where the product data comes from; Open Food Facts when not set. */
  source?: 'usda';
  quantity?: string;
  servingSize?: string;
  imageNutritionUrl?: string;
  nutriments?: ProductNutriments;
  origins?: string;
  manufacturingPlaces?: string;
  stores?: string;
}
