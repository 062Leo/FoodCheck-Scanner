import * as SQLite from 'expo-sqlite';

import { ProductRepository } from '../ProductRepository';
import type { ProductRecord } from '../../../types/Product';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

type DbState = {
  records: Map<string, ProductRecord>;
  nextId: number;
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

describe('ProductRepository', () => {
  let repository: ProductRepository;
  let state: DbState;
  let database: MockDatabase;

  beforeEach(() => {
    state = {
      records: new Map<string, ProductRecord>(),
      nextId: 1,
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
    repository = new ProductRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('insert then findByEan returns the stored record', async () => {
    const record: ProductRecord = {
      ean: '1234567890123',
      name: 'Test Product',
      brands: 'Brand A',
      ingredients: 'Wasser, Zucker',
      nova_score: 1,
      nutriscore: 'A',
      raw_json: '{"status":1}',
      scanned_at: '2026-05-09T10:00:00.000Z',
      rating: 'OK',
    };

    await repository.insert(record);

    const found = await repository.findByEan(record.ean);

    expect(found).toEqual({
      id: 1,
      ...record,
    });
  });

  it('findAll returns records sorted by scanned_at descending', async () => {
    await repository.insert({
      ean: '1111111111111',
      name: 'Older Product',
      brands: 'Brand A',
      ingredients: 'A',
      nova_score: 2,
      nutriscore: 'B',
      raw_json: null,
      scanned_at: '2026-05-09T08:00:00.000Z',
      rating: 'Warning',
    });

    await repository.insert({
      ean: '2222222222222',
      name: 'Newer Product',
      brands: 'Brand B',
      ingredients: 'B',
      nova_score: 1,
      nutriscore: 'A',
      raw_json: null,
      scanned_at: '2026-05-09T12:00:00.000Z',
      rating: 'OK',
    });

    const products = await repository.findAll();

    expect(products.map((product) => product.ean)).toEqual(['2222222222222', '1111111111111']);
  });

  it('deleteByEan removes the stored record', async () => {
    const record: ProductRecord = {
      ean: '3333333333333',
      name: 'Delete Me',
      brands: 'Brand C',
      ingredients: 'C',
      nova_score: 3,
      nutriscore: 'C',
      raw_json: null,
      scanned_at: '2026-05-09T09:00:00.000Z',
      rating: 'Warning',
    };

    await repository.insert(record);
    await repository.deleteByEan(record.ean);

    const found = await repository.findByEan(record.ean);

    expect(found).toBeNull();
  });
});

function handleGetFirst(sql: string, params: unknown[], state: DbState): unknown {
  const normalizedSql = normalizeSql(sql);

  if (normalizedSql.includes('FROM meta')) {
    return { value: '1' };
  }

  if (!normalizedSql.includes('FROM products WHERE ean = $ean')) {
    return null;
  }

  const ean = getNamedParam(params[0], '$ean');

  return ean ? (state.records.get(ean) ?? null) : null;
}

function handleGetAll(sql: string, _params: unknown[], state: DbState): unknown[] {
  if (!normalizeSql(sql).includes('FROM products')) {
    return [];
  }

  return Array.from(state.records.values()).sort((left, right) => {
    const dateComparison = right.scanned_at.localeCompare(left.scanned_at);
    if (dateComparison !== 0) {
      return dateComparison;
    }

    return (right.id ?? 0) - (left.id ?? 0);
  });
}

function handleRun(
  sql: string,
  params: unknown[],
  state: DbState
): { changes: number; lastInsertRowId: number } {
  const normalizedSql = normalizeSql(sql);

  if (normalizedSql.includes('INSERT INTO products')) {
    const values = getNamedParams(params[0]);
    const ean = values['$ean'];

    if (typeof ean !== 'string') {
      throw new Error('Missing EAN in insert payload.');
    }

    const existing = state.records.get(ean);
    const record: ProductRecord = {
      id: existing?.id ?? state.nextId++,
      ean,
      name: getStringOrNull(values['$name']),
      brands: getStringOrNull(values['$brands']),
      ingredients: getStringOrNull(values['$ingredients']),
      nova_score: getNovaScoreOrNull(values['$nova_score']),
      nutriscore: getStringOrNull(values['$nutriscore']),
      raw_json: getStringOrNull(values['$raw_json']),
      scanned_at: getStringValue(values['$scanned_at']),
      rating: getStringValue(values['$rating']) as ProductRecord['rating'],
    };

    state.records.set(ean, record);

    return {
      changes: 1,
      lastInsertRowId: record.id ?? 0,
    };
  }

  if (normalizedSql.includes('DELETE FROM products')) {
    const ean = getNamedParam(params[0], '$ean');

    if (ean) {
      state.records.delete(ean);
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

function getNamedParams(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return {};
}

function getNamedParam(value: unknown, key: string): string | null {
  const params = getNamedParams(value);
  const param = params[key];

  return typeof param === 'string' ? param : null;
}

function getStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function getStringValue(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected a string value.');
  }

  return value;
}

function getNovaScoreOrNull(value: unknown): ProductRecord['nova_score'] {
  if (value === null || value === undefined) {
    return null;
  }

  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }

  return null;
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}
