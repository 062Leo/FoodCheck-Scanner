import {
  getNutriScoreLabel,
  getNovaGroupLabel,
  getEcoScoreLabel,
  canComputeNutriScore,
} from '../ScoreLabels';
import type { Product } from '../../../types/Product';

describe('getNutriScoreLabel', () => {
  it('should map a to label', () => {
    expect(getNutriScoreLabel('a')).toBe('A – Very good');
  });
  it('should map b to label', () => {
    expect(getNutriScoreLabel('b')).toBe('B – Good');
  });
  it('should map c to label', () => {
    expect(getNutriScoreLabel('c')).toBe('C – Average');
  });
  it('should map d to label', () => {
    expect(getNutriScoreLabel('d')).toBe('D – Poor');
  });
  it('should map e to label', () => {
    expect(getNutriScoreLabel('e')).toBe('E – Bad');
  });
  it('should handle uppercase', () => {
    expect(getNutriScoreLabel('A')).toBe('A – Very good');
  });
  it('should return Not available for null', () => {
    expect(getNutriScoreLabel(null)).toBe('Not available');
  });
  it('should return Not available for undefined', () => {
    expect(getNutriScoreLabel(undefined)).toBe('Not available');
  });
  it('should return Not available for empty string', () => {
    expect(getNutriScoreLabel('')).toBe('Not available');
  });
  it('should return Not available for invalid grade', () => {
    expect(getNutriScoreLabel('x')).toBe('Not available');
  });
});

describe('getNovaGroupLabel', () => {
  it('should map 1', () => {
    expect(getNovaGroupLabel(1)).toBe('Unprocessed / Minimally processed');
  });
  it('should map 2', () => {
    expect(getNovaGroupLabel(2)).toBe('Processed culinary ingredients');
  });
  it('should map 3', () => {
    expect(getNovaGroupLabel(3)).toBe('Processed foods');
  });
  it('should map 4', () => {
    expect(getNovaGroupLabel(4)).toBe('Ultra-processed food products');
  });
  it('should return Not available for null', () => {
    expect(getNovaGroupLabel(null)).toBe('Not available');
  });
  it('should return Not available for undefined', () => {
    expect(getNovaGroupLabel(undefined)).toBe('Not available');
  });
  it('should return Not available for invalid value', () => {
    expect(getNovaGroupLabel(5)).toBe('Not available');
  });
});

describe('getEcoScoreLabel', () => {
  it('should map a', () => {
    expect(getEcoScoreLabel('a')).toBe('A – Very low impact');
  });
  it('should map e', () => {
    expect(getEcoScoreLabel('e')).toBe('E – Very high impact');
  });
  it('should return Not available for null', () => {
    expect(getEcoScoreLabel(null)).toBe('Not available');
  });
  it('should return Not available for undefined', () => {
    expect(getEcoScoreLabel(undefined)).toBe('Not available');
  });
});

describe('canComputeNutriScore', () => {
  function makeProduct(miscTags?: string[]): Product {
    return { ean: '123', name: 'Test', miscTags };
  }

  it('should return false when miscTags is undefined', () => {
    expect(canComputeNutriScore(makeProduct())).toBe(false);
  });

  it('should return false when miscTags contains nutriscore-not-computed', () => {
    expect(canComputeNutriScore(makeProduct(['en:nutriscore-not-computed', 'en:organic']))).toBe(
      false
    );
  });

  it('should return true when miscTags does NOT contain nutriscore-not-computed', () => {
    expect(canComputeNutriScore(makeProduct(['en:nutriscore-computed', 'en:organic']))).toBe(true);
  });

  it('should return true for empty miscTags', () => {
    expect(canComputeNutriScore(makeProduct([]))).toBe(true);
  });
});
