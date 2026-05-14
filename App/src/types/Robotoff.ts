export type RobotoffInsightType =
  | 'category'
  | 'label'
  | 'ingredient'
  | 'nutrient'
  | 'brand'
  | 'store'
  | 'packager_code'
  | 'product_weight'
  | 'expiration_date'
  | 'image_flag'
  | 'image_orientation';

export type RobotoffAnnotation = -1 | 0 | 1 | 2;

export interface RobotoffInsight {
  id: string;
  barcode: string;
  type: RobotoffInsightType;
  data: Record<string, unknown>;
  timestamp: string;
  completed_at: string;
  annotation: RobotoffAnnotation;
  annotated_result: number | null;
  n_votes: number;
  username: string | null;
  countries: string[];
  brands: string[];
  process_after: string | null;
  value_tag: string | null;
  value: string | null;
  source_image: string | null;
  automatic_processing: boolean;
  server_type: string;
  unique_scans_n: number;
  reserved_barcode: boolean;
  predictor: string;
  predictor_version: string | null;
  campaign: string[];
  confidence: number | null;
  bounding_box: number[] | null;
  lc: string | null;
  with_image: boolean | null;
}

export interface RobotoffInsightsResponse {
  count: number;
  insights: RobotoffInsight[];
  status: 'found' | 'no_insights';
}

export interface AIInsightFinding {
  id: string;
  type: RobotoffInsightType;
  value: string;
  confidence: number | null;
  predictor: string;
  annotation: RobotoffAnnotation;
  description: string;
}

export function formatInsightValue(
  type: RobotoffInsightType,
  valueTag: string | null,
  fallback = 'Unknown'
): string {
  if (!valueTag) return fallback;

  if (type === 'category' || type === 'label' || type === 'ingredient') {
    return valueTag
      .replace(/^[a-z]{2}:/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return valueTag;
}

export function isHighConfidence(insight: RobotoffInsight): boolean {
  if (insight.annotation < 0) return false;
  if (insight.annotation >= 1) return true;
  if (insight.confidence !== null && insight.confidence >= 0.7) return true;
  if (insight.n_votes >= 3) return true;
  return false;
}

export function isRelevantForAnalysis(type: RobotoffInsightType): boolean {
  return type === 'category' || type === 'label' || type === 'ingredient';
}
