import type { Product } from '../../types/Product';

/**
 * Background note on almonds from California (bee colonies trucked in for pollination).
 * Display only: it never counts as a red flag and never changes the rating.
 *
 * Shown when the product contains almonds and their origin is the USA or unknown; a
 * stated origin elsewhere (Spain, Italy, Australia, …) hides it.
 */
export type AlmondOrigin = 'us' | 'unknown';

/** Categories (Open Food Facts taxonomy) that are or contain almonds. */
const ALMOND_CATEGORIES = new Set([
  'en:almonds',
  'en:almond-based-drinks',
  'en:almond-butters',
  'en:almond-paste',
  'en:almond-spreads',
  'en:almond-oils',
  'en:chocolates-with-almonds',
]);

const LETTER = /\p{L}/u;

/** Tiger nuts are no almonds: "Erdmandel", "aardamandel", "earth almond", "amande de terre". */
const TIGER_NUT_PHRASES =
  /earth[\s-]almonds?|amandes? de terre|mandorle? di terra|almendras? de tierra/g;
const TIGER_NUT_PREFIX = /(erd-?|aarda?)$/;

/** Stems that may stand anywhere in a compound ("Bittermandelöl", "amandelen"). */
const ALMOND_INFIXES = ['mandel', 'almond'];
/** Stems that must start a word ("amandes", "mandorle", "almendras", "migdały"). */
const ALMOND_WORD_STARTS = [
  'amande',
  'mandorl',
  'almendra',
  'amêndoa',
  'amendoa',
  'migdał',
  'migdal',
];

/** Statements about possible traces, up to the end of the sentence. */
const TRACE_STATEMENTS =
  /(spuren|may contain|traces of|peut contenir|traces? (de|d')|può contenere|puo contenere|tracce di|puede contener|trazas de|kan sporen|sporen van|pode conter|vestígios|może zawierać|moze zawierac)[^.]*/g;

/** The ingredient text without trace statements and tiger nut names. */
function almondText(product: Product): string {
  return (product.ingredientsText ?? '')
    .toLowerCase()
    .replace(TRACE_STATEMENTS, ' ')
    .replace(TIGER_NUT_PHRASES, ' ');
}

function containsAlmondWord(text: string): boolean {
  for (const stem of ALMOND_INFIXES) {
    let index = text.indexOf(stem);
    while (index !== -1) {
      const before = text.slice(0, index).match(/[\p{L}-]*$/u)?.[0] ?? '';
      if (!TIGER_NUT_PREFIX.test(before)) return true;
      index = text.indexOf(stem, index + 1);
    }
  }
  return ALMOND_WORD_STARTS.some((stem) => {
    let index = text.indexOf(stem);
    while (index !== -1) {
      if (index === 0 || !LETTER.test(text[index - 1])) return true;
      index = text.indexOf(stem, index + 1);
    }
    return false;
  });
}

/** True if the ingredient list or the categories name almonds (not tiger nuts or traces). */
export function containsAlmonds(product: Product): boolean {
  if ((product.categoriesTags ?? []).some((tag) => ALMOND_CATEGORIES.has(tag))) return true;
  return containsAlmondWord(almondText(product));
}

const US_WORDS = [
  'usa',
  'u.s.a',
  'united states',
  'vereinigte staaten',
  'vereinigten staaten',
  'états-unis',
  'etats-unis',
  'états unis',
  'etats unis',
  'stati uniti',
  'estados unidos',
  'verenigde staten',
  'stany zjednoczone',
  'kalifornien',
  'california',
  'californie',
  'kalifornia',
  'californië',
];

/** Countries other than the USA that grow almonds or are named as origin (EU and others). */
const OTHER_ORIGIN_WORDS = [
  // Main almond producers besides California.
  'spanien',
  'spain',
  'espagne',
  'spagna',
  'españa',
  'espana',
  'spanje',
  'espanha',
  'hiszpania',
  'italien',
  'italy',
  'italie',
  'italia',
  'italië',
  'włochy',
  'portugal',
  'portogallo',
  'portugalia',
  'griechenland',
  'greece',
  'grèce',
  'grece',
  'grecia',
  'griekenland',
  'grécia',
  'grecja',
  'australien',
  'australia',
  'australie',
  'australië',
  'türkei',
  'turkey',
  'türkiye',
  'turquie',
  'turchia',
  'turquía',
  'turquia',
  'turkije',
  'marokko',
  'morocco',
  'maroc',
  'marocco',
  'marruecos',
  'marrocos',
  'tunesien',
  'tunisia',
  'tunisie',
  'túnez',
  'iran',
  'chile',
  'cile',
  'syrien',
  'syria',
  'syrie',
  'israel',
  'afghanistan',
  'usbekistan',
  'uzbekistan',
  // Other EU countries, as German and English names.
  'deutschland',
  'germany',
  'allemagne',
  'germania',
  'alemania',
  'frankreich',
  'france',
  'francia',
  'frankrijk',
  'österreich',
  'austria',
  'zypern',
  'cyprus',
  'malta',
  'kroatien',
  'croatia',
  'bulgarien',
  'bulgaria',
  'rumänien',
  'romania',
  'ungarn',
  'hungary',
  'polen',
  'poland',
  'polska',
  'niederlande',
  'netherlands',
  'belgien',
  'belgium',
];

/** "EU", "EU-Landwirtschaft", "Europe". */
const GENERIC_EU = ['eu', 'ue', 'europa', 'europe', 'europäische union', 'european union'];
/** "Nicht-EU", "non-EU", "hors UE": possibly the USA, so the generic EU words say nothing. */
const NON_EU = /(nicht|non|hors|niet|fuori|fuera)[\s-]*(de |der |dell'|della )?(eu|ue)(?!\p{L})/u;

function hasWord(text: string, word: string): boolean {
  let index = text.indexOf(word);
  while (index !== -1) {
    const end = index + word.length;
    const startsWord = index === 0 || !LETTER.test(text[index - 1]);
    const endsWord = end >= text.length || !LETTER.test(text[end]);
    if (startsWord && endsWord) return true;
    index = text.indexOf(word, index + 1);
  }
  return false;
}

type OriginMention = 'us' | 'other' | 'none';

function originMention(text: string | undefined): OriginMention {
  if (!text?.trim()) return 'none';
  // "US" only in capitals, so the English word "us" does not count.
  if (/(^|[^\p{L}])US(?!\p{L})/u.test(text)) return 'us';
  const lower = text.toLowerCase().replace(/[_]/g, ' ');
  // Tags like "en:united-states" read as "united states".
  const words = lower.replace(/(\p{L})-(\p{L})/gu, '$1 $2');
  if (US_WORDS.some((word) => hasWord(lower, word) || hasWord(words, word))) return 'us';
  const others = NON_EU.test(lower) ? OTHER_ORIGIN_WORDS : [...OTHER_ORIGIN_WORDS, ...GENERIC_EU];
  return others.some((word) => hasWord(words, word)) ? 'other' : 'none';
}

/** The part of the ingredient list right after each almond mention, e.g. "Mandeln (Spanien)". */
function almondContexts(lowerText: string): string[] {
  const contexts: string[] = [];
  const pattern = /(mandel|almond|amande|mandorl|almendra|amêndoa|amendoa|migdał|migdal)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(lowerText)) !== null) {
    let depth = 0;
    let end = match.index;
    // Up to the next comma outside of brackets, at most 80 characters.
    while (end < lowerText.length && end - match.index < 80) {
      const char = lowerText[end];
      if (char === '(' || char === '[') depth++;
      else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
      else if ((char === ',' || char === ';') && depth === 0) break;
      end++;
    }
    contexts.push(lowerText.slice(match.index, end));
  }
  return contexts;
}

/**
 * Whether to show the almond note and with which wording, or null.
 * Sources: the product's origin field, the text right after the almonds in the
 * ingredient list, and the place of manufacture (only when it is in the USA: a
 * European manufacturer says nothing about where the almonds come from).
 */
export function almondPollinationInfo(product: Product): { origin: AlmondOrigin } | null {
  if (!containsAlmonds(product)) return null;
  const mentions = [
    originMention(product.origins),
    ...almondContexts(almondText(product)).map(originMention),
  ];
  if (originMention(product.manufacturingPlaces) === 'us') mentions.push('us');
  if (mentions.includes('us')) return { origin: 'us' };
  if (mentions.includes('other')) return null;
  return { origin: 'unknown' };
}
