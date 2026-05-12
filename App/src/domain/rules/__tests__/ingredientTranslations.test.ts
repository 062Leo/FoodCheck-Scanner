import {
  resolveIngredientKey,
  getIngredientTranslation,
  getAllSearchTerms,
} from '../ingredientTranslations';

describe('ingredientTranslations', () => {
  describe('resolveIngredientKey', () => {
    it('should return English key for German input', () => {
      expect(resolveIngredientKey('Palmöl')).toBe('Palm Oil');
    });

    it('should return English key for French input', () => {
      expect(resolveIngredientKey('Huile de palme')).toBe('Palm Oil');
    });

    it('should return English key for Spanish input', () => {
      expect(resolveIngredientKey('Azúcar')).toBe('Sugar');
    });

    it('should return English key when input is already English', () => {
      expect(resolveIngredientKey('Palm Oil')).toBe('Palm Oil');
    });

    it('should be case-insensitive', () => {
      expect(resolveIngredientKey('palmöl')).toBe('Palm Oil');
      expect(resolveIngredientKey('PALMÖL')).toBe('Palm Oil');
    });

    it('should trim whitespace', () => {
      expect(resolveIngredientKey('  Palmöl  ')).toBe('Palm Oil');
    });

    it('should return original input for unknown terms', () => {
      expect(resolveIngredientKey('UnbekanntesZeug')).toBe('UnbekanntesZeug');
    });

    it('should return empty string for empty input', () => {
      expect(resolveIngredientKey('')).toBe('');
      expect(resolveIngredientKey('   ')).toBe('');
    });

    it('should match Polish translations', () => {
      expect(resolveIngredientKey('Cukier')).toBe('Sugar');
      expect(resolveIngredientKey('Olej palmowy')).toBe('Palm Oil');
    });

    it('should match Italian translations', () => {
      expect(resolveIngredientKey('Olio di palma')).toBe('Palm Oil');
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
