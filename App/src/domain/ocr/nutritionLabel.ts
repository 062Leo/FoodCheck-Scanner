import type { ProductNutriments } from '../../types/Product';

/**
 * Reads per-100 g values from the recognised text of a nutrition table (DE/EN/FR/IT).
 * Works line by line: a value belongs to the nutrient named on the same line, so
 * "Fett 12 g" and "davon gesättigte Fettsäuren 3 g" do not get mixed up.
 * Pure function, never throws.
 */

interface NutrientPattern {
  field: keyof ProductNutriments;
  label: RegExp;
  /** Lines that match `label` but belong to another nutrient. */
  exclude?: RegExp;
}

const SATURATED = /ges[äa]ttigt|saturate|satur[ée]s|saturi/i;

const PATTERNS: NutrientPattern[] = [
  { field: 'saturatedFat100g', label: SATURATED },
  {
    field: 'fat100g',
    label: /\bfett\b|\bfat\b|mati[èe]res?\s+grasses|lipides|grassi/i,
    exclude: SATURATED,
  },
  { field: 'sugars100g', label: /zucker|\bsugars?\b|sucres|zuccheri/i },
  {
    field: 'carbohydrates100g',
    label: /kohlenhydrate|carbohydrates?|glucides|carboidrati/i,
    exclude: /zucker|sugar|sucres|zuccheri/i,
  },
  { field: 'fiber100g', label: /ballaststoffe|fib(?:re|er)s?|fibra/i },
  { field: 'proteins100g', label: /eiwei(?:ß|ss|b)|proteins?|prot[ée]ines?|proteine/i },
  { field: 'salt100g', label: /\bsalz\b|\bsalt\b|\bsel\b|\bsale\b/i },
];

const ENERGY_LABEL = /energie|energy|[ée]nergie|energia|brennwert|valeur\s+[ée]nerg/i;
const TRACE = /spuren|traces?|tracce/i;

/** "1.540" / "1 540" → "1540"; "12,5" → "12.5". */
function normalizeNumbers(text: string): string {
  return text
    .replace(/(\d)[.\s](\d{3})(?=\s*(?:kj|kcal)\b)/gi, '$1$2')
    .replace(/(\d),(\d)/g, '$1.$2');
}

function firstNumber(text: string): number | undefined {
  const match = text.match(/<?\s*(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function energyKcal(lines: string[]): number | undefined {
  const energyLines = lines.filter((line) => ENERGY_LABEL.test(line) || /kcal|kj/i.test(line));
  const text = energyLines.join(' ');
  const kcal = text.match(/(\d+(?:\.\d+)?)\s*kcal/i);
  if (kcal) return Math.round(Number.parseFloat(kcal[1]));
  const kj = text.match(/(\d+(?:\.\d+)?)\s*kj/i);
  if (kj) return Math.round(Number.parseFloat(kj[1]) / 4.184);
  // "Energie (kJ/kcal) 1540/368": the second number of a pair is kcal.
  const pair = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (pair) return Math.round(Number.parseFloat(pair[2]));
  return undefined;
}

export function parseNutritionLabel(rawText: string): Partial<ProductNutriments> {
  const result: Partial<ProductNutriments> = {};
  if (!rawText || typeof rawText !== 'string') return result;

  const lines = normalizeNumbers(rawText.replace(/\r/g, ''))
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const energy = energyKcal(lines);
  if (energy !== undefined) result.energyKcal100g = energy;

  for (const { field, label, exclude } of PATTERNS) {
    for (const line of lines) {
      const match = line.match(label);
      if (!match || (exclude && exclude.test(line))) continue;
      const rest = line.slice((match.index ?? 0) + match[0].length);
      const value = firstNumber(rest) ?? (TRACE.test(rest) ? 0 : undefined);
      if (value !== undefined) {
        result[field] = value;
        break;
      }
    }
  }

  return result;
}
