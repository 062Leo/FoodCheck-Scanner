import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useLanguageStore } from '../../store/languageStore';
import { OffAccountSetup } from '../OffAccountSetup';

const mockSaveCredentials = jest.fn();
jest.mock('../../infrastructure/api/OpenFoodFactsWriteClient', () => {
  const actual = jest.requireActual('../../infrastructure/api/OpenFoodFactsWriteClient');
  return {
    ...actual,
    OpenFoodFactsWriteClient: jest.fn().mockImplementation(() => ({
      saveCredentials: (...args: unknown[]) => mockSaveCredentials(...args),
    })),
  };
});

describe('OffAccountSetup', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'de' });
    mockSaveCredentials.mockReset();
  });

  function fillIn() {
    fireEvent.changeText(screen.getByLabelText('Benutzername'), 'tester');
    fireEvent.changeText(screen.getByLabelText('Passwort'), 'secret');
  }

  it('does not log in after the user cancelled during the check', async () => {
    let finish: () => void = () => {};
    mockSaveCredentials.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve))
    );
    const onSuccess = jest.fn();
    const onCancel = jest.fn();
    render(<OffAccountSetup visible onSuccess={onSuccess} onCancel={onCancel} />);

    fillIn();
    fireEvent.press(screen.getByText('Speichern & Weiter'));
    fireEvent.press(screen.getByLabelText('Abbrechen'));
    const signal = mockSaveCredentials.mock.calls[0][2] as AbortSignal;
    await act(async () => finish());

    expect(signal.aborted).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('checks only once when saving is triggered twice', async () => {
    mockSaveCredentials.mockImplementation(() => new Promise<void>(() => {}));
    render(<OffAccountSetup visible onSuccess={jest.fn()} onCancel={jest.fn()} />);

    fillIn();
    fireEvent(screen.getByLabelText('Passwort'), 'submitEditing');
    fireEvent(screen.getByLabelText('Passwort'), 'submitEditing');

    expect(mockSaveCredentials).toHaveBeenCalledTimes(1);
  });
});
