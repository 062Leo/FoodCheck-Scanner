import { Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { mockRouter } from '../../testing/screenMocks';
import { useTestDatabase } from '../../testing/testDatabase';
import { useFilterStore } from '../../store/filterStore';
import { useLanguageStore } from '../../store/languageStore';
import { useAllergenStore } from '../../store/allergenStore';
import { SEEDED_RULES } from '../../domain/analysis/__fixtures__/goldenRuleSets';
import SettingsScreen from '../SettingsScreen';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

describe('SettingsScreen', () => {
  useTestDatabase();

  beforeEach(() => {
    mockRouter.reset();
    useLanguageStore.setState({ language: 'de' });
    useFilterStore.setState({ rules: SEEDED_RULES, isInitialized: true });
  });

  it('shows the number of rules and opens the rule editor', async () => {
    render(<SettingsScreen />);

    fireEvent.press(await screen.findByText('Filter-Regeln'));

    expect(screen.getByText(/678 Regeln/)).toBeTruthy();
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/filters');
  });

  it('switches the app language immediately', async () => {
    render(<SettingsScreen />);

    fireEvent.press(await screen.findByText('English'));

    await waitFor(() => expect(screen.getByText('Settings')).toBeTruthy());
    expect(useLanguageStore.getState().language).toBe('en');
  });

  it('keeps backup actions disabled until a folder is chosen', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    render(<SettingsScreen />);

    const button = await screen.findByText('Backup erstellen');
    expect(screen.getByText('Kein Ordner gewählt')).toBeTruthy();
    fireEvent.press(button);
    expect(screen.queryByText('Backup gespeichert.')).toBeNull();
  });

  it('explains on iOS that folder backups are Android-only', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    render(<SettingsScreen />);

    expect(await screen.findByText(/nur unter Android/)).toBeTruthy();
    expect(screen.queryByText('Kein Ordner gewählt')).toBeNull();
  });

  it('offers the allergen list only when the warning is switched on', async () => {
    await useAllergenStore.getState().loadProfile();
    render(<SettingsScreen />);

    expect(await screen.findByText('Allergen-Warnung')).toBeTruthy();
    expect(screen.queryByText('Meine Allergene')).toBeNull();

    fireEvent(screen.getByTestId('allergen-warning-switch'), 'valueChange', true);

    expect(await screen.findByText('Meine Allergene')).toBeTruthy();
    expect(useAllergenStore.getState().enabled).toBe(true);
  });
});
