import type { FilterRule } from '../../types/FilterRule';
import type { NovaScore, Product } from '../../types/Product';
import type { ScanResult, ScanStatus } from '../../types/ScanResult';
import { RedFlagAnalyzer } from './RedFlagAnalyzer';
import { NovaScoreEvaluator } from './NovaScoreEvaluator';

export class ProductRating {
  constructor(
    private readonly redFlagAnalyzer: RedFlagAnalyzer,
    private readonly novaEvaluator: NovaScoreEvaluator
  ) {}

  rate(product: Product, rules?: FilterRule[]): ScanResult {
    const redFlags = product.ingredientsText
      ? this.redFlagAnalyzer.analyze(product.ingredientsText, rules && rules.length > 0 ? rules : undefined)
      : [];

    const novaScore = product.novaScore || 1;
    const novaLabel = this.novaEvaluator.evaluate(novaScore);

    const status = this.determineStatus(redFlags.length, novaScore);

    return {
      status,
      redFlags,
      nova: {
        score: novaScore,
        label: novaLabel.label,
      },
    };
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
