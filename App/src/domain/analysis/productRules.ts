import type { FilterRule } from '../../types/FilterRule';
import type { Product } from '../../types/Product';
import type { RedFlagFinding } from '../../types/ScanResult';
import { isWater } from '../product/waterInfo';
import { companyNamesOf, companyWords, containsCompact, containsWords } from './companyRules';

/** Stored category of the seeded product rules (a fixed value, displayed translated). */
export const PRODUCT_RULE_CATEGORY = 'Wasser-Tests';

export interface ProductRuleSource {
  title: string;
  url: string;
  /** ISO date or year of the publication, e.g. "2025-06-26". */
  date?: string;
}

/**
 * A single product (brand plus words of the product name) with a published reason to
 * avoid it, e.g. a poor test result. Stored as JSON in the rule's `translations` column.
 */
export interface ProductRuleData {
  /** Brand as consecutive words, e.g. "Gut & Günstig". */
  brand: string;
  /** Words that must all appear in the product name; empty means the whole brand. */
  nameWords: string[];
  /** Only products that are bottled water match. */
  waterOnly: boolean;
  reason: { de: string; en: string };
  sources: ProductRuleSource[];
}

function parseSource(value: unknown): ProductRuleSource | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (typeof source.title !== 'string' || typeof source.url !== 'string') return null;
  return {
    title: source.title,
    url: source.url,
    ...(typeof source.date === 'string' ? { date: source.date } : {}),
  };
}

/** Reads a product rule's data; `source` may be a single object or a list (`sources`). */
export function parseProductRuleData(json: string | null | undefined): ProductRuleData | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const data = parsed as Record<string, unknown>;
    if (typeof data.brand !== 'string' || !data.brand.trim()) return null;
    const reason = (data.reason ?? {}) as Record<string, unknown>;
    const rawSources = Array.isArray(data.sources) ? data.sources : [data.source];
    return {
      brand: data.brand,
      nameWords: Array.isArray(data.nameWords)
        ? data.nameWords.filter((word): word is string => typeof word === 'string' && !!word.trim())
        : [],
      waterOnly: data.waterOnly === true,
      reason: {
        de: typeof reason.de === 'string' ? reason.de : '',
        en: typeof reason.en === 'string' ? reason.en : '',
      },
      sources: rawSources
        .map(parseSource)
        .filter((source): source is ProductRuleSource => source !== null),
    };
  } catch {
    return null;
  }
}

/** Lowercase words without accents and punctuation (no words are dropped). */
export function nameWordsOf(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** True if the product's brand or brand owner contains `brand` as consecutive words. */
function hasBrand(product: Product, brand: string): boolean {
  const needle = companyWords(brand);
  if (needle.length === 0) return false;
  const compact = needle.join('');
  return companyNamesOf(product).some((name) => {
    const words = companyWords(name);
    return containsWords(words, needle) || containsCompact(words, compact);
  });
}

/** True if every entry of `nameWords` appears in the product name as whole words. */
function hasNameWords(product: Product, nameWords: string[]): boolean {
  if (nameWords.length === 0) return true;
  const words = nameWordsOf(product.name ?? '');
  return nameWords.every((entry) => {
    const needle = nameWordsOf(entry);
    if (needle.length === 0) return true;
    return containsWords(words, needle) || containsCompact(words, needle.join(''));
  });
}

export function matchesProductRule(product: Product, data: ProductRuleData): boolean {
  if (data.waterOnly && !isWater(product)) return false;
  return hasBrand(product, data.brand) && hasNameWords(product, data.nameWords);
}

/** Runs the user's "product" rules; each match counts as one red flag. */
export function findProductRuleMatches(product: Product, rules: FilterRule[]): RedFlagFinding[] {
  const findings: RedFlagFinding[] = [];
  for (const rule of rules) {
    if (rule.type !== 'product' || rule.severity !== 'red_flag') continue;
    const data = parseProductRuleData(rule.translations);
    if (!data || !matchesProductRule(product, data)) continue;
    findings.push({
      ingredient: rule.key,
      category: rule.category || PRODUCT_RULE_CATEGORY,
      severity: 'critical',
      productRule: { name: rule.key, reason: data.reason, sources: data.sources },
    });
  }
  return findings;
}
