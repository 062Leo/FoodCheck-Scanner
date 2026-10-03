import type { FilterRule } from '../../types/FilterRule';
import type { Product } from '../../types/Product';
import type { ScanResult } from '../../types/ScanResult';
import { defaultRules } from '../rules/defaultRules';
import { NovaScoreEvaluator } from './NovaScoreEvaluator';
import { ProductRating } from './ProductRating';
import { RedFlagAnalyzer } from './RedFlagAnalyzer';

const rater = new ProductRating(new RedFlagAnalyzer(defaultRules), new NovaScoreEvaluator());

/**
 * The single entry point for rating a product with the user's rules. Falls back to
 * the built-in default rules when the rule list is empty.
 */
export function rateProduct(product: Product, rules: FilterRule[]): ScanResult {
  return rater.rate(product, rules);
}
