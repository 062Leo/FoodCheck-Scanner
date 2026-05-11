import { IngredientParser } from '../IngredientParser';

describe('IngredientParser', () => {
  let parser: IngredientParser;

  beforeEach(() => {
    parser = new IngredientParser();
  });

  it('should parse comma-separated ingredients', () => {
    const result = parser.parse('Zucker, Palmöl, Salz, Aroma');
    expect(result).toHaveLength(4);
    expect(result[0].normalized).toBe('zucker');
    expect(result[1].normalized).toBe('palmöl');
    expect(result[2].normalized).toBe('salz');
    expect(result[3].normalized).toBe('aroma');
  });

  it('should parse ingredients with percentages', () => {
    const result = parser.parse('Zucker 15%, Mehl, Wasser');
    expect(result).toHaveLength(3);
    expect(result[0].percentage).toBe(15);
    expect(result[0].normalized).toBe('zucker');
  });

  it('should parse parenthetical sub-ingredients', () => {
    const result = parser.parse('Emulgator (Sojalecithin, E322)');
    expect(result.length).toBeGreaterThanOrEqual(2);

    const mainToken = result.find((t) => t.normalized === 'emulgator');
    expect(mainToken).toBeDefined();
    expect(mainToken!.isSubIngredient).toBe(false);

    const subToken = result.find((t) => t.normalized === 'sojalecithin');
    expect(subToken).toBeDefined();
    expect(subToken!.isSubIngredient).toBe(true);
    expect(subToken!.parentToken).toBe('Emulgator');
  });

  it('should detect E-numbers in ingredients', () => {
    const result = parser.parse('Farbstoff (E102), Konservierungsstoff E250');
    const e102 = result.find((t) => t.eNumber === 'E102');
    expect(e102).toBeDefined();
    expect(e102!.isENumber).toBe(true);

    const e250 = result.find((t) => t.eNumber === 'E250');
    expect(e250).toBeDefined();
  });

  it('should handle "Zutaten:" prefix', () => {
    const result = parser.parse('Zutaten: Zucker, Mehl, Salz');
    expect(result[0].normalized).toBe('zucker');
  });

  it('should handle "Ingredients:" prefix', () => {
    const result = parser.parse('Ingredients: sugar, flour, salt');
    expect(result[0].normalized).toBe('sugar');
  });

  it('should deduplicate identical ingredients', () => {
    const result = parser.parse('Zucker, Zucker, Mehl, Mehl');
    expect(result).toHaveLength(2);
  });

  it('should handle semicolon separation', () => {
    const result = parser.parse('Zucker; Mehl; Salz');
    expect(result).toHaveLength(3);
  });

  it('should handle square bracket sub-ingredients', () => {
    const result = parser.parse('Aroma [Milch]');
    const main = result.find((t) => t.normalized === 'aroma');
    const sub = result.find((t) => t.normalized === 'milch');
    expect(main).toBeDefined();
    expect(sub).toBeDefined();
    expect(sub!.isSubIngredient).toBe(true);
  });

  it('should return empty array for empty text', () => {
    expect(parser.parse('')).toEqual([]);
    expect(parser.parse('   ')).toEqual([]);
  });

  it('should handle nested parentheses', () => {
    const result = parser.parse('Verdickungsmittel (modifizierte Stärke (E1442)), Zucker');
    const e1442 = result.find((t) => t.eNumber === 'E1442');
    expect(e1442).toBeDefined();
  });

  it('should normalize ingredient text correctly', () => {
    expect(parser.normalizeIngredient('  Zucker  ')).toBe('zucker');
    expect(parser.normalizeIngredient('E330')).toBe('e330');
    expect(parser.normalizeIngredient('1. Zucker')).toBe('zucker');
    expect(parser.normalizeIngredient('*Palmöl')).toBe('palmöl');
  });

  it('should detect E-numbers with spaces', () => {
    const result = parser.parse('Farbstoff E 102');
    const e102 = result.find((t) => t.eNumber === 'E102');
    expect(e102).toBeDefined();
  });
});
