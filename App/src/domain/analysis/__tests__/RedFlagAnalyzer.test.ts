import { RedFlagAnalyzer } from '../RedFlagAnalyzer';
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
    analyzer = new RedFlagAnalyzer(mockRules);
  });

  it('should find single red flag in ingredient list', () => {
    const result = analyzer.analyze('Wasser, Zucker, Palmöl, Salz');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      ingredient: 'Palmöl',
      category: 'Kritische Öle',
      severity: 'critical',
    });
  });

  it('should find multiple red flags in ingredient list', () => {
    const result = analyzer.analyze('Wasser, Glukosesirup, Palmöl, Natriumnitrit, Salz');
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.ingredient)).toEqual(['Glukosesirup', 'Palmöl', 'Natriumnitrit']);
  });

  it('should perform case-insensitive matching', () => {
    const result = analyzer.analyze('Wasser, PALMÖL, Salz');
    expect(result).toHaveLength(1);
    expect(result[0].ingredient).toBe('PALMÖL');
  });

  it('should return empty array when no red flags are found', () => {
    const result = analyzer.analyze('Wasser, Zucker, Milch, Salz');
    expect(result).toHaveLength(0);
  });

  it('should return empty array for empty or whitespace-only strings', () => {
    expect(analyzer.analyze('')).toHaveLength(0);
    expect(analyzer.analyze('   ')).toHaveLength(0);
    expect(analyzer.analyze('\n\t')).toHaveLength(0);
  });

  it('should match substring within ingredient name', () => {
    const result = analyzer.analyze('Wasser, Glukosesirup mit Sorbitol, Salz');
    expect(result).toHaveLength(1);
    expect(result[0].ingredient).toBe('Glukosesirup');
  });

  it('should preserve original casing in extracted ingredient', () => {
    const result = analyzer.analyze('Wasser, PalmÖl, Salz');
    expect(result[0].ingredient).toBe('PalmÖl');
  });
});
