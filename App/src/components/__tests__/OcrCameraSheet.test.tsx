import { Alert, Modal } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '../../testing/screenMocks';
import { OcrCameraSheet } from '../OcrCameraSheet';

jest.mock('expo-camera', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
    CameraView: forwardRef((_props: unknown, ref: unknown) => {
      useImperativeHandle(ref, () => ({
        takePictureAsync: async () => ({ uri: 'file:///photo.jpg', width: 4000, height: 3000 }),
      }));
      return <View testID="camera" />;
    }),
  };
});
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async () => ({ uri: 'file:///cropped.jpg', width: 1, height: 1 })),
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockRecognize = jest.fn();
jest.mock('../../infrastructure/ocr/OcrService', () => {
  class OcrError extends Error {
    code: string;
    constructor(message: string, _detail?: unknown, code = 'failed') {
      super(message);
      this.code = code;
    }
  }
  return {
    OcrError,
    OcrService: { recognizeText: (...args: unknown[]) => mockRecognize(...args) },
  };
});
const mockCloud = jest.fn();
jest.mock('../../infrastructure/api/OffOcrClient', () => ({
  ...jest.requireActual('../../infrastructure/api/OffOcrClient'),
  OffOcrClient: jest.fn().mockImplementation(() => ({
    extractText: (...args: unknown[]) => mockCloud(...args),
  })),
}));

async function photographAndRecognise() {
  fireEvent.press(await screen.findByTestId('ocr-capture'));
  fireEvent.press(await screen.findByText('Ganzes Foto'));
}

describe('OcrCameraSheet', () => {
  beforeEach(() => {
    mockRecognize.mockReset();
    mockCloud.mockReset();
  });

  it('recognises ingredients on the device and returns one cleaned paragraph', async () => {
    mockRecognize.mockResolvedValue('Zutaten: Wasser, Zu-\ncker,\nSalz');
    const onConfirm = jest.fn();
    render(
      <OcrCameraSheet
        visible
        mode="ingredients"
        barcode="1"
        lang="de"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    await photographAndRecognise();

    expect(await screen.findByText(/das Foto hat das Handy nicht verlassen/)).toBeTruthy();
    expect(screen.getByTestId('ocr-text').props.value).toBe('Zutaten: Wasser, Zucker, Salz');
    fireEvent.press(screen.getByTestId('ocr-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('Zutaten: Wasser, Zucker, Salz');
    expect(mockCloud).not.toHaveBeenCalled();
  });

  it('asks before the Android back button throws away recognised text', async () => {
    mockRecognize.mockResolvedValue('Wasser, Salz');
    const onCancel = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(
      <OcrCameraSheet
        visible
        mode="ingredients"
        barcode="1"
        lang="de"
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );
    await photographAndRecognise();
    await screen.findByTestId('ocr-text');

    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());

    expect(onCancel).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      'Ungespeicherte Änderungen',
      expect.any(String),
      expect.any(Array)
    );
    alert.mockRestore();
  });

  it('uploads to Open Food Facts only after explicit consent', async () => {
    mockRecognize.mockRejectedValue(new Error('ML Kit not linked'));
    mockCloud.mockResolvedValue('Fett 3 g');
    const alert = jest.spyOn(Alert, 'alert');
    render(
      <OcrCameraSheet
        visible
        mode="nutriments"
        barcode="3017624010701"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    await photographAndRecognise();
    expect(await screen.findByText(/Texterkennung auf dem Gerät ist nicht möglich/)).toBeTruthy();

    fireEvent.press(screen.getByText('Stattdessen von Open Food Facts erkennen lassen'));
    expect(alert).toHaveBeenCalled();
    expect(mockCloud).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === 'Hochladen')?.onPress?.());

    await waitFor(() =>
      expect(mockCloud).toHaveBeenCalledWith(
        '3017624010701',
        expect.any(String),
        'nutrition',
        'de',
        expect.anything()
      )
    );
    await waitFor(() => expect(screen.getByTestId('ocr-text').props.value).toBe('Fett 3 g'));
  });

  it('says so when the photo contains no text', async () => {
    const { OcrError } = jest.requireMock('../../infrastructure/ocr/OcrService');
    mockRecognize.mockRejectedValue(new OcrError('empty', undefined, 'no-text'));
    render(
      <OcrCameraSheet
        visible
        mode="ingredients"
        barcode="1"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    await photographAndRecognise();

    expect(await screen.findByText(/Kein Text erkannt/)).toBeTruthy();
    expect(screen.queryByText(/Texterkennung auf dem Gerät ist nicht möglich/)).toBeNull();
  });

  it('cancels a running cloud recognition and keeps the device result on failure', async () => {
    mockRecognize.mockResolvedValue('Fett 3 g');
    let signal: AbortSignal | undefined;
    mockCloud.mockImplementation(
      (_code: string, _uri: string, _field: string, _lang: string, abort: AbortSignal) => {
        signal = abort;
        return new Promise((_resolve, reject) =>
          abort.addEventListener('abort', () => reject(new Error('cancelled')))
        );
      }
    );
    const alert = jest.spyOn(Alert, 'alert');
    alert.mockClear();
    render(
      <OcrCameraSheet
        visible
        mode="nutriments"
        barcode="3017624010701"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    await photographAndRecognise();
    fireEvent.press(await screen.findByText('Stattdessen von Open Food Facts erkennen lassen'));
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === 'Hochladen')?.onPress?.());

    fireEvent.press(await screen.findByText('Abbrechen'));
    expect(signal?.aborted).toBe(true);

    fireEvent.press(await screen.findByText('Ganzes Foto'));
    mockCloud.mockRejectedValue(new Error('HTTP 500'));
    fireEvent.press(await screen.findByText('Stattdessen von Open Food Facts erkennen lassen'));
    const retry = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
    await act(async () => retry.find((b) => b.text === 'Hochladen')?.onPress?.());

    expect(await screen.findByText(/das Foto hat das Handy nicht verlassen/)).toBeTruthy();
    expect(screen.getByText('Stattdessen von Open Food Facts erkennen lassen')).toBeTruthy();
    expect(screen.getByTestId('ocr-text').props.value).toBe('Fett 3 g');
  });
});
