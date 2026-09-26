import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '../../testing/screenMocks';
import { useLanguageStore } from '../../store/languageStore';
import { useSettingsStore } from '../../store/settingsStore';
import ApiKeyScreen from '../ApiKeyScreen';

jest.mock('expo-secure-store', () => ({
  // The stored provider is DeepL, so loading the settings keeps the screen on DeepL.
  getItemAsync: jest.fn(async (key: string) => (key === 'translation_provider' ? 'deepl' : null)),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

describe('ApiKeyScreen', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'de' });
    useSettingsStore.setState({ provider: 'deepl', hasDeepLKey: false, hasMyMemoryKey: false });
  });

  it('treats the key as a secret', async () => {
    render(<ApiKeyScreen />);

    const field = await screen.findByLabelText('DeepL API Key einfügen');

    expect(field.props.secureTextEntry).toBe(true);
    expect(field.props.autoCapitalize).toBe('none');
    expect(field.props.autoCorrect).toBe(false);
  });

  it('does not carry a typed key over to another provider', async () => {
    render(<ApiKeyScreen />);
    await waitFor(() => expect(useSettingsStore.getState().isLoading).toBe(false));
    fireEvent.changeText(await screen.findByLabelText('DeepL API Key einfügen'), 'abc:fx');

    fireEvent.press(screen.getByText('MyMemory'));

    await waitFor(() =>
      expect(screen.getByLabelText('MyMemory API Key einfügen').props.value).toBe('')
    );
  });
});
