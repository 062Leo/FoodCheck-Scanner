import type { FilterRule } from '../../../types/FilterRule';
import type { Product } from '../../../types/Product';
import {
  CHECK_SEEDS,
  countIngredients,
  isOrganic,
  runProductChecks,
  type CheckKey,
} from '../productChecks';

function checkRule(key: CheckKey, extra: Partial<FilterRule> = {}): FilterRule {
  const seed = CHECK_SEEDS.find((s) => s.key === key)!;
  return {
    id: 1,
    type: 'check',
    key,
    category: seed.category,
    threshold: seed.threshold ?? null,
    operator: seed.operator ?? null,
    severity: 'red_flag',
    translations: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

const ALL_CHECKS = CHECK_SEEDS.map((seed) => checkRule(seed.key));

function product(fields: Partial<Product>): Product {
  return { ean: '4000000000000', name: 'Test', ...fields };
}

function keysOf(p: Product, rules: FilterRule[] = ALL_CHECKS) {
  return runProductChecks(p, rules).map((finding) => finding.check?.key);
}

describe('countIngredients', () => {
  it('counts a simple list', () => {
    expect(countIngredients('Wasser, Salz, Zucker')).toBe(3);
  });

  it('counts the parts of a compound ingredient instead of the compound', () => {
    expect(countIngredients('Schokolade (Zucker, Kakaomasse), Milch')).toBe(3);
  });

  it('does not split decimal percentages', () => {
    expect(countIngredients('Tomaten 80 %, Olivenöl 2,5 %, Salz 1.5%')).toBe(3);
  });

  it('ignores the "Zutaten:" prefix', () => {
    expect(countIngredients('Zutaten: Haferflocken, Wasser')).toBe(2);
  });

  it('ignores notes that are not ingredients', () => {
    expect(
      countIngredients(
        'Mandeln*, Datteln*. *aus kontrolliert biologischem Anbau. Kann Spuren von Erdnüssen enthalten.'
      )
    ).toBe(2);
  });
});

describe('isOrganic', () => {
  it('recognises organic labels and control body codes', () => {
    expect(isOrganic(product({ labelsTags: ['en:organic'] }))).toBe(true);
    expect(isOrganic(product({ labelsTags: ['en:de-oko-001'] }))).toBe(true);
  });

  it('recognises an organic note in the ingredient text', () => {
    expect(
      isOrganic(product({ ingredientsText: 'Reis* (*aus kontrolliert biologischem Anbau)' }))
    ).toBe(true);
  });

  it('is false without any organic hint', () => {
    expect(isOrganic(product({ labelsTags: ['en:vegan'], ingredientsText: 'Reis' }))).toBe(false);
  });
});

describe('product checks', () => {
  it('flags more ingredients than the limit', () => {
    const findings = runProductChecks(product({ ingredientsText: 'a1, b2, c3, d4, e5, f6' }), [
      checkRule('ingredient_count'),
    ]);

    expect(findings).toEqual([
      {
        ingredient: 'ingredient_count',
        category: 'Verarbeitung',
        severity: 'critical',
        check: { key: 'ingredient_count', count: 6, threshold: 5, operator: 'gt' },
      },
    ]);
  });

  it('respects the threshold stored in the rule', () => {
    const p = product({ ingredientsText: 'Wasser, Salz, Zucker' });

    expect(keysOf(p, [checkRule('ingredient_count')])).toEqual([]);
    expect(keysOf(p, [checkRule('ingredient_count', { threshold: 2 })])).toEqual([
      'ingredient_count',
    ]);
  });

  it('does not count ingredients without an ingredient list', () => {
    expect(keysOf(product({}), [checkRule('ingredient_count', { threshold: 0 })])).toEqual([]);
  });

  it('flags cans by shape, or canned food in metal', () => {
    expect(keysOf(product({ packagingTags: ['en:can'] }))).toContain('canned');
    expect(
      keysOf(product({ categoriesTags: ['en:canned-foods'], packagingTags: ['en:metal'] }))
    ).toContain('canned');
    expect(keysOf(product({ categoriesTags: ['en:canned-foods'] }))).not.toContain('canned');
  });

  it('flags large predatory fish by category or ingredient', () => {
    expect(keysOf(product({ categoriesTags: ['en:canned-tunas'] }))).toContain('mercury_fish');
    expect(keysOf(product({ ingredientsText: 'Thunfisch, Olivenöl, Salz' }))).toContain(
      'mercury_fish'
    );
    expect(keysOf(product({ ingredientsText: 'Lachs, Salz' }))).not.toContain('mercury_fish');
  });

  it('flags rice when it is the main ingredient', () => {
    expect(keysOf(product({ ingredientsText: 'Basmatireis' }))).toContain('rice_arsenic');
    expect(keysOf(product({ categoriesTags: ['en:rice-cakes'] }))).toContain('rice_arsenic');
    expect(keysOf(product({ ingredientsText: 'Hafer, Reismehl' }))).not.toContain('rice_arsenic');
  });

  it('flags crops with many residue findings unless organic', () => {
    const findings = runProductChecks(product({ categoriesTags: ['en:mangoes'] }), [
      checkRule('pesticide_risk'),
    ]);

    expect(findings.map((f) => f.check)).toEqual([{ key: 'pesticide_risk', crop: 'mango' }]);
    expect(
      keysOf(product({ categoriesTags: ['en:mangoes'], labelsTags: ['en:eu-organic'] }))
    ).not.toContain('pesticide_risk');
  });

  it('flags dairy products unless they are made from raw milk', () => {
    expect(keysOf(product({ categoriesTags: ['en:dairies'] }))).toContain('not_raw_milk');
    expect(
      keysOf(product({ categoriesTags: ['en:dairies'], ingredientsText: 'Rohmilch, Salz, Lab' }))
    ).not.toContain('not_raw_milk');
  });

  it.each([
    'Rohmilch',
    'Käse aus Rohmilch hergestellt',
    'Ziegenrohmilch, Salz',
    'Made with raw milk',
    'lait cru de vache',
    'latte crudo',
    'Pasteurisierte Milch, Rohmilch',
  ])('does not flag dairy made from raw milk: "%s"', (ingredientsText) => {
    expect(keysOf(product({ categoriesTags: ['en:dairies'], ingredientsText }))).not.toContain(
      'not_raw_milk'
    );
  });

  it('does not flag dairy with a raw-milk category or label', () => {
    expect(keysOf(product({ categoriesTags: ['en:dairies', 'en:raw-milks'] }))).not.toContain(
      'not_raw_milk'
    );
    expect(
      keysOf(product({ categoriesTags: ['en:dairies', 'fr:fromages-au-lait-cru'] }))
    ).not.toContain('not_raw_milk');
    expect(
      keysOf(product({ categoriesTags: ['en:dairies'], labelsTags: ['de:rohmilch'] }))
    ).not.toContain('not_raw_milk');
  });

  it.each([
    'Milch (nicht aus Rohmilch hergestellt)',
    'Käse, ohne Rohmilch',
    'Not made with raw milk',
    'Fromage pas au lait cru',
    'Formaggio non a latte crudo',
    'kein Vorzugsmilch',
  ])('flags dairy with a negated raw-milk mention: "%s"', (ingredientsText) => {
    expect(keysOf(product({ categoriesTags: ['en:dairies'], ingredientsText }))).toContain(
      'not_raw_milk'
    );
  });

  it('flags alcohol by category or alcohol content', () => {
    expect(keysOf(product({ categoriesTags: ['en:alcoholic-beverages'] }))).toContain('alcoholic');
    expect(keysOf(product({ nutriments: { alcohol100g: 0.5 } }))).toContain('alcoholic');
    expect(keysOf(product({ nutriments: { alcohol100g: 0 } }))).not.toContain('alcoholic');
  });

  it('flags meat substitutes', () => {
    expect(keysOf(product({ categoriesTags: ['en:meat-analogues'] }))).toContain('meat_substitute');
  });

  it('flags farmed fish by label or category', () => {
    expect(keysOf(product({ labelsTags: ['en:responsible-aquaculture-asc'] }))).toContain(
      'farmed_fish'
    );
    expect(keysOf(product({ categoriesTags: ['en:farmed-salmons'] }))).toContain('farmed_fish');
  });

  it('runs only the checks the user has as red-flag rules', () => {
    const p = product({ packagingTags: ['en:can'], categoriesTags: ['en:alcoholic-beverages'] });

    expect(keysOf(p, [])).toEqual([]);
    expect(keysOf(p, [checkRule('alcoholic')])).toEqual(['alcoholic']);
    expect(keysOf(p, [checkRule('canned', { severity: 'ok' })])).toEqual([]);
  });

  it('yields at most one finding per check', () => {
    const p = product({ packagingTags: ['en:can'] });

    expect(keysOf(p, [checkRule('canned'), checkRule('canned', { id: 2 })])).toEqual(['canned']);
  });
});
