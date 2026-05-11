export interface IngredientToken {
  text: string;
  normalized: string;
  isENumber: boolean;
  eNumber?: string;
  isSubIngredient: boolean;
  percentage?: number;
  parentToken?: string;
}

export class IngredientParser {
  parse(ingredientsText: string): IngredientToken[] {
    if (!ingredientsText || typeof ingredientsText !== 'string') {
      return [];
    }

    const cleaned = ingredientsText
      .replace(/^Zutaten:\s*/i, '')
      .replace(/^Ingredients:\s*/i, '')
      .replace(/^Inhaltsstoffe:\s*/i, '')
      .trim();

    const tokens: IngredientToken[] = [];
    const segments = this.splitSegments(cleaned);

    for (const segment of segments) {
      const parsed = this.parseSegment(segment);
      tokens.push(...parsed);
    }

    return this.deduplicate(tokens);
  }

  private splitSegments(text: string): string[] {
    const segments: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '(' || char === '[') {
        depth++;
        current += char;
      } else if (char === ')' || char === ']') {
        depth--;
        current += char;
      } else if ((char === ',' || char === ';' || char === '.') && depth === 0) {
        const trimmed = current.trim();
        if (trimmed) segments.push(trimmed);
        current = '';
      } else {
        current += char;
      }
    }

    const trimmed = current.trim();
    if (trimmed) segments.push(trimmed);

    return segments;
  }

  private parseSegment(segment: string): IngredientToken[] {
    const tokens: IngredientToken[] = [];
    const mainText = segment
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .trim();
    const percentageMatch = mainText.match(/([\d,.]+)\s*%$/);
    const percentage = percentageMatch
      ? parseFloat(percentageMatch[1].replace(',', '.'))
      : undefined;

    const cleanMain = mainText.replace(/[\d,.]+\s*%$/, '').trim();

    if (cleanMain) {
      tokens.push(this.createToken(cleanMain, false, undefined, percentage));
    }

    // eslint-disable-next-line no-useless-escape
    const parentheticals = segment.match(/[(\[][^)\]]+[)\]]/g);
    if (parentheticals) {
      for (const p of parentheticals) {
        const inner = p.slice(1, -1).trim();
        const subSegments = inner
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);

        for (const sub of subSegments) {
          tokens.push(this.createToken(sub, true, cleanMain || undefined));
        }
      }
    }

    return tokens;
  }

  private createToken(
    text: string,
    isSubIngredient: boolean,
    parentToken?: string,
    percentage?: number
  ): IngredientToken {
    const normalized = this.normalizeIngredient(text);

    const eNumberExact = normalized.match(/^e[\s-]*(\d{3,4}[a-z]?)$/i);
    const eNumberEmbedded = normalized.match(/\be[\s-]*(\d{3,4}[a-z]?)\b/i);

    const eNumberMatch = eNumberExact || eNumberEmbedded;
    const isENumber = eNumberMatch !== null;

    return {
      text: text.trim(),
      normalized,
      isENumber,
      eNumber: isENumber ? `E${eNumberMatch![1]}`.toUpperCase() : undefined,
      isSubIngredient,
      percentage,
      parentToken,
    };
  }

  normalizeIngredient(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[*•·]/g, '')
      .replace(/^\d+[\s.)-]*/, '')
      .trim();
  }

  private deduplicate(tokens: IngredientToken[]): IngredientToken[] {
    const seen = new Set<string>();
    return tokens.filter((t) => {
      const key = t.eNumber || t.normalized;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
