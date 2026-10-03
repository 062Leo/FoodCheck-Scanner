import type { FilterRule } from '../../../types/FilterRule';
import { seedRules } from '../../rules/seedRules';

const CREATED_AT = '2026-01-01T00:00:00.000Z';

/** The rule set a fresh installation has after the seed migration. */
export const SEEDED_RULES: FilterRule[] = seedRules.map((rule, index) => ({
  id: index + 1,
  type: 'ingredient',
  key: rule.key,
  category: rule.category,
  threshold: null,
  operator: null,
  severity: 'red_flag',
  translations: null,
  created_at: CREATED_AT,
}));

/**
 * A customised rule set: the user relaxed "Citric Acid" to OK and added a nutrient
 * rule "sugar above 20 g per 100 g".
 */
export const CUSTOMISED_RULES: FilterRule[] = [
  ...SEEDED_RULES.map((rule) =>
    rule.key === 'Citric Acid' ? { ...rule, severity: 'ok' as const } : rule
  ),
  {
    id: SEEDED_RULES.length + 1,
    type: 'nutrient',
    key: 'sugars_100g',
    category: 'Zucker & Sirupe',
    threshold: 20,
    operator: 'gt',
    severity: 'red_flag',
    translations: null,
    created_at: CREATED_AT,
  },
];
