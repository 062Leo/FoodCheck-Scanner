import { buildRuleChange, NUTRIENT_CATEGORY } from '../RuleEditorSheet';
import { translateRuleKeyword } from '../../../services/RuleTranslationService';
import type { FilterRule } from '../../../types/FilterRule';

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
