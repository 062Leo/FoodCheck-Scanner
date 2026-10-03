import { FilterRuleRepository } from '../FilterRuleRepository';
import { useTestDatabase } from '../../../testing/testDatabase';
import type { NewFilterRule } from '../../../types/FilterRule';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const customRule: NewFilterRule = {
  type: 'ingredient',
  key: 'Meine Zutat',
  category: 'Sonstige Zusatzstoffe',
  severity: 'red_flag',
  translations: JSON.stringify({ en: 'My ingredient' }),
};

describe('FilterRuleRepository (SQLite)', () => {
  useTestDatabase();
  const repository = new FilterRuleRepository();

  async function findCustom() {
    return (await repository.findAll()).find((r) => r.key === 'Meine Zutat');
  }

  it('starts with the seeded rules', async () => {
    const rules = await repository.findAll();
    expect(rules.length).toBeGreaterThan(600);
    expect(rules.every((r) => r.severity === 'red_flag')).toBe(true);
  });

  it('insert then findAll includes the new rule', async () => {
    await repository.insert(customRule);

    expect(await findCustom()).toMatchObject({
      ...customRule,
      threshold: null,
      operator: null,
      created_at: expect.any(String),
    });
  });

  it('update changes only the given fields', async () => {
    await repository.insert(customRule);
    const rule = await findCustom();

    await repository.update(rule!.id, { severity: 'ok' });

    expect(await findCustom()).toMatchObject({
      severity: 'ok',
      translations: customRule.translations,
    });
  });

  it('stores nutrient thresholds', async () => {
    await repository.insert({
      type: 'nutrient',
      key: 'sugars_100g',
      category: 'Zucker & Sirupe',
      threshold: 12.5,
      operator: 'gt',
      severity: 'red_flag',
    });

    const rule = (await repository.findAll()).find((r) => r.type === 'nutrient');
    expect(rule).toMatchObject({ threshold: 12.5, operator: 'gt' });
  });

  it('deleteById removes the rule', async () => {
    await repository.insert(customRule);
    const rule = await findCustom();

    await repository.deleteById(rule!.id);

    expect(await findCustom()).toBeUndefined();
  });
});
