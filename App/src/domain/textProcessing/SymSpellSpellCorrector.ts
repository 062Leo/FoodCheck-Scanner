import type { Dictionary } from './Dictionary';
import type { SpellCorrector } from './SpellCorrector';
import type { SymSpellConfig } from './SymSpellConfig';
import { defaultSymSpellConfig } from './SymSpellConfig';

export class SymSpellSpellCorrector implements SpellCorrector {
  private readonly terms: ReadonlyArray<{ term: string; frequency: number }>;

  constructor(
    dictionary: Dictionary,
    private readonly config: SymSpellConfig = defaultSymSpellConfig,
  ) {
    this.terms = dictionary.all().map((t) => ({ term: t.term, frequency: t.frequency }));
  }

  correctLine(text: string): string {
    const line = (text ?? '').trim();
    if (!line) return '';

    const tokens = tokenize(line);
    const corrected = tokens.map((token) => this.correctToken(token));
    return corrected.join('');
  }

  private correctToken(token: Token): string {
    if (token.type !== 'word') return token.value;

    const raw = token.value;
    const lower = raw.toLowerCase();

    if (lower.length <= 2) return raw;
    if (containsDigit(lower)) return raw;

    const best = this.findBestCandidate(lower);
    if (!best) return '';

    if (best === lower) return raw;

    const dist = damerauLevenshtein(lower, best, this.config.maxEditDistance);
    if (dist === null) return '';

    return preserveCase(raw, best);
  }

  private findBestCandidate(lowerWord: string): string | null {
    let bestTerm: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestFrequency = 0;

    for (const entry of this.terms) {
      const terms = entry.term.split(',').map(t => t.trim().toLowerCase());
      
      for (const term of terms) {
        if (!term) continue;
        
        const dist = damerauLevenshtein(lowerWord, term, this.config.maxEditDistance);
        if (dist === null) continue;

        if (dist < bestDistance) {
          bestDistance = dist;
          bestFrequency = entry.frequency;
          bestTerm = term;
          if (dist === 0) return term;
          continue;
        }

        if (dist === bestDistance && entry.frequency > bestFrequency) {
          bestFrequency = entry.frequency;
          bestTerm = term;
        }
      }
    }

    return bestTerm;
  }
}

type Token =
  | { type: 'word'; value: string }
  | { type: 'other'; value: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let current = '';
  let inWord = false;

  const flush = () => {
    if (!current) return;
    tokens.push({ type: inWord ? 'word' : 'other', value: current });
    current = '';
  };

  for (const ch of text) {
    const isWord = isLetter(ch) || ch === '-' || ch === '’' || ch === "'";

    if (current.length === 0) {
      inWord = isWord;
      current = ch;
      continue;
    }

    if (isWord === inWord) {
      current += ch;
      continue;
    }

    flush();
    inWord = isWord;
    current = ch;
  }

  flush();
  return tokens;
}

function isLetter(ch: string): boolean {
  return /[A-Za-zÄÖÜäöüß]/.test(ch);
}

function containsDigit(s: string): boolean {
  return /\d/.test(s);
}

function preserveCase(original: string, correctedLower: string): string {
  if (original.toUpperCase() === original) {
    return correctedLower.toUpperCase();
  }

  const first = original[0];
  if (first && first.toUpperCase() === first) {
    return correctedLower[0].toUpperCase() + correctedLower.slice(1);
  }

  return correctedLower;
}

function damerauLevenshtein(a: string, b: string, max: number): number | null {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;

  if (Math.abs(al - bl) > max) return null;

  const dp: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));

  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;

  for (let i = 1; i <= al; i++) {
    let rowMin = Number.POSITIVE_INFINITY;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + cost);
      }

      dp[i][j] = val;
      rowMin = Math.min(rowMin, val);
    }

    if (rowMin > max) return null;
  }

  const result = dp[al][bl];
  return result <= max ? result : null;
}
