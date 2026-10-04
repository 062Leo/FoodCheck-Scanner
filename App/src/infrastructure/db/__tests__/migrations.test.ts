import * as SQLite from 'expo-sqlite';

import {
  DATABASE_VERSION,
  getSchemaVersion,
  hasLocalEditMarkers,
  initDatabase,
  resetDatabaseState,
} from '../DatabaseService';
import { seedRules } from '../../../domain/rules/seedRules';
import { CHECK_SEEDS } from '../../../domain/analysis/productChecks';
import { NodeSqliteDatabase } from '../../../testing/nodeSqlite';
import {
  EDITED_RAW_JSON,
  LEGACY_V2_SCHEMA,
  SCANNED_RAW_JSON,
  SEED_KEYS_ADDED_IN_V10,
  CHECK_KEYS_ADDED_IN_V11,
  PRODUCT_RULE_KEYS_ADDED_IN_V12,
  RULES_ADDED_IN_V12,
  SEED_KEYS_ADDED_IN_V9,
  SEED_RULES_REMOVED_IN_V9,
  V6_SCHEMA,
  V8_SCHEMA,
  V9_SCHEMA,
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
    expect(rules?.n).toBe(seedRules.length + CHECK_SEEDS.length + RULES_ADDED_IN_V12);
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

/** The seed rules a v8 installation has: before the filter list update of v9. */
const V8_SEED_RULES = [
  ...seedRules.filter(
    (rule) =>
      !SEED_KEYS_ADDED_IN_V9.includes(rule.key) && !SEED_KEYS_ADDED_IN_V10.includes(rule.key)
  ),
  ...SEED_RULES_REMOVED_IN_V9,
];

/** A v8 database with the v8 seed rules, except `skip`. */
function createV8Database(skip: string[] = []): NodeSqliteDatabase {
  const database = createDatabase(V8_SCHEMA);
  const insert = database.native.prepare(
    `INSERT INTO filter_rules (type, key, category, threshold, operator, severity, created_at)
     VALUES ('ingredient', ?, ?, NULL, NULL, 'red_flag', '2025-01-01T00:00:00.000Z')`
  );
  for (const rule of V8_SEED_RULES) {
    if (!skip.includes(rule.key)) insert.run(rule.key, rule.category);
  }
  return database;
}

interface RuleRow {
  type: string;
  key: string;
  category: string;
  threshold: number | null;
  operator: string | null;
  severity: string;
}

async function ruleSet(database: NodeSqliteDatabase): Promise<string[]> {
  const rows = await database.getAllAsync<RuleRow>(
    'SELECT type, key, category, threshold, operator, severity FROM filter_rules'
  );
  return rows
    .map((r) => [r.type, r.key, r.category, r.threshold, r.operator, r.severity].join('|'))
    .sort();
}

describe('migration 9: filter list update', () => {
  beforeEach(() => {
    resetDatabaseState();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts from the v8 seed list', () => {
    expect(V8_SEED_RULES).toHaveLength(678);
    expect(SEED_KEYS_ADDED_IN_V9.every((key) => seedRules.some((r) => r.key === key))).toBe(true);
  });

  it('updates the filter list and keeps user data, custom and changed rules', async () => {
    // The user deleted "Sugar" and created their own "alcohol" rule.
    const database = createV8Database(['Sugar']);
    database.native.exec(`
      INSERT INTO products (ean, name, ingredients, raw_json, scanned_at, rating, visit_count,
                            last_seen_at, edited_at, edited_fields)
      VALUES
        ('4000000000101', 'Müsli', 'Hafer, Rosinen', '${SCANNED_RAW_JSON}',
         '2025-01-02T10:00:00.000Z', 'OK', 3, '2025-02-01T10:00:00.000Z', NULL, NULL),
        ('4000000000102', 'Eigener Name', 'Wasser, Zucker', '${EDITED_RAW_JSON}',
         '2025-01-02T10:00:00.000Z', 'Warning', 1, NULL, '2025-01-05T10:00:00.000Z',
         '["name"]');
      INSERT INTO favorites (product_id, added_at) VALUES (2, '2025-01-06T00:00:00.000Z');
      UPDATE filter_rules SET severity = 'ok' WHERE key = 'Palm Oil';
      UPDATE filter_rules SET category = 'Meine Kategorie' WHERE key = 'Aspartame';
      INSERT INTO filter_rules (type, key, category, threshold, operator, severity, translations,
                                created_at)
      VALUES
        ('ingredient', 'Meine Zutat', 'Eigene', NULL, NULL, 'red_flag', '{"fr":"Mon ingrédient"}',
         '2025-03-01T00:00:00.000Z'),
        ('ingredient', 'alcohol', 'Eigene', NULL, NULL, 'ok', NULL, '2025-03-01T00:00:00.000Z'),
        ('nutrient', 'sugars_100g', 'Nährwerte', 20, 'gt', 'red_flag', NULL,
         '2025-03-01T00:00:00.000Z');
    `);
    const productsBefore = await database.getAllAsync('SELECT * FROM products ORDER BY id');
    const favoritesBefore = await database.getAllAsync('SELECT * FROM favorites ORDER BY id');
    useDatabase(database);

    await initDatabase();

    expect(await getSchemaVersion(database as unknown as SQLite.SQLiteDatabase)).toBe(
      DATABASE_VERSION
    );
    expect(await database.getAllAsync('SELECT * FROM products ORDER BY id')).toEqual(
      productsBefore
    );
    expect(await database.getAllAsync('SELECT * FROM favorites ORDER BY id')).toEqual(
      favoritesBefore
    );

    const gases = await database.getAllAsync<{ key: string }>(
      `SELECT key FROM filter_rules WHERE lower(key) IN (${SEED_RULES_REMOVED_IN_V9.map(
        (r) => `lower('${r.key}')`
      ).join(', ')})`
    );
    expect(gases).toEqual([]);

    const rows = await database.getAllAsync<RuleRow & { translations: string | null }>(
      'SELECT type, key, category, threshold, operator, severity, translations FROM filter_rules'
    );
    const byKey = (key: string) => rows.filter((r) => r.key.toLowerCase() === key.toLowerCase());
    for (const key of SEED_KEYS_ADDED_IN_V9) {
      expect(byKey(key)).toHaveLength(1);
    }
    // Existing rules stay as the user left them.
    expect(byKey('alcohol')).toEqual([
      expect.objectContaining({ key: 'alcohol', severity: 'ok', category: 'Eigene' }),
    ]);
    expect(byKey('Sugar')).toEqual([]);
    expect(byKey('Palm Oil')).toEqual([expect.objectContaining({ severity: 'ok' })]);
    expect(byKey('Aspartame')).toEqual([
      expect.objectContaining({ category: 'Meine Kategorie', severity: 'red_flag' }),
    ]);
    expect(byKey('Meine Zutat')).toEqual([
      expect.objectContaining({ category: 'Eigene', translations: '{"fr":"Mon ingrédient"}' }),
    ]);
    expect(byKey('sugars_100g')).toEqual([
      expect.objectContaining({ type: 'nutrient', threshold: 20, operator: 'gt' }),
    ]);
    expect(byKey('Cellulose')).toEqual([
      expect.objectContaining({
        type: 'ingredient',
        category: 'Verdickungs- & Geliermittel',
        severity: 'red_flag',
        translations: null,
      }),
    ]);

    const checks = rows.filter((r) => r.type === 'check');
    expect(checks.map((r) => r.key).sort()).toEqual(CHECK_SEEDS.map((c) => c.key).sort());
    expect(byKey('ingredient_count')).toEqual([
      expect.objectContaining({
        category: 'Verarbeitung',
        threshold: 5,
        operator: 'gt',
        severity: 'red_flag',
      }),
    ]);
  });

  it('gives fresh installs and upgraded installs the same rules', async () => {
    const fresh = new NodeSqliteDatabase();
    useDatabase(fresh);
    await initDatabase();

    resetDatabaseState();
    const upgraded = createV8Database();
    useDatabase(upgraded);
    await initDatabase();

    expect(await ruleSet(upgraded)).toEqual(await ruleSet(fresh));
    const checks = await fresh.getAllAsync<RuleRow>(
      "SELECT type, key, category, threshold, operator, severity FROM filter_rules WHERE type = 'check'"
    );
    expect(checks).toEqual(
      CHECK_SEEDS.map((seed) => ({
        type: 'check',
        key: seed.key,
        category: seed.category,
        threshold: seed.threshold ?? null,
        operator: seed.operator ?? null,
        severity: 'red_flag',
      }))
    );
  });

  it('adds nothing twice when it runs again', async () => {
    const database = createV8Database();
    useDatabase(database);
    await initDatabase();
    const before = await ruleSet(database);

    database.native.exec("UPDATE meta SET value = '8' WHERE key = 'schema_version'");
    resetDatabaseState();
    await initDatabase();

    expect(await ruleSet(database)).toEqual(before);
  });
});

/** The product checks of v9 and v10: before the water checks of v11. */
const V10_CHECK_SEEDS = CHECK_SEEDS.filter((seed) => !CHECK_KEYS_ADDED_IN_V11.includes(seed.key));

/** The rules a v9 installation has: before the alcohol rules of v10. */
const V9_SEED_RULES = seedRules.filter((rule) => !SEED_KEYS_ADDED_IN_V10.includes(rule.key));

/** A v9 database with the v9 seed rules and product checks, except `skip`. */
function createV9Database(skip: string[] = []): NodeSqliteDatabase {
  const database = createDatabase(V9_SCHEMA);
  const insert = database.native.prepare(
    `INSERT INTO filter_rules (type, key, category, threshold, operator, severity, created_at)
     VALUES (?, ?, ?, ?, ?, 'red_flag', '2025-01-01T00:00:00.000Z')`
  );
  for (const rule of V9_SEED_RULES) {
    if (!skip.includes(rule.key)) insert.run('ingredient', rule.key, rule.category, null, null);
  }
  for (const check of V10_CHECK_SEEDS) {
    insert.run('check', check.key, check.category, check.threshold ?? null, check.operator ?? null);
  }
  return database;
}

describe('migration 10: alcohol rules', () => {
  beforeEach(() => {
    resetDatabaseState();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts from the v9 seed list', () => {
    expect(V9_SEED_RULES).toHaveLength(753);
    expect(SEED_KEYS_ADDED_IN_V10.every((key) => seedRules.some((r) => r.key === key))).toBe(true);
  });

  it('adds the alcohol rules and keeps user data, custom and changed rules', async () => {
    // The user deleted "Alcohol", relaxed "Ethanol" and created their own "wine" rule.
    const database = createV9Database(['Alcohol']);
    database.native.exec(`
      INSERT INTO products (ean, name, ingredients, raw_json, scanned_at, rating, visit_count,
                            last_seen_at, edited_at, edited_fields)
      VALUES
        ('4000000000101', 'Müsli', 'Hafer, Rosinen', '${SCANNED_RAW_JSON}',
         '2025-01-02T10:00:00.000Z', 'OK', 3, '2025-02-01T10:00:00.000Z', NULL, NULL),
        ('4000000000102', 'Eigener Name', 'Wasser, Zucker', '${EDITED_RAW_JSON}',
         '2025-01-02T10:00:00.000Z', 'Warning', 1, NULL, '2025-01-05T10:00:00.000Z',
         '["name"]');
      INSERT INTO favorites (product_id, added_at) VALUES (2, '2025-01-06T00:00:00.000Z');
      UPDATE filter_rules SET severity = 'ok' WHERE key = 'Ethanol';
      INSERT INTO filter_rules (type, key, category, threshold, operator, severity, translations,
                                created_at)
      VALUES
        ('ingredient', 'Meine Zutat', 'Eigene', NULL, NULL, 'red_flag', '{"fr":"Mon ingrédient"}',
         '2025-03-01T00:00:00.000Z'),
        ('ingredient', 'wine', 'Eigene', NULL, NULL, 'ok', NULL, '2025-03-01T00:00:00.000Z'),
        ('nutrient', 'sugars_100g', 'Nährwerte', 20, 'gt', 'red_flag', NULL,
         '2025-03-01T00:00:00.000Z');
    `);
    const productsBefore = await database.getAllAsync('SELECT * FROM products ORDER BY id');
    const favoritesBefore = await database.getAllAsync('SELECT * FROM favorites ORDER BY id');
    const rulesBefore = await database.getAllAsync('SELECT * FROM filter_rules ORDER BY id');
    useDatabase(database);

    await initDatabase();

    expect(await getSchemaVersion(database as unknown as SQLite.SQLiteDatabase)).toBe(
      DATABASE_VERSION
    );
    expect(await database.getAllAsync('SELECT * FROM products ORDER BY id')).toEqual(
      productsBefore
    );
    expect(await database.getAllAsync('SELECT * FROM favorites ORDER BY id')).toEqual(
      favoritesBefore
    );
    // Every rule that existed stays exactly as it was.
    const rulesAfter = await database.getAllAsync('SELECT * FROM filter_rules ORDER BY id');
    expect(rulesAfter.slice(0, rulesBefore.length)).toEqual(rulesBefore);

    const rows = await database.getAllAsync<RuleRow & { translations: string | null }>(
      'SELECT type, key, category, threshold, operator, severity, translations FROM filter_rules'
    );
    const byKey = (key: string) => rows.filter((r) => r.key.toLowerCase() === key.toLowerCase());
    for (const key of SEED_KEYS_ADDED_IN_V10) {
      expect(byKey(key)).toHaveLength(1);
    }
    expect(byKey('wine')).toEqual([
      expect.objectContaining({ key: 'wine', severity: 'ok', category: 'Eigene' }),
    ]);
    expect(byKey('Beer')).toEqual([
      expect.objectContaining({
        type: 'ingredient',
        category: 'Alkohol',
        severity: 'red_flag',
        translations: null,
      }),
    ]);
    expect(byKey('Alcohol')).toEqual([]);
    expect(byKey('Ethanol')).toEqual([expect.objectContaining({ severity: 'ok' })]);
    expect(rulesAfter).toHaveLength(
      rulesBefore.length +
        SEED_KEYS_ADDED_IN_V10.length -
        1 +
        CHECK_KEYS_ADDED_IN_V11.length +
        RULES_ADDED_IN_V12
    );
  });

  it('gives fresh installs and upgraded installs the same rules', async () => {
    const fresh = new NodeSqliteDatabase();
    useDatabase(fresh);
    await initDatabase();

    resetDatabaseState();
    const upgraded = createV9Database();
    useDatabase(upgraded);
    await initDatabase();

    expect(await ruleSet(upgraded)).toEqual(await ruleSet(fresh));
  });

  it('adds nothing twice when it runs again', async () => {
    const database = createV9Database();
    useDatabase(database);
    await initDatabase();
    const before = await ruleSet(database);

    database.native.exec("UPDATE meta SET value = '9' WHERE key = 'schema_version'");
    resetDatabaseState();
    await initDatabase();

    expect(await ruleSet(database)).toEqual(before);
  });
});

/** A v10 database: all seed rules and the v10 product checks, except the checks in `skip`. */
function createV10Database(skip: string[] = []): NodeSqliteDatabase {
  const database = createDatabase(V9_SCHEMA);
  database.native.exec("UPDATE meta SET value = '10' WHERE key = 'schema_version'");
  const insert = database.native.prepare(
    `INSERT INTO filter_rules (type, key, category, threshold, operator, severity, created_at)
     VALUES (?, ?, ?, ?, ?, 'red_flag', '2025-01-01T00:00:00.000Z')`
  );
  for (const seed of seedRules) {
    insert.run('ingredient', seed.key, seed.category, null, null);
  }
  for (const check of V10_CHECK_SEEDS) {
    if (!skip.includes(check.key)) {
      insert.run(
        'check',
        check.key,
        check.category,
        check.threshold ?? null,
        check.operator ?? null
      );
    }
  }
  return database;
}

describe('migration 11: water checks', () => {
  beforeEach(() => {
    resetDatabaseState();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('adds the water checks and keeps user data, custom and changed rules', async () => {
    // The user allowed canned food and already has an allowed water_contaminants check
    // (other case, own category).
    const database = createV10Database(['canned']);
    database.native.exec(`
      INSERT INTO products (ean, name, ingredients, raw_json, scanned_at, rating, visit_count,
                            last_seen_at, edited_at, edited_fields)
      VALUES
        ('4000000000101', 'Müsli', 'Hafer, Rosinen', '${SCANNED_RAW_JSON}',
         '2025-01-02T10:00:00.000Z', 'OK', 3, '2025-02-01T10:00:00.000Z', NULL, NULL),
        ('4000000000102', 'Eigener Name', 'Wasser, Zucker', '${EDITED_RAW_JSON}',
         '2025-01-02T10:00:00.000Z', 'Warning', 1, NULL, '2025-01-05T10:00:00.000Z',
         '["name"]');
      INSERT INTO favorites (product_id, added_at) VALUES (2, '2025-01-06T00:00:00.000Z');
      INSERT INTO filter_rules (type, key, category, threshold, operator, severity, translations,
                                created_at)
      VALUES
        ('check', 'canned', 'Verpackung', NULL, NULL, 'ok', NULL, '2025-03-01T00:00:00.000Z'),
        ('check', 'Water_Contaminants', 'Eigene', NULL, NULL, 'ok', NULL,
         '2025-03-01T00:00:00.000Z'),
        ('ingredient', 'Meine Zutat', 'Eigene', NULL, NULL, 'red_flag', '{"fr":"Mon ingrédient"}',
         '2025-03-01T00:00:00.000Z');
    `);
    const productsBefore = await database.getAllAsync('SELECT * FROM products ORDER BY id');
    const favoritesBefore = await database.getAllAsync('SELECT * FROM favorites ORDER BY id');
    const rulesBefore = await database.getAllAsync('SELECT * FROM filter_rules ORDER BY id');
    useDatabase(database);

    await initDatabase();

    expect(await getSchemaVersion(database as unknown as SQLite.SQLiteDatabase)).toBe(
      DATABASE_VERSION
    );
    expect(await database.getAllAsync('SELECT * FROM products ORDER BY id')).toEqual(
      productsBefore
    );
    expect(await database.getAllAsync('SELECT * FROM favorites ORDER BY id')).toEqual(
      favoritesBefore
    );
    const rulesAfter = await database.getAllAsync('SELECT * FROM filter_rules ORDER BY id');
    expect(rulesAfter.slice(0, rulesBefore.length)).toEqual(rulesBefore);
    expect(rulesAfter).toHaveLength(rulesBefore.length + 2 + RULES_ADDED_IN_V12);

    const rows = await database.getAllAsync<RuleRow>(
      "SELECT type, key, category, threshold, operator, severity FROM filter_rules WHERE type = 'check'"
    );
    const byKey = (key: string) => rows.filter((r) => r.key.toLowerCase() === key);
    expect(byKey('water_not_mineral')).toEqual([
      {
        type: 'check',
        key: 'water_not_mineral',
        category: 'Wasser',
        threshold: null,
        operator: null,
        severity: 'red_flag',
      },
    ]);
    expect(byKey('water_plastic_bottle')).toEqual([
      expect.objectContaining({ category: 'Wasser', severity: 'red_flag' }),
    ]);
    expect(byKey('water_contaminants')).toEqual([
      expect.objectContaining({ key: 'Water_Contaminants', severity: 'ok', category: 'Eigene' }),
    ]);
    expect(byKey('canned')).toEqual([expect.objectContaining({ severity: 'ok' })]);
  });

  it('gives fresh installs and upgraded installs the same rules', async () => {
    const fresh = new NodeSqliteDatabase();
    useDatabase(fresh);
    await initDatabase();

    resetDatabaseState();
    const upgraded = createV10Database();
    useDatabase(upgraded);
    await initDatabase();

    expect(await ruleSet(upgraded)).toEqual(await ruleSet(fresh));
  });

  it('adds nothing twice when it runs again', async () => {
    const database = createV10Database();
    useDatabase(database);
    await initDatabase();
    const before = await ruleSet(database);

    database.native.exec("UPDATE meta SET value = '10' WHERE key = 'schema_version'");
    resetDatabaseState();
    await initDatabase();

    expect(await ruleSet(database)).toEqual(before);
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

/** A v11 database: all seed rules and checks of version 11. */
function createV11Database(): NodeSqliteDatabase {
  const database = createV10Database();
  const insert = database.native.prepare(
    `INSERT INTO filter_rules (type, key, category, threshold, operator, severity, created_at)
     VALUES ('check', ?, 'Wasser', NULL, NULL, 'red_flag', '2025-01-01T00:00:00.000Z')`
  );
  for (const key of CHECK_KEYS_ADDED_IN_V11) insert.run(key);
  database.native.exec("UPDATE meta SET value = '11' WHERE key = 'schema_version'");
  return database;
}

describe('migration 12: water test rules', () => {
  beforeEach(() => {
    resetDatabaseState();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('adds the product rules and keeps user data and the user’s own rules', async () => {
    // The user already switched off a product rule for Volvic (other case).
    const database = createV11Database();
    database.native.exec(`
      INSERT INTO products (ean, name, ingredients, raw_json, scanned_at, rating, visit_count,
                            last_seen_at, edited_at, edited_fields)
      VALUES
        ('4000000000101', 'Müsli', 'Hafer, Rosinen', '${SCANNED_RAW_JSON}',
         '2025-01-02T10:00:00.000Z', 'OK', 3, '2025-02-01T10:00:00.000Z', NULL, NULL),
        ('4000000000102', 'Eigener Name', 'Wasser, Zucker', '${EDITED_RAW_JSON}',
         '2025-01-02T10:00:00.000Z', 'Warning', 1, NULL, '2025-01-05T10:00:00.000Z',
         '["name"]');
      INSERT INTO favorites (product_id, added_at) VALUES (2, '2025-01-06T00:00:00.000Z');
      INSERT INTO filter_rules (type, key, category, threshold, operator, severity, translations,
                                created_at)
      VALUES
        ('product', 'volvic', 'Eigene', NULL, NULL, 'ok', '{"brand":"Volvic"}',
         '2025-03-01T00:00:00.000Z'),
        ('ingredient', 'Meine Zutat', 'Eigene', NULL, NULL, 'red_flag', '{"fr":"Mon ingrédient"}',
         '2025-03-01T00:00:00.000Z');
    `);
    const productsBefore = await database.getAllAsync('SELECT * FROM products ORDER BY id');
    const favoritesBefore = await database.getAllAsync('SELECT * FROM favorites ORDER BY id');
    const rulesBefore = await database.getAllAsync('SELECT * FROM filter_rules ORDER BY id');
    useDatabase(database);

    await initDatabase();

    expect(await getSchemaVersion(database as unknown as SQLite.SQLiteDatabase)).toBe(12);
    expect(await database.getAllAsync('SELECT * FROM products ORDER BY id')).toEqual(
      productsBefore
    );
    expect(await database.getAllAsync('SELECT * FROM favorites ORDER BY id')).toEqual(
      favoritesBefore
    );
    const rulesAfter = await database.getAllAsync('SELECT * FROM filter_rules ORDER BY id');
    expect(rulesAfter.slice(0, rulesBefore.length)).toEqual(rulesBefore);
    expect(rulesAfter).toHaveLength(rulesBefore.length + RULES_ADDED_IN_V12 - 1);

    const products = await database.getAllAsync<RuleRow & { translations: string }>(
      "SELECT * FROM filter_rules WHERE type = 'product' ORDER BY id"
    );
    const keys = products.map(({ key }) => key.toLowerCase()).sort();
    expect(keys).toEqual(PRODUCT_RULE_KEYS_ADDED_IN_V12.map((key) => key.toLowerCase()).sort());
    const volvic = products.filter(({ key }) => key.toLowerCase() === 'volvic');
    expect(volvic).toEqual([expect.objectContaining({ key: 'volvic', severity: 'ok' })]);

    const gerolsteiner = products.find(({ key }) => key === 'Gerolsteiner Naturell');
    expect(gerolsteiner).toEqual(
      expect.objectContaining({ category: 'Wasser-Tests', severity: 'red_flag' })
    );
    expect(JSON.parse(gerolsteiner!.translations)).toEqual({
      brand: 'Gerolsteiner',
      nameWords: ['Naturell'],
      waterOnly: true,
      reason: {
        de: 'Öko-Test 07/2025: nur „befriedigend“ – erhöhtes Chrom(VI).',
        en: 'Öko-Test 07/2025: only “satisfactory” – elevated chromium(VI).',
      },
      sources: [
        {
          title: 'heidelberg24',
          url: 'https://www.heidelberg24.de/verbraucher/einkauf-test/das-beste-stilles-wasser-oekotest-discounter-vergleich-mineralwasser-fluorid-94355632.html',
        },
      ],
    });
    for (const rule of products) {
      if (rule.severity === 'ok') continue;
      const data = JSON.parse(rule.translations);
      expect(data.waterOnly).toBe(true);
      expect(data.reason.de).not.toBe('');
      expect(data.reason.en).not.toBe('');
      expect(data.sources.length).toBeGreaterThan(0);
    }
  });

  it('gives fresh installs and upgraded installs the same rules', async () => {
    const fresh = new NodeSqliteDatabase();
    useDatabase(fresh);
    await initDatabase();

    resetDatabaseState();
    const upgraded = createV11Database();
    useDatabase(upgraded);
    await initDatabase();

    expect(await ruleSet(upgraded)).toEqual(await ruleSet(fresh));
  });

  it('adds nothing twice when it runs again', async () => {
    const database = createV11Database();
    useDatabase(database);
    await initDatabase();
    const before = await ruleSet(database);

    database.native.exec("UPDATE meta SET value = '11' WHERE key = 'schema_version'");
    resetDatabaseState();
    await initDatabase();

    expect(await ruleSet(database)).toEqual(before);
  });
});
