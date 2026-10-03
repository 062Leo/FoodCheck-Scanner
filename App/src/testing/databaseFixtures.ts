import { NodeSqliteDatabase } from './nodeSqlite';

/**
 * Snapshots of database schemas as they exist on users' devices. They are written
 * out literally (not produced by the current migration code) so that migration
 * tests start from the real old state.
 */

/** Schema of the first releases (v2: initial tables + seeded rules). */
export const LEGACY_V2_SCHEMA = `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ean TEXT NOT NULL UNIQUE,
    name TEXT,
    brands TEXT,
    ingredients TEXT,
    nova_score INTEGER,
    nutriscore TEXT,
    raw_json TEXT,
    scanned_at TEXT NOT NULL,
    rating TEXT NOT NULL
  );
  CREATE TABLE favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL
  );
  CREATE TABLE filter_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    key TEXT NOT NULL,
    threshold REAL,
    operator TEXT,
    severity TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  INSERT INTO meta (key, value) VALUES ('schema_version', '2');
`;

/** Schema of the latest release before this change (v6). */
export const V6_SCHEMA = `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ean TEXT NOT NULL UNIQUE,
    name TEXT,
    brands TEXT,
    ingredients TEXT,
    nova_score INTEGER,
    nutriscore TEXT,
    raw_json TEXT,
    scanned_at TEXT NOT NULL,
    rating TEXT NOT NULL,
    data_version INTEGER DEFAULT 1,
    last_api_fetch TEXT,
    image_url TEXT,
    image_ingredients_url TEXT,
    image_nutrition_url TEXT,
    image_packaging_url TEXT,
    visit_count INTEGER DEFAULT 1,
    last_seen_at TEXT
  );
  CREATE TABLE favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL
  );
  CREATE TABLE filter_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    key TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    threshold REAL,
    operator TEXT,
    severity TEXT NOT NULL,
    translations TEXT,
    created_at TEXT NOT NULL
  );
  INSERT INTO meta (key, value) VALUES ('schema_version', '6');
`;

/** raw_json as written by the product screen after a scan (camelCase API data). */
export const SCANNED_RAW_JSON = JSON.stringify({
  product: { ean: '4000000000101', name: 'Müsli', ingredientsText: 'Hafer, Rosinen', novaScore: 1 },
  _dataVersion: 1,
});

/** raw_json after the old edit screen saved local corrections (snake_case keys). */
export const EDITED_RAW_JSON = JSON.stringify({
  product: {
    ean: '4000000000102',
    name: 'Eigener Name',
    ingredientsText: 'Wasser, Zucker',
    ingredients_text: 'Wasser, Zucker',
    brands: 'Hausmarke',
    nova_group: 3,
  },
  _dataVersion: 1,
});

export function createDatabase(schema: string): NodeSqliteDatabase {
  const database = new NodeSqliteDatabase();
  database.native.exec(schema);
  return database;
}
