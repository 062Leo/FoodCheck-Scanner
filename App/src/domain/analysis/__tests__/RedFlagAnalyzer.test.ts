import { RedFlagAnalyzer } from '../RedFlagAnalyzer';
import type { FilterRule } from '../../../types/FilterRule';
import type { RedFlagRule } from '../../rules/defaultRules';

describe('RedFlagAnalyzer', () => {
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

  let analyzer: RedFlagAnalyzer;

  beforeEach(() => {
    analyzer = new RedFlagAnalyzer();
  });

  it('should find single red flag in ingredient list', () => {
    const result = analyzer.analyze('Wasser, Zucker, Palmöl, Salz', mockRules);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      ingredient: 'Palmöl',
      category: 'Kritische Öle',
      severity: 'critical',
    });
  });

  it('should find multiple red flags in ingredient list', () => {
    const result = analyzer.analyze('Wasser, Glukosesirup, Palmöl, Natriumnitrit, Salz', mockRules);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.ingredient)).toEqual(['Glukosesirup', 'Palmöl', 'Natriumnitrit']);
  });

  it('should perform case-insensitive matching', () => {
    const result = analyzer.analyze('Wasser, PALMÖL, Salz', mockRules);
    expect(result).toHaveLength(1);
    expect(result[0].ingredient).toBe('PALMÖL');
  });

  it('should return empty array when no red flags are found', () => {
    const result = analyzer.analyze('Wasser, Zucker, Milch, Salz', mockRules);
    expect(result).toHaveLength(0);
  });

  it('should return empty array for empty or whitespace-only strings', () => {
    expect(analyzer.analyze('', mockRules)).toHaveLength(0);
    expect(analyzer.analyze('   ', mockRules)).toHaveLength(0);
    expect(analyzer.analyze('\n\t', mockRules)).toHaveLength(0);
  });

  it('should match substring within ingredient name', () => {
    const result = analyzer.analyze('Wasser, Glukosesirup mit Sorbitol, Salz', mockRules);
    expect(result).toHaveLength(1);
    expect(result[0].ingredient).toBe('Glukosesirup');
  });

  it('should preserve original casing in extracted ingredient', () => {
    const result = analyzer.analyze('Wasser, PalmÖl, Salz', mockRules);
    expect(result[0].ingredient).toBe('PalmÖl');
  });

  it('should not flag palmöl when a custom ok rule is provided', () => {
    const customRules: FilterRule[] = [
      {
        id: 1,
        type: 'ingredient',
        key: 'Palmöl',
        category: 'Kritische Öle',
        threshold: null,
        operator: null,
        severity: 'ok',
        created_at: '2026-05-09T10:00:00.000Z',
      },
    ];

    const result = analyzer.analyze('Wasser, Palmöl, Salz', [...mockRules, ...customRules]);

    expect(result).toHaveLength(0);
  });

  it('should flag zucker when a custom red_flag rule is provided', () => {
    const customRules: FilterRule[] = [
      {
        id: 2,
        type: 'ingredient',
        key: 'Zucker',
        category: 'Zucker & Sirupe',
        threshold: null,
        operator: null,
        severity: 'red_flag',
        created_at: '2026-05-09T10:00:00.000Z',
      },
    ];

    const result = analyzer.analyze('Wasser, Zucker, Salz', customRules);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ingredient: 'Zucker',
      category: 'Zucker & Sirupe',
      severity: 'critical',
    });
  });

  it('should flag sugars_100g when the value exceeds the threshold', () => {
    const nutrientRules: FilterRule[] = [
      {
        id: 3,
        type: 'nutrient',
        key: 'sugars_100g',
        category: 'Nährwerte',
        threshold: 3,
        operator: 'gt',
        severity: 'red_flag',
        created_at: '2026-05-09T10:00:00.000Z',
      },
    ];

    const result = analyzer.analyze('{"nutriments":{"sugars_100g":4.2}}', nutrientRules);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ingredient: 'sugars_100g',
      category: 'Nährwerte',
      severity: 'critical',
    });
  });

  describe('analyzeTaxonomy', () => {
    it('should detect high-risk additives like Natriumnitrit (E250)', () => {
      const result = analyzer.analyzeTaxonomy('Schweinefleisch, Speck, Natriumnitrit, Gewürze');
      const nitrit = result.find((f) => f.ingredient.includes('Natriumnitrit'));
      expect(nitrit).toBeDefined();
      expect(nitrit!.severity).toBe('critical');
    });

    it('should detect medium-risk additives like Mononatriumglutamat (E621)', () => {
      const result = analyzer.analyzeTaxonomy(
        'Zucker, Geschmacksverstärker (Mononatriumglutamat, E631)'
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      const msg = result.find(
        (f) => f.ingredient.includes('Mononatriumglutamat') || f.ingredient.includes('E621')
      );
      expect(msg).toBeDefined();
    });

    it('should detect E-numbers in parentheses', () => {
      const result = analyzer.analyzeTaxonomy(
        'Wasser, Farbstoff (E102), Konservierungsstoff (E250)'
      );
      expect(result.length).toBeGreaterThanOrEqual(2);
      const e102 = result.find((f) => f.ingredient.includes('E102'));
      const e250 = result.find((f) => f.ingredient.includes('E250'));
      expect(e102).toBeDefined();
      expect(e250).toBeDefined();
    });

    it('should not flag low-risk additives', () => {
      const result = analyzer.analyzeTaxonomy('Zucker, Säuerungsmittel Citronensäure, Aroma');
      const citric = result.find((f) => f.ingredient.includes('Citronensäure'));
      expect(citric).toBeUndefined();
    });

    it('should categorize by function class', () => {
      const result = analyzer.analyzeTaxonomy('Farbstoff (E102), Konservierungsstoff (E250)');
      const e102 = result.find((f) => f.ingredient.includes('E102'));
      const e250 = result.find((f) => f.ingredient.includes('E250'));
      expect(e102!.category).toBe('Farbstoff');
      expect(e250!.category).toBe('Konservierungsstoff');
    });

    it('should use critical severity for high-risk additives', () => {
      const result = analyzer.analyzeTaxonomy('Natriumnitrit');
      expect(result[0].severity).toBe('critical');
    });

    it('should use warning severity for medium-risk additives', () => {
      const result = analyzer.analyzeTaxonomy('Süßungsmittel (Aspartam)');
      const aspartam = result.find((f) => f.ingredient.includes('Aspartam'));
      expect(aspartam).toBeDefined();
      expect(aspartam!.severity).toBe('warning');
    });

    it('should deduplicate same E-number', () => {
      const result = analyzer.analyzeTaxonomy('Konservierungsstoff: E250, E 250');
      const e250Flags = result.filter((f) => f.ingredient.includes('E250'));
      expect(e250Flags).toHaveLength(1);
    });

    it('should return empty array for text without additives', () => {
      const result = analyzer.analyzeTaxonomy('Zucker, Mehl, Wasser, Salz');
      expect(result).toEqual([]);
    });

    it('should return empty array for empty text', () => {
      expect(analyzer.analyzeTaxonomy('')).toEqual([]);
    });

    it('should detect Aspartam (E951) as medium-risk sweetener', () => {
      const result = analyzer.analyzeTaxonomy('Süßungsmittel Aspartam');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].category).toBe('Süßungsmittel');
    });

    it('should detect Titanium Dioxid (E171) as high-risk color', () => {
      const result = analyzer.analyzeTaxonomy('Farbstoff Titandioxid');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].severity).toBe('critical');
    });
  });
});
