import { matchAllergens, parseAllergenProfile } from '../allergenProfile';
import type { Product } from '../../../types/Product';

const product = (overrides: Partial<Product>): Product => ({
  ean: '4000000000001',
  name: 'Test',
  ...overrides,
});

describe('matchAllergens', () => {
  it('finds profile allergens in the declared tags', () => {
    const match = matchAllergens(product({ allergensTags: ['en:milk', 'en:nuts'] }), [
      'milk',
      'gluten',
    ]);
    expect(match).toEqual({ contains: ['milk'], traces: [] });
  });

  it('reads traces as tags or as free English text', () => {
    expect(matchAllergens(product({ traces: 'en:peanuts,en:sesame-seeds' }), ['peanuts'])).toEqual({
      contains: [],
      traces: ['peanuts'],
    });
    expect(matchAllergens(product({ traces: 'milk, Sesame seeds' }), ['sesame-seeds'])).toEqual({
      contains: [],
      traces: ['sesame-seeds'],
    });
  });

  it('does not repeat a contained allergen under traces', () => {
    const match = matchAllergens(product({ allergensTags: ['en:milk'], traces: 'en:milk' }), [
      'milk',
    ]);
    expect(match).toEqual({ contains: ['milk'], traces: [] });
  });

  it('ignores other languages and partial words', () => {
    const match = matchAllergens(
      product({ allergensTags: ['de:milch'], traces: 'buttermilk, nutshell' }),
      ['milk', 'nuts']
    );
    expect(match).toEqual({ contains: [], traces: [] });
  });

  it('matches nothing without a profile', () => {
    expect(matchAllergens(product({ allergensTags: ['en:milk'] }), [])).toEqual({
      contains: [],
      traces: [],
    });
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
