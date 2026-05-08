import type { NovaScore } from './Product';

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
}

export interface ScanResult {
  status: ScanStatus;
  redFlags: RedFlagFinding[];
  nova: NovaDetails;
}