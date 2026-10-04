import type { FilterRule } from '../../../types/FilterRule';
import type { Product } from '../../../types/Product';
import { ProductRating } from '../ProductRating';
import { RedFlagAnalyzer } from '../RedFlagAnalyzer';
import { NovaScoreEvaluator } from '../NovaScoreEvaluator';
import {
  findProductRuleMatches,
  parseProductRuleData,
  PRODUCT_RULE_CATEGORY,
  type ProductRuleData,
} from '../productRules';

const SOURCE = { title: 'Utopia', url: 'https://utopia.de/news/x', date: '2026-08-05' };

function productRule(
  key: string,
  data: Partial<ProductRuleData> & { brand: string },
  severity: FilterRule['severity'] = 'red_flag'
): FilterRule {
  return {
    id: 1,
    type: 'product',
    key,
    category: PRODUCT_RULE_CATEGORY,
    threshold: null,
    operator: null,
    severity,
    translations: JSON.stringify({
      nameWords: [],
      waterOnly: true,
      reason: { de: 'Grund', en: 'Reason' },
      sources: [SOURCE],
      ...data,
    }),
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

const WATER = ['en:beverages', 'en:waters', 'en:natural-mineral-waters'];

function water(fields: Partial<Product>): Product {
  return { ean: '4000000000000', name: 'Wasser', categoriesTags: WATER, ...fields };
}

const naturalis = productRule('Naturalis Medium', { brand: 'Naturalis', nameWords: ['Medium'] });
const gutGuenstig = productRule('Gut & Günstig Mineralwasser', {
  brand: 'Gut & Günstig',
  nameWords: ['Mineralwasser'],
});
const volvic = productRule('Volvic', { brand: 'Volvic' });
const reinbeker = productRule('Reinbeker Klosterquelle Frische Brise', {
  brand: 'Reinbeker Klosterquelle',
  nameWords: ['Frische Brise'],
});

describe('findProductRuleMatches', () => {
  it('matches brand and every name word, and reports reason and sources', () => {
    const findings = findProductRuleMatches(
      water({ brand: 'Naturalis', name: 'Naturalis Mineralwasser Medium' }),
      [naturalis]
    );

    expect(findings).toEqual([
      {
        ingredient: 'Naturalis Medium',
        category: PRODUCT_RULE_CATEGORY,
        severity: 'critical',
        productRule: {
          name: 'Naturalis Medium',
          reason: { de: 'Grund', en: 'Reason' },
          sources: [SOURCE],
        },
      },
    ]);
  });

  it('does not match another variant of the brand', () => {
    expect(
      findProductRuleMatches(water({ brand: 'Naturalis', name: 'Naturalis Classic' }), [naturalis])
    ).toEqual([]);
    expect(
      findProductRuleMatches(water({ brand: 'Naturalis', name: 'Naturalis Mediumfein' }), [
        naturalis,
      ])
    ).toEqual([]);
  });

  it('ignores accents, case, spacing and the ampersand', () => {
    const variants = ['Gut & Günstig', 'gut&gunstig', 'GUT & GÜNSTIG, Edeka', 'Gut und Günstig'];
    const hits = variants.map(
      (brand) =>
        findProductRuleMatches(water({ brand, name: 'Natürliches MINERALWASSER still' }), [
          gutGuenstig,
        ]).length
    );
    // "und" is a different word than "&", so only the first three match.
    expect(hits).toEqual([1, 1, 1, 0]);
  });

  it('matches the brand owner and the brand as consecutive words', () => {
    expect(
      findProductRuleMatches(
        water({ brandOwner: 'Reinbeker Klosterquelle GmbH', name: 'Frische Brise Still' }),
        [reinbeker]
      )
    ).toHaveLength(1);
    expect(
      findProductRuleMatches(water({ brand: 'Klosterquelle Reinbeker', name: 'Frische Brise' }), [
        reinbeker,
      ])
    ).toEqual([]);
    expect(
      findProductRuleMatches(water({ brand: 'Reinbeker Klosterquelle', name: 'FrischeBrise' }), [
        reinbeker,
      ])
    ).toHaveLength(1);
  });

  it('matches a whole brand without name words', () => {
    expect(
      findProductRuleMatches(water({ brand: 'Volvic', name: 'Volvic Naturelle' }), [volvic])
    ).toHaveLength(1);
    expect(
      findProductRuleMatches(water({ brand: 'Hépar' }), [productRule('Hépar', { brand: 'Hepar' })])
    ).toHaveLength(1);
  });

  it('only matches waters when the rule is limited to waters', () => {
    const chips: Product = {
      ean: '1',
      name: 'Mineralwasser Chips',
      brand: 'Gut & Günstig',
      categoriesTags: ['en:snacks'],
    };
    const juice: Product = { ean: '2', name: 'Volvic Juicy', brand: 'Volvic' };

    expect(findProductRuleMatches(chips, [gutGuenstig])).toEqual([]);
    expect(findProductRuleMatches({ ...chips, name: 'Gouda' }, [gutGuenstig])).toEqual([]);
    expect(findProductRuleMatches(juice, [volvic])).toEqual([]);
    const anyProduct = productRule('Volvic', { brand: 'Volvic', waterOnly: false });
    expect(findProductRuleMatches(juice, [anyProduct])).toHaveLength(1);
  });

  it('skips switched-off rules, other rule types and broken data', () => {
    const product = water({ brand: 'Volvic' });
    const broken = { ...volvic, translations: 'not json' };
    const company = { ...volvic, type: 'company' as const };

    expect(
      findProductRuleMatches(product, [productRule('Volvic', { brand: 'Volvic' }, 'ok')])
    ).toEqual([]);
    expect(findProductRuleMatches(product, [broken, company])).toEqual([]);
  });
});

describe('parseProductRuleData', () => {
  it('accepts a single source object as well as a list', () => {
    const data = parseProductRuleData(
      JSON.stringify({ brand: 'Volvic', source: SOURCE, reason: { de: 'a', en: 'b' } })
    );

    expect(data).toEqual({
      brand: 'Volvic',
      nameWords: [],
      waterOnly: false,
      reason: { de: 'a', en: 'b' },
      sources: [SOURCE],
    });
    expect(parseProductRuleData(JSON.stringify({ nameWords: ['x'] }))).toBeNull();
    expect(parseProductRuleData(null)).toBeNull();
  });
});

describe('ProductRating with product rules', () => {
  const rater = new ProductRating(new RedFlagAnalyzer(), new NovaScoreEvaluator());

  it('counts a match as one red flag, not as critical on its own', () => {
    const result = rater.rate(
      water({ brand: 'Volvic', name: 'Volvic', ingredientsText: 'Natürliches Mineralwasser' }),
      [volvic]
    );

    expect(result.status).toBe('Warning');
    expect(result.reasons).toEqual([{ code: 'redFlags', count: 1 }]);
  });

  it('does not match product rules against the ingredient text', () => {
    const result = rater.rate({ ean: '1', name: 'Test', ingredientsText: 'Wasser, Volvic' }, [
      volvic,
    ]);

    expect(result.redFlags).toEqual([]);
  });
});
