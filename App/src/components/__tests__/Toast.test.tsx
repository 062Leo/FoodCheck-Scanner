import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Toast } from '../Toast';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default
);

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps the action reachable as its own button', () => {
    const undo = jest.fn();
    const dismiss = jest.fn();
    render(
      <Toast
        message="Produkt gelöscht"
        type="info"
        action={{ label: 'Rückgängig', onPress: undo }}
        onDismiss={dismiss}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Rückgängig' }));

    expect(undo).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('gives screen reader users more time for the action', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const dismiss = jest.fn();
    render(
      <Toast
        message="Produkt gelöscht"
        type="info"
        action={{ label: 'Rückgängig', onPress: jest.fn() }}
        onDismiss={dismiss}
      />
    );
    await act(async () => {}); // screen reader check

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(dismiss).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss a replacement when the old toast goes away', async () => {
    const dismiss = jest.fn();
    const { rerender } = render(
      <Toast key={1} message="Produkt gelöscht" type="info" onDismiss={dismiss} />
    );
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    rerender(<Toast key={2} message="Produkt gelöscht" type="info" onDismiss={dismiss} />);
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(dismiss).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
