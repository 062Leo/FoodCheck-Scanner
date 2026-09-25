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

  it('updateProduct marks the product as edited and keeps unrelated data', async () => {
    await repository.saveScan(
      productRecord({
        raw_json: JSON.stringify({
          product: { ean: '4000000000001', name: 'Alt', stores: 'Laden', novaScore: 3 },
        }),
      })
    );

    await repository.updateProduct({ ean: '4000000000001', name: 'Korrigiert', novaScore: 2 });

    const updated = await repository.findByEan('4000000000001');
    expect(updated?.name).toBe('Korrigiert');
    expect(updated?.nova_score).toBe(2);
    expect(updated?.edited_at).toEqual(expect.any(String));
    const product = JSON.parse(updated!.raw_json!).product;
    expect(product).toMatchObject({ name: 'Korrigiert', stores: 'Laden', novaScore: 2 });
  });
});
