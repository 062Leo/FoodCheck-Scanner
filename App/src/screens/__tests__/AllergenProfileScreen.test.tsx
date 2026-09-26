import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '../../testing/screenMocks';
import { useTestDatabase } from '../../testing/testDatabase';
import { useAllergenStore } from '../../store/allergenStore';
import { useLanguageStore } from '../../store/languageStore';
import AllergenProfileScreen from '../AllergenProfileScreen';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

describe('AllergenProfileScreen', () => {
  useTestDatabase();

  beforeEach(() => {
    useLanguageStore.setState({ language: 'de' });
    useAllergenStore.setState({ profile: [] });
  });

  it('lists the 14 EU allergens and saves a selection', async () => {
    render(<AllergenProfileScreen />);

    expect(screen.getAllByRole('switch')).toHaveLength(14);
    fireEvent(screen.getByLabelText('Erdnüsse'), 'valueChange', true);

    await waitFor(() => expect(useAllergenStore.getState().profile).toEqual(['peanuts']));
    expect(screen.getByLabelText('Erdnüsse').props.value).toBe(true);
    expect(screen.getByText(/prüfe immer die Verpackung/)).toBeTruthy();
  });
});
