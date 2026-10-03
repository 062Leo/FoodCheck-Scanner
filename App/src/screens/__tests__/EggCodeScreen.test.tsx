import { fireEvent, render, screen } from '@testing-library/react-native';
import { mockRouter } from '../../testing/screenMocks';
import { useLanguageStore } from '../../store/languageStore';
import EggCodeScreen from '../EggCodeScreen';

describe('EggCodeScreen', () => {
  beforeEach(() => {
    mockRouter.reset();
    useLanguageStore.setState({ language: 'de' });
  });

  it('reads a typed code live and shows housing, country and state', async () => {
    render(<EggCodeScreen />);
    const input = await screen.findByTestId('egg-code-input');

    fireEvent.changeText(input, '2-de-0912345');

    expect(input.props.value).toBe('2-DE-0912345');
    expect(input.props.autoCapitalize).toBe('characters');
    expect(screen.getByText('Bodenhaltung – kein Auslauf')).toBeTruthy();
    expect(screen.getByText('Haltungsform 2: Bodenhaltung')).toBeTruthy();
    expect(screen.getByText('Deutschland (DE)')).toBeTruthy();
    expect(screen.getByText('Bayern (09)')).toBeTruthy();
    expect(screen.getByText('1234')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('rates organic eggs as the best housing system', async () => {
    render(<EggCodeScreen />);

    fireEvent.changeText(await screen.findByTestId('egg-code-input'), '0 DE 1612345');

    expect(screen.getByText('Bio – beste Haltungsform')).toBeTruthy();
    expect(screen.getByText('Thüringen (16)')).toBeTruthy();
  });

  it('shows other countries without a state', async () => {
    useLanguageStore.setState({ language: 'en' });
    render(<EggCodeScreen />);

    fireEvent.changeText(await screen.findByTestId('egg-code-input'), '3-AT-1234567');

    expect(screen.getByText('Caged')).toBeTruthy();
    expect(screen.getByText('Austria (AT)')).toBeTruthy();
    expect(screen.getByText('1234567')).toBeTruthy();
    expect(screen.queryByText('Federal state')).toBeNull();
  });

  it('shows an error for an invalid code, but not on the first characters', async () => {
    render(<EggCodeScreen />);
    const input = await screen.findByTestId('egg-code-input');

    fireEvent.changeText(input, '5');
    expect(screen.queryByText('Die erste Ziffer muss 0, 1, 2 oder 3 sein.')).toBeNull();

    fireEvent.changeText(input, '5-DE');
    expect(screen.getByText('Die erste Ziffer muss 0, 1, 2 oder 3 sein.')).toBeTruthy();
    expect(screen.queryByTestId('egg-code-housing')).toBeNull();

    fireEvent.changeText(input, '0-DE-031');
    expect(screen.queryByText(/zu kurz/)).toBeNull();

    fireEvent.changeText(input, '0-DE-1712345');
    expect(screen.getByText(/Unbekanntes Bundesland/)).toBeTruthy();
  });

  it('goes back with the header button', async () => {
    render(<EggCodeScreen />);

    fireEvent.press(await screen.findByLabelText('Zurück'));

    expect(mockRouter.back).toHaveBeenCalled();
  });
});
