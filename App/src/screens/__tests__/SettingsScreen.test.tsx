import { Alert, Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { mockRouter } from '../../testing/screenMocks';
import { useTestDatabase } from '../../testing/testDatabase';
import { useFilterStore } from '../../store/filterStore';
import { useLanguageStore } from '../../store/languageStore';
import { useAllergenStore } from '../../store/allergenStore';
import * as DatabaseService from '../../infrastructure/db/DatabaseService';
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

    expect(screen.getByText(/777 Regeln/)).toBeTruthy();
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/filters');
  });

  it('opens the egg code reader', async () => {
    render(<SettingsScreen />);

    fireEvent.press(await screen.findByText('Eiercode prüfen'));

    expect(mockRouter.push).toHaveBeenCalledWith('/egg-code');
  });

  it('opens the USDA key settings', async () => {
    render(<SettingsScreen />);

    fireEvent.press(await screen.findByText('USDA FoodData Central'));

    expect(mockRouter.push).toHaveBeenCalledWith('/settings/usda-key');
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

  it('offers a retry when the allergen settings could not be loaded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const read = jest
      .spyOn(DatabaseService, 'getMetaValue')
      .mockRejectedValueOnce(new Error('locked'));
    await useAllergenStore.getState().loadProfile();
    render(<SettingsScreen />);

    expect(await screen.findByText(/konnte nicht geladen werden/)).toBeTruthy();
    expect(screen.getByTestId('allergen-warning-switch').props.value).toBe(false);

    read.mockRestore();
    fireEvent.press(screen.getByText('Erneut versuchen'));

    await waitFor(() => expect(useAllergenStore.getState().status).toBe('ready'));
    expect(screen.queryByText(/konnte nicht geladen werden/)).toBeNull();
    expect(screen.queryByText('Erneut versuchen')).toBeNull();
  });

  it('tells the user when switching the warning could not be saved', async () => {
    await useAllergenStore.getState().loadProfile();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(DatabaseService, 'setMetaValue').mockRejectedValueOnce(new Error('disk full'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<SettingsScreen />);

    fireEvent(await screen.findByTestId('allergen-warning-switch'), 'valueChange', true);

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Allergen-Warnung',
        'Die Einstellung konnte nicht gespeichert werden.'
      )
    );
    expect(useAllergenStore.getState().enabled).toBe(false);
  });
});
