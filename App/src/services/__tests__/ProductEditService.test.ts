import { ProductEditService } from '../ProductEditService';
import { ProductRepository } from '../../infrastructure/db/ProductRepository';
import { SEEDED_RULES } from '../../domain/analysis/__fixtures__/goldenRuleSets';
import { productRecord, useTestDatabase } from '../../testing/testDatabase';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const EAN = '4000000000001';

describe('ProductEditService', () => {
  useTestDatabase();
  const repository = new ProductRepository();
  const writeClient = { updateProduct: jest.fn() };
  const service = new ProductEditService({
    repository,
    writeClient,
    now: () => new Date('2026-03-01T12:00:00.000Z'),
  });

  beforeEach(() => writeClient.updateProduct.mockReset());

  it('opens an unknown barcode without storing anything', async () => {
    const session = await service.open(EAN);

    expect(session.record).toBeNull();
    expect(session.initial.name).toBe('');
    expect(await repository.findByEan(EAN)).toBeNull();
  });

  it('creates, rates and marks a new product on save', async () => {
    const session = await service.open(EAN);

    const { rating } = await service.save(
      session,
      { ...session.initial, name: 'Limo', ingredients: { de: 'Wasser, Glukose-Fruktose-Sirup' } },
      SEEDED_RULES
    );

    expect(rating.status).toBe('Warning');
    expect(await repository.findByEan(EAN)).toMatchObject({
      name: 'Limo',
      rating: 'Warning',
      ingredients: 'Wasser, Glukose-Fruktose-Sirup',
      edited_at: '2026-03-01T12:00:00.000Z',
      edited_fields: '["ingredients","name"]',
      visit_count: 1,
    });
  });

  it('re-rates an existing product and keeps its scan history', async () => {
    await repository.saveScan(productRecord({ rating: 'OK' }));
    await repository.saveScan(productRecord({ scanned_at: '2026-01-05T10:00:00.000Z' }));
    const session = await service.open(EAN);

    await service.save(session, { ...session.initial, nova: '4' }, SEEDED_RULES);

    expect(await repository.findByEan(EAN)).toMatchObject({
      rating: 'Critical',
      nova_score: 4,
      visit_count: 2,
      scanned_at: '2026-01-05T10:00:00.000Z',
      edited_fields: '["nova"]',
    });
  });

  it('accumulates edited fields over several saves', async () => {
    let session = await service.open(EAN);
    await service.save(session, { ...session.initial, name: 'A' }, SEEDED_RULES);
    session = await service.open(EAN);
    await service.save(session, { ...session.initial, brand: 'B' }, SEEDED_RULES);

    expect((await repository.findByEan(EAN))?.edited_fields).toBe('["brand","name"]');
  });

  it('sends the entered values to Open Food Facts', async () => {
    const session = await service.open(EAN);
    const values = {
      ...session.initial,
      name: 'Limo',
      nutriments: { ...session.initial.nutriments, sugars100g: '9,5' },
    };

    await service.contribute(EAN, values);

    expect(writeClient.updateProduct).toHaveBeenCalledWith(
      EAN,
      expect.objectContaining({
        product_name: 'Limo',
        nutriment_sugars: '9.5',
        nutrition_data_per: '100g',
      })
    );
  });
});
