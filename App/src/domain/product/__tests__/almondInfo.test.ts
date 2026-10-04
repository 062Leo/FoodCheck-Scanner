import type { Product } from '../../../types/Product';
import { almondPollinationInfo, containsAlmonds } from '../almondInfo';

function product(overrides: Partial<Product> = {}): Product {
  return { ean: '4000000000001', name: 'Test', ...overrides };
}

describe('containsAlmonds', () => {
  it.each([
    'Zucker, Mandeln 20 %, Kakaobutter',
    'Mandelmus',
    'Wasser, Mandel (2 %), Salz',
    'Aroma (Bittermandelöl)',
    'sugar, almonds',
    'Almond butter',
    "pâte d'amandes",
    'mandorle tostate',
    'almendras',
    'amandelen',
    'amêndoas',
    'migdały',
  ])('finds almonds in "%s"', (ingredientsText) => {
    expect(containsAlmonds(product({ ingredientsText }))).toBe(true);
  });

  it.each([
    'Erdmandeln, Datteln',
    'Erdmandelmehl',
    'Erd-Mandeln',
    'earth almonds',
    'aardamandelen',
    'souchet (amandes de terre)',
    'Zucker, Haselnüsse. Kann Spuren von Mandeln enthalten.',
    'sugar, hazelnuts. May contain traces of almonds.',
    'Haselnüsse, Zucker',
    '',
  ])('finds no almonds in "%s"', (ingredientsText) => {
    expect(containsAlmonds(product({ ingredientsText }))).toBe(false);
  });

  it('finds almonds by category', () => {
    expect(containsAlmonds(product({ categoriesTags: ['en:nuts', 'en:almonds'] }))).toBe(true);
    expect(containsAlmonds(product({ categoriesTags: ['en:almond-based-drinks'] }))).toBe(true);
    expect(containsAlmonds(product({ categoriesTags: ['en:hazelnuts'] }))).toBe(false);
  });
});

describe('almondPollinationInfo', () => {
  it('shows nothing without almonds', () => {
    expect(almondPollinationInfo(product({ ingredientsText: 'Haselnüsse', origins: 'USA' }))).toBe(
      null
    );
  });

  it('marks the origin as unknown when nothing is stated', () => {
    expect(almondPollinationInfo(product({ ingredientsText: 'Mandeln' }))).toEqual({
      origin: 'unknown',
    });
    // A European manufacturer says nothing about where the almonds come from.
    expect(
      almondPollinationInfo(
        product({ ingredientsText: 'Mandeln', manufacturingPlaces: 'Deutschland' })
      )
    ).toEqual({ origin: 'unknown' });
    expect(
      almondPollinationInfo(product({ ingredientsText: 'Mandeln', origins: 'EU und Nicht-EU' }))
    ).toEqual({ origin: 'unknown' });
  });

  it.each([
    { origins: 'USA' },
    { origins: 'Kalifornien' },
    { origins: 'United States' },
    { origins: 'en:united-states' },
    { origins: 'US' },
    { origins: 'Spanien, USA' },
    { manufacturingPlaces: 'California' },
    { ingredientsText: 'Zucker, Mandeln (Kalifornien), Kakao' },
    { ingredientsText: 'sugar, almonds (origin: United States)' },
  ])('detects a US origin in %o', (overrides) => {
    expect(almondPollinationInfo(product({ ingredientsText: 'Mandeln', ...overrides }))).toEqual({
      origin: 'us',
    });
  });

  it.each([
    { origins: 'Spanien' },
    { origins: 'Italia' },
    { origins: 'EU' },
    { origins: 'Australien' },
    { origins: 'Griechenland, Portugal' },
    { ingredientsText: 'Zucker, Mandeln 30 % (Spanien), Kakao' },
    { ingredientsText: 'sucre, amandes (origine Espagne)' },
  ])('stays hidden for an origin outside the USA in %o', (overrides) => {
    expect(almondPollinationInfo(product({ ingredientsText: 'Mandeln', ...overrides }))).toBeNull();
  });

  it('only reads the origin right after the almonds in the ingredient list', () => {
    expect(
      almondPollinationInfo(product({ ingredientsText: 'Mandeln, Kakao (Spanien), Zucker' }))
    ).toEqual({ origin: 'unknown' });
  });

  it('does not take the English word "us" for the USA', () => {
    expect(
      almondPollinationInfo(product({ ingredientsText: 'almonds', origins: 'ask us' }))
    ).toEqual({ origin: 'unknown' });
  });
});
