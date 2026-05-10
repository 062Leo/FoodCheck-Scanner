import { OcrService, OcrError } from '../OcrService';

// Mock @react-native-ml-kit/text-recognition
jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: {
    recognize: jest.fn(),
  },
  TextRecognitionScript: {
    LATIN: 'LATIN',
    CHINESE: 'CHINESE',
    DEVANAGARI: 'DEVANAGARI',
    JAPANESE: 'JAPANESE',
    KOREAN: 'KOREAN',
  },
}));

import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';

describe('OcrService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recognizeText', () => {
    it('should return non-empty string for valid image', async () => {
      const mockText = 'Sample recognized text from image';
      (TextRecognition.recognize as jest.Mock).mockResolvedValue({ text: mockText });

      const result = await OcrService.recognizeText('file:///path/to/image.jpg');

      expect(result).toBe(mockText);
      expect(result.length).toBeGreaterThan(0);
      expect(TextRecognition.recognize).toHaveBeenCalledTimes(1);
      expect(TextRecognition.recognize).toHaveBeenCalledWith(
        'file:///path/to/image.jpg',
        TextRecognitionScript.LATIN
      );
    });

    it('should run only selected script when provided', async () => {
      (TextRecognition.recognize as jest.Mock).mockResolvedValue({ text: 'Greek-like text' });

      const result = await OcrService.recognizeText(
        'file:///path/to/image.jpg',
        TextRecognitionScript.JAPANESE
      );

      expect(result).toBe('Greek-like text');
      expect(TextRecognition.recognize).toHaveBeenCalledTimes(1);
      expect(TextRecognition.recognize).toHaveBeenCalledWith(
        'file:///path/to/image.jpg',
        TextRecognitionScript.JAPANESE
      );
    });

    it('should throw OcrError if recognition fails', async () => {
      const testError = new Error('ML Kit error');
      (TextRecognition.recognize as jest.Mock).mockRejectedValue(testError);

      await expect(OcrService.recognizeText('file:///path/to/image.jpg')).rejects.toThrow(OcrError);
      await expect(OcrService.recognizeText('file:///path/to/image.jpg')).rejects.toThrow(
        /Failed to recognize text/
      );
    });

    it('should throw OcrError if no text recognized', async () => {
      (TextRecognition.recognize as jest.Mock).mockResolvedValue({ text: '' });

      await expect(OcrService.recognizeText('file:///path/to/image.jpg')).rejects.toThrow(OcrError);
      await expect(OcrService.recognizeText('file:///path/to/image.jpg')).rejects.toThrow(
        /No text recognized/
      );
    });
  });

  describe('parseNutriments', () => {
    it('should parse German nutrient labels correctly', () => {
      const germanText = `
        Nährwertangaben pro 100g
        Energie: 523 kJ (125 kcal)
        Fett: 8g
        - davon gesättigte Fettsäuren: 2g
        Kohlenhydrate: 12g
        - davon Zucker: 5g
        Ballaststoffe: 1.5g
        Eiweiß: 3g
        Salz: 0.5g
      `;

      const result = OcrService.parseNutriments(germanText);

      expect(result.energyKcal100g).toBeDefined();
      expect(result.fat100g).toBe(8);
      expect(result.saturatedFat100g).toBe(2);
      expect(result.carbohydrates100g).toBe(12);
      expect(result.sugars100g).toBe(5);
      expect(result.fiber100g).toBe(1.5);
      expect(result.proteins100g).toBe(3);
      expect(result.salt100g).toBe(0.5);
    });

    it('should handle comma decimal separator', () => {
      const text = `
        Fett: 8,5g
        Zucker: 2,3g
        Salz: 0,7g
      `;

      const result = OcrService.parseNutriments(text);

      expect(result.fat100g).toBe(8.5);
      expect(result.sugars100g).toBe(2.3);
      expect(result.salt100g).toBe(0.7);
    });

    it('should return empty object for garbage text', () => {
      const garbageText = 'This is just random text without any nutrient information';

      const result = OcrService.parseNutriments(garbageText);

      expect(result).toEqual({});
    });

    it('should return empty object for empty string', () => {
      const result = OcrService.parseNutriments('');

      expect(result).toEqual({});
    });

    it('should return partial results for incomplete nutrient labels', () => {
      const partialText = `
        Fett: 10g
        Zucker: 3g
      `;

      const result = OcrService.parseNutriments(partialText);

      expect(result.fat100g).toBe(10);
      expect(result.sugars100g).toBe(3);
      expect(result.energyKcal100g).toBeUndefined();
      expect(result.proteins100g).toBeUndefined();
    });

    it('should handle case-insensitive matching', () => {
      const mixedCaseText = `
        FETT: 7g
        eiweiß: 4g
        ZUCKER: 2g
      `;

      const result = OcrService.parseNutriments(mixedCaseText);

      expect(result.fat100g).toBe(7);
      expect(result.proteins100g).toBe(4);
      expect(result.sugars100g).toBe(2);
    });

    it('should never throw on unparseable text', () => {
      expect(() => {
        OcrService.parseNutriments('Random gibberish 🍕 🥗 @#$%^&*()');
      }).not.toThrow();

      expect(() => {
        OcrService.parseNutriments(null as any);
      }).not.toThrow();

      expect(() => {
        OcrService.parseNutriments(undefined as any);
      }).not.toThrow();
    });

    it('should convert kJ energy to kcal', () => {
      const text = 'Energie: 523 kJ';

      const result = OcrService.parseNutriments(text);

      // 523 kJ / 4.184 ≈ 125 kcal
      expect(result.energyKcal100g).toBeCloseTo(125, 0);
    });

    it('should prefer kcal if both units present', () => {
      const text = 'Energie: 500 kcal (2092 kJ)';

      const result = OcrService.parseNutriments(text);

      // Should extract the kcal value (500)
      expect(result.energyKcal100g).toBeDefined();
    });
  });
});
