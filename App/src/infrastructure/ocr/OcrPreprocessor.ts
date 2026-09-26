import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 2048;

export interface OcrPreprocessResult {
  uri: string;
  width: number;
  height: number;
  wasResized: boolean;
}

export class OcrPreprocessor {
  static async preprocess(imageUri: string): Promise<OcrPreprocessResult> {
    const info = await ImageManipulator.manipulateAsync(imageUri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    });

    let currentUri = imageUri;
    let wasResized = false;

    if (info.width > MAX_DIMENSION || info.height > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / info.width, MAX_DIMENSION / info.height);
      const newWidth = Math.round(info.width * scale);
      const newHeight = Math.round(info.height * scale);

      const resized = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ resize: { width: newWidth, height: newHeight } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      currentUri = resized.uri;
      wasResized = true;
    }

    const finalInfo = wasResized
      ? await ImageManipulator.manipulateAsync(currentUri, [], {
          format: ImageManipulator.SaveFormat.JPEG,
        })
      : info;

    return {
      uri: currentUri,
      width: finalInfo.width,
      height: finalInfo.height,
      wasResized,
    };
  }

  static estimateQuality(text: string): {
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    if (!text || text.length < 5) {
      return { score: 0, issues: ['Kein Text erkannt'] };
    }

    const weirdChars = (text.match(/[^\w\säöüÄÖÜßéèêëàâîïôûçñ.,:;()%/\-+&|!?€$@'"*]/g) || [])
      .length;
    const weirdRatio = weirdChars / text.length;
    if (weirdRatio > 0.05) {
      score -= Math.round(weirdRatio * 200);
      issues.push('Viele ungewöhnliche Zeichen');
    }

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 3) {
      score -= 30;
      issues.push('Nur wenige Wörter erkannt');
    }

    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    if (avgWordLength > 15) {
      score -= 20;
      issues.push('Ungewöhnlich lange "Wörter" – möglicherweise OCR-Fehler');
    }

    const lines = text.split(/\n/).filter(Boolean);
    if (lines.length > 20) {
      score -= 10;
      issues.push('Viele Zeilenumbrüche');
    }

    return { score: Math.max(0, score), issues };
  }
}
