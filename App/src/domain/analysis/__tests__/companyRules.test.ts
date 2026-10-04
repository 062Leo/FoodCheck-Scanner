import type { FilterRule } from '../../../types/FilterRule';
import type { Product } from '../../../types/Product';
import {
  activeCompanyNameCount,
  COMPANY_CATEGORY,
  findAvoidedCompanies,
  keepExclusions,
  parseCompanyData,
  toggleCompanyName,
  type CompanyData,
} from '../companyRules';

function companyRule(key: string, names: string[] = []): FilterRule {
  return {
    id: 1,
    type: 'company',
    key,
    category: COMPANY_CATEGORY,
    threshold: null,
    operator: null,
    severity: 'red_flag',
    translations: names.length > 0 ? JSON.stringify({ names }) : null,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function product(fields: Partial<Product>): Product {
  return { ean: '4000000000000', name: 'Test', ...fields };
}

describe('findAvoidedCompanies', () => {
  it('finds the avoided name inside a brand, ignoring accents and legal forms', () => {
    const findings = findAvoidedCompanies(product({ brand: 'Nestle Deutschland AG' }), [
      companyRule('Nestlé'),
    ]);

    expect(findings).toEqual([
      {
        ingredient: 'Nestlé',
        category: COMPANY_CATEGORY,
        severity: 'critical',
        company: { name: 'Nestlé', matched: 'Nestle Deutschland AG' },
      },
    ]);
  });

  it('matches a brand of the company as a whole brand or at its start', () => {
    const rules = [companyRule('Nestlé', ['Maggi', 'Thomy', 'Lion'])];

    expect(findAvoidedCompanies(product({ brand: 'Knorr, Maggi' }), rules)).toHaveLength(1);
    expect(findAvoidedCompanies(product({ brand: 'Maggi Fix' }), rules)).toHaveLength(1);
    expect(findAvoidedCompanies(product({ brand: 'Thomy Les Sauces' }), rules)).toHaveLength(1);
    expect(findAvoidedCompanies(product({ brand: 'Lion Bar' }), rules)).toHaveLength(1);
    expect(findAvoidedCompanies(product({ brand: 'Maggiore Foods' }), rules)).toEqual([]);
    expect(findAvoidedCompanies(product({ brand: 'Golden Lion Foods' }), rules)).toEqual([]);
    expect(findAvoidedCompanies(product({ brand: 'Sea Lion' }), rules)).toEqual([]);
  });

  it('matches a brand written with or without spaces', () => {
    const rules = [companyRule('Nestlé', ['Kit Kat', 'Coffee-Mate'])];

    expect(findAvoidedCompanies(product({ brand: 'KitKat' }), rules)).toHaveLength(1);
    expect(findAvoidedCompanies(product({ brand: 'Coffee mate' }), rules)).toHaveLength(1);
    expect(findAvoidedCompanies(product({ brand: 'KitKat Chunky' }), rules)).toHaveLength(1);
    expect(findAvoidedCompanies(product({ brand: 'Kit' }), rules)).toEqual([]);
  });

  it('matches the avoided name itself written with or without spaces and hyphens', () => {
    expect(
      findAvoidedCompanies(product({ brand: 'KitKat Chunky' }), [companyRule('Kit Kat')])
    ).toHaveLength(1);
    expect(
      findAvoidedCompanies(product({ brand: 'CocaCola Zero' }), [companyRule('Coca-Cola')])
    ).toHaveLength(1);
    expect(
      findAvoidedCompanies(product({ brand: 'Coca-Cola' }), [companyRule('CocaCola')])
    ).toHaveLength(1);
    expect(findAvoidedCompanies(product({ brand: 'Kit' }), [companyRule('Kit Kat')])).toEqual([]);
  });

  it('matches the brand owner', () => {
    const findings = findAvoidedCompanies(
      product({ brand: 'Thomy', brandOwner: 'Nestlé Deutschland AG' }),
      [companyRule('Nestlé')]
    );

    expect(findings.map((f) => f.company)).toEqual([
      { name: 'Nestlé', matched: 'Nestlé Deutschland AG' },
    ]);
  });

  it('finds nothing without company rules or company data', () => {
    expect(findAvoidedCompanies(product({ brand: 'Nestlé' }), [])).toEqual([]);
    expect(findAvoidedCompanies(product({}), [companyRule('Nestlé')])).toEqual([]);
  });

  it('ignores company rules set to OK', () => {
    const rule = { ...companyRule('Nestlé'), severity: 'ok' as const };

    expect(findAvoidedCompanies(product({ brand: 'Nestlé' }), [rule])).toEqual([]);
  });
});

describe('company name exclusions', () => {
  const allNames = ['Nestlé', 'Maggi', 'Lion', 'Kit Kat'];
  const nestle = (excluded?: string[]): FilterRule => ({
    ...companyRule('Nestlé', allNames),
    translations: JSON.stringify({ names: allNames, excluded }),
  });

  it('parses old JSON without exclusions and new JSON with them', () => {
    expect(parseCompanyData('{"wikidataId":"Q1","names":["A"]}')).toEqual({
      wikidataId: 'Q1',
      names: ['A'],
    });
    expect(parseCompanyData('{"names":["A","B"],"excluded":["B",3]}')).toEqual({
      wikidataId: undefined,
      names: ['A', 'B'],
      excluded: ['B'],
    });
  });

  it('ignores excluded names, compared normalized', () => {
    const rules = [nestle(['LION', 'KitKat'])];
    expect(findAvoidedCompanies(product({ brand: 'Lion' }), rules)).toEqual([]);
    expect(findAvoidedCompanies(product({ brand: 'Kit Kat' }), rules)).toEqual([]);
    expect(findAvoidedCompanies(product({ brand: 'Maggi' }), rules)).toHaveLength(1);
  });

  it('never excludes the name of the rule itself', () => {
    expect(findAvoidedCompanies(product({ brand: 'Nestle' }), [nestle(['Nestlé'])])).toHaveLength(
      1
    );
    const data: CompanyData = { names: ['Nestlé', 'Maggi'] };
    expect(toggleCompanyName(data, 'Nestlé', 'Nestle')).toBe(data);
    expect(toggleCompanyName(data, 'Maggi', 'Nestlé').excluded).toEqual(['Maggi']);
  });

  it('keeps exclusions of names that are still present after a refresh', () => {
    const previous: CompanyData = { names: ['Maggi', 'Lion', 'Plus'], excluded: ['Lion', 'Plus'] };
    expect(keepExclusions(previous, { names: ['Maggi', 'lion'] })).toEqual({
      names: ['Maggi', 'lion'],
      excluded: ['lion'],
    });
    expect(keepExclusions(previous, { names: ['Maggi'] })).toEqual({ names: ['Maggi'] });
    expect(activeCompanyNameCount(previous)).toBe(1);
  });
});
