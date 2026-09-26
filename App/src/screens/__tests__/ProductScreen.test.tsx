import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { mockRouter } from '../../testing/screenMocks';
import { productRecord, useTestDatabase } from '../../testing/testDatabase';
import { ProductRepository } from '../../infrastructure/db/ProductRepository';
import { useFilterStore } from '../../store/filterStore';
import { useCatalogStore } from '../../store/catalogStore';
import { useAllergenStore } from '../../store/allergenStore';
import { rateProduct } from '../../domain/analysis/rateProduct';
import { SEEDED_RULES } from '../../domain/analysis/__fixtures__/goldenRuleSets';
import type { LookupResult } from '../../services/ProductLookupService';
import type { Product } from '../../types/Product';
import ProductScreen from '../ProductScreen';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const mockLookup = jest.fn();
const mockLookupLocal = jest.fn();
jest.mock('../../services/ProductLookupService', () => ({
  ProductLookupService: jest.fn().mockImplementation(() => ({
    lookup: (...args: unknown[]) => mockLookup(...args),
    lookupLocal: (...args: unknown[]) => mockLookupLocal(...args),
  })),
}));

const EAN = '4000000000001';

const limo: Product = {
  ean: EAN,
  name: 'Zitronenlimo',
  brand: 'Hausmarke',
  ingredientsText: 'Wasser, Glukose-Fruktose-Sirup, Farbstoff E150d',
  novaScore: 4,
  nutriments: { sugars100g: 9.5, energyKcal100g: 40 },
};

function found(
  product: Product,
  overrides: Partial<Extract<LookupResult, { status: 'found' }>> = {}
) {
  return {
    status: 'found' as const,
    product,
    rating: rateProduct(product, SEEDED_RULES),
    record: { ...productRecord({ ean: product.ean }), id: 1 },
    source: 'network' as const,
    networkFailed: false,
    isStale: false,
    ...overrides,
  };
}

describe('ProductScreen', () => {
  useTestDatabase();

  beforeEach(async () => {
    mockRouter.reset();
    mockRouter.params = { ean: EAN, source: 'scan' };
    mockLookup.mockReset();
    mockLookupLocal.mockReset();
    useFilterStore.setState({ rules: SEEDED_RULES, isInitialized: true });
    useAllergenStore.setState({ profile: [] });
    await new ProductRepository().saveScan(productRecord({ ean: EAN }));
  });

  it('shows the rating with its reasons and the findings', async () => {
    mockLookup.mockResolvedValue(found(limo));

    render(<ProductScreen />);

    expect(await screen.findByText('Zitronenlimo')).toBeTruthy();
    expect(screen.getByText('Kritisch')).toBeTruthy();
    expect(screen.getByText('Hochverarbeitet (NOVA 4)')).toBeTruthy();
    expect(screen.getByText('2 kritische Inhaltsstoffe')).toBeTruthy();
    expect(screen.getByText('Red Flags (2)')).toBeTruthy();
    expect(mockLookup).toHaveBeenCalledWith(EAN, 'scan', SEEDED_RULES);
  });

  it('names allergens and traces in the app language', async () => {
    mockLookup.mockResolvedValue(
      found({ ...limo, allergensTags: ['en:milk', 'en:nuts'], traces: 'en:peanuts' })
    );

    render(<ProductScreen />);

    expect(await screen.findByText(/Milch, Schalenfrüchte \(Nüsse\)/)).toBeTruthy();
    expect(screen.getByText(/Erdnüsse/)).toBeTruthy();
  });

  it('warns about allergens from the profile, and only about those', async () => {
    useAllergenStore.setState({ profile: ['milk', 'celery'] });
    mockLookup.mockResolvedValue(found({ ...limo, allergensTags: ['en:milk', 'en:nuts'] }));

    render(<ProductScreen />);

    expect(await screen.findByTestId('allergen-warning')).toBeTruthy();
    expect(screen.getByText('Enthält Milch')).toBeTruthy();
    expect(screen.queryByText(/Sellerie/)).toBeNull();
  });

  it('says when a product has no allergen information at all', async () => {
    useAllergenStore.setState({ profile: ['milk'] });
    mockLookup.mockResolvedValue(found(limo));

    render(<ProductScreen />);

    expect(await screen.findByTestId('allergen-no-data')).toBeTruthy();
    expect(screen.queryByTestId('allergen-warning')).toBeNull();
  });

  it('shows no allergen warning without a matching profile entry', async () => {
    useAllergenStore.setState({ profile: ['celery'] });
    mockLookup.mockResolvedValue(found({ ...limo, allergensTags: ['en:milk'] }));

    render(<ProductScreen />);

    await screen.findByText('Zitronenlimo');
    expect(screen.queryByTestId('allergen-warning')).toBeNull();
  });

  it('counts a product opened from the catalog as a view', async () => {
    mockRouter.params = { ean: EAN };
    mockLookup.mockResolvedValue(found(limo));

    render(<ProductScreen />);

    await screen.findByText('Zitronenlimo');
    expect(mockLookup).toHaveBeenCalledWith(EAN, 'view', SEEDED_RULES);
  });

  it('says when saved data is shown offline', async () => {
    mockLookup.mockResolvedValue(found(limo, { source: 'cache', isStale: true }));

    render(<ProductScreen />);

    expect(
      await screen.findByText(
        'Offline – gespeicherte Daten · Gespeicherte Daten sind älter als 7 Tage'
      )
    ).toBeTruthy();
  });

  it('rates a product without data as unknown and offers to add ingredients', async () => {
    mockLookup.mockResolvedValue(found({ ean: EAN, name: '' }));

    render(<ProductScreen />);

    expect(await screen.findByText('Unbekannt')).toBeTruthy();
    expect(screen.getByText('Unbekanntes Produkt')).toBeTruthy();
    expect(screen.getByText('Zu wenig Daten für eine Bewertung')).toBeTruthy();
    fireEvent.press(screen.getByText('Zutaten ergänzen'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/edit/[ean]',
      params: { ean: EAN },
    });
  });

  it('offers to add an unknown product', async () => {
    mockLookup.mockResolvedValue({ status: 'not-found' });

    render(<ProductScreen />);

    expect(await screen.findByText('Produkt unbekannt')).toBeTruthy();
    fireEvent.press(screen.getByText('Produkt erfassen'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/edit/[ean]',
      params: { ean: EAN },
    });
  });

  it('retries after a failed offline lookup without counting another scan', async () => {
    mockLookup.mockResolvedValueOnce({ status: 'offline' }).mockResolvedValueOnce(found(limo));

    render(<ProductScreen />);

    expect(await screen.findByText('Keine Verbindung')).toBeTruthy();
    fireEvent.press(screen.getByText('Erneut versuchen'));

    expect(await screen.findByText('Zitronenlimo')).toBeTruthy();
    expect(mockLookup).toHaveBeenLastCalledWith(EAN, 'view', SEEDED_RULES);
  });

  it('toggles the favorite', async () => {
    mockLookup.mockResolvedValue(found(limo));

    render(<ProductScreen />);
    await screen.findByText('Zitronenlimo');

    fireEvent.press(screen.getByLabelText('Zu Favoriten hinzufügen'));

    await waitFor(() => expect(useCatalogStore.getState().favorites).toHaveLength(1));
    expect(await screen.findByLabelText('Aus Favoriten entfernen')).toBeTruthy();
  });
});
