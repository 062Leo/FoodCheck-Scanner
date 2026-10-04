import { normalizeBarcode } from '../barcode/barcode';
import type { Recall } from './recall';

/** 'ean': the warning names this barcode. 'name': brand and product name fit ("möglicherweise"). */
export type RecallMatchKind = 'ean' | 'name';

export interface RecallMatch {
  recall: Recall;
  kind: RecallMatchKind;
}

export interface RecallProduct {
  ean: string;
  name?: string | null;
  brand?: string | null;
}

/** Name matches only consider warnings of the last year; older ones are rarely still relevant. */
export const NAME_MATCH_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const MIN_BRAND_LENGTH = 3;
const MIN_WORD_LENGTH = 4;

/** Words too common in product names to identify a product. */
const COMMON_WORDS = new Set([
  'bio',
  'organic',
  'gramm',
  'gram',
  'grams',
  'kilogramm',
  'liter',
  'milliliter',
  'stück',
  'stueck',
  'packung',
  'pack',
  'mit',
  'ohne',
  'und',
  'with',
  'and',
  'from',
  'original',
  'classic',
  'klassisch',
  'natur',
  'premium',
]);

/** Lower case, umlauts folded, everything that is not a letter or digit becomes a space. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function containsPhrase(haystack: string, phrase: string): boolean {
  return phrase.length > 0 && ` ${haystack} `.includes(` ${phrase} `);
}

function significantWords(name: string, brandWords: Set<string>): string[] {
  const words = normalizeText(name)
    .split(' ')
    .filter(
      (word) =>
        word.length >= MIN_WORD_LENGTH &&
        !/^\d/.test(word) &&
        !COMMON_WORDS.has(word) &&
        !brandWords.has(word)
    );
  return [...new Set(words)];
}

/**
 * Conservative name match: one of the product's brands appears as a whole phrase in the
 * warning, and the product name's distinctive words appear in the warning's product text
 * (at least two, or the only one when the name has just one).
 */
function matchesByName(product: RecallProduct, recall: Recall): boolean {
  if (!product.brand || !product.name) return false;
  const brands = product.brand
    .split(',')
    .map(normalizeText)
    .filter((brand) => brand.length >= MIN_BRAND_LENGTH);
  if (brands.length === 0) return false;

  const recallText = normalizeText(
    [recall.title, recall.productName, recall.brand, recall.manufacturer].filter(Boolean).join(' ')
  );
  const brand = brands.find((candidate) => containsPhrase(recallText, candidate));
  if (!brand) return false;

  const words = significantWords(product.name, new Set(brand.split(' ')));
  if (words.length === 0) return false;
  const productText = normalizeText([recall.title, recall.productName].filter(Boolean).join(' '));
  const hits = words.filter((word) => containsPhrase(productText, word)).length;
  return hits >= Math.min(2, words.length);
}

/**
 * Warnings that concern the product. A barcode named in a warning is decisive: a warning
 * that lists barcodes but not this one never matches by name.
 */
export function findRecallMatches(
  product: RecallProduct,
  recalls: Recall[],
  now: number = Date.now()
): RecallMatch[] {
  const ean = normalizeBarcode(product.ean) ?? product.ean;
  const matches: RecallMatch[] = [];
  for (const recall of recalls) {
    if (recall.eans.length > 0) {
      if (recall.eans.includes(ean)) matches.push({ recall, kind: 'ean' });
      continue;
    }
    if (now - recall.publishedAt > NAME_MATCH_MAX_AGE_MS) continue;
    if (matchesByName(product, recall)) matches.push({ recall, kind: 'name' });
  }
  return matches.sort(
    (a, b) =>
      Number(b.kind === 'ean') - Number(a.kind === 'ean') ||
      b.recall.publishedAt - a.recall.publishedAt
  );
}
