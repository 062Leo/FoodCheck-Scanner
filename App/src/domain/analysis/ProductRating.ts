import type { FilterRule } from '../../types/FilterRule';
import type { NovaScore, Product } from '../../types/Product';
import type { ScanResult, ScanStatus, RedFlagFinding } from '../../types/ScanResult';
import { RedFlagAnalyzer } from './RedFlagAnalyzer';
import { NovaScoreEvaluator } from './NovaScoreEvaluator';

export class ProductRating {
  constructor(
    private readonly redFlagAnalyzer: RedFlagAnalyzer,
    private readonly novaEvaluator: NovaScoreEvaluator
  ) {}

  rate(product: Product, rules?: FilterRule[]): ScanResult {
    const keywordFlags = product.ingredientsText
      ? this.redFlagAnalyzer.analyze(
          product.ingredientsText,
          rules && rules.length > 0 ? rules : undefined
        )
      : [];

    const taxonomyFlags = product.ingredientsText
      ? this.redFlagAnalyzer.analyzeTaxonomy(product.ingredientsText)
      : [];

    const redFlags = this.mergeFindings(keywordFlags, taxonomyFlags);

    const novaScore = product.novaScore || 1;
    const novaDetails = this.novaEvaluator.evaluate(novaScore);

    const status = this.determineStatus(redFlags.length, novaScore);

    return {
      status,
      redFlags,
      nova: {
        score: novaScore,
        label: novaDetails.label,
        color: novaDetails.color,
      },
    };
  }

  private mergeFindings(
    keywordFlags: RedFlagFinding[],
    taxonomyFlags: RedFlagFinding[]
  ): RedFlagFinding[] {
    const merged: RedFlagFinding[] = [...keywordFlags];
    const keywordNorm = new Set(keywordFlags.map((f) => this.normalizeForDedup(f.ingredient)));

    for (const flag of taxonomyFlags) {
      const norm = this.normalizeForDedup(flag.ingredient);
      if (!keywordNorm.has(norm)) {
        merged.push(flag);
        keywordNorm.add(norm);
      }
    }

    return merged;
  }

  private normalizeForDedup(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s*\(e\d+[a-z]?\)\s*/gi, '')
      .replace(/e\s*\d{3,4}[a-z]?/gi, '')
      .trim();
  }

  private determineStatus(redFlagCount: number, novaScore: NovaScore): ScanStatus {
    if (novaScore === 4 || redFlagCount >= 3) {
      return 'Critical';
    }

    if ((redFlagCount >= 1 && redFlagCount <= 2) || novaScore === 3) {
      return 'Warning';
    }

    return 'OK';
  }
}
