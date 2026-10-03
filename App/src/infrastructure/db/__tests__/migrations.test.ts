import * as SQLite from 'expo-sqlite';

import {
  DATABASE_VERSION,
  getSchemaVersion,
  hasLocalEditMarkers,
  initDatabase,
  resetDatabaseState,
} from '../DatabaseService';
import { seedRules } from '../../../domain/rules/seedRules';
import { NodeSqliteDatabase } from '../../../testing/nodeSqlite';
import {
  EDITED_RAW_JSON,
  LEGACY_V2_SCHEMA,
  SCANNED_RAW_JSON,
  V6_SCHEMA,
  createDatabase,
} from '../../../testing/databaseFixtures';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const openDatabaseAsync = SQLite.openDatabaseAsync as jest.MockedFunction<
  typeof SQLite.openDatabaseAsync
>;

function useDatabase(database: NodeSqliteDatabase): void {
  openDatabaseAsync.mockResolvedValue(database as unknown as SQLite.SQLiteDatabase);
}

async function columnsOf(database: NodeSqliteDatabase, table: string): Promise<string[]> {
  const rows = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.map((r) => r.name);
}

const distinctSeedKeys = new Set(seedRules.map((r) => r.key.toLowerCase())).size;

describe('database migrations', () => {
  beforeEach(() => {
    resetDatabaseState();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates the current schema on a fresh install', async () => {
    const database = new NodeSqliteDatabase();
    useDatabase(database);

    await initDatabase();

    expect(await getSchemaVersion(database as unknown as SQLite.SQLiteDatabase)).toBe(
      DATABASE_VERSION
    );
    expect(await columnsOf(database, 'products')).toEqual(
      expect.arrayContaining([
        'visit_count',
        'last_seen_at',
        'edited_at',
        'edited_fields',
        'image_url',
      ])
    );
    expect(await columnsOf(database, 'filter_rules')).toEqual(
      expect.arrayContaining(['category', 'translations'])
    );
    const rules = await database.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM filter_rules'
    );
    expect(rules?.n).toBe(seedRules.length);
  });

  it('migrates a legacy v2 database without losing user data', async () => {
    const database = createDatabase(LEGACY_V2_SCHEMA);
    database.native.exec(`
      INSERT INTO products (ean, name, brands, ingredients, nova_score, raw_json, scanned_at, rating)
      VALUES ('4000000000101', 'Müsli', 'Marke', 'Hafer, Rosinen', 1, '${SCANNED_RAW_JSON}',
              '2025-01-02T10:00:00.000Z', 'OK');
      INSERT INTO favorites (product_id, added_at) VALUES (1, '2025-01-03T10:00:00.000Z');
      INSERT INTO filter_rules (type, key, threshold, operator, severity, created_at)
      VALUES ('ingredient', 'Palm Oil', NULL, NULL, 'red_flag', '2025-01-01T00:00:00.000Z'),
             ('ingredient', 'Meine Zutat', NULL, NULL, 'red_flag', '2025-01-01T00:00:00.000Z'),
             ('nutrient', 'sugars_100g', 20, 'gt', 'red_flag', '2025-01-01T00:00:00.000Z');
    `);
    useDatabase(database);

    await initDatabase();

    expect(await getSchemaVersion(database as unknown as SQLite.SQLiteDatabase)).toBe(
      DATABASE_VERSION
    );
    const product = await database.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM products WHERE ean = ?',
      '4000000000101'
    );
    expect(product).toMatchObject({
      name: 'Müsli',
      brands: 'Marke',
      raw_json: SCANNED_RAW_JSON,
      scanned_at: '2025-01-02T10:00:00.000Z',
      rating: 'OK',
      visit_count: 1,
      edited_at: null,
    });
    const favorites = await database.getAllAsync('SELECT * FROM favorites');
    expect(favorites).toHaveLength(1);

    const userRules = await database.getAllAsync<{ key: string; category: string }>(
      "SELECT key, category FROM filter_rules WHERE key IN ('Meine Zutat', 'sugars_100g', 'Palm Oil')"
    );
    expect(userRules).toEqual(
      expect.arrayContaining([
        { key: 'Palm Oil', category: 'Gehärtete Fette & raffinierte Öle' },
        { key: 'Meine Zutat', category: '' },
        { key: 'sugars_100g', category: '' },
      ])
    );
    const ingredientRules = await database.getFirstAsync<{ n: number }>(
      "SELECT COUNT(DISTINCT lower(key)) AS n FROM filter_rules WHERE type = 'ingredient'"
    );
    expect(ingredientRules?.n).toBe(distinctSeedKeys + 1);
  });

  it('migrates v6 to v7: deduplicates favorites and marks locally edited products', async () => {
    const database = createDatabase(V6_SCHEMA);
    database.native.exec(`
      INSERT INTO products (ean, name, raw_json, scanned_at, rating, visit_count, last_seen_at)
      VALUES
        ('4000000000101', 'Müsli', '${SCANNED_RAW_JSON}', '2025-01-02T10:00:00.000Z', 'OK', 4,
         '2025-02-01T10:00:00.000Z'),
        ('4000000000102', 'Eigener Name', '${EDITED_RAW_JSON}', '2025-01-02T10:00:00.000Z',
         'Warning', 1, NULL),
        ('4000000000103', 'Kaputt', '{not json', '2025-01-02T10:00:00.000Z', 'OK', 1, NULL),
        ('4000000000104', 'Ohne JSON', NULL, '2025-01-02T10:00:00.000Z', 'OK', 1, NULL);
      INSERT INTO favorites (product_id, added_at) VALUES
        (1, '2025-01-05T00:00:00.000Z'),
        (1, '2025-01-06T00:00:00.000Z'),
        (2, '2025-01-07T00:00:00.000Z');
    `);
    useDatabase(database);

    await initDatabase();

    const favorites = await database.getAllAsync<{ id: number; product_id: number }>(
      'SELECT id, product_id FROM favorites ORDER BY id'
    );
    expect(favorites).toEqual([
      { id: 1, product_id: 1 },
      { id: 3, product_id: 2 },
    ]);
    await expect(
      database.runAsync(
        "INSERT INTO favorites (product_id, added_at) VALUES (1, '2025-03-01T00:00:00.000Z')"
      )
    ).rejects.toThrow(/UNIQUE/);

    const edited = await database.getAllAsync<{ ean: string; edited_at: string | null }>(
      'SELECT ean, edited_at FROM products ORDER BY ean'
    );
    expect(edited).toEqual([
      { ean: '4000000000101', edited_at: null },
      { ean: '4000000000102', edited_at: '2025-01-02T10:00:00.000Z' },
      { ean: '4000000000103', edited_at: null },
      { ean: '4000000000104', edited_at: null },
    ]);

    const muesli = await database.getFirstAsync<Record<string, unknown>>(
      "SELECT visit_count, raw_json FROM products WHERE ean = '4000000000101'"
    );
    expect(muesli).toEqual({ visit_count: 4, raw_json: SCANNED_RAW_JSON });
  });

  it('is idempotent when started twice', async () => {
    const database = createDatabase(V6_SCHEMA);
    useDatabase(database);
    await initDatabase();
    const before = await database.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM filter_rules'
    );

    resetDatabaseState();
    await initDatabase();

    const after = await database.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM filter_rules'
    );
    expect(after).toEqual(before);
  });

  it('rolls back a failing migration and keeps the old version and data', async () => {
    const database = createDatabase(V6_SCHEMA);
    database.native.exec(`
      INSERT INTO products (ean, name, scanned_at, rating) VALUES ('1', 'A', '2025-01-01', 'OK');
      DROP TABLE favorites;
    `);
    useDatabase(database);

    await expect(initDatabase()).rejects.toThrow(/deduplicate favorites/);

    expect(await getSchemaVersion(database as unknown as SQLite.SQLiteDatabase)).toBe(6);
    expect(await columnsOf(database, 'products')).not.toContain('edited_at');
    const products = await database.getAllAsync('SELECT ean FROM products');
    expect(products).toEqual([{ ean: '1' }]);
  });

  it('leaves a database from a newer app version untouched', async () => {
    const database = createDatabase(V6_SCHEMA);
    database.native.exec("UPDATE meta SET value = '99' WHERE key = 'schema_version'");
    useDatabase(database);

    await initDatabase();

    expect(await getSchemaVersion(database as unknown as SQLite.SQLiteDatabase)).toBe(99);
    expect(await columnsOf(database, 'products')).not.toContain('edited_at');
  });
});

describe('hasLocalEditMarkers', () => {
  it('detects keys written by the old edit screen', () => {
    expect(hasLocalEditMarkers(EDITED_RAW_JSON)).toBe(true);
    expect(hasLocalEditMarkers(SCANNED_RAW_JSON)).toBe(false);
    expect(hasLocalEditMarkers('{"brands":"x"}')).toBe(true);
    expect(hasLocalEditMarkers('not json')).toBe(false);
    expect(hasLocalEditMarkers('null')).toBe(false);
  });
});
