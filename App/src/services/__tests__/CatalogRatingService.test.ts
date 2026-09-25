import { CatalogRatingService, ratingFingerprint } from '../CatalogRatingService';
import { ProductRepository } from '../../infrastructure/db/ProductRepository';
import { SEEDED_RULES, CUSTOMISED_RULES } from '../../domain/analysis/__fixtures__/goldenRuleSets';
import { productRecord, useTestDatabase } from '../../testing/testDatabase';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

describe('CatalogRatingService', () => {
  useTestDatabase();
  const repository = new ProductRepository();
  const service = new CatalogRatingService(repository);

  beforeEach(async () => {
    // Stored by an older app version: rated OK although nothing is known.
    await repository.saveScan(
      productRecord({
        ean: '4000000000001',
        ingredients: null,
        nova_score: null,
        raw_json: JSON.stringify({ product: { ean: '4000000000001', name: 'Leer' } }),
        rating: 'OK',
      })
    );
    await repository.saveScan(
      productRecord({
        ean: '4000000000002',
        ingredients: 'Maismehl, Salz',
        nova_score: 1,
        raw_json: JSON.stringify({
          product: {
            ean: '4000000000002',
            name: 'Cornflakes',
            ingredientsText: 'Maismehl, Salz',
            novaScore: 1,
            nutriments: { sugars100g: 35 },
          },
        }),
        rating: 'OK',
      })
    );
  });

  async function ratings() {
    const rows = await repository.findAllForRating();
    return Object.fromEntries(rows.map((r) => [r.ean, r.rating]));
  }

  it('recomputes outdated stored ratings', async () => {
    const changed = await service.rerateAll(SEEDED_RULES);

    expect(changed).toBe(1);
    expect(await ratings()).toEqual({ '4000000000001': 'Unknown', '4000000000002': 'OK' });
  });

  it('applies rule changes to the whole catalog', async () => {
    await service.rerateAll(SEEDED_RULES);
    await service.rerateAll(CUSTOMISED_RULES);

    expect((await ratings())['4000000000002']).toBe('Warning');
  });

  it('only runs again when rules or rating logic changed', async () => {
    const spy = jest.spyOn(repository, 'findAllForRating');

    await service.rerateIfOutdated(SEEDED_RULES);
    await service.rerateIfOutdated(SEEDED_RULES);
    expect(spy).toHaveBeenCalledTimes(1);

    await service.rerateIfOutdated(CUSTOMISED_RULES);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('fingerprint changes when a rule changes', () => {
    const changed = SEEDED_RULES.map((r, i) => (i === 0 ? { ...r, severity: 'ok' as const } : r));
    expect(ratingFingerprint(SEEDED_RULES)).toBe(ratingFingerprint([...SEEDED_RULES].reverse()));
    expect(ratingFingerprint(SEEDED_RULES)).not.toBe(ratingFingerprint(changed));
  });
});
