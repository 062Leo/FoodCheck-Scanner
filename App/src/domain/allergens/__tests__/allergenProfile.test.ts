import {
  allergenNamed,
  allergensNamedIn,
  matchAllergens,
  parseAllergenProfile,
} from '../allergenProfile';
import type { Product } from '../../../types/Product';

const product = (overrides: Partial<Product>): Product => ({
  ean: '4000000000001',
  name: 'Test',
  ...overrides,
});

describe('allergensNamedIn', () => {
  it.each([
    ['en:milk', 'milk'],
    ['en:sesame-seeds', 'sesame-seeds'],
    ['en:sulphur-dioxide-and-sulphites', 'sulphur-dioxide-and-sulphites'],
    ['de:haselnüsse', 'nuts'],
    ['Milch', 'milk'],
    ['Soy', 'soybeans'],
    ['Tree nuts', 'nuts'],
    ['Schalenfrüchte (Nüsse)', 'nuts'],
    ['Kann Spuren von Haselnüssen enthalten', 'nuts'],
    ['Spuren von Eiern', 'eggs'],
    ['Weizen', 'gluten'],
    ['Schwefeldioxid und Sulfite', 'sulphur-dioxide-and-sulphites'],
  ])('finds the allergen in "%s"', (text, allergen) => {
    expect([...allergensNamedIn(text)]).toContain(allergen);
  });

  it.each(['Kokosmilch', 'Muskatnuss', 'Enthält ein Verdickungsmittel', 'Eis'])(
    'does not see an allergen in "%s"',
    (text) => {
      expect([...allergensNamedIn(text)]).toEqual([]);
    }
  );

  it('finds several allergens in one text', () => {
    expect([...allergensNamedIn('Milch, Soja und Senf')].sort()).toEqual([
      'milk',
      'mustard',
      'soybeans',
    ]);
  });
});

describe('allergenNamed', () => {
  it('names an allergen only when the whole entry is its name', () => {
    expect(allergenNamed('Milk')).toBe('milk');
    expect(allergenNamed('en:nuts')).toBe('nuts');
    expect(allergenNamed('Spuren von Milch')).toBeUndefined();
  });
});

describe('matchAllergens', () => {
  it('finds profile allergens in the declared tags', () => {
    const match = matchAllergens(product({ allergensTags: ['en:milk', 'en:nuts'] }), [
      'milk',
      'gluten',
    ]);
    expect(match).toEqual({ contains: ['milk'], traces: [], noData: false });
  });

  it('reads traces from the normalised tags and from the free text', () => {
    expect(
      matchAllergens(product({ tracesTags: ['en:nuts'], traces: 'Haselnüsse' }), ['nuts'])
    ).toMatchObject({ traces: ['nuts'] });
    expect(
      matchAllergens(product({ traces: 'Kann Spuren von Sesam enthalten' }), ['sesame-seeds'])
    ).toMatchObject({ traces: ['sesame-seeds'] });
  });

  it('understands allergens typed on the edit screen', () => {
    const match = matchAllergens(product({ allergensTags: ['Milch', 'Soja'] }), ['soybeans']);
    expect(match.contains).toEqual(['soybeans']);
  });

  it('does not repeat a contained allergen under traces', () => {
    const match = matchAllergens(product({ allergensTags: ['en:milk'], traces: 'en:milk' }), [
      'milk',
    ]);
    expect(match).toEqual({ contains: ['milk'], traces: [], noData: false });
  });

  it('reports missing allergen data only when a profile is set', () => {
    expect(matchAllergens(product({}), ['milk']).noData).toBe(true);
    expect(matchAllergens(product({ allergensTags: [], traces: ' ' }), ['milk']).noData).toBe(true);
    expect(matchAllergens(product({}), []).noData).toBe(false);
    expect(matchAllergens(product({ allergensTags: ['en:nuts'] }), ['milk']).noData).toBe(false);
  });
});

describe('parseAllergenProfile', () => {
  it('keeps only known allergens in a fixed order', () => {
    expect(parseAllergenProfile('["nuts","milk","chocolate"]')).toEqual(['milk', 'nuts']);
  });

  it('survives missing or broken values', () => {
    expect(parseAllergenProfile(null)).toEqual([]);
    expect(parseAllergenProfile('not json')).toEqual([]);
    expect(parseAllergenProfile('{"milk":true}')).toEqual([]);
  });
});
