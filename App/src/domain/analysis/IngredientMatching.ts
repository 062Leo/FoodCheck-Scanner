/**
 * Low-level text helpers for matching rule terms against an ingredient list.
 * Pure functions, no framework dependencies.
 */

export interface TextSpan {
  start: number;
  end: number;
}

const E_NUMBER_TERM = /^e\d{3,4}[a-z]?$/i;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const LETTER = /\p{L}/u;

/**
 * Joins E-numbers written with a space or hyphen ("E 330", "E-211") so that they
 * match rule keys such as "E330".
 */
export function normalizeENumberSpacing(text: string): string {
  return text.replace(/\b([eE])[\s\-‐‑]+(\d{3,4}[a-zA-Z]?)\b/g, '$1$2');
}

export function isENumberTerm(term: string): boolean {
  return E_NUMBER_TERM.test(term.trim());
}

/** Short all-caps abbreviations (BHA, MSG, EDTA …) must stand as whole words. */
function isAbbreviation(term: string): boolean {
  return term.length <= 5 && /^[A-Z]+$/.test(term);
}

function isBoundary(char: string | undefined, pattern: RegExp): boolean {
  return char === undefined || !pattern.test(char);
}

/**
 * Finds every occurrence of `term` in `lowerText` (already lower-cased).
 *
 * - E-numbers must not be part of a longer code ("E140" does not match "E1400").
 * - Abbreviations must be whole words.
 * - Everything else is a plain substring match, so German compounds such as
 *   "Rohrzucker" still match "Zucker"; overlapping longer matches are resolved later.
 */
export function findOccurrences(lowerText: string, term: string): TextSpan[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];

  const boundary = isENumberTerm(needle)
    ? LETTER_OR_DIGIT
    : isAbbreviation(term.trim())
      ? LETTER
      : null;

  const spans: TextSpan[] = [];
  let index = lowerText.indexOf(needle);
  while (index !== -1) {
    const end = index + needle.length;
    if (
      !boundary ||
      (isBoundary(lowerText[index - 1], boundary) && isBoundary(lowerText[end], boundary))
    ) {
      spans.push({ start: index, end });
    }
    index = lowerText.indexOf(needle, index + 1);
  }
  return spans;
}

/** True if `inner` lies inside `outer` and `outer` is strictly longer. */
export function isStrictlyContained(inner: TextSpan, outer: TextSpan): boolean {
  return (
    outer.start <= inner.start &&
    inner.end <= outer.end &&
    outer.end - outer.start > inner.end - inner.start
  );
}

/**
 * Splits an ingredient list into top-level segments (separated by "," or ";" outside
 * of brackets). Decimal commas such as "7,4 %" do not split.
 * Returns the segment boundaries in the same coordinates as `text`.
 */
export function segmentSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(' || char === '[') {
      depth++;
    } else if ((char === ')' || char === ']') && depth > 0) {
      depth--;
    } else if (depth === 0 && (char === ',' || char === ';')) {
      const isDecimalComma =
        char === ',' && /\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '');
      if (!isDecimalComma) {
        spans.push({ start, end: i });
        start = i + 1;
      }
    }
  }
  spans.push({ start, end: text.length });
  return spans;
}

export function segmentIndexAt(segments: TextSpan[], position: number): number {
  const index = segments.findIndex((s) => position >= s.start && position < s.end);
  return index === -1 ? segments.length - 1 : index;
}
