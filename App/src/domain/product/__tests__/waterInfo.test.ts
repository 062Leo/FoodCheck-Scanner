import type { Product } from '../../../types/Product';
import {
  exceededInfantFoodLimits,
  hasGlassPackaging,
  hasPlasticPackaging,
  isWater,
  nonMineralWaterKind,
  toMgPerLitre,
  waterInfo,
} from '../waterInfo';

function product(fields: Partial<Product>): Product {
  return { ean: '4000000000000', name: 'Wasser', ...fields };
}

const NATURAL = [
  'en:beverages',
  'en:waters',
  'en:spring-waters',
  'en:mineral-waters',
  'en:natural-mineral-waters',
];

describe('toMgPerLitre', () => {
  it('converts g per 100 g to mg per litre', () => {
    expect(toMgPerLitre(0.012)).toBe(120);
    expect(toMgPerLitre(0.00073)).toBe(7.3);
    expect(toMgPerLitre(0.002)).toBe(20);
    expect(toMgPerLitre(0.000002)).toBe(0.02);
  });
});

describe('isWater and nonMineralWaterKind', () => {
  it('recognises waters by category', () => {
    expect(isWater(product({ categoriesTags: NATURAL }))).toBe(true);
    expect(isWater(product({ categoriesTags: ['en:beverages', 'en:sodas'] }))).toBe(false);
    expect(isWater(product({}))).toBe(false);
  });

  it('does not flag natural mineral water', () => {
    expect(nonMineralWaterKind(product({ categoriesTags: NATURAL }))).toBeNull();
    expect(
      nonMineralWaterKind(product({ categoriesTags: ['en:carbonated-natural-mineral-waters'] }))
    ).toBeNull();
  });

  it('flags table water even if it is also tagged as natural mineral water', () => {
    expect(nonMineralWaterKind(product({ categoriesTags: ['en:waters', 'en:table-waters'] }))).toBe(
      'table'
    );
    expect(nonMineralWaterKind(product({ categoriesTags: [...NATURAL, 'en:table-waters'] }))).toBe(
      'table'
    );
  });

  it('flags spring water and other waters with their own kind', () => {
    expect(
      nonMineralWaterKind(product({ categoriesTags: ['en:waters', 'en:spring-waters'] }))
    ).toBe('spring');
    expect(
      nonMineralWaterKind(
        product({ categoriesTags: ['en:waters', 'en:spring-waters', 'en:mineral-waters'] })
      )
    ).toBe('spring');
    expect(nonMineralWaterKind(product({ categoriesTags: ['en:waters'] }))).toBe('other');
    expect(nonMineralWaterKind(product({ categoriesTags: ['en:flavored-waters'] }))).toBe('other');
  });

  it('ignores products that are no water', () => {
    expect(nonMineralWaterKind(product({ categoriesTags: ['en:sodas'] }))).toBeNull();
  });
});

describe('packaging', () => {
  it.each([
    'en:plastic',
    'en:pet-polyethylene-terephthalate',
    'en:pet-polyethylenterephtalat',
    'en:kunststoff',
    'de:1-flasche-pet-recycling',
    'fr:plastique',
    'it:plastica',
    'es:plástico',
    'de:plastikflasche',
    'de:pet-flasche',
  ])('recognises %s as plastic', (tag) => {
    expect(hasPlasticPackaging(product({ packagingTags: [tag] }))).toBe(true);
  });

  it.each(['en:glass', 'de:glasflasche', 'fr:verre', 'en:metal', 'en:petite-bouteille'])(
    'does not read %s as plastic',
    (tag) => {
      expect(hasPlasticPackaging(product({ packagingTags: [tag] }))).toBe(false);
    }
  );

  it('recognises glass', () => {
    expect(hasGlassPackaging(product({ packagingTags: ['en:glass-bottle'] }))).toBe(true);
    expect(hasGlassPackaging(product({ packagingTags: ['fr:verre'] }))).toBe(true);
    expect(hasGlassPackaging(product({ packagingTags: ['en:plastic'] }))).toBe(false);
  });
});

describe('exceededInfantFoodLimits', () => {
  it('lists each value above its limit in mg/l', () => {
    const water = product({
      categoriesTags: NATURAL,
      nutriments: {
        sodium100g: 0.012,
        nitrate100g: 0.0011,
        sulphate100g: 0.0009,
        fluoride100g: 0.00008,
      },
    });
    expect(exceededInfantFoodLimits(water)).toEqual([
      { mineral: 'nitrate', value: 11, limit: 10 },
      { mineral: 'sodium', value: 120, limit: 20 },
      { mineral: 'fluoride', value: 0.8, limit: 0.7 },
    ]);
  });

  it('does not flag values at the limit or missing values', () => {
    const water = product({ categoriesTags: NATURAL, nutriments: { sodium100g: 0.002 } });
    expect(exceededInfantFoodLimits(water)).toEqual([]);
    expect(exceededInfantFoodLimits(product({ categoriesTags: NATURAL }))).toEqual([]);
  });

  it('only applies to waters', () => {
    expect(
      exceededInfantFoodLimits(
        product({ categoriesTags: ['en:sodas'], nutriments: { sodium100g: 0.1 } })
      )
    ).toEqual([]);
  });
});

describe('waterInfo', () => {
  it('is null for products that are no water', () => {
    expect(waterInfo(product({ categoriesTags: ['en:sodas'] }))).toBeNull();
  });

  it('notes natural mineral water, infant-food label and glass', () => {
    const info = waterInfo(
      product({
        categoriesTags: NATURAL,
        labelsTags: ['de:geeignet-fur-die-zubereitung-von-sauglingsnahrung'],
        packagingTags: ['en:glass'],
      })
    );
    expect(info).toMatchObject({ naturalMineral: true, infantLabel: true, glass: true });
  });

  it('does not read "not recommended for children" as infant-food label', () => {
    const info = waterInfo(
      product({ categoriesTags: NATURAL, labelsTags: ['en:not-recommended-for-babies'] })
    );
    expect(info?.infantLabel).toBe(false);
  });

  it('does not note glass when the packaging also names plastic', () => {
    const info = waterInfo(
      product({ categoriesTags: NATURAL, packagingTags: ['en:glass', 'en:pet'] })
    );
    expect(info?.glass).toBe(false);
  });

  it('notes a water very low in minerals from at least three values', () => {
    const poor = waterInfo(
      product({
        categoriesTags: NATURAL,
        nutriments: { sodium100g: 0.0002, calcium100g: 0.0004, magnesium100g: 0.0001 },
      })
    );
    expect(poor?.mineralPoor).toBe(true);
    const tooFew = waterInfo(
      product({ categoriesTags: NATURAL, nutriments: { sodium100g: 0.0002, calcium100g: 0.0004 } })
    );
    expect(tooFew?.mineralPoor).toBe(false);
  });

  it('notes calcium and magnesium rich water', () => {
    const info = waterInfo(
      product({
        categoriesTags: NATURAL,
        nutriments: { calcium100g: 0.0348, magnesium100g: 0.0108 },
      })
    );
    expect(info).toMatchObject({ calciumRich: true, magnesiumRich: true, mineralPoor: false });
  });
});
