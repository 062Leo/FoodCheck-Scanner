import { buildRuleChange, NUTRIENT_CATEGORY } from '../RuleEditorSheet';
import { translateRuleKeyword } from '../../../services/RuleTranslationService';
import type { FilterRule } from '../../../types/FilterRule';
import type { CompanyData } from '../../../domain/analysis/companyRules';

const customRule: FilterRule = {
  id: 7,
  type: 'ingredient',
  key: 'Kokosfett',
  category: 'Gehärtete Fette & raffinierte Öle',
  severity: 'red_flag',
  translations: JSON.stringify({ en: 'Coconut fat' }),
  created_at: '2026-01-01T00:00:00.000Z',
};

const form = {
  type: 'ingredient' as const,
  keyword: 'Kokosfett',
  category: 'Gehärtete Fette & raffinierte Öle',
  nutrient: 'sugars_100g' as const,
  operator: 'gt' as const,
  threshold: '',
  severity: 'ok' as const,
  companyName: '',
  companyData: null as CompanyData | null,
};

describe('buildRuleChange', () => {
  it('keeps stored translations when only the severity changes', () => {
    const change = buildRuleChange(customRule, form);

    expect(change).toEqual({
      kind: 'update',
      id: 7,
      changes: expect.not.objectContaining({ translations: expect.anything() }),
      translate: false,
    });
    expect('changes' in change && 'translations' in change.changes).toBe(false);
  });

  it('re-translates when the keyword changes', () => {
    const change = buildRuleChange(customRule, { ...form, keyword: 'Kokosöl' });

    expect(change).toMatchObject({
      kind: 'update',
      translate: true,
      changes: { key: 'Kokosöl', translations: null },
    });
  });

  it('stores dictionary keywords under their canonical key without translating', () => {
    expect(
      buildRuleChange(null, { ...form, keyword: 'Palmöl', severity: 'red_flag' })
    ).toMatchObject({
      kind: 'add',
      rule: { key: 'Palm Oil' },
      translate: false,
    });
  });

  it('parses comma thresholds for nutrient rules', () => {
    expect(
      buildRuleChange(null, { ...form, type: 'nutrient', threshold: '12,5', severity: 'red_flag' })
    ).toMatchObject({
      kind: 'add',
      rule: {
        type: 'nutrient',
        key: 'sugars_100g',
        threshold: 12.5,
        operator: 'gt',
        category: NUTRIENT_CATEGORY,
      },
    });
  });

  it('reports missing input', () => {
    expect(buildRuleChange(null, { ...form, keyword: ' ' })).toEqual({ error: 'ingredient' });
    expect(buildRuleChange(null, { ...form, category: '' })).toEqual({ error: 'category' });
    expect(buildRuleChange(null, { ...form, type: 'nutrient', threshold: 'viel' })).toEqual({
      error: 'threshold',
    });
    // The comparison belongs to the operator; "<5" must not silently become "> 5".
    expect(buildRuleChange(null, { ...form, type: 'nutrient', threshold: '<5' })).toEqual({
      error: 'threshold',
    });
  });

  it('changes only the severity of a check without a limit', () => {
    const checkRule: FilterRule = { ...customRule, type: 'check', key: 'canned' };

    expect(buildRuleChange(checkRule, { ...form, type: 'check', threshold: '9' })).toEqual({
      kind: 'update',
      id: 7,
      changes: { severity: 'ok' },
      translate: false,
    });
  });

  it('changes the ingredient limit of the ingredient count check', () => {
    const checkRule: FilterRule = {
      ...customRule,
      type: 'check',
      key: 'ingredient_count',
      threshold: 5,
      operator: 'gt',
      translations: null,
    };
    const checkForm = { ...form, type: 'check' as const, severity: 'red_flag' as const };

    expect(buildRuleChange(checkRule, { ...checkForm, threshold: ' 8 ' })).toEqual({
      kind: 'update',
      id: 7,
      changes: { severity: 'red_flag', threshold: 8, operator: 'gt' },
      translate: false,
    });
    for (const threshold of ['0', '2,5', '-1', '', 'viele']) {
      expect(buildRuleChange(checkRule, { ...checkForm, threshold })).toEqual({ error: 'count' });
    }
  });

  it('stores a company with its brands and never translates it', () => {
    const companyData: CompanyData = { wikidataId: 'Q160746', names: ['Nestlé', 'Maggi'] };

    expect(
      buildRuleChange(null, { ...form, type: 'company', companyName: ' Nestlé ', companyData })
    ).toEqual({
      kind: 'add',
      rule: {
        type: 'company',
        key: 'Nestlé',
        category: 'Marken & Konzerne',
        threshold: null,
        operator: null,
        severity: 'red_flag',
        translations: JSON.stringify(companyData),
      },
      translate: false,
    });
    expect(buildRuleChange(null, { ...form, type: 'company', companyName: 'Hipp' })).toMatchObject({
      kind: 'add',
      rule: { key: 'Hipp', translations: null, severity: 'red_flag' },
      translate: false,
    });
    expect(buildRuleChange(null, { ...form, type: 'company', companyName: ' ' })).toEqual({
      error: 'company',
    });
  });

  it('refuses a second rule for the same company', () => {
    const existing: FilterRule = { ...customRule, id: 3, type: 'company', key: 'Nestlé AG' };
    const companyForm = { ...form, type: 'company' as const, companyName: 'nestle' };

    expect(buildRuleChange(null, companyForm, [customRule, existing])).toEqual({
      error: 'duplicateCompany',
    });
    // Saving the rule itself again is no duplicate.
    expect(buildRuleChange(existing, companyForm, [existing])).toMatchObject({
      kind: 'update',
      id: 3,
    });
  });
});

describe('translateRuleKeyword', () => {
  it('translates in parallel and skips failures and unchanged results', async () => {
    const translator = {
      translate: jest.fn(async (text: string, lang?: string) => {
        if (lang === 'fr') throw new Error('quota');
        if (lang === 'it') return text;
        return `${text}-${lang}`;
      }),
    };

    const json = await translateRuleKeyword('Kokosfett', translator);

    const parsed = JSON.parse(json!);
    expect(parsed.en).toBeUndefined();
    expect(parsed.de).toBe('Kokosfett-de');
    expect(parsed.fr).toBeUndefined();
    expect(parsed.it).toBeUndefined();
    expect(translator.translate).toHaveBeenCalledTimes(7);
  });

  it('returns null when nothing could be translated', async () => {
    await expect(
      translateRuleKeyword('x', { translate: async (text: string) => text })
    ).resolves.toBeNull();
  });
});
