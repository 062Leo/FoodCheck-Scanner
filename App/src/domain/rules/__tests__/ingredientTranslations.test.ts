import {
  findEnglishKey,
  getIngredientTranslation,
  getAllSearchTerms,
} from '../ingredientTranslations';

describe('ingredientTranslations', () => {
  describe('findEnglishKey', () => {
    it('should return English key for German input', () => {
      expect(findEnglishKey('Palmöl')).toBe('Palm Oil');
    });

    it('should return English key for French input', () => {
      expect(findEnglishKey('Huile de palme')).toBe('Palm Oil');
    });

    it('should return English key for Spanish input', () => {
      expect(findEnglishKey('Azúcar')).toBe('Sugar');
    });

    it('should return English key when input is already English', () => {
      expect(findEnglishKey('Palm Oil')).toBe('Palm Oil');
    });

    it('should be case-insensitive', () => {
      expect(findEnglishKey('palmöl')).toBe('Palm Oil');
      expect(findEnglishKey('PALMÖL')).toBe('Palm Oil');
    });

    it('should trim whitespace', () => {
      expect(findEnglishKey('  Palmöl  ')).toBe('Palm Oil');
    });

    it('should return original input for unknown terms', () => {
      expect(findEnglishKey('UnbekanntesZeug')).toBe('UnbekanntesZeug');
    });

    it('should return empty string for empty input', () => {
      expect(findEnglishKey('')).toBe('');
      expect(findEnglishKey('   ')).toBe('');
    });

    it('should match Polish translations', () => {
      expect(findEnglishKey('Cukier')).toBe('Sugar');
      expect(findEnglishKey('Olej palmowy')).toBe('Palm Oil');
    });

    it('should match Italian translations', () => {
      expect(findEnglishKey('Olio di palma')).toBe('Palm Oil');
    });
  });

  describe('getIngredientTranslation', () => {
    it('should return German translation when language is de', () => {
      expect(getIngredientTranslation('Palm Oil', 'de')).toBe('Palmöl');
    });

    it('should return English key when language is en', () => {
      expect(getIngredientTranslation('Palm Oil', 'en')).toBe('Palm Oil');
    });

    it('should fall back to key for unknown ingredients', () => {
      expect(getIngredientTranslation('FancyNewAdditive', 'de')).toBe('FancyNewAdditive');
    });

    it('should fall back to key for unsupported languages', () => {
      expect(getIngredientTranslation('Palm Oil', 'ja')).toBe('Palm Oil');
    });
  });

  describe('getAllSearchTerms', () => {
    it('should return English key plus all translations', () => {
      const terms = getAllSearchTerms('Palm Oil');
      expect(terms).toContain('Palm Oil');
      expect(terms).toContain('Palmöl');
      expect(terms).toContain('Huile de palme');
      expect(terms).toContain('Olio di palma');
    });

    it('should return only the key for unknown ingredients', () => {
      expect(getAllSearchTerms('E102')).toEqual(['E102']);
    });

    it('should not contain duplicate terms', () => {
      const terms = getAllSearchTerms('Sugar');
      const unique = [...new Set(terms)];
      expect(terms).toEqual(unique);
    });
  });
});
