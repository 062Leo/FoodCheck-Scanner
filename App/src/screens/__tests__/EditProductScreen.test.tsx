import { Alert, type AlertButton } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { mockRouter } from '../../testing/screenMocks';
import { productRecord, useTestDatabase } from '../../testing/testDatabase';
import { ProductRepository } from '../../infrastructure/db/ProductRepository';
import { useFilterStore } from '../../store/filterStore';
import { SEEDED_RULES } from '../../domain/analysis/__fixtures__/goldenRuleSets';
import EditProductScreen from '../EditProductScreen';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('../../components/OcrCameraSheet', () => ({ OcrCameraSheet: () => null }));

const mockUpdateProduct = jest.fn();
const mockLoadCredentials = jest.fn();
jest.mock('../../infrastructure/api/OpenFoodFactsWriteClient', () => {
  const actual = jest.requireActual('../../infrastructure/api/OpenFoodFactsWriteClient');
  return {
    ...actual,
    OpenFoodFactsWriteClient: jest.fn().mockImplementation(() => ({
      updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
      loadCredentials: () => mockLoadCredentials(),
      saveCredentials: jest.fn(),
    })),
  };
});

const EAN = '4000000000001';
const repository = new ProductRepository();

describe('EditProductScreen', () => {
  useTestDatabase();

  beforeEach(() => {
    mockRouter.reset();
    mockUpdateProduct.mockReset().mockResolvedValue(undefined);
    mockLoadCredentials.mockReset().mockResolvedValue({ username: 'u', password: 'p' });
    useFilterStore.setState({ rules: SEEDED_RULES, isInitialized: true });
  });

  it('creates a new product with comma decimals and shows it after saving', async () => {
    mockRouter.params = { ean: EAN, then: 'show' };
    render(<EditProductScreen />);

    fireEvent.changeText(await screen.findByTestId('edit-name'), 'Cornflakes');
    fireEvent.changeText(screen.getByTestId('edit-sugars100g'), '35,5');
    fireEvent.press(screen.getByTestId('edit-save'));

    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith({
        pathname: '/result',
        params: { ean: EAN, source: 'recent' },
      })
    );
    const stored = await repository.findByEan(EAN);
    expect(stored).toMatchObject({ name: 'Cornflakes', rating: 'Unknown' });
    expect(JSON.parse(stored!.raw_json!).product.nutriments).toEqual({ sugars100g: 35.5 });
  });

  it('shows an inline error for an invalid number and stores nothing', async () => {
    mockRouter.params = { ean: EAN };
    render(<EditProductScreen />);

    fireEvent.changeText(await screen.findByTestId('edit-fat100g'), '1,2,3');
    fireEvent.press(screen.getByTestId('edit-save'));

    expect(await screen.findByText('Keine gültige Zahl (z. B. 12,5)')).toBeTruthy();
    expect(await repository.findByEan(EAN)).toBeNull();
  });

  it('asks before sending, names the target server and saves locally first', async () => {
    await repository.saveScan(productRecord({ name: 'Müsli' }));
    mockRouter.params = { ean: EAN };
    const alert = jest.spyOn(Alert, 'alert');
    render(<EditProductScreen />);

    fireEvent.changeText(await screen.findByTestId('edit-sugars100g'), '<0,5');
    fireEvent.press(screen.getByText('An Open Food Facts senden'));

    await waitFor(() => expect(alert).toHaveBeenCalled());
    const [title, body, buttons] = alert.mock.calls[0] as [string, string, AlertButton[]];
    expect(title).toBe('An Open Food Facts senden?');
    expect(body).toContain('world.openfoodfacts.net');
    expect(body).toContain('Nährwerte');
    expect(mockUpdateProduct).not.toHaveBeenCalled();

    buttons.find((b) => b.text === 'Senden')?.onPress?.();

    await waitFor(() => expect(mockUpdateProduct).toHaveBeenCalled());
    expect(mockUpdateProduct.mock.calls[0][1]).toMatchObject({
      product_name: 'Müsli',
      nutriment_sugars: '<0.5',
    });
    expect((await repository.findByEan(EAN))?.edited_fields).toBe('["nutriments.sugars100g"]');
  });

  it('does not offer to send USDA data to Open Food Facts', async () => {
    await repository.saveScan(
      productRecord({
        name: 'Oat Cereal Rings',
        raw_json: JSON.stringify({
          product: { ean: EAN, name: 'Oat Cereal Rings', source: 'usda' },
        }),
      })
    );
    mockRouter.params = { ean: EAN };
    render(<EditProductScreen />);

    expect(await screen.findByText(/stammen aus USDA FoodData Central/)).toBeTruthy();
    expect(screen.queryByText('An Open Food Facts senden')).toBeNull();
    expect(screen.getByTestId('edit-save')).toBeTruthy();
  });

  it('leaves only once when saving during the upload success message', async () => {
    await repository.saveScan(productRecord({ name: 'Müsli' }));
    mockRouter.params = { ean: EAN };
    const alert = jest.spyOn(Alert, 'alert');
    render(<EditProductScreen />);

    fireEvent.changeText(await screen.findByTestId('edit-sugars100g'), '5');
    fireEvent.press(screen.getByText('An Open Food Facts senden'));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    buttons.find((b) => b.text === 'Senden')?.onPress?.();
    await waitFor(() => expect(mockUpdateProduct).toHaveBeenCalled());
    await act(async () => {});

    fireEvent.press(screen.getByText('Speichern'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    await act(() => new Promise((resolve) => setTimeout(resolve, 1300)));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('asks for an Open Food Facts account before sending', async () => {
    mockLoadCredentials.mockResolvedValue(null);
    await repository.saveScan(productRecord({ name: 'Müsli' }));
    mockRouter.params = { ean: EAN };
    render(<EditProductScreen />);

    fireEvent.press(await screen.findByText('An Open Food Facts senden'));

    expect(await screen.findByText('Open Food Facts Konto einrichten')).toBeTruthy();
    expect(mockUpdateProduct).not.toHaveBeenCalled();
  });
});
