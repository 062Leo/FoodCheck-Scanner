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
}
