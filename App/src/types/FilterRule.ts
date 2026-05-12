export type FilterRuleType = 'ingredient' | 'nutrient';
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
