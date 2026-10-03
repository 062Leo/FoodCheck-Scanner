import { FavoritesRepository } from '../FavoritesRepository';
import { ProductRepository } from '../ProductRepository';
import { productRecord, useTestDatabase } from '../../../testing/testDatabase';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

describe('FavoritesRepository (SQLite)', () => {
  const database = useTestDatabase();
  const favorites = new FavoritesRepository();
  const products = new ProductRepository();

  beforeEach(async () => {
    await products.saveScan(productRecord({ ean: '4000000000001', name: 'Eins' }));
    await products.saveScan(productRecord({ ean: '4000000000002', name: 'Zwei' }));
  });

  it('add then isFavorite returns true; remove makes it false', async () => {
    await favorites.add(1);
    expect(await favorites.isFavorite(1)).toBe(true);

    await favorites.remove(1);
    expect(await favorites.isFavorite(1)).toBe(false);
  });

  it('puts a favorite back at its old position', async () => {
    await favorites.add(1, '2026-01-01T00:00:00.000Z');
    await favorites.add(2, '2026-02-01T00:00:00.000Z');
    const addedAt = await favorites.findAddedAt(1);

    await favorites.remove(1);
    await favorites.add(1, addedAt!);

    expect(addedAt).toBe('2026-01-01T00:00:00.000Z');
    expect((await favorites.findAll()).map((p) => p.name)).toEqual(['Zwei', 'Eins']);
    expect(await favorites.findAddedAt(99)).toBeNull();
  });

  it('adding the same favorite twice keeps a single row', async () => {
    await favorites.add(1);
    await favorites.add(1);

    expect(await database().getAllAsync('SELECT * FROM favorites')).toHaveLength(1);
  });

  it('findAll returns only favorites as summaries, newest first', async () => {
    await favorites.add(1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await favorites.add(2);

    const result = await favorites.findAll();

    expect(result.map((p) => p.name)).toEqual(['Zwei', 'Eins']);
    expect(result[0]).toMatchObject({ ean: '4000000000002', has_ingredients: 1 });
    expect(result[0]).not.toHaveProperty('raw_json');
  });
});
