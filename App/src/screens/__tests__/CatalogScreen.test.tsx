import { Alert, type AlertButton } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { mockRouter } from '../../testing/screenMocks';
import { productRecord, useTestDatabase } from '../../testing/testDatabase';
import { ProductRepository } from '../../infrastructure/db/ProductRepository';
import { FavoritesRepository } from '../../infrastructure/db/FavoritesRepository';
import { useCatalogStore } from '../../store/catalogStore';
import CatalogScreen from '../CatalogScreen';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const repository = new ProductRepository();

async function seed() {
  await repository.saveScan(
    productRecord({
      ean: '4000000000001',
      name: 'Apfelmus',
      rating: 'OK',
      scanned_at: '2026-01-01T00:00:00.000Z',
    })
  );
  await repository.saveScan(
    productRecord({
      ean: '4000000000002',
      name: 'Cola',
      brands: 'Brausehaus',
      rating: 'Critical',
      scanned_at: '2026-01-02T00:00:00.000Z',
    })
  );
  await repository.saveScan(
    productRecord({
      ean: '4000000000003',
      name: 'Brot',
      rating: 'Warning',
      scanned_at: '2026-01-03T00:00:00.000Z',
    })
  );
}

function listNames() {
  const list = screen.getByTestId('catalog-list');
  return ['Apfelmus', 'Cola', 'Brot'].filter((name) => within(list).queryByText(name));
}

describe('CatalogScreen', () => {
  useTestDatabase();

  beforeEach(async () => {
    mockRouter.reset();
    useCatalogStore.setState({ products: [], favorites: [] });
    await seed();
  });

  it('lists products with status text and filters by status', async () => {
    render(<CatalogScreen />);

    expect(await screen.findByText('Cola')).toBeTruthy();
    expect(screen.getByText('3 Produkte · 3 Scans · 0 % hochverarbeitet')).toBeTruthy();
    expect(within(screen.getByTestId('catalog-list')).getAllByText('Kritisch')).toHaveLength(1);

    fireEvent.press(screen.getByText('Kritisch 1'));

    await waitFor(() => expect(listNames()).toEqual(['Cola']));
  });

  it('uses the singular for a single product', async () => {
    await repository.deleteByEan('4000000000002');
    await repository.deleteByEan('4000000000003');

    render(<CatalogScreen />);

    expect(await screen.findByText('1 Produkt · 1 Scan · 0 % hochverarbeitet')).toBeTruthy();
  });

  it('searches instantly by brand', async () => {
    render(<CatalogScreen />);
    await screen.findByText('Cola');

    fireEvent.press(screen.getByLabelText('Katalog durchsuchen'));
    fireEvent.changeText(screen.getByTestId('catalog-search'), 'brause');

    expect(listNames()).toEqual(['Cola']);
  });

  it('deletes a product and restores it with its favorite on undo', async () => {
    await new FavoritesRepository().add(2);
    const alert = jest.spyOn(Alert, 'alert');
    render(<CatalogScreen />);

    fireEvent(await screen.findByText('Cola'), 'longPress');
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    await act(async () => buttons.find((b) => b.text === 'Löschen')?.onPress?.());

    await waitFor(() => expect(screen.queryByText('Cola')).toBeNull());
    expect(await repository.findByEan('4000000000002')).toBeNull();

    await act(async () => fireEvent.press(screen.getByText('Rückgängig')));

    expect(await screen.findByText('Cola')).toBeTruthy();
    expect(await repository.findByEan('4000000000002')).toMatchObject({ id: 2, name: 'Cola' });
    expect(await new FavoritesRepository().isFavorite(2)).toBe(true);
  });

  it('offers undo for the latest of two quick deletions', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    render(<CatalogScreen />);

    for (const name of ['Cola', 'Brot']) {
      alert.mockClear();
      fireEvent(await screen.findByText(name), 'longPress');
      const buttons = alert.mock.calls[0][2] as AlertButton[];
      await act(async () => buttons.find((b) => b.text === 'Löschen')?.onPress?.());
      await waitFor(() => expect(screen.queryByText(name)).toBeNull());
    }

    await act(async () => fireEvent.press(screen.getByText('Rückgängig')));

    expect(await screen.findByText('Brot')).toBeTruthy();
    expect(screen.queryByText('Cola')).toBeNull();
  });

  it('reports a failed deletion instead of pretending it worked', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    alert.mockClear();
    const failing = jest
      .spyOn(ProductRepository.prototype, 'deleteByEan')
      .mockRejectedValueOnce(new Error('database is locked'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<CatalogScreen />);

    fireEvent(await screen.findByText('Cola'), 'longPress');
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    await act(async () => buttons.find((b) => b.text === 'Löschen')?.onPress?.());

    expect(await screen.findByText('Produkt konnte nicht gelöscht werden.')).toBeTruthy();
    expect(screen.queryByText('Rückgängig')).toBeNull();
    expect(screen.getByText('Cola')).toBeTruthy();
    failing.mockRestore();
    consoleError.mockRestore();
  });

  it('opens a product without counting a scan', async () => {
    render(<CatalogScreen />);

    fireEvent.press(await screen.findByText('Apfelmus'));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/result',
      params: { ean: '4000000000001' },
    });
  });
});
