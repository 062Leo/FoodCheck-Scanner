import type { ProductNutriments } from './Product';

export interface ContributeFormData {
  ean: string;
  productName: string;
  brands?: string;
  categories?: string;
  ingredientsText?: string;
  ingredientsByLang?: Record<string, string>;
  nutriments?: ProductNutriments;
}
