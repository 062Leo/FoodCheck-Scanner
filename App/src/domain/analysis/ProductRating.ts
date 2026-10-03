import type { FilterRule } from '../../types/FilterRule';
import type { NovaScore, Product } from '../../types/Product';
import type { RatingReason, RedFlagFinding, ScanResult, ScanStatus } from '../../types/ScanResult';
import { RedFlagAnalyzer } from './RedFlagAnalyzer';
import { NovaScoreEvaluator } from './NovaScoreEvaluator';

/** Number of red flags from which a product is rated critical. */
export const CRITICAL_RED_FLAG_COUNT = 3;

export function toNovaScore(value: unknown): NovaScore | undefined {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : undefined;
}

export class ProductRating {
  constructor(
    private readonly redFlagAnalyzer: RedFlagAnalyzer,
    private readonly novaEvaluator: NovaScoreEvaluator
  ) {}

  rate(product: Product, rules?: FilterRule[]): ScanResult {
    const ingredientsText = product.ingredientsText?.trim() ? product.ingredientsText : '';
    const activeRules = rules && rules.length > 0 ? rules : undefined;

    const keywordFlags = this.redFlagAnalyzer.analyze(
      ingredientsText,
      activeRules,
      product.nutriments
    );
    const taxonomyFlags = ingredientsText
      ? this.redFlagAnalyzer.analyzeTaxonomy(ingredientsText, activeRules)
      : [];
    const redFlags = this.mergeFindings(keywordFlags, taxonomyFlags);

    const novaScore = toNovaScore(product.novaScore);
    const novaDetails = this.novaEvaluator.evaluate(novaScore);
    const hasIngredients = ingredientsText.length > 0;
    const status = this.determineStatus(redFlags.length, novaScore, hasIngredients);

    return {
      status,
      redFlags,
      nova: {
        score: novaScore,
        label: novaDetails.label,
        color: novaDetails.color,
      },
      reasons: this.buildReasons(status, redFlags.length, novaScore, hasIngredients),
    };
  }

  private mergeFindings(
    keywordFlags: RedFlagFinding[],
    taxonomyFlags: RedFlagFinding[]
  ): RedFlagFinding[] {
    const merged: RedFlagFinding[] = [...keywordFlags];
    const seenNames = new Set(keywordFlags.map((f) => this.normalizeForDedup(f.ingredient)));
    const seenENumbers = new Set(
      keywordFlags.map((f) => f.eNumber).filter((e): e is string => Boolean(e))
    );

    for (const flag of taxonomyFlags) {
      const name = this.normalizeForDedup(flag.ingredient);
      if (seenNames.has(name) || (flag.eNumber && seenENumbers.has(flag.eNumber))) {
        continue;
      }
      merged.push(flag);
      seenNames.add(name);
      if (flag.eNumber) seenENumbers.add(flag.eNumber);
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

  private determineStatus(
    redFlagCount: number,
    novaScore: NovaScore | undefined,
    hasIngredients: boolean
  ): ScanStatus {
    if (novaScore === 4 || redFlagCount >= CRITICAL_RED_FLAG_COUNT) {
      return 'Critical';
    }
    if (redFlagCount >= 1 || novaScore === 3) {
      return 'Warning';
    }
    if (!hasIngredients && novaScore === undefined) {
      return 'Unknown';
    }
    return 'OK';
  }

  private buildReasons(
    status: ScanStatus,
    redFlagCount: number,
    novaScore: NovaScore | undefined,
    hasIngredients: boolean
  ): RatingReason[] {
    if (status === 'Unknown') {
      return [{ code: 'insufficientData' }];
    }

    const reasons: RatingReason[] = [];
    if (novaScore === 3 || novaScore === 4) {
      reasons.push({ code: 'nova', nova: novaScore });
    }
    if (redFlagCount > 0) {
      reasons.push({ code: 'redFlags', count: redFlagCount });
    }
    if (reasons.length === 0) {
      reasons.push({ code: 'noFindings' });
    }
    if (!hasIngredients) {
      reasons.push({ code: 'ingredientsMissing' });
    }
    return reasons;
  }
}
