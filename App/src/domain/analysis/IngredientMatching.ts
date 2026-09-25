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
const DIGIT = /\d/;

/** Abbreviations that must stand as whole words (they occur inside ordinary words). */
const ABBREVIATIONS = new Set(['bha', 'bht', 'bpa', 'edta', 'hfcs', 'msg', 'tbhq']);

/**
 * Joins E-numbers written with a space or hyphen ("E 330", "E-211") so that they
 * match rule keys such as "E330". "Vitamin E 150 mg" stays untouched.
 */
export function normalizeENumberSpacing(text: string): string {
  return text.replace(
    /\b([eE])[\s\-‐‑]+(\d{3,4}[a-zA-Z]?)\b/g,
    (match: string, e: string, code: string, offset: number, whole: string) =>
      /vitamin\s*$/i.test(whole.slice(Math.max(0, offset - 12), offset)) ? match : `${e}${code}`
  );
}

/**
 * Lower-cases without changing the string length, so positions found in the result
 * are valid in the original text ("İ" would otherwise become two code units).
 */
export function lowerCasePreservingLength(text: string): string {
  let result = '';
  for (const char of text) {
    const lower = char.toLowerCase();
    result += lower.length === char.length ? lower : char;
  }
  return result;
}

export function isENumberTerm(term: string): boolean {
  return E_NUMBER_TERM.test(term.trim());
}

function isBoundary(char: string | undefined, pattern: RegExp): boolean {
  return char === undefined || !pattern.test(char);
}

/**
 * End of an E-number match: a key without letter suffix ("E500") also covers
 * suffixed forms ("E500ii", "E450a"); a code never continues with a digit.
 */
function eNumberMatchEnds(lowerText: string, end: number, needle: string): boolean {
  if (!isBoundary(lowerText[end], DIGIT)) return false;
  if (/[a-z]$/.test(needle)) return isBoundary(lowerText[end], LETTER_OR_DIGIT);
  let cursor = end;
  while (cursor < lowerText.length && cursor - end < 3 && /[a-z]/.test(lowerText[cursor])) {
    cursor++;
  }
  return isBoundary(lowerText[cursor], LETTER_OR_DIGIT);
}

/**
 * Finds every occurrence of `term` in `lowerText` (already lower-cased).
 *
 * - E-numbers must not be part of a longer code ("E140" does not match "E1400").
 * - Known abbreviations (BHA, MSG …) must be whole words.
 * - Everything else is a plain substring match, so German compounds such as
 *   "Rohrzucker" still match "Zucker"; overlapping longer matches are resolved later.
 */
export function findOccurrences(lowerText: string, term: string): TextSpan[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];

  const isENumber = isENumberTerm(needle);
  const isAbbreviation = ABBREVIATIONS.has(needle);

  const spans: TextSpan[] = [];
  let index = lowerText.indexOf(needle);
  while (index !== -1) {
    const end = index + needle.length;
    let matches = true;
    if (isENumber) {
      matches =
        isBoundary(lowerText[index - 1], LETTER_OR_DIGIT) &&
        eNumberMatchEnds(lowerText, end, needle);
    } else if (isAbbreviation) {
      matches = isBoundary(lowerText[index - 1], LETTER) && isBoundary(lowerText[end], LETTER);
    }
    if (matches) spans.push({ start: index, end });
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
 * Structure of an ingredient list: bracket depth per character, counting only
 * brackets that are properly closed (an unclosed "(" is treated as text).
 */
export class IngredientStructure {
  private readonly depth: number[];

  constructor(private readonly text: string) {
    const closing = new Map<number, number>();
    const open: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '(' || text[i] === '[') open.push(i);
      else if ((text[i] === ')' || text[i] === ']') && open.length > 0) {
        closing.set(open.pop()!, i);
      }
    }

    this.depth = new Array<number>(text.length).fill(0);
    let current = 0;
    const closers = new Set(closing.values());
    for (let i = 0; i < text.length; i++) {
      if (closers.has(i)) current--;
      this.depth[i] = current;
      if (closing.has(i)) current++;
    }
  }

  private isSeparator(i: number): boolean {
    const char = this.text[i];
    const before = this.text[i - 1] ?? '';
    const after = this.text[i + 1];
    if (char === ';') return true;
    if (char === ',') return !(DIGIT.test(before) && DIGIT.test(after ?? ''));
    if (char === '.') return !DIGIT.test(before) && (after === undefined || /\s/.test(after));
    return false;
  }

  private isOpening(i: number): boolean {
    return (this.text[i] === '(' || this.text[i] === '[') && this.depth[i + 1] > this.depth[i];
  }

  private isClosing(i: number): boolean {
    return (
      (this.text[i] === ')' || this.text[i] === ']') && this.depth[i] < (this.depth[i - 1] ?? 0)
    );
  }

  /**
   * The single ingredient the position belongs to: delimited by separators at the same
   * bracket depth or by the enclosing brackets, including any bracket list attached to
   * it. "Füllung (Zucker, Farbstoff: Carotin)" → position in "Carotin" yields
   * "Farbstoff: Carotin"; position in "Füllung" yields the whole text.
   */
  itemAt(position: number): TextSpan {
    const level = this.depth[position] ?? 0;
    let start = 0;
    for (let i = position - 1; i >= 0; i--) {
      if (this.depth[i] === level && this.isSeparator(i)) {
        start = i + 1;
        break;
      }
      if (this.depth[i] === level - 1 && this.isOpening(i)) {
        start = i + 1;
        break;
      }
    }
    let end = this.text.length;
    for (let i = position; i < this.text.length; i++) {
      if (this.depth[i] === level && this.isSeparator(i)) {
        end = i;
        break;
      }
      if (this.isClosing(i) && this.depth[i] === level - 1) {
        end = i;
        break;
      }
    }
    return { start, end };
  }
}
