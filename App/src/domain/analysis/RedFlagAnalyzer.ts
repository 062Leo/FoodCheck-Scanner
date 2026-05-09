import type { FilterRule } from '../../types/FilterRule';
import type { RedFlagFinding, RedFlagSeverity } from '../../types/ScanResult';
import type { RedFlagRule } from '../rules/defaultRules';
import { defaultRedFlagRules } from './defaultRedFlagRules';

type AnalyzerRule = RedFlagRule | FilterRule;

export class RedFlagAnalyzer {
  constructor(private readonly defaultRules: AnalyzerRule[] = defaultRedFlagRules) {}

  analyze(ingredientsText: string, rules?: AnalyzerRule[]): RedFlagFinding[] {
    if (!ingredientsText || ingredientsText.trim().length === 0) {
      return [];
    }

    const lowerText = ingredientsText.toLowerCase();
    const activeRules = rules ?? this.defaultRules;
    const found: Array<RedFlagFinding & { position: number }> = [];
    const blockedKeys = new Set<string>();

    for (const rule of activeRules) {
      if (this.isFilterRule(rule) && rule.severity === 'ok') {
        if (rule.type === 'ingredient' && lowerText.includes(rule.key.toLowerCase())) {
          blockedKeys.add(this.normalizeRuleKey(rule.key));
        }

        if (rule.type === 'nutrient' && this.extractNutrientValue(ingredientsText, rule.key) !== null) {
          blockedKeys.add(this.normalizeRuleKey(rule.key));
        }
      }
    }

    for (const rule of activeRules) {
      if (this.isFilterRule(rule)) {
        if (rule.severity !== 'red_flag') {
          continue;
        }

        if (rule.type === 'ingredient') {
          const index = lowerText.indexOf(rule.key.toLowerCase());
          if (index === -1 || blockedKeys.has(this.normalizeRuleKey(rule.key))) {
            continue;
          }

          found.push({
            position: index,
            ingredient: this.extractIngredient(ingredientsText, rule.key),
            category: rule.key,
            severity: 'critical',
          });
          continue;
        }

        const value = this.extractNutrientValue(ingredientsText, rule.key);
        if (value === null || blockedKeys.has(this.normalizeRuleKey(rule.key))) {
          continue;
        }

        if (!this.matchesThreshold(value, rule.operator, rule.threshold)) {
          continue;
        }

        found.push({
          position: lowerText.indexOf(rule.key.toLowerCase()),
          ingredient: rule.key,
          category: rule.key,
          severity: 'critical',
        });
        continue;
      }

      const searchLower = rule.searchTerm.toLowerCase();
      const index = lowerText.indexOf(searchLower);
      if (index === -1) {
        continue;
      }

      if (blockedKeys.has(this.normalizeRuleKey(rule.searchTerm))) {
        continue;
      }

      found.push({
        position: index,
        ingredient: this.extractIngredient(ingredientsText, rule.searchTerm),
        category: rule.category,
        severity: rule.severity,
      });
    }

    found.sort((a, b) => a.position - b.position);
    return found.map(({ position, ...rest }) => rest);
  }

  private isFilterRule(rule: AnalyzerRule): rule is FilterRule {
    return 'type' in rule;
  }

  private normalizeRuleKey(value: string): string {
    return value.toLowerCase().trim();
  }

  private matchesThreshold(value: number, operator: FilterRule['operator'], threshold: number | null | undefined): boolean {
    if (threshold === null || threshold === undefined || operator === null || operator === undefined) {
      return false;
    }

    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  private extractNutrientValue(text: string, key: string): number | null {
    const parsedValue = this.findNumericValueInParsedContent(text, key);
    if (parsedValue !== null) {
      return parsedValue;
    }

    const escapedKey = this.escapeRegExp(key);
    const patterns = [
      new RegExp(`"${escapedKey}"\s*[:=]\s*(-?\\d+(?:[.,]\\d+)?)`, 'i'),
      new RegExp(`\\b${escapedKey}\\b\s*[:=]\s*(-?\\d+(?:[.,]\\d+)?)`, 'i'),
      new RegExp(`\\b${escapedKey}\\b[^\\d-]*(-?\\d+(?:[.,]\\d+)?)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) {
        continue;
      }

      const value = Number.parseFloat(match[1].replace(',', '.'));
      if (!Number.isNaN(value)) {
        return value;
      }
    }

    return null;
  }

  private findNumericValueInParsedContent(text: string, key: string): number | null {
    const trimmedText = text.trim();
    if (!trimmedText.startsWith('{') && !trimmedText.startsWith('[')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmedText) as unknown;
      return this.searchForKey(parsed, key);
    } catch {
      return null;
    }
  }

  private searchForKey(value: unknown, key: string): number | null {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const result = this.searchForKey(entry, key);
        if (result !== null) {
          return result;
        }
      }

      return null;
    }

    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    const directValue = record[key];
    if (typeof directValue === 'number') {
      return directValue;
    }

    if (typeof directValue === 'string') {
      const parsed = Number.parseFloat(directValue.replace(',', '.'));
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    for (const nestedValue of Object.values(record)) {
      const result = this.searchForKey(nestedValue, key);
      if (result !== null) {
        return result;
      }
    }

    return null;
  }

  private extractIngredient(ingredientsText: string, searchTerm: string): string {
    const lowerText = ingredientsText.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    const index = lowerText.indexOf(lowerSearch);

    if (index === -1) {
      return searchTerm;
    }

    return ingredientsText.substring(index, index + searchTerm.length);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
