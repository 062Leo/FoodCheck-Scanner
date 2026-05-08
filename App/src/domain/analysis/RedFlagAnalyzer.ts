import type { RedFlagFinding } from '../../types/ScanResult';
import type { RedFlagRule } from '../rules/defaultRules';

export class RedFlagAnalyzer {
  constructor(private readonly rules: RedFlagRule[]) {}

  analyze(ingredientsText: string): RedFlagFinding[] {
    if (!ingredientsText || ingredientsText.trim().length === 0) {
      return [];
    }

    const lowerText = ingredientsText.toLowerCase();
    const found: Array<RedFlagFinding & { position: number }> = [];

    for (const rule of this.rules) {
      const searchLower = rule.searchTerm.toLowerCase();
      const index = lowerText.indexOf(searchLower);
      if (index !== -1) {
        found.push({
          position: index,
          ingredient: this.extractIngredient(ingredientsText, rule.searchTerm),
          category: rule.category,
          severity: rule.severity,
        });
      }
    }

    found.sort((a, b) => a.position - b.position);
    return found.map(({ position, ...rest }) => rest);
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
}
