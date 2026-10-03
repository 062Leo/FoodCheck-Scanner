import { ProductRepository } from '../ProductRepository';
import { FavoritesRepository } from '../FavoritesRepository';
import { productRecord, useTestDatabase } from '../../../testing/testDatabase';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

describe('ProductRepository (SQLite)', () => {
  const database = useTestDatabase();
  const repository = new ProductRepository();

  it('saveScan inserts a product that findByEan returns', async () => {
    await repository.saveScan(productRecord());

    const found = await repository.findByEan('4000000000001');

    expect(found).toMatchObject({
      id: 1,
      ean: '4000000000001',
      name: 'Testprodukt',
      rating: 'Warning',
      visit_count: 1,
      last_seen_at: '2026-01-01T10:00:00.000Z',
      edited_at: null,
    });
    expect(await repository.findByEan('0000000000000')).toBeNull();
  });

  it('saveScan counts repeated scans and updates the scan time', async () => {
    await repository.saveScan(productRecord());
    await repository.saveScan(
      productRecord({ scanned_at: '2026-02-01T10:00:00.000Z', name: 'Neu', rating: 'Critical' })
    );

    expect(await repository.findByEan('4000000000001')).toMatchObject({
      name: 'Neu',
      rating: 'Critical',
      visit_count: 2,
      scanned_at: '2026-02-01T10:00:00.000Z',
      last_seen_at: '2026-02-01T10:00:00.000Z',
    });
  });

  it('saveRefresh updates data without counting a scan', async () => {
    await repository.saveScan(productRecord());
    await repository.saveRefresh(
      productRecord({ scanned_at: '2026-03-01T10:00:00.000Z', name: 'Frisch', rating: 'OK' })
    );

    expect(await repository.findByEan('4000000000001')).toMatchObject({
      name: 'Frisch',
      rating: 'OK',
      visit_count: 1,
      scanned_at: '2026-01-01T10:00:00.000Z',
    });
  });

  it('findAllSummaries omits raw_json and reports whether ingredients exist', async () => {
    await repository.saveScan(productRecord());
    await repository.saveScan(
      productRecord({
        ean: '4000000000002',
        ingredients: '   ',
        scanned_at: '2026-01-02T10:00:00.000Z',
      })
    );

    const summaries = await repository.findAllSummaries();

    expect(summaries.map((s) => [s.ean, s.has_ingredients])).toEqual([
      ['4000000000002', 0],
      ['4000000000001', 1],
    ]);
    expect(summaries[0]).not.toHaveProperty('raw_json');
  });

  it('updateRatings writes all ratings in one go', async () => {
    await repository.saveScan(productRecord());
    await repository.saveScan(productRecord({ ean: '4000000000002' }));

    await repository.updateRatings([
      { ean: '4000000000001', rating: 'Unknown' },
      { ean: '4000000000002', rating: 'Critical' },
    ]);

    const ratings = (await repository.findAllForRating()).map((r) => [r.ean, r.rating]);
    expect(ratings).toEqual(
      expect.arrayContaining([
        ['4000000000001', 'Unknown'],
        ['4000000000002', 'Critical'],
      ])
    );
  });

  it('deleteByEan removes the product and its favorite', async () => {
    await repository.saveScan(productRecord());
    await new FavoritesRepository().add(1);

    await repository.deleteByEan('4000000000001');

    expect(await repository.findByEan('4000000000001')).toBeNull();
    expect(await database().getAllAsync('SELECT * FROM favorites')).toEqual([]);
  });

  it('saveEdit stores data and edit markers without counting a scan', async () => {
    await repository.saveScan(productRecord({ name: 'Alt' }));

    await repository.saveEdit(
      productRecord({ name: 'Korrigiert', nova_score: 2, edited_at: '2026-02-01T00:00:00.000Z' }),
      '["name","nova"]'
    );

    expect(await repository.findByEan('4000000000001')).toMatchObject({
      name: 'Korrigiert',
      nova_score: 2,
      visit_count: 1,
      edited_at: '2026-02-01T00:00:00.000Z',
      edited_fields: '["name","nova"]',
    });
  });

  it('keeps edit markers when the product is scanned or refreshed later', async () => {
    await repository.saveEdit(productRecord({ edited_at: '2026-02-01T00:00:00.000Z' }), '["name"]');
    await repository.saveScan(productRecord({ name: 'Neu' }));
    await repository.saveRefresh(productRecord({ name: 'Neuer' }));

    expect(await repository.findByEan('4000000000001')).toMatchObject({
      name: 'Neuer',
      edited_at: '2026-02-01T00:00:00.000Z',
      edited_fields: '["name"]',
      visit_count: 2,
    });
  });
});
