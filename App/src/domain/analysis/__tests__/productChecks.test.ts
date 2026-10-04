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

  it('counts ingredients joined by a conjunction', () => {
    expect(countIngredients('Wasser, Zucker und Salz, Mehl, Hefe, Öl')).toBe(6);
    expect(countIngredients('water, sugar and salt, flour, yeast, oil')).toBe(6);
    expect(countIngredients('SUGAR, WHEAT FLOUR AND SALT')).toBe(3);
    expect(countIngredients('farine, sucre et sel')).toBe(3);
    expect(countIngredients('pomodoro, olio e sale')).toBe(3);
    expect(countIngredients('agua, azúcar y sal')).toBe(3);
    expect(countIngredients('mąka, cukier oraz sól')).toBe(3);
    expect(countIngredients('Salz und Pfeffer')).toBe(2);
  });

  it('counts line-separated and dash-separated lists', () => {
    expect(countIngredients('Wasser\nZucker\nSalz\nMehl\nHefe\nÖl')).toBe(6);
    expect(countIngredients('Wasser - Zucker - Salz - Mehl – Hefe - Öl')).toBe(6);
    expect(countIngredients('Glukose-Fruktose-Sirup, Wasser')).toBe(2);
  });

  it('does not split inside brackets, numbers, additives or notes', () => {
    expect(countIngredients('Schokolade (Zucker und Kakaomasse), Milch')).toBe(2);
    expect(countIngredients('Schokolade (Zucker, Kakaomasse) und Milch')).toBe(3);
    expect(countIngredients('Tomaten 2,5 % und Salz 1.5 %')).toBe(2);
    expect(countIngredients('Säuerungsmittel e 330, Wasser')).toBe(2);
    expect(countIngredients('lait écrémé en poudre, sucre')).toBe(2);
    expect(countIngredients('Hafer, Wasser. Kann Spuren von Nüssen und Soja enthalten.')).toBe(2);
    expect(countIngredients('sugar and/or dextrose, salt')).toBe(2);
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

  it.each(['Vollkornreis', 'Reismehl, Salz', 'rice flour', 'brown rice', 'riz', 'arroz', 'ryż'])(
    'flags rice as the main ingredient in "%s"',
    (ingredientsText) => {
      expect(keysOf(product({ ingredientsText }))).toContain('rice_arsenic');
    }
  );

  it.each(['licorice extract', 'liquorice', 'Preiselbeeren', 'Reiseproviant'])(
    'does not mistake "%s" for rice',
    (ingredientsText) => {
      expect(keysOf(product({ ingredientsText }))).not.toContain('rice_arsenic');
    }
  );

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

describe('water checks', () => {
  const gerolsteiner = product({
    categoriesTags: [
      'en:beverages',
      'en:waters',
      'en:spring-waters',
      'en:mineral-waters',
      'en:natural-mineral-waters',
    ],
    packagingTags: ['en:einwegpfand', 'en:kunststoff', 'en:pet-polyethylenterephtalat'],
    nutriments: { sodium100g: 0.012, calcium100g: 0.0348, magnesium100g: 0.0108 },
  });

  it('flags plastic and the sodium above the infant-food limit, not the mineral water', () => {
    expect(keysOf(gerolsteiner)).toEqual(['water_plastic_bottle', 'water_contaminants']);
    const finding = runProductChecks(gerolsteiner, ALL_CHECKS).find(
      (f) => f.ingredient === 'water_contaminants'
    );
    expect(finding?.check?.exceeded).toEqual([{ mineral: 'sodium', value: 120, limit: 20 }]);
    expect(finding?.category).toBe('Wasser');
  });

  it('flags table water with its kind', () => {
    const findings = runProductChecks(
      product({ categoriesTags: ['en:waters', 'en:table-waters'], packagingTags: ['en:glass'] }),
      ALL_CHECKS
    );
    expect(findings.map((f) => f.check)).toEqual([
      { key: 'water_not_mineral', waterKind: 'table' },
    ]);
  });

  it('does not run the water checks on other products', () => {
    expect(
      keysOf(
        product({
          categoriesTags: ['en:sodas'],
          packagingTags: ['en:plastic'],
          nutriments: { sodium100g: 0.1 },
        })
      )
    ).toEqual([]);
  });

  it('does not flag a water check that the user allowed', () => {
    const rules = ALL_CHECKS.map((r) =>
      r['key'] === 'water_plastic_bottle' ? { ...r, severity: 'ok' as const } : r
    );
    expect(keysOf(gerolsteiner, rules)).toEqual(['water_contaminants']);
  });
});
