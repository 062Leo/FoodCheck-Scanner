/**
 * - ingredient: a word in the ingredient list
 * - nutrient: a nutrient value per 100 g compared with a threshold
 * - check: a whole-product check (see domain/analysis/productChecks)
 * - company: a brand or company to avoid; a match rates the product critical
 * - product: a single product (brand and name words) with a published reason, e.g. a
 *   poor test result; a match counts as one red flag (see domain/analysis/productRules)
 */
export type FilterRuleType = 'ingredient' | 'nutrient' | 'check' | 'company' | 'product';
export type FilterRuleSeverity = 'red_flag' | 'ok';
export type FilterRuleOperator = 'gt' | 'lt' | 'eq';

export interface FilterRule {
  id: number;
  type: FilterRuleType;
  key: string;
  category: string;
  threshold?: number | null;
  operator?: FilterRuleOperator | null;
  severity: FilterRuleSeverity;
  translations?: string | null;
  created_at: string;
}

export type NewFilterRule = Omit<FilterRule, 'id' | 'created_at'>;

export interface FilterRuleSeed {
  key: string;
  category: string;
  type: 'ingredient';
  severity: 'red_flag';
}
