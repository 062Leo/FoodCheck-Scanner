import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { NutrimentData } from '../../types/ContributeFormData';

/**
 * Thrown when OCR recognition fails.
 */
export class OcrError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'OcrError';
  }
}

export type OcrScriptSelection = 'auto' | TextRecognitionScript;

const DEFAULT_SCRIPT = TextRecognitionScript.LATIN;

function resolveScript(selection: OcrScriptSelection): TextRecognitionScript {
  return selection === 'auto' ? DEFAULT_SCRIPT : selection;
}

function isLetterLike(ch: string): boolean {
  return /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u1F00-\u1FFF]/.test(ch);
}

function cleanupOcrText(text: string): string {
  const lines = text.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const tokens = line.split(/\s+/).filter(Boolean);
    const kept: string[] = [];

    for (const token of tokens) {
      const letters = Array.from(token).filter((ch) => isLetterLike(ch)).length;
      const digits = Array.from(token).filter((ch) => /\d/.test(ch)).length;
      const other = token.length - letters - digits;

      const hasLetter = letters > 0;
      const isMostlyNoise = token.length >= 4 && !hasLetter && digits === 0;
      const tooManyOther = token.length >= 4 && other / token.length > 0.5;

      if (isMostlyNoise || tooManyOther) {
        continue;
      }

      kept.push(token);
    }

    cleanedLines.push(kept.join(' '));
  }

  return cleanedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isGreekVowel(ch: string): boolean {
  return /[\u0391\u0395\u0397\u0399\u039F\u03A5\u03A9\u03B1\u03B5\u03B7\u03B9\u03BF\u03C5\u03C9]/.test(
    ch
  );
}

function isLatinVowel(ch: string): boolean {
  return /[AEIOUaeiou]/.test(ch);
}

function looksLikeRealWord(token: string): boolean {
  if (token.length <= 2) return true;
  if (/\d/.test(token)) return true;
  if (/^(kcal|kj|g|mg|µg|ug|ml|l|%|per)$/i.test(token)) return true;

  const chars = Array.from(token);
  const letters = chars.filter((ch) => isLetterLike(ch)).length;
  if (letters === 0) return false;

  const letterRatio = letters / token.length;
  if (token.length >= 12 && letterRatio < 0.6) return false;

  const vowelCount = chars.filter((ch) => isLatinVowel(ch) || isGreekVowel(ch)).length;
  if (token.length >= 10 && vowelCount === 0) return false;

  return true;
}

function cleanupNutrimentOcrText(text: string): string {
  const lines = text.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const tokens = line.split(/\s+/).filter(Boolean);
    const kept: string[] = [];

    for (const token of tokens) {
      if (!looksLikeRealWord(token)) continue;
      kept.push(token);
    }

    cleanedLines.push(kept.join(' '));
  }

  return cleanedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Service for optical character recognition (OCR) and nutrient data parsing.
 * recognizeText() is the only function with side effects (ML Kit call).
 * parseNutriments() is pure and deterministic.
 */
export class OcrService {
  /**
   * Uses ML Kit to recognize text from an image.
   * Resolves the requested OCR script and falls back to Latin for auto mode.
   *
   * Resolves the requested OCR script and falls back to Latin for auto mode.
   *
   * @param imageUri - URI of the image to recognize text from
   * @returns Promise resolving to the full recognized text as a single string
   * @throws OcrError if recognition fails or produces no text
   */
  static async recognizeText(
    imageUri: string,
    selection: OcrScriptSelection = 'auto'
  ): Promise<string> {
    const script = resolveScript(selection);

    try {
      const result = await TextRecognition.recognize(imageUri, script);
      const text = result.text?.trim() ?? '';

      if (!text) {
        throw new OcrError(`No text recognized in image using ${script} OCR`);
      }

      return text;
    } catch (error) {
      if (error instanceof OcrError) throw error;
      throw new OcrError(
        `Failed to recognize text using ${script} OCR: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Parses German nutrient label text and extracts numeric values.
   * Pure function: deterministic, no side effects, no throws.
   * Best-effort parsing: returns only fields it can confidently parse.
   *
   * Recognized German keywords:
   * - Energie (energy in kJ or kcal)
   * - Fett (fat in g)
   * - gesättigte Fettsäuren (saturated fat in g)
   * - Kohlenhydrate (carbohydrates in g)
   * - Zucker (sugar in g)
   * - Ballaststoffe (fiber in g)
   * - Eiweiß (protein in g)
   * - Salz (salt in g)
   *
   * @param rawText - Raw OCR text from nutrient label
   * @returns Partial object with successfully parsed nutrient values; empty if none found
   */
  static parseNutriments(rawText: string): Partial<NutrimentData> {
    const result: Partial<NutrimentData> = {};

    if (!rawText || typeof rawText !== 'string') {
      return result;
    }

    const sanitizedText = cleanupNutrimentOcrText(rawText);

    // Helper to extract numeric value after keyword pattern
    const extractValue = (pattern: RegExp): number | undefined => {
      const match = sanitizedText.match(pattern);
      if (!match || !match[1]) {
        return undefined;
      }
      // Handle both dot and comma decimal separators (German format)
      const normalized = match[1].replace(',', '.');
      const num = parseFloat(normalized);
      return isNaN(num) ? undefined : num;
    };

    // Energie: can be kJ or kcal; if kJ, convert to kcal (1 kcal ≈ 4.184 kJ)
    // Pattern: "Energie" followed by optional colon/equals and a number, optionally with kJ/kcal
    const energyMatch = sanitizedText.match(/Energie\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:kJ|kcal)?/i);
    if (energyMatch) {
      let value = parseFloat(energyMatch[1].replace(',', '.'));
      // If no unit or kJ assumed, convert from kJ to kcal (1 kcal ≈ 4.184 kJ)
      if (
        sanitizedText.match(/Energie\s*:?\s*\d+(?:[.,]\d+)?\s*kJ/i) ||
        !sanitizedText.match(/Energie.*kcal/i)
      ) {
        // Looks like kJ, convert to kcal
        if (sanitizedText.match(/Energie\s*:?\s*\d+(?:[.,]\d+)?\s*kJ/i)) {
          value = value / 4.184;
        }
      }
      if (!isNaN(value)) {
        result.energyKcal100g = Math.round(value);
      }
    }

    // Fett (total fat)
    result.fat100g = extractValue(/Fett\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i);

    // gesättigte Fettsäuren (saturated fat)
    result.saturatedFat100g = extractValue(
      /gesättigte\s+Fettsäuren\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i
    );

    // Kohlenhydrate (carbohydrates)
    result.carbohydrates100g = extractValue(/Kohlenhydrate\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i);

    // Zucker (sugar)
    result.sugars100g = extractValue(/Zucker\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i);

    // Ballaststoffe (fiber)
    result.fiber100g = extractValue(/Ballaststoffe\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i);

    // Eiweiß (protein)
    result.proteins100g = extractValue(/Eiweiß\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i);

    // Salz (salt)
    result.salt100g = extractValue(/Salz\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i);

    return result;
  }
}
