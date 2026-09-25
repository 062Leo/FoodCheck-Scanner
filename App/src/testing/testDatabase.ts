import * as SQLite from 'expo-sqlite';

import { initDatabase, resetDatabaseState } from '../infrastructure/db/DatabaseService';
import type { ProductRecord } from '../types/Product';
import { NodeSqliteDatabase } from './nodeSqlite';

/**
 * Gives every test a fresh, fully migrated in-memory SQLite database.
 * The calling test file must mock expo-sqlite:
 *   jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
 */
export function useTestDatabase(): () => NodeSqliteDatabase {
  let database: NodeSqliteDatabase;

  beforeEach(async () => {
    resetDatabaseState();
    database = new NodeSqliteDatabase();
    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(database);
    await initDatabase();
  });

  afterEach(async () => {
    await database.closeAsync();
    resetDatabaseState();
  });

  return () => database;
}

export function productRecord(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    ean: '4000000000001',
    name: 'Testprodukt',
    brands: 'Marke',
    ingredients: 'Wasser, Zucker',
    nova_score: 3,
    nutriscore: null,
    raw_json: JSON.stringify({ product: { ean: '4000000000001', name: 'Testprodukt' } }),
    scanned_at: '2026-01-01T10:00:00.000Z',
    rating: 'Warning',
    ...overrides,
  };
}
