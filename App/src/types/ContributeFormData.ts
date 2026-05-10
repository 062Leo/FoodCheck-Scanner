export interface NutrimentData {
  energyKcal100g?: number;
  fat100g?: number;
  saturatedFat100g?: number;
  carbohydrates100g?: number;
  sugars100g?: number;
  fiber100g?: number;
  proteins100g?: number;
  salt100g?: number;
}

export interface ContributeFormData {
  ean: string;
  productName: string;
  brands?: string;
  categories?: string;
  ingredientsText?: string;
  ingredientsByLang?: Record<string, string>;
  nutriments?: NutrimentData;
}
