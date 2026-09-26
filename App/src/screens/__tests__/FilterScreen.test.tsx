import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { mockRouter } from '../../testing/screenMocks';
import { useTestDatabase } from '../../testing/testDatabase';
import { useFilterStore } from '../../store/filterStore';
import { FilterRuleRepository } from '../../infrastructure/db/FilterRuleRepository';
import FilterScreen from '../FilterScreen';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const mockTranslate = jest.fn();
jest.mock('../../services/RuleTranslationService', () => ({
  translateRuleKeyword: (...args: unknown[]) => mockTranslate(...args),
}));

describe('FilterScreen', () => {
  useTestDatabase();

  beforeEach(async () => {
    mockRouter.reset();
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
});
