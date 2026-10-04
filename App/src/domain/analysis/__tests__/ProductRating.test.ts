import { ProductRating } from '../ProductRating';
import { RedFlagAnalyzer } from '../RedFlagAnalyzer';
import { NovaScoreEvaluator } from '../NovaScoreEvaluator';
import type { Product } from '../../../types/Product';
import type { FilterRule } from '../../../types/FilterRule';
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
    expect(result.nova.score).toBeUndefined();
    expect(result.nova.label).toBe('Unbekannt');
    expect(result.reasons).toEqual([{ code: 'noFindings' }]);
  });

  it('rates a product without ingredients and without NOVA as Unknown', () => {
    const result = rater.rate({ ean: '123456', name: 'Leer' });

    expect(result.status).toBe('Unknown');
    expect(result.reasons).toEqual([{ code: 'insufficientData' }]);
  });

  it('rates by NOVA alone and says the ingredient list is missing', () => {
    const result = rater.rate({ ean: '123456', name: 'Nur NOVA', novaScore: 4 });

    expect(result.status).toBe('Critical');
    expect(result.reasons).toEqual([{ code: 'nova', nova: 4 }, { code: 'ingredientsMissing' }]);
  });

  it('explains a critical rating by NOVA and red flag count', () => {
    const result = rater.rate({
      ean: '123456',
      name: 'Riegel',
      ingredientsText: 'Palmöl, Glukosesirup',
      novaScore: 4,
    });

    expect(result.reasons).toEqual([
      { code: 'nova', nova: 4 },
      { code: 'redFlags', count: 2 },
    ]);
  });

  it('ignores an invalid NOVA value', () => {
    const product = { ean: '1', name: 'x', ingredientsText: 'Wasser', novaScore: 7 } as never;
    expect(rater.rate(product).nova.score).toBeUndefined();
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

  describe('with product checks and avoided companies', () => {
    const rule = (type: FilterRule['type'], key: string, category: string): FilterRule => ({
      id: 1,
      type,
      key,
      category,
      threshold: null,
      operator: null,
      severity: 'red_flag',
      translations: null,
      created_at: '2026-01-01T00:00:00.000Z',
    });
    const palmOil = rule('ingredient', 'Palmöl', 'Kritische Öle');
    const canned = rule('check', 'canned', 'Verpackung');
    const alcoholic = rule('check', 'alcoholic', 'Alkohol');
    const tuna = rule('check', 'mercury_fish', 'Schadstoffe');
    const nestle = rule('company', 'Nestlé', 'Marken & Konzerne');

    it('counts check findings as red flags', () => {
      const product: Product = {
        ean: '1',
        name: 'Thunfisch in Öl',
        ingredientsText: 'Thunfisch, Palmöl, Salz',
        packagingTags: ['en:can'],
      };

      const result = rater.rate(product, [palmOil, canned, tuna]);

      expect(result.status).toBe('Critical');
      expect(result.redFlags.map((f) => f.check?.key ?? f.ingredient)).toEqual([
        'Palmöl',
        'canned',
        'mercury_fish',
      ]);
      expect(result.reasons).toEqual([{ code: 'redFlags', count: 3 }]);
    });

    it('rates a single check finding as a warning', () => {
      const product: Product = { ean: '1', name: 'Mais', ingredientsText: 'Mais, Wasser' };

      const result = rater.rate({ ...product, packagingTags: ['en:can'] }, [canned]);

      expect(result.status).toBe('Warning');
      expect(rater.rate(product, [canned]).status).toBe('OK');
    });

    it('rates a product of an avoided company as critical', () => {
      const product: Product = {
        ean: '1',
        name: 'Suppe',
        brand: 'Nestlé Deutschland AG',
        ingredientsText: 'Wasser, Karotten',
        novaScore: 1,
      };

      const result = rater.rate(product, [nestle]);

      expect(result.status).toBe('Critical');
      expect(result.reasons).toEqual([{ code: 'avoidedCompany', company: 'Nestlé' }]);
      expect(result.redFlags).toEqual([
        expect.objectContaining({
          company: { name: 'Nestlé', matched: 'Nestlé Deutschland AG' },
        }),
      ]);
    });

    it('rates a product without ingredients by its category checks instead of Unknown', () => {
      const product: Product = {
        ean: '1',
        name: 'Bier',
        categoriesTags: ['en:alcoholic-beverages'],
      };

      const result = rater.rate(product, [alcoholic]);

      expect(result.status).toBe('Warning');
      expect(result.reasons).toEqual([
        { code: 'redFlags', count: 1 },
        { code: 'ingredientsMissing' },
      ]);
    });

    it('rates a product without ingredients of an avoided company as critical', () => {
      const result = rater.rate({ ean: '1', name: 'Riegel', brand: 'Nestlé' }, [nestle]);

      expect(result.status).toBe('Critical');
      expect(result.reasons).toEqual([
        { code: 'avoidedCompany', company: 'Nestlé' },
        { code: 'ingredientsMissing' },
      ]);
    });

    it('stays Unknown without ingredients when no check applies', () => {
      const result = rater.rate({ ean: '1', name: 'Leer' }, [canned, alcoholic, nestle]);

      expect(result.status).toBe('Unknown');
    });

    it('does not match check or company rules against the ingredient text', () => {
      const product: Product = {
        ean: '1',
        name: 'Test',
        ingredientsText: 'Wasser, canned, Nestlé',
      };

      const result = rater.rate(product, [canned, nestle]);

      expect(result.status).toBe('OK');
      expect(result.redFlags).toEqual([]);
    });
  });
});
