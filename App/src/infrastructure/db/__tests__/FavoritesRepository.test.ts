import * as SQLite from 'expo-sqlite';

import { FavoritesRepository } from '../FavoritesRepository';
import type { ProductRecord } from '../../../types/Product';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

type FavoriteRow = {
  id: number;
  product_id: number;
  added_at: string;
};

type DbState = {
  products: Map<number, ProductRecord>;
  favorites: FavoriteRow[];
  nextFavoriteId: number;
};

type MockDatabase = {
  execAsync: jest.Mock<Promise<void>, [string]>;
  getFirstAsync: jest.Mock<Promise<unknown>, [string, ...unknown[]]>;
  getAllAsync: jest.Mock<Promise<unknown[]>, [string, ...unknown[]]>;
  runAsync: jest.Mock<
    Promise<{ changes: number; lastInsertRowId: number }>,
    [string, ...unknown[]]
  >;
};

const openDatabaseAsync = SQLite.openDatabaseAsync as jest.MockedFunction<
  typeof SQLite.openDatabaseAsync
>;

describe('FavoritesRepository', () => {
  let repository: FavoritesRepository;
  let state: DbState;
  let database: MockDatabase;

  beforeEach(() => {
    state = {
      products: new Map<number, ProductRecord>([
        [
          1,
          {
            id: 1,
            ean: '1111111111111',
            name: 'Alpha',
            brands: 'Brand A',
            ingredients: 'Wasser',
            nova_score: 1,
            nutriscore: 'A',
            raw_json: null,
            scanned_at: '2026-05-09T08:00:00.000Z',
            rating: 'OK',
          },
        ],
        [
          2,
          {
            id: 2,
            ean: '2222222222222',
            name: 'Beta',
            brands: 'Brand B',
            ingredients: 'Zucker',
            nova_score: 3,
            nutriscore: 'C',
            raw_json: null,
            scanned_at: '2026-05-09T10:00:00.000Z',
            rating: 'Warning',
          },
        ],
      ]),
      favorites: [],
      nextFavoriteId: 1,
    };

    database = {
      execAsync: jest.fn(async () => undefined),
      getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) =>
        handleGetFirst(sql, params, state)
      ),
      getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) =>
        handleGetAll(sql, params, state)
      ),
      runAsync: jest.fn(async (sql: string, ...params: unknown[]) => handleRun(sql, params, state)),
    };

    openDatabaseAsync.mockResolvedValue(database as unknown as SQLite.SQLiteDatabase);
    repository = new FavoritesRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('add then isFavorite returns true', async () => {
    await repository.add(1);

    await expect(repository.isFavorite(1)).resolves.toBe(true);
  });

  it('add then remove then isFavorite returns false', async () => {
    await repository.add(1);
    await repository.remove(1);

    await expect(repository.isFavorite(1)).resolves.toBe(false);
  });

  it('findAll returns only favorited products', async () => {
    await repository.add(2);
    await repository.add(1);

    const favorites = await repository.findAll();

    expect(favorites.map((product) => product.id)).toEqual([1, 2]);
    expect(favorites.map((product) => product.ean)).toEqual(['1111111111111', '2222222222222']);
  });
});

function handleGetFirst(sql: string, params: unknown[], state: DbState): unknown {
  const normalizedSql = normalizeSql(sql);

  if (normalizedSql.includes('FROM meta')) {
    return { value: '1' };
  }

  if (!normalizedSql.includes('FROM favorites')) {
    return null;
  }

  const productId = getNamedParam(params[0], '$product_id');

  return typeof productId === 'number' &&
    state.favorites.some((favorite) => favorite.product_id === productId)
    ? { id: 1 }
    : null;
}

function handleGetAll(sql: string, _params: unknown[], state: DbState): unknown[] {
  const normalizedSql = normalizeSql(sql);

  if (!normalizedSql.includes('FROM favorites f INNER JOIN products p ON p.id = f.product_id')) {
    return [];
  }

  return state.favorites
    .slice()
    .sort((left, right) => {
      const addedAtComparison = right.added_at.localeCompare(left.added_at);
      if (addedAtComparison !== 0) {
        return addedAtComparison;
      }

      return right.id - left.id;
    })
    .map((favorite) => state.products.get(favorite.product_id))
    .filter((product): product is ProductRecord => product !== undefined);
}

function handleRun(
  sql: string,
  params: unknown[],
  state: DbState
): { changes: number; lastInsertRowId: number } {
  const normalizedSql = normalizeSql(sql);

  if (normalizedSql.includes('INSERT INTO favorites')) {
    const productId = getNamedParam(params[0], '$product_id');
    const addedAt = getNamedParam(params[0], '$added_at');

    if (typeof productId !== 'number' || typeof addedAt !== 'string') {
      throw new Error('Invalid favorite insert payload.');
    }

    const row: FavoriteRow = {
      id: state.nextFavoriteId++,
      product_id: productId,
      added_at: addedAt,
    };

    state.favorites.push(row);

    return {
      changes: 1,
      lastInsertRowId: row.id,
    };
  }

  if (normalizedSql.includes('DELETE FROM favorites')) {
    const productId = getNamedParam(params[0], '$product_id');

    if (typeof productId === 'number') {
      state.favorites = state.favorites.filter((favorite) => favorite.product_id !== productId);
    }

    return {
      changes: 1,
      lastInsertRowId: 0,
    };
  }

  return {
    changes: 0,
    lastInsertRowId: 0,
  };
}

function getNamedParam(value: unknown, key: string): string | number | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const param = record[key];

  if (typeof param === 'string' || typeof param === 'number') {
    return param;
  }

  return null;
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}
