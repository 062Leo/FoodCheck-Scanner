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

  it('keeps a rating saved while the catalog was being re-rated', async () => {
    const read = repository.findAllForRating.bind(repository);
    const spy = jest.spyOn(repository, 'findAllForRating').mockImplementationOnce(async () => {
      const rows = await read();
      // The user edits the empty product meanwhile; the edit stores its own rating.
      await repository.saveScan(
        productRecord({
          ean: '4000000000001',
          ingredients: 'Wasser',
          nova_score: 1,
          raw_json: JSON.stringify({ ean: '4000000000001', name: 'Wasser', novaScore: 1 }),
          rating: 'OK',
        })
      );
      return rows;
    });

    await service.rerateAll(SEEDED_RULES);
    spy.mockRestore();

    expect((await ratings())['4000000000001']).toBe('OK');
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

  it('fingerprint changes when brands of a company are switched off', () => {
    const rule = {
      ...SEEDED_RULES[0],
      type: 'company' as const,
      key: 'Nestlé',
      translations: JSON.stringify({ names: ['Nestlé', 'Lion'] }),
    };
    const excluded = {
      ...rule,
      translations: JSON.stringify({ names: ['Nestlé', 'Lion'], excluded: ['Lion'] }),
    };
    expect(ratingFingerprint([rule])).not.toBe(ratingFingerprint([excluded]));
  });

  it('fingerprint changes when a product rule changes', () => {
    const rule = {
      ...SEEDED_RULES[0],
      type: 'product' as const,
      key: 'Volvic',
      translations: JSON.stringify({ brand: 'Volvic', nameWords: [], waterOnly: true }),
    };
    const narrowed = {
      ...rule,
      translations: JSON.stringify({ brand: 'Volvic', nameWords: ['Naturelle'], waterOnly: true }),
    };
    const switchedOff = { ...rule, severity: 'ok' as const };
    expect(ratingFingerprint([rule])).not.toBe(ratingFingerprint([narrowed]));
    expect(ratingFingerprint([rule])).not.toBe(ratingFingerprint([switchedOff]));
  });

  it('serialises quick rule changes so the latest rules win', async () => {
    let rules = CUSTOMISED_RULES;
    const first = service.schedule(() => rules, true);
    rules = SEEDED_RULES;
    const second = service.schedule(() => rules, true);
    await Promise.all([first, second]);

    expect(await ratings()).toEqual({ '4000000000001': 'Unknown', '4000000000002': 'OK' });
  });
});
