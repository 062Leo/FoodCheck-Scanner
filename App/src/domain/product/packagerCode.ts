/**
 * Packager codes (identification marks, "Identitätskennzeichen") as Open Food Facts
 * stores them in `emb_codes_tags`, e.g. "de-by-123-eg", "fr-29-123-001-ce",
 * "it-1234-ce". The mark names the establishment that last processed or packed the
 * product, not where the raw materials come from.
 */
export interface PackagerCode {
  /** The tag as stored. */
  raw: string;
  /** Upper case with spaces, e.g. "DE BY 123 EG". */
  formatted: string;
  /** ISO 3166-1 alpha-2 code in upper case, e.g. "DE"; missing if the code has none. */
  country?: string;
  /** German state abbreviation, e.g. "BY"; only for German codes. */
  region?: GermanState;
}

/** Abbreviations of the German states used in German identification marks. */
export const GERMAN_STATES = [
  'BW',
  'BY',
  'BE',
  'BB',
  'HB',
  'HH',
  'HE',
  'MV',
  'NI',
  'NW',
  'RP',
  'SL',
  'SN',
  'ST',
  'SH',
  'TH',
] as const;

export type GermanState = (typeof GERMAN_STATES)[number];

function isGermanState(value: string): value is GermanState {
  return (GERMAN_STATES as readonly string[]).includes(value);
}

/** Parses one packager code; returns undefined for an empty value. */
export function parsePackagerCode(tag: string): PackagerCode | undefined {
  const raw = tag.trim();
  const parts = raw
    .toLowerCase()
    .split(/[\s\-./]+/)
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  const formatted = parts.join(' ').toUpperCase();

  // A country prefix is two letters, followed by at least one part with a digit.
  const [first, ...rest] = parts;
  const hasCountry = /^[a-z]{2}$/.test(first) && rest.some((part) => /\d/.test(part));
  if (!hasCountry) return { raw, formatted };

  const country = first.toUpperCase();
  const second = rest[0]?.toUpperCase();
  const region = country === 'DE' && second && isGermanState(second) ? second : undefined;
  return region ? { raw, formatted, country, region } : { raw, formatted, country };
}

/** All distinct packager codes of a product, in their original order. */
export function parsePackagerCodes(tags: string[] | undefined): PackagerCode[] {
  const seen = new Set<string>();
  const codes: PackagerCode[] = [];
  for (const tag of tags ?? []) {
    const code = parsePackagerCode(tag);
    if (!code || seen.has(code.formatted)) continue;
    seen.add(code.formatted);
    codes.push(code);
  }
  return codes;
}
