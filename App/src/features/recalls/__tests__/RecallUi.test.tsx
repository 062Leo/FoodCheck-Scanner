import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { mockRouter } from '../../../testing/screenMocks';
import { useTestDatabase } from '../../../testing/testDatabase';
import type { Recall } from '../../../domain/recalls/recall';
import type { Product } from '../../../types/Product';
import { useLanguageStore } from '../../../store/languageStore';
import { useRecallStore } from '../../../store/recallStore';
import { createTranslator } from '../../../i18n/useTranslation';
import { RecallService } from '../../../services/RecallService';
import RecallsScreen from '../../../screens/RecallsScreen';
import SettingsScreen from '../../../screens/SettingsScreen';
import { RecallWarning } from '../RecallWarning';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const EAN = '4006381333931';
const RECALL: Recall = {
  id: 'r1',
  title: 'Sesampaste (Tahina), 12x800 Gramm',
  productName: 'Sesampaste (Tahina), Marke: Chtoura Garden, 12x800 Gramm',
  brand: 'Chtoura Garden',
  manufacturer: 'Beispielfirma',
  reason: 'Krankheitserreger',
  publishedAt: Date.now() - 24 * 60 * 60 * 1000,
  link: 'https://www.lebensmittelwarnung.de/meldung.html',
  imageUrl: null,
  states: ['Bayern'],
  eans: [],
};

const t = createTranslator('de');
const product = (overrides: Partial<Product> = {}): Product => ({
  ean: EAN,
  name: 'Sesampaste Tahina',
  brand: 'Chtoura Garden',
  ...overrides,
});

describe('recalls in the UI', () => {
  useTestDatabase();

  beforeEach(() => {
    mockRouter.reset();
    useLanguageStore.setState({ language: 'de' });
    useRecallStore.setState({ visible: true, recalls: [RECALL], load: async () => undefined });
  });

  it('lists the warnings with source note and opens the official page', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<RecallsScreen />);

    expect(screen.getByText('Quelle: lebensmittelwarnung.de (offizieller RSS-Feed)')).toBeTruthy();
    expect(screen.getByText(RECALL.title)).toBeTruthy();
    expect(screen.getByText('Grund: Krankheitserreger')).toBeTruthy();
    expect(screen.getByText('Bundesländer: Bayern')).toBeTruthy();

    fireEvent.press(screen.getByText('Meldung öffnen'));
    expect(openURL).toHaveBeenCalledWith(RECALL.link);
  });

  it('shows "möglicherweise betroffen" for a match by name', () => {
    render(<RecallWarning product={product()} t={t} language="de" />);

    expect(screen.getByText('Möglicherweise betroffen')).toBeTruthy();
    expect(screen.getByText(RECALL.title)).toBeTruthy();
  });

  it('names the recall directly for a match by barcode', () => {
    useRecallStore.setState({ recalls: [{ ...RECALL, eans: [EAN] }] });
    render(
      <RecallWarning product={product({ name: 'Anderes', brand: 'Andere' })} t={t} language="de" />
    );

    expect(screen.getByText('Rückruf für dieses Produkt')).toBeTruthy();
  });

  it('shows nothing for unrelated products', () => {
    render(
      <RecallWarning product={product({ name: 'Hummus', brand: 'Andere' })} t={t} language="de" />
    );
    expect(screen.queryByTestId('recall-warning')).toBeNull();
  });

  it('opens the recall list from the settings', async () => {
    render(<SettingsScreen />);

    fireEvent.press(await screen.findByText('Rückrufe'));
    expect(mockRouter.push).toHaveBeenCalledWith('/recalls');
  });

  it('hides everything when the source fails', async () => {
    const service = new RecallService({
      fetchRecalls: async () => {
        throw new Error('HTTP 500');
      },
      isOnline: async () => true,
      readState: async () => null,
      writeState: async () => undefined,
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    useRecallStore.setState({ load: useRecallStore.getInitialState().load });
    await useRecallStore.getState().load(service);
    warn.mockRestore();

    expect(useRecallStore.getState().visible).toBe(false);
    render(<SettingsScreen />);
    await screen.findByText('Datenquellen & Schlüssel');
    expect(screen.queryByText('Rückrufe')).toBeNull();

    render(<RecallWarning product={product()} t={t} language="de" />);
    expect(screen.queryByTestId('recall-warning')).toBeNull();
  });
});
