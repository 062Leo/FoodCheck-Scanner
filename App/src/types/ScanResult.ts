import type { NovaScore } from './Product';
import type { AIInsightFinding } from './Robotoff';

/**
 * Traffic-light status of a product. `Unknown` means there is not enough data
 * (no ingredient list, no NOVA group and no nutrient finding) to rate it.
 */
export type ScanStatus = 'OK' | 'Warning' | 'Critical' | 'Unknown';

export const SCAN_STATUSES: readonly ScanStatus[] = ['Critical', 'Warning', 'OK', 'Unknown'];

export function isScanStatus(value: unknown): value is ScanStatus {
  return typeof value === 'string' && (SCAN_STATUSES as readonly string[]).includes(value);
}

export type RedFlagSeverity = 'warning' | 'critical';

export type NutrientKey =
  | 'sugars_100g'
  | 'fat_100g'
  | 'saturated-fat_100g'
  | 'salt_100g'
  | 'energy-kcal_100g';

export interface NutrientFindingDetail {
  key: NutrientKey;
  value: number;
  operator: 'gt' | 'lt' | 'eq';
  threshold: number;
}

export interface RedFlagFinding {
  ingredient: string;
  category: string;
  severity: RedFlagSeverity;
  canonicalKey?: string;
  /** E-number of the additive this finding refers to, if known. */
  eNumber?: string;
  /** Set for findings produced by a nutrient threshold rule. */
  nutrient?: NutrientFindingDetail;
}

export interface NovaDetails {
  /** Undefined when the product has no NOVA group. */
  score?: NovaScore;
  label?: string;
  color?: string;
}

/** Machine-readable explanation of a status; the UI turns it into text. */
export type RatingReason =
  | { code: 'nova'; nova: 3 | 4 }
  | { code: 'redFlags'; count: number }
  | { code: 'ingredientsMissing' }
  | { code: 'insufficientData' }
  | { code: 'noFindings' };

export interface ScanResult {
  status: ScanStatus;
  redFlags: RedFlagFinding[];
  nova: NovaDetails;
  reasons: RatingReason[];
  aiInsights?: AIInsightFinding[];
}
