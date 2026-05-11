import type { NovaScore } from './Product';
import type { AIInsightFinding } from './Robotoff';

export type ScanStatus = 'OK' | 'Warning' | 'Critical';

export type RedFlagSeverity = 'warning' | 'critical';

export interface RedFlagFinding {
  ingredient: string;
  category: string;
  severity: RedFlagSeverity;
}

export interface NovaDetails {
  score: NovaScore;
  label?: string;
  color?: string;
}

export interface ScanResult {
  status: ScanStatus;
  redFlags: RedFlagFinding[];
  nova: NovaDetails;
  aiInsights?: AIInsightFinding[];
}
