import { ProductRating } from '../ProductRating';
import { RedFlagAnalyzer } from '../RedFlagAnalyzer';
import { NovaScoreEvaluator } from '../NovaScoreEvaluator';
import type { Product } from '../../../types/Product';
import type { RedFlagRule } from '../../rules/defaultRules';

describe('ProductRating', () => {
  const mockRules: RedFlagRule[] = [
    {
      searchTerm: 'Palmöl',
      category: 'Kritische Öle',
      severity: 'critical',
    },
    {
      searchTerm: 'Glukosesirup',
      category: 'Zucker',
      severity: 'warning',
    },
    {
      searchTerm: 'Natriumnitrit',
      category: 'Konservierungsstoffe',
      severity: 'critical',
    },
  ];

  let rater: ProductRating;
  let analyzer: RedFlagAnalyzer;
  let evaluator: NovaScoreEvaluator;

  beforeEach(() => {
    analyzer = new RedFlagAnalyzer(mockRules);
    evaluator = new NovaScoreEvaluator();
    rater = new ProductRating(analyzer, evaluator);
  });

  it('should return OK status for product with no red flags and Nova 1', () => {
    const product: Product = {
      ean: '123456',
      name: 'Wasser',
      ingredientsText: 'Wasser',
      novaScore: 1,
    };

    const result = rater.rate(product);

    expect(result.status).toBe('OK');
    expect(result.redFlags).toHaveLength(0);
    expect(result.nova.score).toBe(1);
  });

  it('should return OK status for product with no red flags and Nova 2', () => {
    const product: Product = {
      ean: '123456',
      name: 'Saft',
      ingredientsText: 'Wasser, Zucker, Zitrone',
      novaScore: 2,
    };

    const result = rater.rate(product);

    expect(result.status).toBe('OK');
    expect(result.redFlags).toHaveLength(0);
  });

  it('should return Warning status for product with 1 red flag', () => {
    const product: Product = {
      ean: '123456',
      name: 'Öl',
      ingredientsText: 'Palmöl, Wasser',
      novaScore: 1,
    };

    const result = rater.rate(product);

    expect(result.status).toBe('Warning');
    expect(result.redFlags).toHaveLength(1);
  });

  it('should return Warning status for product with 2 red flags', () => {
    const product: Product = {
      ean: '123456',
      name: 'Süßstoff',
      ingredientsText: 'Palmöl, Glukosesirup, Wasser',
      novaScore: 1,
    };

    const result = rater.rate(product);

    expect(result.status).toBe('Warning');
    expect(result.redFlags).toHaveLength(2);
  });

  it('should return Warning status for product with Nova 3 despite no red flags', () => {
    const product: Product = {
      ean: '123456',
      name: 'Saft',
      ingredientsText: 'Wasser, Zucker',
      novaScore: 3,
    };

    const result = rater.rate(product);

    expect(result.status).toBe('Warning');
    expect(result.redFlags).toHaveLength(0);
  });

  it('should return Critical status for product with 3 red flags', () => {
    const product: Product = {
      ean: '123456',
      name: 'Verarbeitetes Produkt',
      ingredientsText: 'Palmöl, Glukosesirup, Natriumnitrit, Wasser',
      novaScore: 1,
    };

    const result = rater.rate(product);

    expect(result.status).toBe('Critical');
    expect(result.redFlags).toHaveLength(3);
  });

  it('should return Critical status for product with Nova 4 despite no red flags', () => {
    const product: Product = {
      ean: '123456',
      name: 'Ultra-Verarbeitetes Produkt',
      ingredientsText: 'Wasser, Zucker, Salz',
      novaScore: 4,
    };

    const result = rater.rate(product);

    expect(result.status).toBe('Critical');
    expect(result.redFlags).toHaveLength(0);
  });

  it('should handle product with missing ingredients text', () => {
    const product: Product = {
      ean: '123456',
      name: 'Unbekanntes Produkt',
      novaScore: 2,
    };

    const result = rater.rate(product);

    expect(result.status).toBe('OK');
    expect(result.redFlags).toHaveLength(0);
  });

  it('should handle product with missing Nova score', () => {
    const product: Product = {
      ean: '123456',
      name: 'Wasser',
      ingredientsText: 'Wasser',
    };

    const result = rater.rate(product);

    expect(result.status).toBe('OK');
    expect(result.nova.score).toBe(1);
    expect(result.nova.label).toBe('Minimal verarbeitet');
  });

  it('should include Nova label in result', () => {
    const product: Product = {
      ean: '123456',
      name: 'Süßes Produkt',
      ingredientsText: 'Wasser, Zucker',
      novaScore: 3,
    };

    const result = rater.rate(product);

    expect(result.nova.label).toBe('Mäßig verarbeitet');
  });
});
