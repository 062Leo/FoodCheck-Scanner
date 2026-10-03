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
  findWordForms,
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

/**
 * Labels that state the opposite of what a rule looks for: "nicht pasteurisiert",
 * "aus nicht gentechnisch veränderten Sojabohnen", "alkoholfrei". For the keys below a
 * match does not count when the text right before or after it negates it.
 */
const NEGATION_WORD_BEFORE =
  /(?:^|[^\p{L}])(?:nicht|ohne|kein(?:e[mnrs]?)?|frei\s+von|not|non|no|free\s+(?:from|of)|sans|senza|sin|sem|não|nao|niet|zonder|nie|bez)[\s-]+(?:aus\s+|from\s+)?$/u;
/** "unpasteurisiert", "ongepasteuriseerd", "niepasteryzowany". */
const NEGATING_PREFIX = /(?:^|[^\p{L}])(?:un|on|nie)-?$/u;
/**
 * Not a drink's alcohol: "Zuckeralkohole", "sugar alcohols", "entalkoholisiert",
 * "analcolico", "bezalkoholowy", "0,0 % Alkohol" (but not "10,0 % Alkohol") and spirit
 * vinegar ("vinaigre d'alcool").
 */
const NOT_ALCOHOL_BEFORE =
  /(?:zucker|sugar\s|suiker|(?:^|[^\p{L}])(?:ent|de-?|dés|des|an|bez))$|(?:^|[^\d,.])0[,.]0\s*%\s*(?:vol\.?\s*)?$|(?:vinaigre\s+d['’]|vinagre\s+de\s+)$/u;
/** "alkoholfrei", "alcohol-free", "alcoholvrij", "Alkoholessig". */
const NOT_ALCOHOL_AFTER = /^(?:[\s-]*(?:frei|free|vrij)|essig)/u;
/**
 * Vinegar and yeast named after a drink are not the drink: "vinaigre de vin", "aceto di
 * vino", "vinagre de Jerez", "levure de bière", "lievito di birra".
 */
const NOT_A_DRINK_BEFORE =
  /(?:vinaigre|vinagre|aceto|levure|lievito|levadura|levedura)\s+(?:de|di|do|d['’])\s*$/u;
/** "Weinessig", "Branntweinessig", "wine vinegar", "wijnazijn", "Bierhefe", "biergist". */
const NOT_A_DRINK_AFTER = /^[\s-]*(?:essig|vinegar|azijn|hefe|yeast|gist)/u;

interface Negation {
  before: RegExp[];
  after?: RegExp;
}

const NOT_GENETICALLY_MODIFIED: Negation = { before: [NEGATION_WORD_BEFORE] };
const NOT_HEAT_TREATED: Negation = { before: [NEGATION_WORD_BEFORE, NEGATING_PREFIX] };
const NO_ALCOHOL: Negation = {
  before: [NEGATION_WORD_BEFORE, NOT_ALCOHOL_BEFORE],
  after: NOT_ALCOHOL_AFTER,
};
/**
 * Alcohol-free beer and wine still count (up to 0.5 % vol.), so "alkoholfrei" does not
 * negate a drink; only "ohne …" and vinegar or yeast made from it do.
 */
const NOT_A_DRINK: Negation = {
  before: [NEGATION_WORD_BEFORE, NOT_A_DRINK_BEFORE],
  after: NOT_A_DRINK_AFTER,
};

/** Rule keys (lower case) whose matches are checked for a negation. */
const NEGATABLE_KEYS: Record<string, Negation> = {
  'genetically modified': NOT_GENETICALLY_MODIFIED,
  'gentechnisch verändert': NOT_GENETICALLY_MODIFIED,
  pasteurised: NOT_HEAT_TREATED,
  pasteurized: NOT_HEAT_TREATED,
  uht: NOT_HEAT_TREATED,
  ultrahocherhitzt: NOT_HEAT_TREATED,
  wärmebehandelt: NOT_HEAT_TREATED,
  'h-milch': NOT_HEAT_TREATED,
  alcohol: NO_ALCOHOL,
  ethanol: NO_ALCOHOL,
  wine: NOT_A_DRINK,
  'port wine': NOT_A_DRINK,
  sherry: NOT_A_DRINK,
  marsala: NOT_A_DRINK,
  sake: NOT_A_DRINK,
  beer: NOT_A_DRINK,
  brandy: NOT_A_DRINK,
  weinbrand: NOT_A_DRINK,
  cognac: NOT_A_DRINK,
  kirschwasser: NOT_A_DRINK,
  rum: NOT_A_DRINK,
  whisky: NOT_A_DRINK,
  whiskey: NOT_A_DRINK,
  vodka: NOT_A_DRINK,
  liqueur: NOT_A_DRINK,
};

/** Characters around a match that are searched for a negation. */
const NEGATION_WINDOW = 24;

function isNegated(lowerText: string, span: TextSpan, negation: Negation): boolean {
  const before = lowerText.slice(Math.max(0, span.start - NEGATION_WINDOW), span.start);
  const after = lowerText.slice(span.end, span.end + NEGATION_WINDOW);
  return negation.before.some((pattern) => pattern.test(before)) || !!negation.after?.test(after);
}

/**
 * Words that contain a rule's term but name something else. For the keys below a match
 * does not count when it overlaps such a word: the Dutch and Polish "talk" (talc) inside
 * "entalkoholisiert" (de-alcoholised).
 */
const OTHER_WORDS: Record<string, RegExp> = {
  talc: /alkohol|alcohol/gu,
  // Pork and boar, tartaric acid, cream of tartar, grapes, raisins, vine leaves, vineyard
  // snails and peaches, rue, wine gums; the English "vine" and the Polish "winorośl".
  wine: /schwein|swine|zwijn|wein(?:säure|stein|traube|beere|blatt|blätter|berg|raute|rebe|gummi)|wijn(?:steen|druif|druiven|blad|ruit)|winogron|winow|winoro[śs]l|^vines?$/gu,
  // Berries ("Erdbeeren"), the Polish brewer's yeast ("drożdże piwowarskie"), sausages
  // named after beer ("Bierschinken", "Bierwurst") and spent grain ("Biertreber").
  beer: /beere|piwowar|bier(?:schinken|wurst|treber)/gu,
  // Only at the start of a word ("Rumaroma" counts): not "Krume", "crumb", "Milchserum",
  // "Rumpsteak", "Rumex", "rumänisch" or the Polish "rumianek" (camomile).
  rum: /\p{L}rh?um|rh?um(?:p|ex|än|ian)/gu,
  // Licorice.
  liqueur: /licoric/gu,
  // Only as a word of its own.
  sake: /\p{L}sak[eé]|sak[eé]\p{L}/gu,
  // Portobello mushrooms.
  'port wine': /portobell/gu,
};

const WORD_LETTER = /\p{L}/u;

function isPartOfOtherWord(lowerText: string, span: TextSpan, otherWords: RegExp): boolean {
  let start = span.start;
  while (start > 0 && WORD_LETTER.test(lowerText[start - 1])) start--;
  let end = span.end;
  while (end < lowerText.length && WORD_LETTER.test(lowerText[end])) end++;
  for (const match of lowerText.slice(start, end).matchAll(otherWords)) {
    const otherStart = start + match.index;
    if (otherStart < span.end && span.start < otherStart + match[0].length) return true;
  }
  return false;
}

/**
 * Written-out E472a–f, e.g. "Mono- und Diacetylweinsäureester von Mono- und Diglyceriden
 * von Speisefettsäuren": one emulsifier, not tartaric acid, E471 and fatty acids. The
 * first group names the acid, which decides the E-number.
 */
const E472_NAMES = [
  /(?:mono-?\s*und\s+)?(diacetylweinsäure|essig-?\s*und\s+weinsäure|essigsäure|milchsäure|citronensäure|zitronensäure|weinsäure)ester\s+von\s+mono-?\s*und\s+diglyceriden\s+(?:von\s+|der\s+)?speisefettsäuren/g,
  /(?:mono-?\s*and\s+)?(diacetyl\s+tartaric|mixed\s+acetic\s+and\s+tartaric|acetic|lactic|citric|tartaric)\s+acid\s+esters\s+of\s+mono-?\s*and\s+di-?glycerides\s+of\s+fatty\s+acids/g,
];
const E472_ACIDS: [RegExp, string][] = [
  [/diacetyl/, 'E472e'],
  [/(essig|acetic).*(wein|tartaric)/, 'E472f'],
  [/essig|acetic/, 'E472a'],
  [/milch|lactic/, 'E472b'],
  [/citron|zitron|citric/, 'E472c'],
  [/wein|tartaric/, 'E472d'],
];

/**
 * Translations of a rule up to this length match only as words of their own (with
 * plural endings): "Sel" and "Sal" would otherwise hit "Sellerie" and "Salami". Longer
 * ones match inside compounds, as Dutch and German need ("melkpoeder", "walnoot").
 */
const MAX_SHORT_TRANSLATION_LENGTH = 3;

/** Additive names shorter than this are too generic to hide the words inside them. */
const MIN_SHIELD_NAME_LENGTH = 8;
/** Additives made of the additives they name: the aspartame-acesulfame salt is aspartame. */
const NAMES_OF_REAL_PARTS = new Set(['E962']);

/**
 * A written-out additive name. It counts for rules on its own E-number and hides the
 * words of other additives inside it: "Sorbit" in "Sorbitanmonostearat" is not
 * sorbitol. `hidesAll` also hides words without an E-number ("Speisefettsäuren").
 */
interface NameShield {
  span: TextSpan;
  eNumber: string;
  hidesAll: boolean;
}

const eNumberFamily = (eNumber: string) => eNumber.match(/^E\d+/)?.[0] ?? eNumber;

/** Whether `shield` hides a match of a substance of the E-number family `family`. */
const hides = (shield: NameShield, span: TextSpan, family: string | undefined) =>
  isStrictlyContained(span, shield.span) &&
  family !== eNumberFamily(shield.eNumber) &&
  (shield.hidesAll || family !== undefined);

/** A rule on "E472" also covers E472a–f, as it does for the written codes. */
const ruleCoversENumber = (ruleENumber: string, eNumber: string) =>
  ruleENumber === eNumber ||
  (ruleENumber === eNumberFamily(ruleENumber) && ruleENumber === eNumberFamily(eNumber));

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
  private readonly additiveNames: { name: string; eNumber: string }[];
  /** Search terms and E-number per rule; they depend only on the rule, not on the product. */
  private readonly ruleTerms = new WeakMap<
    FilterRule,
    { translations: unknown; terms: string[]; eNumber?: string }
  >();

  constructor(private readonly defaultRules: AnalyzerRule[] = defaultRedFlagRules) {
    this.parser = new IngredientParser();
    this.taxonomy = new IngredientTaxonomy();
    this.additiveNames = this.taxonomy
      .writtenNames()
      .filter(
        ({ name, eNumber }) =>
          name.length >= MIN_SHIELD_NAME_LENGTH && !NAMES_OF_REAL_PARTS.has(eNumber)
      );
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
    const shields = this.findAdditiveNames(lowerText);
    const candidates = this.collectCandidates(rules, text, lowerText, whitelist, shields);
    const allOccurrences = candidates.flatMap((candidate) =>
      candidate.occurrences.map((span) => ({ candidate, span }))
    );

    // 1. Drop occurrences inside a longer match of another rule, inside the written-out
    //    name of a different additive, negated ones ("nicht pasteurisiert"), parts of
    //    other words ("entalkoholisiert") and context-bound words outside their context.
    const located: Located[] = [];
    for (const candidate of candidates) {
      const context = CONTEXT_BOUND_KEYS[candidate.canonicalKey.toLowerCase()];
      const resolvedKey = resolveIngredientKey(candidate.canonicalKey).toLowerCase();
      const negation = NEGATABLE_KEYS[resolvedKey];
      const otherWords = OTHER_WORDS[resolvedKey];
      const family = candidate.eNumber ? eNumberFamily(candidate.eNumber) : undefined;
      const surviving = candidate.occurrences.filter((span) => {
        const covered = allOccurrences.some(
          (other) => other.candidate !== candidate && isStrictlyContained(span, other.span)
        );
        if (covered) return false;
        const shielded = shields.some((shield) => hides(shield, span, family));
        if (shielded) return false;
        if (negation && isNegated(lowerText, span, negation)) return false;
        if (otherWords && isPartOfOtherWord(lowerText, span, otherWords)) return false;
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

  private termsOf(rule: FilterRule): { terms: string[]; eNumber?: string } {
    const cached = this.ruleTerms.get(rule);
    if (cached && cached.translations === rule.translations) return cached;
    const terms = getAllSearchTerms(rule.key, rule.translations);
    const eNumber = terms.map((term) => this.resolveENumber(term)).find(Boolean);
    const entry = { translations: rule.translations, terms, eNumber };
    this.ruleTerms.set(rule, entry);
    return entry;
  }

  private findAdditiveNames(lowerText: string): NameShield[] {
    const shields: NameShield[] = [];
    for (const { name, eNumber } of this.additiveNames) {
      for (const span of findOccurrences(lowerText, name)) {
        shields.push({ span, eNumber, hidesAll: false });
      }
    }
    for (const pattern of E472_NAMES) {
      for (const match of lowerText.matchAll(pattern)) {
        const eNumber = this.taxonomy.normalizeENumber(
          E472_ACIDS.find(([acid]) => acid.test(match[1]))?.[1] ?? 'E472'
        );
        const span = { start: match.index, end: match.index + match[0].length };
        shields.push({ span, eNumber, hidesAll: true });
      }
    }
    return shields;
  }

  private collectCandidates(
    rules: AnalyzerRule[],
    text: string,
    lowerText: string,
    whitelist: Whitelist,
    shields: NameShield[]
  ): Candidate[] {
    const candidates: Candidate[] = [];

    const add = (
      key: string,
      canonicalKey: string,
      category: string,
      severity: RedFlagSeverity,
      occurrences: TextSpan[],
      knownENumber?: string
    ) => {
      if (occurrences.length === 0 || this.isWhitelistedKey(key, whitelist)) return;
      const first = occurrences.reduce((a, b) => (b.start < a.start ? b : a));
      const eNumber =
        knownENumber ??
        this.resolveENumber(key) ??
        this.resolveENumber(text.substring(first.start, first.end));
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

    const filterRules: { rule: FilterRule; eNumber?: string; occurrences: TextSpan[] }[] = [];
    for (const rule of rules) {
      if (this.isFilterRule(rule)) {
        if (rule.severity !== 'red_flag' || rule.type !== 'ingredient') continue;
        const { terms, eNumber } = this.termsOf(rule);
        const occurrences = terms.flatMap((term, index) =>
          index > 0 && term.trim().length <= MAX_SHORT_TRANSLATION_LENGTH
            ? findWordForms(lowerText, term)
            : findOccurrences(lowerText, term)
        );
        filterRules.push({ rule, eNumber, occurrences });
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

    // A written-out name that hides another substance's word counts like its own
    // E-number instead: "Natriumaluminiumsilicat" is E554, not aluminium. Names that hide
    // nothing add nothing, so the rule list keeps its meaning. Outer names first, once.
    const matches = [
      ...filterRules.flatMap((entry) =>
        entry.occurrences.map((span) => ({ span, eNumber: entry.eNumber }))
      ),
      ...candidates.flatMap((c) => c.occurrences.map((span) => ({ span, eNumber: c.eNumber }))),
    ];
    const byLength = [...shields].sort(
      (a, b) => b.span.end - b.span.start - (a.span.end - a.span.start)
    );
    const credited: TextSpan[] = [];
    for (const shield of byLength) {
      const within = (outer: TextSpan) =>
        outer.start <= shield.span.start && shield.span.end <= outer.end;
      if (credited.some(within) || matches.some((match) => within(match.span))) continue;
      const hidesSomething = matches.some((match) =>
        hides(shield, match.span, match.eNumber ? eNumberFamily(match.eNumber) : undefined)
      );
      if (!hidesSomething) continue;
      credited.push(shield.span);
      for (const entry of filterRules) {
        if (entry.eNumber && ruleCoversENumber(entry.eNumber, shield.eNumber)) {
          entry.occurrences.push(shield.span);
        }
      }
    }
    for (const { rule, eNumber, occurrences } of filterRules) {
      add(rule.key, rule.key, rule.category, 'critical', occurrences, eNumber);
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
