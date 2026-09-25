import type { FilterRule } from '../../types/FilterRule';
import type { ProductNutriments } from '../../types/Product';
import type { NutrientKey, RedFlagFinding, RedFlagSeverity } from '../../types/ScanResult';
import type { RedFlagRule } from '../rules/defaultRules';
import { defaultRedFlagRules } from './defaultRedFlagRules';
import { IngredientParser } from './IngredientParser';
import { IngredientTaxonomy } from './IngredientTaxonomy';
import { getAllSearchTerms, resolveIngredientKey } from '../rules/ingredientTranslations';
import {
  IngredientStructure,
  findOccurrences,
  isENumberTerm,
  isStrictlyContained,
  lowerCasePreservingLength,
  normalizeENumberSpacing,
  type TextSpan,
} from './IngredientMatching';

type AnalyzerRule = RedFlagRule | FilterRule;

/**
 * Rule keys that name a functional class ("Emulgator", "Farbstoff" …) rather than a
 * substance. EU labels name the class together with the substance, so a class label
 * only counts when nothing more specific was found in the same ingredient.
 */
const CLASS_LABEL_KEYS = new Set(
  [
    'Acidity Regulator',
    'Anti Caking Agent',
    'Anti Foaming Agent',
    'Antioxidant',
    'Artificial Colors',
    'Artificial Sweeteners',
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
    'Natural Flavor Enhancer',
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
 * but both are colour names too. They only count in a colour context within the
 * same ingredient.
 */
const CONTEXT_BOUND_KEYS: Record<string, RegExp> = {
  amaranth: COLOUR_CONTEXT,
  caramel: COLOUR_CONTEXT,
};
const CONTEXT_BOUND_E_NUMBERS: Record<string, RegExp> = {
  E123: COLOUR_CONTEXT,
};

/** E-number families whose members are interchangeable label variants (caramel colours). */
const MERGEABLE_FAMILIES = new Set(['E150']);

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
  eNumber?: string;
  isClassLabel: boolean;
  occurrences: TextSpan[];
}

interface Located {
  candidate: Candidate;
  finding: RedFlagFinding;
  occurrences: TextSpan[];
  position: number;
}

/** Keys and E-numbers whitelisted by "ok" rules for the current text. */
interface Whitelist {
  keys: Set<string>;
  eNumbers: Set<string>;
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
    const lowerText = lowerCasePreservingLength(text);
    const whitelist = this.collectWhitelist(activeRules);

    const ingredientFindings = lowerText.trim()
      ? this.analyzeIngredientRules(activeRules, text, lowerText, whitelist)
      : [];
    const nutrientFindings = this.analyzeNutrientRules(activeRules, nutriments);

    return [...ingredientFindings, ...nutrientFindings];
  }

  /**
   * Flags medium/high-risk additives from the built-in taxonomy. Additives
   * whitelisted by an "ok" rule in `rules` are skipped.
   */
  analyzeTaxonomy(ingredientsText: string, rules?: AnalyzerRule[]): RedFlagFinding[] {
    if (!ingredientsText || ingredientsText.trim().length === 0) {
      return [];
    }

    const text = normalizeENumberSpacing(ingredientsText);
    const whitelist = rules
      ? this.collectWhitelist(rules)
      : { keys: new Set<string>(), eNumbers: new Set<string>() };
    const tokens = this.parser.parse(text);
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
      if (seenENumbers.has(eNumber) || whitelist.eNumbers.has(eNumber)) {
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

  /** The E-number a term refers to, if the taxonomy knows it. */
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
    whitelist: Whitelist
  ): RedFlagFinding[] {
    const structure = new IngredientStructure(text);
    const candidates = this.collectCandidates(rules, text, lowerText, whitelist);
    const allOccurrences = candidates.flatMap((candidate) =>
      candidate.occurrences.map((span) => ({ candidate, span }))
    );

    // 1. Drop occurrences inside a longer match of another rule and context-bound
    //    words outside their context.
    const located: Located[] = [];
    for (const candidate of candidates) {
      const context = CONTEXT_BOUND_KEYS[candidate.canonicalKey.toLowerCase()];
      const surviving = candidate.occurrences.filter((span) => {
        const covered = allOccurrences.some(
          (other) => other.candidate !== candidate && isStrictlyContained(span, other.span)
        );
        if (covered) return false;
        if (!context) return true;
        const item = structure.itemAt(span.start);
        return context.test(text.slice(item.start, item.end));
      });
      if (surviving.length === 0) continue;

      const first = surviving.reduce((a, b) => (b.start < a.start ? b : a));
      located.push({
        candidate,
        occurrences: surviving,
        position: first.start,
        finding: {
          ingredient: text.substring(first.start, first.end),
          category: candidate.category,
          severity: candidate.severity,
          canonicalKey: candidate.canonicalKey,
          ...(candidate.eNumber ? { eNumber: candidate.eNumber } : {}),
        },
      });
    }
    located.sort((a, b) => a.position - b.position);

    // 2. One finding per substance: the same E-number anywhere in the list counts once;
    //    within one ingredient a key without suffix and its suffixed form, or variants
    //    of an interchangeable family (E150a–d), count once.
    const seenENumbers = new Set<string>();
    const seenKeys = new Set<string>();
    const familiesByItem = new Map<string, Set<string>>();
    const unique = located.filter(({ candidate, position }) => {
      const eNumber = candidate.eNumber;
      const keyId = candidate.canonicalKey.toLowerCase();
      if ((eNumber && seenENumbers.has(eNumber)) || (!eNumber && seenKeys.has(keyId))) {
        return false;
      }
      if (eNumber) {
        const family = eNumber.match(/^E\d+/)?.[0] ?? eNumber;
        const hasSuffix = family !== eNumber;
        const item = structure.itemAt(position);
        const itemKey = `${item.start}:${item.end}`;
        const families = familiesByItem.get(itemKey) ?? new Set<string>();
        const unsuffixedSeen = families.has(`${family}|bare`);
        const suffixedSeen = families.has(`${family}|suffixed`);
        if (
          (hasSuffix && unsuffixedSeen) ||
          (!hasSuffix && suffixedSeen) ||
          (MERGEABLE_FAMILIES.has(family) && (unsuffixedSeen || suffixedSeen))
        ) {
          return false;
        }
        families.add(`${family}|${hasSuffix ? 'suffixed' : 'bare'}`);
        familiesByItem.set(itemKey, families);
        seenENumbers.add(eNumber);
      } else {
        seenKeys.add(keyId);
      }
      return true;
    });

    // 3. A class label counts only if at least one of its occurrences stands in an
    //    ingredient without a more specific finding.
    const specificSpans = unique
      .filter((entry) => !entry.candidate.isClassLabel)
      .flatMap((entry) => entry.occurrences);
    return unique
      .filter((entry) => {
        if (!entry.candidate.isClassLabel) return true;
        return entry.occurrences.some((span) => {
          const item = structure.itemAt(span.start);
          return !specificSpans.some((s) => s.start >= item.start && s.end <= item.end);
        });
      })
      .map((entry) => entry.finding);
  }

  private collectCandidates(
    rules: AnalyzerRule[],
    text: string,
    lowerText: string,
    whitelist: Whitelist
  ): Candidate[] {
    const candidates: Candidate[] = [];

    const add = (
      key: string,
      canonicalKey: string,
      category: string,
      severity: RedFlagSeverity,
      occurrences: TextSpan[]
    ) => {
      if (occurrences.length === 0 || this.isWhitelistedKey(key, whitelist)) return;
      const first = occurrences.reduce((a, b) => (b.start < a.start ? b : a));
      const eNumber =
        this.resolveENumber(key) ?? this.resolveENumber(text.substring(first.start, first.end));
      if (eNumber && whitelist.eNumbers.has(eNumber)) return;
      candidates.push({
        key,
        canonicalKey,
        category,
        severity,
        eNumber,
        isClassLabel: CLASS_LABEL_KEYS.has(canonicalKey.toLowerCase()),
        occurrences,
      });
    };

    for (const rule of rules) {
      if (this.isFilterRule(rule)) {
        if (rule.severity !== 'red_flag' || rule.type !== 'ingredient') continue;
        const occurrences = getAllSearchTerms(rule.key, rule.translations).flatMap((term) =>
          findOccurrences(lowerText, term)
        );
        add(rule.key, rule.key, rule.category, 'critical', occurrences);
        continue;
      }

      add(
        rule.searchTerm,
        resolveIngredientKey(rule.searchTerm),
        rule.category,
        rule.severity,
        findOccurrences(lowerText, rule.searchTerm)
      );
    }

    return candidates;
  }

  private analyzeNutrientRules(
    rules: AnalyzerRule[],
    nutriments: ProductNutriments | undefined
  ): RedFlagFinding[] {
    if (!nutriments) return [];

    const nutrientRules = rules.filter(
      (rule): rule is FilterRule => this.isFilterRule(rule) && rule.type === 'nutrient'
    );
    // An "ok" nutrient rule only whitelists while its own condition holds.
    const whitelisted = new Set(
      nutrientRules
        .filter((rule) => rule.severity === 'ok' && this.nutrientRuleMatches(rule, nutriments))
        .map((rule) => rule.key)
    );

    const findings: RedFlagFinding[] = [];
    for (const rule of nutrientRules) {
      if (rule.severity !== 'red_flag' || whitelisted.has(rule.key)) continue;
      if (!this.nutrientRuleMatches(rule, nutriments)) continue;

      findings.push({
        ingredient: rule.key,
        category: rule.category,
        severity: 'critical',
        canonicalKey: rule.key,
        nutrient: {
          key: rule.key as NutrientKey,
          value: this.nutrientValue(nutriments, rule.key)!,
          operator: rule.operator!,
          threshold: rule.threshold!,
        },
      });
    }
    return findings;
  }

  private nutrientRuleMatches(rule: FilterRule, nutriments: ProductNutriments): boolean {
    const value = this.nutrientValue(nutriments, rule.key);
    if (value === undefined || rule.operator == null || rule.threshold == null) return false;
    return this.matchesThreshold(value, rule.operator, rule.threshold);
  }

  /**
   * An "ok" ingredient rule whitelists an ingredient: red-flag rules for the same
   * ingredient (in any language) or the same E-number are ignored.
   */
  private collectWhitelist(rules: AnalyzerRule[]): Whitelist {
    const whitelist: Whitelist = { keys: new Set(), eNumbers: new Set() };

    for (const rule of rules) {
      if (!this.isFilterRule(rule) || rule.severity !== 'ok' || rule.type !== 'ingredient') {
        continue;
      }
      const canonical = resolveIngredientKey(rule.key);
      whitelist.keys.add(this.normalizeKey(rule.key));
      whitelist.keys.add(this.normalizeKey(canonical));

      const terms = [
        rule.key,
        ...getAllSearchTerms(rule.key, rule.translations),
        ...getAllSearchTerms(canonical),
      ];
      for (const term of terms) {
        const eNumber = this.resolveENumber(term);
        if (eNumber) {
          whitelist.eNumbers.add(eNumber);
          break;
        }
      }
    }

    return whitelist;
  }

  private isWhitelistedKey(key: string, whitelist: Whitelist): boolean {
    if (whitelist.keys.size === 0) return false;
    return (
      whitelist.keys.has(this.normalizeKey(key)) ||
      whitelist.keys.has(this.normalizeKey(resolveIngredientKey(key)))
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
