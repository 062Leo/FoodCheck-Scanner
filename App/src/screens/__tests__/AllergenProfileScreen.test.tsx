import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '../../testing/screenMocks';
import { useTestDatabase } from '../../testing/testDatabase';
import { useAllergenStore } from '../../store/allergenStore';
import { useLanguageStore } from '../../store/languageStore';
import AllergenProfileScreen from '../AllergenProfileScreen';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

describe('AllergenProfileScreen', () => {
  useTestDatabase();

  beforeEach(async () => {
    useLanguageStore.setState({ language: 'de' });
    await useAllergenStore.getState().loadProfile();
  });

  it('lists the 14 EU allergens; tapping a row switches it on', async () => {
    render(<AllergenProfileScreen />);

    expect(screen.getAllByRole('switch')).toHaveLength(14);
    fireEvent.press(screen.getByRole('switch', { name: 'Erdnüsse' }));

    await waitFor(() => expect(useAllergenStore.getState().profile).toEqual(['peanuts']));
    expect(screen.getByRole('switch', { name: 'Erdnüsse' }).props.accessibilityState).toMatchObject(
      { checked: true }
    );
    expect(screen.getByText(/prüfe immer die Verpackung/)).toBeTruthy();
  });

  it('says when the selection could not be loaded and blocks changes', () => {
    useAllergenStore.setState({ status: 'error' });
    render(<AllergenProfileScreen />);

    expect(screen.getByText(/konnte nicht geladen werden/)).toBeTruthy();
    fireEvent.press(screen.getByRole('switch', { name: 'Milch' }));
    expect(useAllergenStore.getState().profile).toEqual([]);
  });
});
