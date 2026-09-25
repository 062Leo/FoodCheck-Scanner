import type { FilterRule } from '../../types/FilterRule';
import type { ProductNutriments } from '../../types/Product';
import type { NutrientKey, RedFlagFinding, RedFlagSeverity } from '../../types/ScanResult';
import type { RedFlagRule } from '../rules/defaultRules';
import { defaultRedFlagRules } from './defaultRedFlagRules';
import { IngredientParser } from './IngredientParser';
import { IngredientTaxonomy } from './IngredientTaxonomy';
import { getAllSearchTerms, resolveIngredientKey } from '../rules/ingredientTranslations';
import {
  findOccurrences,
  isENumberTerm,
  isStrictlyContained,
  normalizeENumberSpacing,
  segmentIndexAt,
  segmentSpans,
  type TextSpan,
} from './IngredientMatching';

type AnalyzerRule = RedFlagRule | FilterRule;

/**
 * Rule keys that name a functional class ("Emulgator", "Farbstoff" …) rather than a
 * substance. EU labels always name the class together with the substance, so a class
 * label only counts when nothing more specific was found in the same ingredient.
 */
const CLASS_LABEL_KEYS = new Set(
  [
    'Acidity Regulator',
    'Anti Caking Agent',
    'Anti Foaming Agent',
    'Antioxidant',
    'Bulking Agent',
    'Carrier Solvent',
    'Color',
    'Emulsifier',
    'Fat Replacer',
    'Firming Agent',
    'Flavor Enhancer',
    'Flour Treatment Agent',
    'Foaming Agent',
    'Gelling Agent',
    'Humectant',
    'Packaging Gas',
    'Propellants',
    'Stabiliser',
    'Sweetener',
    'Thickener',
  ].map((key) => key.toLowerCase())
);

const COLOUR_CONTEXT = /farbstoff|colou?r|colorant|kleurstof|barwnik|corante/i;

/**
 * Words that are also ordinary foods: "Amaranth" is a grain and "Karamell" a sweet,
 * but both are colour names too. They only count in a colour context.
 */
const CONTEXT_BOUND_KEYS: Record<string, RegExp> = {
  amaranth: COLOUR_CONTEXT,
  caramel: COLOUR_CONTEXT,
};
const CONTEXT_BOUND_E_NUMBERS: Record<string, RegExp> = {
  E123: COLOUR_CONTEXT,
};

const NUTRIENT_FIELDS: Record<NutrientKey, keyof ProductNutriments> = {
  sugars_100g: 'sugars100g',
  fat_100g: 'fat100g',
  'saturated-fat_100g': 'saturatedFat100g',
  salt_100g: 'salt100g',
  'energy-kcal_100g': 'energyKcal100g',
};

interface Candidate {
  key: string;
  canonicalKey: string;
  category: string;
  severity: RedFlagSeverity;
  occurrences: TextSpan[];
}

interface LocatedFinding {
  finding: RedFlagFinding;
  position: number;
  segment: number;
  identity: string;
  isClassLabel: boolean;
}

export class RedFlagAnalyzer {
  private readonly parser: IngredientParser;
  private readonly taxonomy: IngredientTaxonomy;

  constructor(private readonly defaultRules: AnalyzerRule[] = defaultRedFlagRules) {
    this.parser = new IngredientParser();
    this.taxonomy = new IngredientTaxonomy();
  }

  /**
   * Applies keyword and nutrient rules. Ingredient findings come first, sorted by
   * their position in the list; nutrient findings follow.
   */
  analyze(
    ingredientsText: string,
    rules?: AnalyzerRule[],
    nutriments?: ProductNutriments
  ): RedFlagFinding[] {
    const activeRules = rules ?? this.defaultRules;
    const text = normalizeENumberSpacing(ingredientsText ?? '');
    const lowerText = text.toLowerCase();
    const blocked = this.collectBlockedKeys(activeRules, lowerText, nutriments);

    const ingredientFindings = lowerText.trim()
      ? this.analyzeIngredientRules(activeRules, text, lowerText, blocked)
      : [];
    const nutrientFindings = this.analyzeNutrientRules(activeRules, nutriments, blocked);

    return [...ingredientFindings, ...nutrientFindings];
  }

  analyzeTaxonomy(ingredientsText: string): RedFlagFinding[] {
    if (!ingredientsText || ingredientsText.trim().length === 0) {
      return [];
    }

    const tokens = this.parser.parse(normalizeENumberSpacing(ingredientsText));
    const findings: RedFlagFinding[] = [];
    const seenENumbers = new Set<string>();

    for (const token of tokens) {
      const additive = token.eNumber
        ? this.taxonomy.findByENumber(token.eNumber)
        : this.taxonomy.findByText(token.normalized);

      if (!additive || additive.riskLevel === 'none' || additive.riskLevel === 'low') {
        continue;
      }

      const eNumber = this.taxonomy.normalizeENumber(additive.eNumber);
      if (seenENumbers.has(eNumber)) {
        continue;
      }

      const context = CONTEXT_BOUND_E_NUMBERS[eNumber];
      if (context && !token.eNumber && !context.test(`${token.parentToken ?? ''} ${token.text}`)) {
        continue;
      }

      seenENumbers.add(eNumber);
      findings.push({
        ingredient: `${additive.name} (${additive.eNumber})`,
        category: additive.functionClass,
        severity: additive.riskLevel === 'high' ? 'critical' : 'warning',
        eNumber,
      });
    }

    return findings;
  }

  /** The E-number a finding refers to, if the taxonomy knows it. */
  resolveENumber(term: string): string | undefined {
    if (isENumberTerm(term)) {
      return this.taxonomy.normalizeENumber(term);
    }
    const additive = this.taxonomy.findByExactName(term);
    return additive ? this.taxonomy.normalizeENumber(additive.eNumber) : undefined;
  }

  private analyzeIngredientRules(
    rules: AnalyzerRule[],
    text: string,
    lowerText: string,
    blocked: Set<string>
  ): RedFlagFinding[] {
    const candidates = this.collectCandidates(rules, lowerText, blocked);
    const segments = segmentSpans(text);
    const allOccurrences = candidates.flatMap((candidate) =>
      candidate.occurrences.map((span) => ({ candidate, span }))
    );

    const located: LocatedFinding[] = [];
    for (const candidate of candidates) {
      const context = CONTEXT_BOUND_KEYS[candidate.canonicalKey.toLowerCase()];
      const surviving = candidate.occurrences.filter((span) => {
        const covered = allOccurrences.some(
          (other) => other.candidate !== candidate && isStrictlyContained(span, other.span)
        );
        if (covered) return false;
        if (!context) return true;
        const segment = segments[segmentIndexAt(segments, span.start)];
        return context.test(text.slice(segment.start, segment.end));
      });
      if (surviving.length === 0) continue;

      const first = surviving.reduce((a, b) => (b.start < a.start ? b : a));
      const matchedText = text.substring(first.start, first.end);
      const eNumber = this.resolveENumber(candidate.key) ?? this.resolveENumber(matchedText);

      located.push({
        finding: {
          ingredient: matchedText,
          category: candidate.category,
          severity: candidate.severity,
          canonicalKey: candidate.canonicalKey,
          ...(eNumber ? { eNumber } : {}),
        },
        position: first.start,
        segment: segmentIndexAt(segments, first.start),
        identity: eNumber ?? `key:${candidate.canonicalKey.toLowerCase()}`,
        isClassLabel: CLASS_LABEL_KEYS.has(candidate.canonicalKey.toLowerCase()),
      });
    }

    located.sort((a, b) => a.position - b.position);

    // One finding per substance: the same E-number anywhere in the list, or the same
    // E-number family (E150a/E150d …) within one ingredient, counts once.
    const seenIdentities = new Set<string>();
    const unique = located.filter((entry) => {
      const family = entry.finding.eNumber?.match(/^E\d+/)?.[0];
      const familyKey = family ? `${entry.segment}:${family}` : undefined;
      if (seenIdentities.has(entry.identity) || (familyKey && seenIdentities.has(familyKey))) {
        return false;
      }
      seenIdentities.add(entry.identity);
      if (familyKey) seenIdentities.add(familyKey);
      return true;
    });

    const specificSegments = new Set(unique.filter((e) => !e.isClassLabel).map((e) => e.segment));
    return unique
      .filter((entry) => !entry.isClassLabel || !specificSegments.has(entry.segment))
      .map((entry) => entry.finding);
  }

  private collectCandidates(
    rules: AnalyzerRule[],
    lowerText: string,
    blocked: Set<string>
  ): Candidate[] {
    const candidates: Candidate[] = [];

    for (const rule of rules) {
      if (this.isFilterRule(rule)) {
        if (rule.severity !== 'red_flag' || rule.type !== 'ingredient') continue;
        if (this.isBlocked(rule.key, blocked)) continue;

        const occurrences = getAllSearchTerms(rule.key, rule.translations).flatMap((term) =>
          findOccurrences(lowerText, term)
        );
        if (occurrences.length === 0) continue;

        candidates.push({
          key: rule.key,
          canonicalKey: rule.key,
          category: rule.category,
          severity: 'critical',
          occurrences,
        });
        continue;
      }

      if (this.isBlocked(rule.searchTerm, blocked)) continue;
      const occurrences = findOccurrences(lowerText, rule.searchTerm);
      if (occurrences.length === 0) continue;

      candidates.push({
        key: rule.searchTerm,
        canonicalKey: resolveIngredientKey(rule.searchTerm),
        category: rule.category,
        severity: rule.severity,
        occurrences,
      });
    }

    return candidates;
  }

  private analyzeNutrientRules(
    rules: AnalyzerRule[],
    nutriments: ProductNutriments | undefined,
    blocked: Set<string>
  ): RedFlagFinding[] {
    if (!nutriments) return [];

    const findings: RedFlagFinding[] = [];
    for (const rule of rules) {
      if (!this.isFilterRule(rule) || rule.type !== 'nutrient' || rule.severity !== 'red_flag') {
        continue;
      }
      const value = this.nutrientValue(nutriments, rule.key);
      if (value === undefined || this.isBlocked(rule.key, blocked)) continue;
      if (
        rule.operator == null ||
        rule.threshold == null ||
        !this.matchesThreshold(value, rule.operator, rule.threshold)
      ) {
        continue;
      }

      findings.push({
        ingredient: rule.key,
        category: rule.category,
        severity: 'critical',
        canonicalKey: rule.key,
        nutrient: {
          key: rule.key as NutrientKey,
          value,
          operator: rule.operator,
          threshold: rule.threshold,
        },
      });
    }
    return findings;
  }

  /**
   * An "ok" rule whitelists a term: while the term is present, red-flag rules for the
   * same ingredient (in any language) are ignored.
   */
  private collectBlockedKeys(
    rules: AnalyzerRule[],
    lowerText: string,
    nutriments: ProductNutriments | undefined
  ): Set<string> {
    const blocked = new Set<string>();

    for (const rule of rules) {
      if (!this.isFilterRule(rule) || rule.severity !== 'ok') continue;

      if (rule.type === 'ingredient') {
        const present = getAllSearchTerms(rule.key, rule.translations).some(
          (term) => findOccurrences(lowerText, term).length > 0
        );
        if (present) {
          blocked.add(this.normalizeKey(rule.key));
          blocked.add(this.normalizeKey(resolveIngredientKey(rule.key)));
        }
      } else if (nutriments && this.nutrientValue(nutriments, rule.key) !== undefined) {
        blocked.add(this.normalizeKey(rule.key));
      }
    }

    return blocked;
  }

  private isBlocked(key: string, blocked: Set<string>): boolean {
    return (
      blocked.has(this.normalizeKey(key)) ||
      blocked.has(this.normalizeKey(resolveIngredientKey(key)))
    );
  }

  private nutrientValue(nutriments: ProductNutriments, key: string): number | undefined {
    const field = NUTRIENT_FIELDS[key as NutrientKey];
    const value = field ? nutriments[field] : undefined;
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private isFilterRule(rule: AnalyzerRule): rule is FilterRule {
    return 'type' in rule;
  }

  private normalizeKey(value: string): string {
    return value.toLowerCase().trim();
  }

  private matchesThreshold(
    value: number,
    operator: 'gt' | 'lt' | 'eq',
    threshold: number
  ): boolean {
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
}
