import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import type { ProductNutriments } from '../../types/Product';
import { OcrPreprocessor } from './OcrPreprocessor';

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

export interface OcrRecognitionResult {
  text: string;
  confidence: number;
  qualityScore: number;
  qualityIssues: string[];
}

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

export function cleanupOcrTextPublic(text: string): string {
  return cleanupOcrText(text);
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
 */
export class OcrService {
  static async recognizeText(
    imageUri: string,
    selection: OcrScriptSelection = 'auto'
  ): Promise<string> {
    const result = await OcrService.recognizeWithConfidence(imageUri, selection);
    return result.text;
  }

  static async recognizeWithConfidence(
    imageUri: string,
    selection: OcrScriptSelection = 'auto'
  ): Promise<OcrRecognitionResult> {
    const script = resolveScript(selection);

    // Preprocess image: resize if needed
    let processedUri = imageUri;
    try {
      const preprocessResult = await OcrPreprocessor.preprocess(imageUri);
      processedUri = preprocessResult.uri;
    } catch {
      // Fall through with original URI if preprocessing fails
    }

    try {
      const result = await TextRecognition.recognize(processedUri, script);
      const text = result.text?.trim() ?? '';

      if (!text) {
        throw new OcrError(`No text recognized in image using ${script} OCR`);
      }

      // Calculate average confidence from blocks
      let totalConfidence = 0;
      let blockCount = 0;
      if (result.blocks) {
        for (const block of result.blocks) {
          if (block.lines) {
            for (const line of block.lines) {
              const confidence = (line as { confidence?: number }).confidence;
              if (typeof confidence === 'number') {
                totalConfidence += confidence;
                blockCount++;
              }
            }
          }
        }
      }
      const avgConfidence = blockCount > 0 ? totalConfidence / blockCount : 0.5;

      // Estimate quality
      const quality = OcrPreprocessor.estimateQuality(text);

      return {
        text,
        confidence: Math.round(avgConfidence * 100) / 100,
        qualityScore: quality.score,
        qualityIssues: quality.issues,
      };
    } catch (error) {
      if (error instanceof OcrError) throw error;
      throw new OcrError(
        `Failed to recognize text using ${script} OCR: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  static cleanIngredientsText(rawOcrText: string): string {
    return cleanupOcrText(rawOcrText);
  }

  /**
   * Parses nutrient label text in multiple languages and extracts numeric values.
   * Pure function: deterministic, no side effects, no throws.
   *
   * Supported languages: German (DE), English (EN), French (FR), Italian (IT)
   */
  static parseNutriments(rawText: string): Partial<ProductNutriments> {
    const result: Partial<ProductNutriments> = {};

    if (!rawText || typeof rawText !== 'string') {
      return result;
    }

    const sanitizedText = cleanupNutrimentOcrText(rawText);

    const locale = OcrService.detectNutritionLocale(sanitizedText);

    const extractValue = (pattern: RegExp): number | undefined => {
      const match = sanitizedText.match(pattern);
      if (!match || !match[1]) {
        return undefined;
      }
      const normalized = match[1].replace(',', '.');
      const num = parseFloat(normalized);
      return isNaN(num) ? undefined : num;
    };

    const energyPatterns: Record<string, RegExp> = {
      de: /Energie\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:kJ|kcal)?/i,
      en: /Energy\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:kJ|kcal)?/i,
      fr: /[ÉE]nergie\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:kJ|kcal)?/i,
      it: /Energia\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:kJ|kcal)?/i,
    };

    const fatPatterns: Record<string, RegExp> = {
      de: /Fett\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      en: /Fat\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      fr: /(?:Matières?\s*grasses?|Lipides)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      it: /Grassi\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
    };

    const satFatPatterns: Record<string, RegExp> = {
      de: /(?:gesättigte\s+Fettsäuren|davon\s+gesättigte\s+Fettsäuren)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      en: /(?:of which\s+saturates|saturated\s*fat|saturates)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      fr: /(?:dont\s+acides\s+gras\s+saturés|acides\s+gras\s+saturés)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      it: /(?:di\s+cui\s+acidi\s+grassi\s+saturi|acidi\s+grassi\s+saturi)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
    };

    const carbPatterns: Record<string, RegExp> = {
      de: /Kohlenhydrate\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      en: /Carbohydrate[s]?\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      fr: /Glucides\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      it: /Carboidrati\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
    };

    const sugarPatterns: Record<string, RegExp> = {
      de: /(?:davon\s+)?Zucker\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      en: /(?:of which\s+sugars|Sugars)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      fr: /(?:dont\s+sucres|Sucres)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      it: /(?:di\s+cui\s+zuccheri|Zuccheri)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
    };

    const fiberPatterns: Record<string, RegExp> = {
      de: /Ballaststoffe\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      en: /Fib[er]{1,2}e\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      fr: /Fibres\s*(?:alimentaires)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      it: /Fibr[ae]\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
    };

    const proteinPatterns: Record<string, RegExp> = {
      de: /Eiweiß\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      en: /Protein[s]?\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      fr: /Protéines\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      it: /Proteine\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
    };

    const saltPatterns: Record<string, RegExp> = {
      de: /Salz\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      en: /Salt\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      fr: /Sel\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
      it: /Sale\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?/i,
    };

    // Energy with kJ/kcal detection
    const energyPattern = energyPatterns[locale] || energyPatterns.en;
    const energyMatch = sanitizedText.match(energyPattern);
    if (energyMatch) {
      let value = parseFloat(energyMatch[1].replace(',', '.'));
      const looksLikeKj =
        /(?:kJ|kj)/i.test(sanitizedText) || (locale === 'de' && !/kcal/i.test(sanitizedText));
      if (looksLikeKj) {
        value = value / 4.184;
      }
      if (!isNaN(value)) {
        result.energyKcal100g = Math.round(value);
      }
    }

    const extractLocalized = (patterns: Record<string, RegExp>, field: keyof ProductNutriments) => {
      const pattern = patterns[locale] || patterns.en;
      const value = extractValue(pattern);
      if (value !== undefined) {
        (result as Record<string, number>)[field] = value;
      }
    };

    extractLocalized(fatPatterns, 'fat100g');
    extractLocalized(satFatPatterns, 'saturatedFat100g');
    extractLocalized(carbPatterns, 'carbohydrates100g');
    extractLocalized(sugarPatterns, 'sugars100g');
    extractLocalized(fiberPatterns, 'fiber100g');
    extractLocalized(proteinPatterns, 'proteins100g');
    extractLocalized(saltPatterns, 'salt100g');

    return result;
  }

  private static detectNutritionLocale(text: string): 'de' | 'en' | 'fr' | 'it' {
    const markers: Array<{ locale: 'de' | 'en' | 'fr' | 'it'; patterns: RegExp[] }> = [
      {
        locale: 'de',
        patterns: [
          /Energie/i,
          /Kohlenhydrate/i,
          /Eiweiß/i,
          /Ballaststoffe/i,
          /Fett\b/i,
          /Zucker\b/i,
          /Salz\b/i,
        ],
      },
      {
        locale: 'fr',
        patterns: [/Glucides/i, /Lipides/i, /Protéines/i, /fibres/i, /saturés/i, /Énergie/i],
      },
      {
        locale: 'it',
        patterns: [/Carboidrati/i, /Grassi/i, /Proteine/i, /Fibra/i, /Energia/i, /Zuccheri/i],
      },
      {
        locale: 'en',
        patterns: [/Energy/i, /Carbohydrate/i, /Protein/i, /Fibre/i, /saturates/i, /Sugars/i],
      },
    ];

    for (const marker of markers) {
      if (marker.patterns.some((p) => p.test(text))) {
        return marker.locale;
      }
    }

    return 'en';
  }
}
