import { TextRecognition } from '@react-native-ml-kit/text-recognition';
import { NutrimentData } from '../../types/ContributeFormData';

/**
 * Thrown when OCR recognition fails.
 */
export class OcrError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'OcrError';
  }
}

/**
 * Service for optical character recognition (OCR) and nutrient data parsing.
 * recognizeText() is the only function with side effects (ML Kit call).
 * parseNutriments() is pure and deterministic.
 */
export class OcrService {
  /**
   * Uses ML Kit to recognize text from an image.
   * @param imageUri - URI of the image to recognize text from
   * @returns Promise resolving to the full recognized text as a single string
   * @throws OcrError if recognition fails
   */
  static async recognizeText(imageUri: string): Promise<string> {
    try {
      const result = await TextRecognition.recognize(imageUri);
      // ML Kit returns blocks of text; join them into a single string
      const text = result
        .map((block: { text: string }) => block.text)
        .join('\n')
        .trim();

      if (!text) {
        throw new OcrError('No text recognized in image');
      }

      return text;
    } catch (error) {
      if (error instanceof OcrError) {
        throw error;
      }
      throw new OcrError(
        `Failed to recognize text: ${error instanceof Error ? error.message : String(error)}`,
        error,
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

    // Helper to extract numeric value after keyword pattern
    const extractValue = (pattern: RegExp): number | undefined => {
      const match = rawText.match(pattern);
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
    const energyMatch = rawText.match(
      /Energie\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:kJ|kcal)?/i,
    );
    if (energyMatch) {
      let value = parseFloat(energyMatch[1].replace(',', '.'));
      // If no unit or kJ assumed, convert from kJ to kcal
      if (rawText.match(/Energie\s*:?\s*\d+(?:[.,]\d+)?\s*kJ/i) || !rawText.match(/Energie.*kcal/i)) {
        // Looks like kJ, convert to kcal
        if (rawText.match(/Energie\s*:?\s*\d+(?:[.,]\d+)?\s*kJ/i)) {
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
      /gesättigte\s+Fettsäuren\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
    );

    // Kohlenhydrate (carbohydrates)
    result.carbohydrates100g = extractValue(
      /Kohlenhydrate\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
    );

    // Zucker (sugar)
    result.sugars100g = extractValue(/Zucker\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i);

    // Ballaststoffe (fiber)
    result.fiber100g = extractValue(
      /Ballaststoffe\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
    );

    // Eiweiß (protein)
    result.proteins100g = extractValue(/Eiweiß\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i);

    // Salz (salt)
    result.salt100g = extractValue(/Salz\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i);

    return result;
  }
}
