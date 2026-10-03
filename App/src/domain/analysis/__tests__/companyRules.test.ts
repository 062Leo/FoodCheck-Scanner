import type { FilterRule } from '../../../types/FilterRule';
import type { Product } from '../../../types/Product';
import { COMPANY_CATEGORY, findAvoidedCompanies } from '../companyRules';

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
