import type { FilterRule } from '../../types/FilterRule';
import type { Product } from '../../types/Product';
import type { RedFlagFinding } from '../../types/ScanResult';

/** Stored category of company rules (a fixed value, displayed translated). */
export const COMPANY_CATEGORY = 'Marken & Konzerne';

/**
 * Brands and subsidiaries of an avoided company, looked up once when the rule is saved
 * and stored with it (in the rule's `translations` column), so matching works offline.
 */
export interface CompanyData {
  /** Wikidata item of the company, e.g. "Q160746". */
  wikidataId?: string;
  /** Names of brands and companies that belong to it. */
  names: string[];
  /** Names the user switched off; they no longer match products. */
  excluded?: string[];
}

export function parseCompanyData(json: string | null | undefined): CompanyData | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const data = parsed as Record<string, unknown>;
    if (!Array.isArray(data.names)) return null;
    return {
      wikidataId: typeof data.wikidataId === 'string' ? data.wikidataId : undefined,
      names: data.names.filter((name): name is string => typeof name === 'string'),
      ...(Array.isArray(data.excluded)
        ? {
            excluded: data.excluded.filter((name): name is string => typeof name === 'string'),
          }
        : {}),
    };
  } catch {
    return null;
  }
}

/** Legal forms and regional suffixes that do not distinguish companies. */
const COMPANY_SUFFIXES = new Set([
  'gmbh',
  'ag',
  'se',
  'kg',
  'co',
  'ohg',
  'inc',
  'ltd',
  'limited',
  'llc',
  'plc',
  'corp',
  'corporation',
  'company',
  'sa',
  'sas',
  'spa',
  'srl',
  'bv',
  'nv',
  'ab',
  'as',
  'oy',
  'group',
  'gruppe',
  'holding',
  'deutschland',
  'germany',
  'international',
  'europe',
  'the',
]);

/** Lowercase words without accents, punctuation and legal-form suffixes. */
export function companyWords(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word && !COMPANY_SUFFIXES.has(word));
}

export function normalizeCompanyName(name: string): string {
  return companyWords(name).join(' ');
}

/** True if `name` is the rule's own name, which can never be switched off. */
export function isOwnCompanyName(name: string, ruleName: string): boolean {
  const own = compactName(ruleName);
  return own.length > 0 && compactName(name) === own;
}

/** True if the user switched `name` off (compared normalized). */
export function isExcludedCompanyName(data: CompanyData | null, name: string): boolean {
  const compact = compactName(name);
  return (data?.excluded ?? []).some((excluded) => compactName(excluded) === compact);
}

/** Switches a single collected name on or off; the rule's own name stays on. */
export function toggleCompanyName(data: CompanyData, name: string, ruleName: string): CompanyData {
  if (isOwnCompanyName(name, ruleName)) return data;
  const compact = compactName(name);
  const excluded = data.excluded ?? [];
  const next = isExcludedCompanyName(data, name)
    ? excluded.filter((other) => compactName(other) !== compact)
    : [...excluded, name];
  return { ...data, excluded: next };
}

/**
 * Carries the exclusions of `previous` over to a fresh lookup result: exclusions of names
 * that are still present are kept, those of vanished names are dropped.
 */
export function keepExclusions(previous: CompanyData | null, next: CompanyData): CompanyData {
  const excluded = next.names.filter((name) => isExcludedCompanyName(previous, name));
  return excluded.length > 0 ? { ...next, excluded } : next;
}

/** Number of collected names that are switched on. */
export function activeCompanyNameCount(data: CompanyData | null): number {
  return (data?.names ?? []).filter((name) => !isExcludedCompanyName(data, name)).length;
}

/** True if `words` contains `needle` as consecutive whole words. */
export function containsWords(words: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > words.length) return false;
  for (let i = 0; i + needle.length <= words.length; i++) {
    if (needle.every((word, j) => words[i + j] === word)) return true;
  }
  return false;
}

/** The product's brands and brand owner as entered at Open Food Facts. */
export function companyNamesOf(product: Product): string[] {
  const brands = (product.brand ?? '')
    .split(',')
    .map((brand) => brand.trim())
    .filter(Boolean);
  return product.brandOwner ? [...brands, product.brandOwner] : brands;
}

/** A normalized name without spaces, so "Kit Kat" and "KitKat" are the same brand. */
export function compactName(name: string): string {
  return normalizeCompanyName(name).replace(/ /g, '');
}

/** True if the first whole words of `words`, written together, are `compact`. */
function startsWithCompact(words: string[], compact: string): boolean {
  let joined = '';
  for (const word of words) {
    joined += word;
    if (joined === compact) return true;
    if (joined.length >= compact.length) return false;
  }
  return false;
}

/** True if consecutive whole words of `words`, written together, are `compact`. */
export function containsCompact(words: string[], compact: string): boolean {
  return words.some((_, i) => startsWithCompact(words.slice(i), compact));
}

/**
 * Finds the user's avoided brands and companies in a product. The avoided name itself
 * may appear inside a brand ("Nestlé Nesquik", "Nestlé Deutschland AG"); names of its
 * brands must match a whole brand or its first words ("Maggi Fix"), so short brand
 * names do not hit unrelated ones ("Golden Lion Foods" is not "Lion"). Spaces and
 * hyphens do not matter either way: "Kit Kat" is "KitKat", "Coca-Cola" is "CocaCola".
 */
export function findAvoidedCompanies(product: Product, rules: FilterRule[]): RedFlagFinding[] {
  const companyRules = rules.filter(
    (rule) => rule.type === 'company' && rule.severity === 'red_flag' && rule.key.trim()
  );
  if (companyRules.length === 0) return [];

  const candidates = companyNamesOf(product).map((name) => ({
    name,
    words: companyWords(name),
  }));
  if (candidates.length === 0) return [];

  const findings: RedFlagFinding[] = [];
  for (const rule of companyRules) {
    const ownWords = companyWords(rule.key);
    const ownCompact = ownWords.join('');
    const data = parseCompanyData(rule.translations);
    const excluded = new Set(
      (data?.excluded ?? []).map(compactName).filter((name) => name !== ownCompact)
    );
    const aliases = new Set(
      (data?.names ?? [])
        .map(compactName)
        .filter((alias) => alias.length > 1 && !excluded.has(alias))
    );
    const match = candidates.find(
      (candidate) =>
        containsWords(candidate.words, ownWords) ||
        (ownCompact.length > 1 && containsCompact(candidate.words, ownCompact)) ||
        [...aliases].some((alias) => startsWithCompact(candidate.words, alias))
    );
    if (!match) continue;
    findings.push({
      ingredient: rule.key,
      category: rule.category || COMPANY_CATEGORY,
      severity: 'critical',
      company: { name: rule.key, matched: match.name },
    });
  }
  return findings;
}
