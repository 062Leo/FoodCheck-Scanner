import { parseNutritionLabel } from '../../domain/ocr/nutritionLabel';
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

  /** Parses a recognised nutrition table. See parseNutritionLabel. */
  static parseNutriments(rawText: string): Partial<ProductNutriments> {
    return parseNutritionLabel(rawText);
  }
}
