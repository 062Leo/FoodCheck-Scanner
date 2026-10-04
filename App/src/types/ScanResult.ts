import type { NovaScore } from './Product';
import type { AIInsightFinding } from './Robotoff';
import type { CheckDetail } from '../domain/analysis/productChecks';

/**
 * Traffic-light status of a product. `Unknown` means there is not enough data
 * (no ingredient list, no NOVA group and no finding) to rate it.
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
  /** Set for findings produced by a whole-product check rule. */
  check?: CheckDetail;
  /** Set when the product belongs to a brand or company the user avoids. */
  company?: CompanyFindingDetail;
  /** Set for findings produced by a product rule (brand and product name). */
  productRule?: ProductRuleFindingDetail;
}

export interface ProductRuleFindingDetail {
  /** The rule's name, e.g. "Volvic". */
  name: string;
  reason: { de: string; en: string };
  sources: { title: string; url: string; date?: string }[];
}

export interface CompanyFindingDetail {
  /** The avoided name as the user entered it, e.g. "Nestlé". */
  name: string;
  /** The brand or owner of the product that matched, e.g. "Maggi". */
  matched: string;
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
  | { code: 'avoidedCompany'; company: string }
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
