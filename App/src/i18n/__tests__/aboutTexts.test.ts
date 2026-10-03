import { createTranslator } from '../useTranslation';

describe.each(['de', 'en'] as const)('about texts (%s)', (language) => {
  const t = createTranslator(language);

  it('names every data source with its licence', () => {
    const text = t('about.dataSourceText');
    expect(text).toMatch(/Open Food Facts.*ODbL/);
    expect(text).toMatch(/USDA FoodData Central.*CC0/);
    expect(text).toMatch(/Wikidata \(CC0\)/);
  });

  it('lists every request that leaves the device and where keys stay', () => {
    const text = t('about.dataPrivacyText');
    expect(text).toContain('USDA FoodData Central');
    expect(text).toContain('Wikidata');
    expect(text).toMatch(/MyMemory/);
    expect(text).toMatch(/Schlüssel|keys/);
  });
});
