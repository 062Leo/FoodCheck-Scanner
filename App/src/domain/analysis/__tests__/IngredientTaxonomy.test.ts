import { IngredientTaxonomy } from '../IngredientTaxonomy';
import type { AdditiveInfo } from '../AdditiveTaxonomyTypes';

describe('IngredientTaxonomy', () => {
  const testTaxonomy: AdditiveInfo[] = [
    {
      eNumber: 'E330',
      name: 'Citronensäure',
      functionClass: 'Säuerungsmittel',
      riskLevel: 'none',
      aliases: ['Zitronensäure', 'E 330'],
    },
    {
      eNumber: 'E250',
      name: 'Natriumnitrit',
      functionClass: 'Konservierungsstoff',
      riskLevel: 'high',
      aliases: ['Natriumnitrit', 'E 250'],
    },
    {
      eNumber: 'E621',
      name: 'Mononatriumglutamat',
      functionClass: 'Geschmacksverstärker',
      riskLevel: 'medium',
      aliases: ['MSG', 'Glutamat', 'E 621'],
    },
    {
      eNumber: 'E407',
      name: 'Carrageen',
      functionClass: 'Verdickungsmittel',
      riskLevel: 'medium',
      aliases: ['Carrageenan', 'Carrageenan', 'E 407'],
    },
  ];

  let taxonomy: IngredientTaxonomy;

  beforeEach(() => {
    taxonomy = new IngredientTaxonomy(testTaxonomy);
  });

  describe('findByENumber', () => {
    it('should find additive by E-number', () => {
      const result = taxonomy.findByENumber('E330');
      expect(result).toBeDefined();
      expect(result!.name).toBe('Citronensäure');
    });

    it('should find additive with space in E-number', () => {
      const result = taxonomy.findByENumber('E 250');
      expect(result).toBeDefined();
      expect(result!.name).toBe('Natriumnitrit');
    });

    it('should return undefined for unknown E-number', () => {
      const result = taxonomy.findByENumber('E9999');
      expect(result).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      const result = taxonomy.findByENumber('e330');
      expect(result).toBeDefined();
    });
  });

  describe('findByText', () => {
    it('should find by alias', () => {
      const result = taxonomy.findByText('MSG');
      expect(result).toBeDefined();
      expect(result!.eNumber).toBe('E621');
    });

    it('should find by German name', () => {
      const result = taxonomy.findByText('Citronensäure');
      expect(result).toBeDefined();
    });

    it('should find by E-number in text', () => {
      const result = taxonomy.findByText('E250');
      expect(result).toBeDefined();
      expect(result!.riskLevel).toBe('high');
    });

    it('should return undefined for unknown text', () => {
      const result = taxonomy.findByText('Zucker');
      expect(result).toBeUndefined();
    });
  });

  describe('findByFunctionClass', () => {
    it('should find additives by function class', () => {
      const result = taxonomy.findByFunctionClass('Konservierungsstoff');
      expect(result).toHaveLength(1);
      expect(result[0].eNumber).toBe('E250');
    });
  });

  describe('getHighRiskAdditives', () => {
    it('should return only high-risk additives', () => {
      const result = taxonomy.getHighRiskAdditives();
      expect(result).toHaveLength(1);
      expect(result[0].eNumber).toBe('E250');
    });
  });

  describe('getByRiskLevel', () => {
    it('should filter by medium risk', () => {
      const result = taxonomy.getByRiskLevel('medium');
      expect(result).toHaveLength(2);
      const eNumbers = result.map((r) => r.eNumber);
      expect(eNumbers).toContain('E621');
      expect(eNumbers).toContain('E407');
    });
  });

  describe('normalizeENumber', () => {
    it('should normalize various E-number formats', () => {
      expect(taxonomy.normalizeENumber('e330')).toBe('E330');
      expect(taxonomy.normalizeENumber('E 330')).toBe('E330');
      expect(taxonomy.normalizeENumber('e 330')).toBe('E330');
      expect(taxonomy.normalizeENumber('E330a')).toBe('E330A');
      expect(taxonomy.normalizeENumber('E 330 A')).toBe('E330A');
    });
  });

  describe('extractENumberPattern', () => {
    it('should extract E-number from text patterns', () => {
      expect(taxonomy.extractENumberPattern('E 621 Test')).toBe('E621');
      expect(taxonomy.extractENumberPattern('e250')).toBe('E250');
    });

    it('should return undefined when no E-number found', () => {
      expect(taxonomy.extractENumberPattern('Zucker')).toBeUndefined();
    });
  });

  describe('getAllFunctionClasses', () => {
    it('should return sorted unique function classes', () => {
      const classes = taxonomy.getAllFunctionClasses();
      expect(classes).toContain('Konservierungsstoff');
      expect(classes).toContain('Säuerungsmittel');
      expect(classes).toContain('Geschmacksverstärker');
      expect(classes).toContain('Verdickungsmittel');
    });
  });
});
