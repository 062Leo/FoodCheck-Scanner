export type NovaScore = 1 | 2 | 3 | 4;

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
}
