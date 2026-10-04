import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { mockRouter } from '../../testing/screenMocks';
import { useTestDatabase } from '../../testing/testDatabase';
import { useFilterStore } from '../../store/filterStore';
import { FilterRuleRepository } from '../../infrastructure/db/FilterRuleRepository';
import { CompanyLookupError } from '../../services/CompanyLookupService';
import FilterScreen from '../FilterScreen';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const mockTranslate = jest.fn();
jest.mock('../../services/RuleTranslationService', () => ({
  translateRuleKeyword: (...args: unknown[]) => mockTranslate(...args),
}));

const mockSearchCompanies = jest.fn();
const mockCollectCompanyNames = jest.fn();
jest.mock('../../services/CompanyLookupService', () => ({
  ...jest.requireActual('../../services/CompanyLookupService'),
  searchCompanies: (...args: unknown[]) => mockSearchCompanies(...args),
  collectCompanyNames: (...args: unknown[]) => mockCollectCompanyNames(...args),
}));

async function storedRule(type: string, key?: string) {
  const rules = await new FilterRuleRepository().findAll();
  return rules.find((rule) => rule.type === type && (key === undefined || rule.key === key));
}

/** Removes the seeded Nestlé rule, for tests that add their own company rules. */
async function removeSeededCompanies() {
  const rules = await new FilterRuleRepository().findAll();
  for (const rule of rules.filter(({ type }) => type === 'company')) {
    await useFilterStore.getState().deleteRule(rule.id);
  }
}

describe('FilterScreen', () => {
  useTestDatabase();

  beforeEach(async () => {
    mockRouter.reset();
    mockTranslate.mockReset();
    mockSearchCompanies.mockReset();
    mockCollectCompanyNames.mockReset();
    useFilterStore.setState({ rules: [], isInitialized: false });
    await useFilterStore.getState().loadRules();
  });

  it('shows only non-empty categories and opens matching ones while searching', async () => {
    render(<FilterScreen />);

    expect(await screen.findByText('Antioxidationsmittel')).toBeTruthy();
    expect(screen.queryByText('Glukosesirup')).toBeNull();

    fireEvent.changeText(screen.getByTestId('rule-search'), 'glukosesirup');

    expect(await screen.findByText('Glukosesirup')).toBeTruthy();
  });

  it('adds a nutrient rule with a comma threshold', async () => {
    render(<FilterScreen />);

    fireEvent.press(await screen.findByLabelText('Regel hinzufügen'));
    fireEvent.press(screen.getByText('Nährwert-Regel'));
    fireEvent.changeText(screen.getByTestId('rule-threshold'), '22,5');
    fireEvent.press(screen.getByTestId('rule-save'));

    await waitFor(async () => {
      const rules = await new FilterRuleRepository().findAll();
      expect(rules.find((r) => r.type === 'nutrient')).toMatchObject({
        key: 'sugars_100g',
        operator: 'gt',
        threshold: 22.5,
        severity: 'red_flag',
      });
    });
    expect(await screen.findByText('Regel gespeichert – Katalog wird neu bewertet.')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('rule-search'), 'Nährwerte');
    expect(await screen.findByText('> 22,5 g pro 100 g')).toBeTruthy();
  });

  it('stays open while a new rule is being translated and saved', async () => {
    let finishTranslation: (value: string | null) => void = () => {};
    mockTranslate.mockImplementation(() => new Promise((resolve) => (finishTranslation = resolve)));
    render(<FilterScreen />);

    fireEvent.press(await screen.findByLabelText('Regel hinzufügen'));
    fireEvent.changeText(screen.getByTestId('rule-keyword'), 'Kokosblütenzucker');
    fireEvent.press(screen.getAllByText('Zucker & Sirupe').at(-1)!); // the chip in the sheet
    fireEvent.press(screen.getByTestId('rule-save'));
    fireEvent.press(screen.getAllByLabelText('Abbrechen')[0]);

    expect(screen.getByTestId('rule-keyword')).toBeTruthy();
    expect(mockTranslate).toHaveBeenCalledWith('Kokosblütenzucker');
    await act(async () => finishTranslation(JSON.stringify({ en: 'coconut blossom sugar' })));
    expect(await screen.findByText('Regel gespeichert – Katalog wird neu bewertet.')).toBeTruthy();
  });

  it('shows check rules with a readable title and edits the ingredient limit', async () => {
    render(<FilterScreen />);

    fireEvent.changeText(await screen.findByTestId('rule-search'), 'Zutaten');
    fireEvent.press(await screen.findByText('Mehr als 5 Zutaten'));

    // No type tabs and no keyword for a check, but its explanation and the limit.
    expect(screen.queryByText('Zutaten-Regel')).toBeNull();
    expect(screen.queryByTestId('rule-keyword')).toBeNull();
    expect(
      screen.getByText(/Zusammengesetzte Zutaten zählen mit ihren Bestandteilen/)
    ).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('rule-check-threshold'), '0');
    fireEvent.press(screen.getByTestId('rule-save'));
    expect(screen.getByText('Bitte eine ganze Zahl ab 1 eingeben.')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('rule-check-threshold'), '8');
    fireEvent.press(screen.getByTestId('rule-save'));

    expect(await screen.findByText('Mehr als 8 Zutaten')).toBeTruthy();
    expect(await storedRule('check', 'ingredient_count')).toMatchObject({
      threshold: 8,
      operator: 'gt',
      category: 'Verarbeitung',
      severity: 'red_flag',
    });
  });

  it('shows other checks with their description and without a limit field', async () => {
    render(<FilterScreen />);

    fireEvent.changeText(await screen.findByTestId('rule-search'), 'Pestizid');
    expect(await screen.findByText('Pestizid-Risiko-Kulturen ohne Bio')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('rule-search'), 'Konserve');
    fireEvent.press(await screen.findByText('Konserve oder Dose'));

    expect(screen.getAllByText(/Dosenbeschichtungen können Bisphenole/).length).toBeGreaterThan(1);
    expect(screen.queryByTestId('rule-check-threshold')).toBeNull();
    expect(screen.queryByTestId('rule-keyword')).toBeNull();
    // A check cannot be deleted, only switched off.
    expect(screen.queryByText('Löschen')).toBeNull();
    expect(screen.getByText(/Prüfungen lassen sich nicht löschen/)).toBeTruthy();
    fireEvent.press(screen.getByText('Erlaubt'));
    expect(
      screen.getByText('Diese Prüfung ist ausgeschaltet und zählt nie als Red Flag.')
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('rule-save'));

    await waitFor(async () =>
      expect(await storedRule('check', 'canned')).toMatchObject({ severity: 'ok' })
    );
    expect(await screen.findByText('Regel gespeichert – Katalog wird neu bewertet.')).toBeTruthy();
  });

  it('adds a company with the brands picked from the Wikidata lookup', async () => {
    const companyData = { wikidataId: 'Q160746', names: ['Nestlé', 'Maggi', 'Thomy'] };
    mockSearchCompanies.mockResolvedValue([
      { id: 'Q160746', label: 'Nestlé', description: 'Schweizer Lebensmittelkonzern' },
      { id: 'Q37485297', label: 'Nestle', description: 'Familienname' },
    ]);
    mockCollectCompanyNames.mockResolvedValue(companyData);
    await removeSeededCompanies();
    render(<FilterScreen />);

    fireEvent.press(await screen.findByLabelText('Regel hinzufügen'));
    fireEvent.press(screen.getByText('Marke / Konzern'));
    expect(
      screen.getByText(
        'Produkte dieser Marke bzw. dieses Konzerns und seiner Marken werden sofort als kritisch bewertet.'
      )
    ).toBeTruthy();
    expect(screen.getByText('Daten: Wikidata (CC0)')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('rule-company-name'), 'Nestlé');
    fireEvent.press(screen.getByTestId('company-lookup'));

    fireEvent.press(await screen.findByText('Nestlé – Schweizer Lebensmittelkonzern'));
    expect(await screen.findByText('3 zugehörige Marken gefunden')).toBeTruthy();
    expect(mockSearchCompanies).toHaveBeenCalledWith('Nestlé', 'de', expect.anything());
    expect(mockCollectCompanyNames).toHaveBeenCalledWith('Q160746', expect.anything());
    fireEvent.press(screen.getByText('Namen anzeigen'));
    expect(screen.getByText('3 von 3 Marken aktiv')).toBeTruthy();
    expect(screen.getByTestId('company-name-Thomy')).toBeTruthy();
    fireEvent.press(screen.getByTestId('rule-save'));

    await waitFor(async () => {
      const rule = await storedRule('company');
      expect(rule).toMatchObject({
        key: 'Nestlé',
        category: 'Marken & Konzerne',
        severity: 'red_flag',
      });
      expect(JSON.parse(rule!.translations!)).toEqual(companyData);
    });
    expect(await screen.findByText('Regel gespeichert – Katalog wird neu bewertet.')).toBeTruthy();
    expect(mockTranslate).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId('rule-search'), 'Nestlé');
    expect(await screen.findByText('Marke/Konzern · 3 zugehörige Marken')).toBeTruthy();

    // The same company cannot be added twice.
    fireEvent.press(screen.getByLabelText('Regel hinzufügen'));
    fireEvent.press(screen.getByText('Marke / Konzern'));
    fireEvent.changeText(screen.getByTestId('rule-company-name'), 'Nestle AG');
    fireEvent.press(screen.getByTestId('rule-save'));
    expect(
      screen.getByText('Diese Marke bzw. dieser Konzern ist schon in der Liste.')
    ).toBeTruthy();
    await waitFor(async () => {
      const rules = await new FilterRuleRepository().findAll();
      expect(rules.filter((rule) => rule.type === 'company')).toHaveLength(1);
    });
  });

  it('saves a company by name only, also when the lookup fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockSearchCompanies
      .mockRejectedValueOnce(new CompanyLookupError('Wikidata returned HTTP 503', 'server'))
      .mockRejectedValueOnce(new CompanyLookupError('Network request failed', 'network'));
    render(<FilterScreen />);

    fireEvent.press(await screen.findByLabelText('Regel hinzufügen'));
    fireEvent.press(screen.getByText('Marke / Konzern'));
    fireEvent.changeText(screen.getByTestId('rule-company-name'), 'Hipp');
    fireEvent.press(screen.getByTestId('company-lookup'));
    expect(await screen.findByText(/Die Abfrage bei Wikidata ist fehlgeschlagen/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('company-lookup'));
    expect(await screen.findByText(/Wikidata ist gerade nicht erreichbar/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('rule-save'));

    await waitFor(async () =>
      expect(await storedRule('company', 'Hipp')).toMatchObject({ translations: null })
    );
    expect(mockTranslate).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId('rule-search'), 'Hipp');
    expect(await screen.findByText('Marke/Konzern · nur Name, keine Konzerndaten')).toBeTruthy();
    jest.restoreAllMocks();
  });

  it('keeps the brands of a company rule when it is saved again', async () => {
    const companyData = { wikidataId: 'Q160746', names: ['Nestlé', 'Maggi'] };
    await removeSeededCompanies();
    await useFilterStore.getState().addRule({
      type: 'company',
      key: 'Nestlé',
      category: 'Marken & Konzerne',
      severity: 'red_flag',
      translations: JSON.stringify(companyData),
    });
    mockCollectCompanyNames.mockResolvedValue({
      ...companyData,
      names: ['Nestlé', 'Maggi', 'KitKat'],
    });
    render(<FilterScreen />);

    fireEvent.changeText(await screen.findByTestId('rule-search'), 'Nestlé');
    fireEvent.press(await screen.findByText('Nestlé'));
    expect(screen.getByText('2 zugehörige Marken gefunden')).toBeTruthy();
    fireEvent.press(screen.getByText('Erneut abfragen'));
    expect(await screen.findByText('3 zugehörige Marken gefunden')).toBeTruthy();
    expect(mockCollectCompanyNames).toHaveBeenCalledWith('Q160746', expect.anything());
    fireEvent.press(screen.getByTestId('rule-save'));

    await waitFor(async () =>
      expect(JSON.parse((await storedRule('company'))!.translations!).names).toEqual([
        'Nestlé',
        'Maggi',
        'KitKat',
      ])
    );
    expect(mockTranslate).not.toHaveBeenCalled();
    expect(await screen.findByText('Regel gespeichert – Katalog wird neu bewertet.')).toBeTruthy();
  });

  it('starts with Nestlé as an avoided company with generic names switched off', async () => {
    render(<FilterScreen />);

    fireEvent.changeText(await screen.findByTestId('rule-search'), 'Nestlé');
    expect(await screen.findByText('Marke/Konzern · 216 zugehörige Marken')).toBeTruthy();
    fireEvent.press(screen.getByText('Nestlé'));
    fireEvent.press(screen.getByText('Namen anzeigen'));
    expect(screen.getByText('197 von 216 Marken aktiv')).toBeTruthy();
  });

  it('shows a water test rule with its reason and sources and changes its severity', async () => {
    render(<FilterScreen />);

    fireEvent.changeText(await screen.findByTestId('rule-search'), 'Gerolsteiner');
    expect(await screen.findByText('Wasser-Tests')).toBeTruthy();
    expect(
      screen.getByText('Wasser der Marke „Gerolsteiner“ mit „Naturell“ im Namen')
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Gerolsteiner Naturell'));

    expect(screen.getByText('Begründung')).toBeTruthy();
    expect(
      screen.getByText('Öko-Test 07/2025: nur „befriedigend“ – erhöhtes Chrom(VI).')
    ).toBeTruthy();
    expect(screen.getByText('Quellen')).toBeTruthy();
    expect(screen.getByText(/www\.heidelberg24\.de\/verbraucher/)).toBeTruthy();
    expect(screen.queryByTestId('rule-keyword')).toBeNull();
    expect(screen.getByText('Löschen')).toBeTruthy();
    fireEvent.press(screen.getByText('Erlaubt'));
    expect(
      screen.getByText('Diese Regel ist ausgeschaltet und zählt nie als Red Flag.')
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('rule-save'));

    await waitFor(async () =>
      expect(await storedRule('product', 'Gerolsteiner Naturell')).toMatchObject({
        severity: 'ok',
        category: 'Wasser-Tests',
        translations: expect.stringContaining('"brand":"Gerolsteiner"'),
      })
    );
    expect(mockTranslate).not.toHaveBeenCalled();
  });
});
