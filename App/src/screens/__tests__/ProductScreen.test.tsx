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
    useAllergenStore.setState({ enabled: false, profile: [] });
    await new ProductRepository().saveScan(productRecord({ ean: EAN }));
  });

  it('shows the rating with its reasons and the findings', async () => {
    mockLookup.mockResolvedValue(found(limo));

    render(<ProductScreen />);

    expect(await screen.findByText('Zitronenlimo')).toBeTruthy();
    expect(screen.getByText('Kritisch')).toBeTruthy();
    expect(screen.getByText('Hochverarbeitet (NOVA 4)')).toBeTruthy();
    expect(screen.getByText('2 Red Flags')).toBeTruthy();
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
    useAllergenStore.setState({ enabled: true, profile: ['milk', 'celery'] });
    mockLookup.mockResolvedValue(found({ ...limo, allergensTags: ['en:milk', 'en:nuts'] }));

    render(<ProductScreen />);

    expect(await screen.findByTestId('allergen-warning')).toBeTruthy();
    expect(screen.getByText('Enthält Milch')).toBeTruthy();
    expect(screen.queryByText(/Sellerie/)).toBeNull();
  });

  it('says when a product has no allergen information at all', async () => {
    useAllergenStore.setState({ enabled: true, profile: ['milk'] });
    mockLookup.mockResolvedValue(found(limo));

    render(<ProductScreen />);

    expect(await screen.findByTestId('allergen-no-data')).toBeTruthy();
    expect(screen.queryByTestId('allergen-warning')).toBeNull();
  });

  it('shows nothing about allergens while the warning is switched off', async () => {
    useAllergenStore.setState({ enabled: false, profile: ['milk'] });
    mockLookup.mockResolvedValue(found({ ...limo, allergensTags: ['en:milk'] }));

    render(<ProductScreen />);

    await screen.findByText('Zitronenlimo');
    expect(screen.queryByTestId('allergen-warning')).toBeNull();
    expect(screen.queryByTestId('allergen-no-data')).toBeNull();
  });

  it('shows no allergen warning without a matching profile entry', async () => {
    useAllergenStore.setState({ enabled: true, profile: ['celery'] });
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

  it('adds a hint when the USDA lookup for an unknown product failed', async () => {
    mockLookup.mockResolvedValue({ status: 'not-found', usdaError: 'invalid-key' });

    render(<ProductScreen />);

    expect(await screen.findByText('Produkt unbekannt')).toBeTruthy();
    expect(screen.getByText(/USDA-Abfrage fehlgeschlagen: Schlüssel ungültig\./)).toBeTruthy();
    expect(screen.getByText('Produkt erfassen')).toBeTruthy();
  });

  it('names USDA FoodData Central as the source of a USDA product', async () => {
    mockLookup.mockResolvedValue(found({ ...limo, source: 'usda' }));

    render(<ProductScreen />);

    expect(
      await screen.findByText('Datenquelle: USDA FoodData Central (gemeinfrei, CC0)')
    ).toBeTruthy();
  });

  it('shows no USDA source line for Open Food Facts products', async () => {
    mockLookup.mockResolvedValue(found(limo));

    render(<ProductScreen />);

    await screen.findByText('Zitronenlimo');
    expect(screen.queryByText(/USDA/)).toBeNull();
  });

  it('retries after a failed offline lookup without counting another scan', async () => {
    mockLookup.mockResolvedValueOnce({ status: 'offline' }).mockResolvedValueOnce(found(limo));

    render(<ProductScreen />);

    expect(await screen.findByText('Keine Verbindung')).toBeTruthy();
    fireEvent.press(screen.getByText('Erneut versuchen'));

    expect(await screen.findByText('Zitronenlimo')).toBeTruthy();
    expect(mockLookup).toHaveBeenLastCalledWith(EAN, 'view', SEEDED_RULES);
  });

  it('shows label badges below the name', async () => {
    mockLookup.mockResolvedValue(
      found({
        ...limo,
        labelsTags: [
          'en:organic',
          'en:eu-organic',
          'en:demeter',
          'de:ohne-gentechnik',
          'de:haltungsform-1-stall',
        ],
      })
    );

    render(<ProductScreen />);

    expect(await screen.findByTestId('product-badges')).toBeTruthy();
    expect(screen.getByText('Bio · Demeter')).toBeTruthy();
    expect(screen.getByText('Ohne Gentechnik')).toBeTruthy();
    expect(screen.getByText('Haltungsform 1 · Stall')).toBeTruthy();
    expect(screen.getByLabelText('Kennzeichnung: Bio · Demeter')).toBeTruthy();
  });

  it('shows no badges for a product without labels', async () => {
    mockLookup.mockResolvedValue(found(limo));

    render(<ProductScreen />);

    await screen.findByText('Zitronenlimo');
    expect(screen.queryByTestId('product-badges')).toBeNull();
  });

  it('names where the product was processed or packed, with a hint on its meaning', async () => {
    mockLookup.mockResolvedValue(found({ ...limo, embCodesTags: ['de-by-123-eg'] }));

    render(<ProductScreen />);

    fireEvent.press(await screen.findByText('Weitere Informationen'));
    expect(screen.getByText('Verarbeitet/verpackt in')).toBeTruthy();
    expect(screen.getByText('Deutschland, Bayern (DE BY 123 EG)')).toBeTruthy();
    expect(screen.getByText(/nicht die Herkunft der Rohstoffe/)).toBeTruthy();
  });

  it('shows the almond note for almonds of unknown origin', async () => {
    mockLookup.mockResolvedValue(
      found({ ...limo, ingredientsText: 'Zucker, Mandeln 30 %, Kakaobutter' })
    );

    render(<ProductScreen />);

    expect(await screen.findByTestId('almond-note')).toBeTruthy();
    expect(screen.getByText(/über 2 Millionen Bienenvölker/)).toBeTruthy();
    expect(
      screen.getByText('Herkunft der Mandeln unbekannt – möglicherweise aus Kalifornien.')
    ).toBeTruthy();
    expect(screen.getByText('Quellen: UC Berkeley (2025), SARE, KTTC (Okt. 2025)')).toBeTruthy();
  });

  it('shows the almond note without the unknown-origin line for almonds from the USA', async () => {
    mockLookup.mockResolvedValue(
      found({ ...limo, ingredientsText: 'Zucker, Mandeln 30 %', origins: 'USA' })
    );

    render(<ProductScreen />);

    expect(await screen.findByTestId('almond-note')).toBeTruthy();
    expect(screen.queryByText(/Herkunft der Mandeln unbekannt/)).toBeNull();
  });

  it('shows no almond note for almonds from Spain or without almonds', async () => {
    mockLookup.mockResolvedValue(
      found({ ...limo, ingredientsText: 'Zucker, Mandeln 30 % (Spanien)' })
    );

    const { unmount } = render(<ProductScreen />);
    await screen.findByText('Zitronenlimo');
    expect(screen.queryByTestId('almond-note')).toBeNull();
    unmount();

    mockLookup.mockResolvedValue(found({ ...limo, ingredientsText: 'Erdmandeln, Datteln' }));
    render(<ProductScreen />);
    await screen.findByText('Zitronenlimo');
    expect(screen.queryByTestId('almond-note')).toBeNull();
  });

  it('shows the water note for a natural mineral water in glass', async () => {
    mockLookup.mockResolvedValue(
      found({
        ...limo,
        ingredientsText: undefined,
        categoriesTags: ['en:beverages', 'en:waters', 'en:natural-mineral-waters'],
        packagingTags: ['de:glasflasche'],
        nutriments: { calcium100g: 0.0348, magnesium100g: 0.0108, sodium100g: 0.0012 },
      })
    );

    render(<ProductScreen />);

    expect(await screen.findByTestId('water-note')).toBeTruthy();
    expect(
      screen.getByText(/amtlich anerkannt, aus einer ursprünglich reinen Quelle/)
    ).toBeTruthy();
    expect(screen.getByText(/Lack der Kronkorken/)).toBeTruthy();
    expect(screen.getByText('Calciumreich: mehr als 150 mg/l Calcium.')).toBeTruthy();
    expect(screen.getByText(/Uran, Arsen, Pestizid-Abbauprodukte/)).toBeTruthy();
    expect(screen.queryByText(/Sehr mineralarm/)).toBeNull();
  });

  it('shows no water note for other products', async () => {
    mockLookup.mockResolvedValue(found(limo));

    render(<ProductScreen />);
    await screen.findByText('Zitronenlimo');
    expect(screen.queryByTestId('water-note')).toBeNull();
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
