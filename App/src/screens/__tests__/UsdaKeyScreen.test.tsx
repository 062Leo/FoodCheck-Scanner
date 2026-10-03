import { Alert, Linking, type AlertButton } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import '../../testing/screenMocks';
import { useLanguageStore } from '../../store/languageStore';
import { useSettingsStore } from '../../store/settingsStore';
import UsdaKeyScreen from '../UsdaKeyScreen';

const mockStored: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStored[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStored[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockStored[key];
  }),
}));

describe('UsdaKeyScreen', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStored)) delete mockStored[key];
    jest.clearAllMocks();
    useLanguageStore.setState({ language: 'de' });
    useSettingsStore.setState({ hasUsdaKey: false, isLoading: false });
  });

  afterEach(() => jest.restoreAllMocks());

  it('treats the key as a secret', async () => {
    render(<UsdaKeyScreen />);

    const field = await screen.findByLabelText('USDA API Key einfügen');

    expect(field.props.secureTextEntry).toBe(true);
    expect(field.props.autoCapitalize).toBe('none');
    expect(field.props.autoCorrect).toBe(false);
    expect(screen.getByText('Kein Key – USDA wird nicht abgefragt')).toBeTruthy();
  });

  it('saves the key in the secure store only', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<UsdaKeyScreen />);
    await waitFor(() => expect(useSettingsStore.getState().isLoading).toBe(false));

    fireEvent.changeText(await screen.findByLabelText('USDA API Key einfügen'), ' test-key ');
    fireEvent.press(screen.getByText('Key speichern'));

    await waitFor(() =>
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('usda_api_key', 'test-key')
    );
    expect(useSettingsStore.getState().hasUsdaKey).toBe(true);
    expect(await screen.findByText('Key konfiguriert')).toBeTruthy();
    expect(screen.getByLabelText('USDA API Key einfügen').props.value).toBe('');
  });

  it('removes the key after confirmation', async () => {
    mockStored.usda_api_key = 'test-key';
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<UsdaKeyScreen />);

    fireEvent.press(await screen.findByText('Key entfernen'));
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    await act(async () => {
      await buttons.find((b) => b.style === 'destructive')?.onPress?.();
    });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('usda_api_key');
    expect(useSettingsStore.getState().hasUsdaKey).toBe(false);
    expect(screen.queryByText('Key entfernen')).toBeNull();
  });

  it('links to the free key sign-up', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<UsdaKeyScreen />);

    fireEvent.press(await screen.findByText('Kostenlosen Schlüssel anfordern'));

    expect(open).toHaveBeenCalledWith('https://fdc.nal.usda.gov/api-key-signup');
  });
});
