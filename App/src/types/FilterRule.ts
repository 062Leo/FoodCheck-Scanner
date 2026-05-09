export type FilterRuleType = 'ingredient' | 'nutrient';
export type FilterRuleSeverity = 'red_flag' | 'ok';
export type FilterRuleOperator = 'gt' | 'lt' | 'eq';

export interface FilterRule {
  id: number;
  type: FilterRuleType;
  key: string;
  threshold?: number | null;
  operator?: FilterRuleOperator | null;
  severity: FilterRuleSeverity;
  created_at: string;
}

export type NewFilterRule = Omit<FilterRule, 'id' | 'created_at'>;
