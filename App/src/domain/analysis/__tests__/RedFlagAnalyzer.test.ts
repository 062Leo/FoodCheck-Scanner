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
      category: 'Zucker',
      severity: 'critical',
    });
  });

  it('should flag sugars_100g when the value exceeds the threshold', () => {
    const nutrientRules: FilterRule[] = [
      {
        id: 3,
        type: 'nutrient',
        key: 'sugars_100g',
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
      category: 'sugars_100g',
      severity: 'critical',
    });
  });
});
