import { normalizeBarcode } from '../barcode/barcode';

/** A food warning or recall published on lebensmittelwarnung.de. */
export interface Recall {
  id: string;
  title: string;
  productName: string | null;
  brand: string | null;
  manufacturer: string | null;
  reason: string | null;
  /** Milliseconds since the epoch. */
  publishedAt: number;
  /** The official page of the warning. */
  link: string;
  imageUrl: string | null;
  states: string[];
  /** Barcodes named in the warning, normalized like product EANs. */
  eans: string[];
}

const BARCODE_KEYWORD = /EAN|GTIN/gi;
/** How far after "EAN"/"GTIN" codes are collected ("EAN-Codes: 1 / 2 / 3"). */
const BARCODE_WINDOW = 160;

/** A code from a warning in the form the app stores it, or null if it is no valid barcode. */
function toProductEan(digits: string): string | null {
  if (digits.length === 14)
    return digits.startsWith('0') ? normalizeBarcode(digits.slice(1)) : null;
  return normalizeBarcode(digits);
}

/**
 * Barcodes mentioned after "EAN" or "GTIN" in a warning text. Only codes with a valid
 * check digit count, so batch numbers and article numbers are not taken for barcodes.
 */
export function extractEans(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(BARCODE_KEYWORD)) {
    const start = (match.index ?? 0) + match[0].length;
    const window = text.slice(start, start + BARCODE_WINDOW);
    for (const digits of window.match(/\d+/g) ?? []) {
      const ean = toProductEan(digits);
      if (ean) found.add(ean);
    }
  }
  return [...found];
}

/** HTML fragment to plain text with collapsed whitespace. */
export function plainText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}
