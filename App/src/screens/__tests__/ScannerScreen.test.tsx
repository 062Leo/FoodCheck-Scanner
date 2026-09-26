import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { mockRouter } from '../../testing/screenMocks';
import * as Haptics from 'expo-haptics';
import { useTestDatabase } from '../../testing/testDatabase';
import { useFilterStore } from '../../store/filterStore';
import { useAllergenStore } from '../../store/allergenStore';
import { rateProduct } from '../../domain/analysis/rateProduct';
import { SEEDED_RULES } from '../../domain/analysis/__fixtures__/goldenRuleSets';
import type { Product } from '../../types/Product';
import ScannerScreen from '../ScannerScreen';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
  addEventListener: jest.fn(() => jest.fn()),
}));

const mockPermission = { current: { granted: true, canAskAgain: true } };
const mockRequestPermission = jest.fn();
const mockCamera: { onBarcodeScanned?: (result: { data: string }) => void } = {};

jest.mock('expo-camera', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    useCameraPermissions: () => [mockPermission.current, mockRequestPermission],
    CameraView: forwardRef(
      (props: { onBarcodeScanned?: (result: { data: string }) => void }, ref: unknown) => {
        useImperativeHandle(ref, () => ({ pausePreview: jest.fn(), resumePreview: jest.fn() }));
        mockCamera.onBarcodeScanned = props.onBarcodeScanned;
        return <View testID="camera" />;
      }
    ),
  };
});

const mockLookup = jest.fn();
jest.mock('../../services/ProductLookupService', () => ({
  ProductLookupService: jest.fn().mockImplementation(() => ({
    lookup: (...args: unknown[]) => mockLookup(...args),
    lookupLocal: jest.fn(),
  })),
}));

const EAN = '4006381333931';
const product: Product = {
  ean: EAN,
  name: 'Instantnudeln',
  ingredientsText: 'Weizenmehl, Palmöl, Geschmacksverstärker Mononatriumglutamat',
  novaScore: 4,
};

function scan(code: string) {
  act(() => mockCamera.onBarcodeScanned?.({ data: code }));
}

describe('ScannerScreen', () => {
  useTestDatabase();

  beforeEach(() => {
    mockRouter.reset();
    mockLookup.mockReset();
    mockRequestPermission.mockReset();
    mockPermission.current = { granted: true, canAskAgain: true };
    useFilterStore.setState({ rules: SEEDED_RULES, isInitialized: true });
    useAllergenStore.setState({ enabled: false, profile: [] });
    mockLookup.mockResolvedValue({
      status: 'found',
      product,
      rating: rateProduct(product, SEEDED_RULES),
      record: null,
      source: 'network',
      networkFailed: false,
      isStale: false,
    });
  });

  it('shows the result of a scan on the scanner and opens the details', async () => {
    render(<ScannerScreen />);

    scan(EAN);

    expect(await screen.findByText('Instantnudeln')).toBeTruthy();
    expect(screen.getByText('Kritisch')).toBeTruthy();
    expect(screen.getByText('Hochverarbeitet (NOVA 4)')).toBeTruthy();
    expect(mockLookup).toHaveBeenCalledWith(EAN, 'scan', SEEDED_RULES);

    fireEvent.press(screen.getByText('Instantnudeln'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/result',
      params: { ean: EAN, source: 'recent' },
    });
  });

  it('warns on the scan card about allergens from the profile', async () => {
    useAllergenStore.setState({ enabled: true, profile: ['gluten', 'milk'] });
    const withAllergens = { ...product, allergensTags: ['en:gluten'], traces: 'en:milk' };
    mockLookup.mockResolvedValue({
      status: 'found',
      product: withAllergens,
      rating: rateProduct(withAllergens, SEEDED_RULES),
      record: null,
      source: 'network',
      networkFailed: false,
      isStale: false,
    });
    render(<ScannerScreen />);

    scan(EAN);

    expect(await screen.findByText('Enthält Gluten')).toBeTruthy();
    expect(screen.getByText('Kann Spuren enthalten: Milch')).toBeTruthy();
    // The screen reader hears the allergen before the rating.
    expect(
      screen.getByLabelText(/^Enthält Gluten\. Kann Spuren enthalten: Milch\. Instantnudeln/)
    ).toBeTruthy();
  });

  it('does not vibrate "all good" for an OK product with a profile allergen', async () => {
    useAllergenStore.setState({ enabled: true, profile: ['milk'] });
    const water = {
      ean: EAN,
      name: 'Milchbrötchen',
      ingredientsText: 'Wasser',
      novaScore: 1 as const,
    };
    const withMilk = { ...water, allergensTags: ['en:milk'] };
    const rating = rateProduct(withMilk, SEEDED_RULES);
    expect(rating.status).toBe('OK');
    mockLookup.mockResolvedValue({
      status: 'found',
      product: withMilk,
      rating,
      record: null,
      source: 'network',
      networkFailed: false,
      isStale: false,
    });
    render(<ScannerScreen />);

    scan(EAN);

    expect(await screen.findByText('Enthält Milch')).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('warning');
  });

  it('ignores misreads with a wrong check digit', async () => {
    render(<ScannerScreen />);

    scan('4006381333932');
    scan('12345');

    await waitFor(() => expect(mockLookup).not.toHaveBeenCalled());
  });

  it('looks a code up only once while it stays in front of the camera', async () => {
    render(<ScannerScreen />);

    scan(EAN);
    scan(EAN);
    await screen.findByText('Instantnudeln');
    scan(EAN);

    expect(mockLookup).toHaveBeenCalledTimes(1);
  });

  it('accepts UPC-A codes as EAN-13', async () => {
    render(<ScannerScreen />);

    scan('036000291452');

    await waitFor(() =>
      expect(mockLookup).toHaveBeenCalledWith('0036000291452', 'scan', SEEDED_RULES)
    );
  });

  it('offers to add a product unknown to Open Food Facts', async () => {
    mockLookup.mockResolvedValue({ status: 'not-found' });
    render(<ScannerScreen />);

    scan(EAN);

    fireEvent.press(await screen.findByText('Produkt erfassen'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/edit/[ean]',
      params: { ean: EAN, then: 'show' },
    });
    expect(screen.queryByTestId('scan-card')).toBeNull();
  });

  it('validates manually entered barcodes', async () => {
    render(<ScannerScreen />);

    fireEvent.press(screen.getByTestId('manual-entry-button'));
    const input = await screen.findByTestId('manual-ean-input');
    fireEvent.changeText(input, '4006381333932');
    fireEvent(input, 'submitEditing');
    expect(await screen.findByText('Ungültiger Barcode – bitte Ziffern prüfen.')).toBeTruthy();

    fireEvent.changeText(input, '4006 3813 33931');
    fireEvent(input, 'submitEditing');
    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith(EAN, 'scan', SEEDED_RULES));
  });

  it('sends the user to the system settings when camera access was denied', async () => {
    mockPermission.current = { granted: false, canAskAgain: false };
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    render(<ScannerScreen />);

    fireEvent.press(screen.getByText('Einstellungen öffnen'));

    expect(openSettings).toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(screen.getByText('Barcode eingeben')).toBeTruthy();
  });

  it('looks up a typed barcode after a running camera lookup has finished', async () => {
    let finishFirst: (value: unknown) => void = () => {};
    mockLookup.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)));
    render(<ScannerScreen />);

    scan('96385074');
    fireEvent.press(screen.getByTestId('manual-entry-button'));
    const input = await screen.findByTestId('manual-ean-input');
    fireEvent.changeText(input, EAN);
    fireEvent(input, 'submitEditing');
    expect(mockLookup).toHaveBeenCalledTimes(1);

    await act(async () => finishFirst({ status: 'not-found' }));

    await waitFor(() => expect(mockLookup).toHaveBeenLastCalledWith(EAN, 'scan', SEEDED_RULES));
  });
});
