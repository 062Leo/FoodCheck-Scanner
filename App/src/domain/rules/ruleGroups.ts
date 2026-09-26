import type { FilterRule } from '../../types/FilterRule';

export interface RuleGroup {
  category: string;
  label: string;
  rules: FilterRule[];
}

/**
 * Groups rules by category for display: only categories that contain rules, sorted by
 * their displayed (translated) name; rules sorted by displayed name. With a search
 * query, a category matches as a whole if its name matches, otherwise only matching
 * rules are kept.
 */
export function groupRules(
  rules: readonly FilterRule[],
  options: {
    query: string;
    categoryLabel: (category: string) => string;
    ruleLabel: (rule: FilterRule) => string;
    uncategorized: string;
  }
): RuleGroup[] {
  const byCategory = new Map<string, FilterRule[]>();
  for (const rule of rules) {
    const category = rule.category || '';
    byCategory.set(category, [...(byCategory.get(category) ?? []), rule]);
  }

  const query = options.query.trim().toLocaleLowerCase();
  const groups: RuleGroup[] = [];
  for (const [category, categoryRules] of byCategory) {
    const label = category ? options.categoryLabel(category) : options.uncategorized;
    const categoryMatches =
      !query ||
      label.toLocaleLowerCase().includes(query) ||
      category.toLocaleLowerCase().includes(query);
    const matching = categoryMatches
      ? categoryRules
      : categoryRules.filter(
          (rule) =>
            options.ruleLabel(rule).toLocaleLowerCase().includes(query) ||
            rule.key.toLocaleLowerCase().includes(query)
        );
    if (matching.length === 0) continue;
    groups.push({
      category,
      label,
      rules: [...matching].sort((a, b) =>
        options.ruleLabel(a).localeCompare(options.ruleLabel(b), undefined, { sensitivity: 'base' })
      ),
    });
  }

  return groups.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}
