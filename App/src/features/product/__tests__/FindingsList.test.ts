import { createTranslator } from '../../../i18n/useTranslation';
import { categoryLabel } from '../../../i18n/categoryLabels';
import type { RedFlagFinding } from '../../../types/ScanResult';
import { reasonText } from '../../../ui/status';
import { findingDetail, findingTitle } from '../FindingsList';

const de = createTranslator('de');
const en = createTranslator('en');

const ingredientCount: RedFlagFinding = {
  ingredient: 'ingredient_count',
  category: 'Verarbeitung',
  severity: 'critical',
  check: { key: 'ingredient_count', count: 12, threshold: 5, operator: 'gt' },
};

const pesticide: RedFlagFinding = {
  ingredient: 'pesticide_risk',
  category: 'Schadstoffe',
  severity: 'critical',
  check: { key: 'pesticide_risk', crop: 'greenBean' },
};

const company: RedFlagFinding = {
  ingredient: 'Nestlé',
  category: 'Marken & Konzerne',
  severity: 'critical',
  company: { name: 'Nestlé', matched: 'Maggi' },
};

describe('finding texts', () => {
  it('describes the ingredient count with the rule limit', () => {
    expect(findingTitle(ingredientCount, de, 'de')).toBe('Mehr als 5 Zutaten (12)');
    expect(findingTitle(ingredientCount, en, 'en')).toBe('More than 5 ingredients (12)');
  });

  it('names the crop of a pesticide finding', () => {
    expect(findingTitle(pesticide, de, 'de')).toBe('Grüne Bohnen ohne Bio-Siegel');
    expect(findingTitle(pesticide, en, 'en')).toBe('Green beans without organic label');
    expect(findingDetail(pesticide, de, 'de')).toContain('BVL-Bericht 2023');
  });

  it('explains every check in both languages', () => {
    for (const key of [
      'canned',
      'mercury_fish',
      'rice_arsenic',
      'not_raw_milk',
      'alcoholic',
      'meat_substitute',
      'farmed_fish',
    ] as const) {
      const finding: RedFlagFinding = {
        ingredient: key,
        category: 'Verarbeitung',
        severity: 'critical',
        check: { key },
      };
      for (const [t, language] of [
        [de, 'de'],
        [en, 'en'],
      ] as const) {
        expect(findingTitle(finding, t, language)).not.toMatch(/^product\./);
        expect(findingDetail(finding, t, language)).not.toMatch(/^product\./);
      }
    }
  });

  it('names the avoided company and the brand that matched', () => {
    expect(findingTitle(company, de, 'de')).toBe('Marke/Konzern, den du meidest: Nestlé');
    expect(findingDetail(company, de, 'de')).toBe('Erkannt über: Maggi');
    expect(findingDetail(company, en, 'en')).toBe('Detected via: Maggi');
  });

  it('explains a rating by an avoided company', () => {
    const reason = { code: 'avoidedCompany', company: 'Nestlé' } as const;

    expect(reasonText(reason, de)).toBe('Von einem Konzern, den du meidest: Nestlé');
    expect(reasonText(reason, en)).toBe('From a company you avoid: Nestlé');
  });

  it('translates the new categories', () => {
    expect(categoryLabel('Marken & Konzerne', en)).toBe('Brands & Companies');
    expect(categoryLabel('Erhitzte Milch', en)).toBe('Heated Milk');
    expect(categoryLabel('Samenöle', de)).toBe('Samenöle');
  });
});
