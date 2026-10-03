import { groupRules } from '../ruleGroups';
import type { FilterRule } from '../../../types/FilterRule';

function rule(id: number, key: string, category: string): FilterRule {
  return {
    id,
    type: 'ingredient',
    key,
    category,
    severity: 'red_flag',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

const rules = [
  rule(1, 'Sugar', 'Zucker & Sirupe'),
  rule(2, 'Glucose Syrup', 'Zucker & Sirupe'),
  rule(3, 'Palm Oil', 'Gehärtete Fette & raffinierte Öle'),
  rule(4, 'Meine Zutat', ''),
];

const labels: Record<string, string> = {
  'Zucker & Sirupe': 'Sugar & Syrups',
  'Gehärtete Fette & raffinierte Öle': 'Hydrogenated Fats & Refined Oils',
};
const names: Record<string, string> = {
  Sugar: 'Zucker',
  'Glucose Syrup': 'Glukosesirup',
  'Palm Oil': 'Palmöl',
};

const options = (query: string) => ({
  query,
  categoryLabel: (c: string) => labels[c] ?? c,
  ruleLabel: (r: FilterRule) => names[r.key] ?? r.key,
  uncategorized: 'Uncategorized',
});

describe('groupRules', () => {
  it('lists only non-empty categories, sorted by their displayed name', () => {
    expect(groupRules(rules, options('')).map((g) => g.label)).toEqual([
      'Hydrogenated Fats & Refined Oils',
      'Sugar & Syrups',
      'Uncategorized',
    ]);
  });

  it('sorts rules by their displayed name', () => {
    const sugar = groupRules(rules, options('')).find((g) => g.label === 'Sugar & Syrups');
    expect(sugar?.rules.map((r) => r.key)).toEqual(['Glucose Syrup', 'Sugar']);
  });

  it('finds rules by translated name and categories by label', () => {
    expect(groupRules(rules, options('palmöl')).map((g) => g.rules.map((r) => r.key))).toEqual([
      ['Palm Oil'],
    ]);
    expect(groupRules(rules, options('syrups'))[0].rules).toHaveLength(2);
    expect(groupRules(rules, options('xyz'))).toEqual([]);
  });
});
