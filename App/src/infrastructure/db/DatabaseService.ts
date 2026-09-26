import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { seedRules } from '../../domain/rules/seedRules';
import { getErrorMessage } from '../../shared/errors';

export const DATABASE_NAME = 'foodscanner.db';
export const DATABASE_VERSION = 8;
const META_SCHEMA_VERSION_KEY = 'schema_version';

type Migration = (database: SQLite.SQLiteDatabase) => Promise<void>;

let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export let db: SQLite.SQLiteDatabase | null = null;

export function resetDatabaseState(): void {
  db = null;
  initializationPromise = null;
}

/**
 * Versioned, append-only migrations. Never edit a released migration: existing
 * installations have already run it. Add a new version instead.
 */
const migrations: Record<number, Migration> = {
  1: createInitialSchema,
  2: seedDefaultFilterRules,
  3: addProductStorageColumns,
  4: addVisitTrackingColumns,
  5: addCategoryColumn,
  6: addTranslationsColumn,
  7: addFavoritesUniquenessAndEditTracking,
  8: addEditedFieldsColumn,
};

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = initializeDatabase();
  return initializationPromise;
}

/** Returns the open, fully migrated database. */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return db ?? initDatabase();
}

/** The user's allergen profile (JSON list of EU allergen ids). */
export const META_ALLERGEN_PROFILE = 'allergen_profile';
/** 'true' when the allergen warning is switched on (off by default). */
export const META_ALLERGEN_WARNING = 'allergen_warning_enabled';

export async function getMetaValue(key: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = $key',
    { $key: key }
  );
  return row?.value ?? null;
}

export async function setMetaValue(key: string, value: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO meta (key, value) VALUES ($key, $value)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    { $key: key, $value: value }
  );
}

export async function deleteMetaValue(key: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM meta WHERE key = $key', { $key: key });
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  try {
    const database = await SQLite.openDatabaseAsync(DATABASE_NAME);

    await enablePragmas(database);
    await ensureMetaTable(database);
    await migrateSchema(database);

    db = database;
    return database;
  } catch (error) {
    initializationPromise = null;
    throw new Error(`Database initialization failed: ${getErrorMessage(error)}`, { cause: error });
  }
}

async function enablePragmas(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await database.execAsync(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
    `);
  } catch (error) {
    throw new Error(`Failed to enable SQLite pragmas: ${getErrorMessage(error)}`, { cause: error });
  }
}

async function ensureMetaTable(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  } catch (error) {
    throw new Error(`Failed to create meta table: ${getErrorMessage(error)}`, { cause: error });
  }
}

export async function migrateSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const currentVersion = await getSchemaVersion(database);

    if (currentVersion > DATABASE_VERSION) {
      console.warn(
        `Database version ${currentVersion} is newer than expected (${DATABASE_VERSION}). ` +
          'Some features may not be available. Continuing with existing schema.'
      );
      return;
    }

    if (currentVersion === DATABASE_VERSION) {
      return;
    }

    const migrate = async (transaction: SQLite.SQLiteDatabase) => {
      let version = currentVersion;

      while (version < DATABASE_VERSION) {
        const nextVersion = version + 1;
        const migration = migrations[nextVersion];

        if (!migration) {
          throw new Error(`Missing migration for database version ${nextVersion}.`);
        }

        await migration(transaction);
        await setSchemaVersion(transaction, nextVersion);
        version = nextVersion;
      }
    };

    const dbAny = database as unknown as {
      withExclusiveTransactionAsync?: (
        fn: (tx: SQLite.SQLiteDatabase) => Promise<void>
      ) => Promise<void>;
      withTransactionAsync?: (fn: (tx: SQLite.SQLiteDatabase) => Promise<void>) => Promise<void>;
    };

    // Exclusive transactions are not available in expo-sqlite on the web.
    if (Platform.OS !== 'web' && typeof dbAny.withExclusiveTransactionAsync === 'function') {
      await dbAny.withExclusiveTransactionAsync(migrate);
      return;
    }

    if (typeof dbAny.withTransactionAsync === 'function') {
      await dbAny.withTransactionAsync(() => migrate(database));
      return;
    }

    await migrate(database);
  } catch (error) {
    throw new Error(`Failed to migrate database schema: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

export async function getSchemaVersion(database: SQLite.SQLiteDatabase): Promise<number> {
  try {
    const row = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM meta WHERE key = ?',
      META_SCHEMA_VERSION_KEY
    );

    if (!row) {
      return 0;
    }

    const parsedVersion = Number.parseInt(row.value, 10);
    return Number.isNaN(parsedVersion) ? 0 : parsedVersion;
  } catch (error) {
    throw new Error(`Failed to read schema version: ${getErrorMessage(error)}`, { cause: error });
  }
}

async function setSchemaVersion(database: SQLite.SQLiteDatabase, version: number): Promise<void> {
  try {
    await database.runAsync(
      `
        INSERT INTO meta (key, value)
        VALUES ($key, $value)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      `,
      {
        $key: META_SCHEMA_VERSION_KEY,
        $value: String(version),
      }
    );
  } catch (error) {
    throw new Error(`Failed to store schema version: ${getErrorMessage(error)}`, { cause: error });
  }
}

async function createInitialSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
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

      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        added_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS filter_rules (
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
    `);
  } catch (error) {
    throw new Error(`Failed to create initial schema: ${getErrorMessage(error)}`, { cause: error });
  }
}

async function seedDefaultFilterRules(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const existingRules = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM filter_rules;'
    );

    if (existingRules && existingRules.count > 0) {
      return;
    }

    const now = new Date().toISOString();
    for (const rule of seedRules) {
      await database.runAsync(
        `
          INSERT INTO filter_rules (type, key, category, threshold, operator, severity, created_at)
          VALUES ('ingredient', $key, $category, NULL, NULL, 'red_flag', $created_at);
        `,
        {
          $key: rule.key,
          $category: rule.category,
          $created_at: now,
        }
      );
    }
  } catch (error) {
    throw new Error(`Failed to seed default filter rules: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

async function addColumnIfMissing(
  database: SQLite.SQLiteDatabase,
  table: string,
  columnDefinition: string
): Promise<void> {
  const columnName = columnDefinition.split(' ')[0];
  try {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${columnDefinition};`);
  } catch (error) {
    const message = getErrorMessage(error);
    if (!message.includes('duplicate column') && !message.includes('already exists')) {
      throw new Error(`Failed to add column ${table}.${columnName}: ${message}`, { cause: error });
    }
  }
}

async function addProductStorageColumns(database: SQLite.SQLiteDatabase): Promise<void> {
  for (const column of [
    'data_version INTEGER DEFAULT 1',
    'last_api_fetch TEXT',
    'image_url TEXT',
    'image_ingredients_url TEXT',
    'image_nutrition_url TEXT',
    'image_packaging_url TEXT',
  ]) {
    await addColumnIfMissing(database, 'products', column);
  }
}

async function addVisitTrackingColumns(database: SQLite.SQLiteDatabase): Promise<void> {
  for (const column of ['visit_count INTEGER DEFAULT 1', 'last_seen_at TEXT']) {
    await addColumnIfMissing(database, 'products', column);
  }
}

async function addCategoryColumn(database: SQLite.SQLiteDatabase): Promise<void> {
  await addColumnIfMissing(database, 'filter_rules', "category TEXT NOT NULL DEFAULT ''");

  try {
    const existing = await database.getAllAsync<{ key: string }>(
      "SELECT key FROM filter_rules WHERE type = 'ingredient'"
    );
    const existingKeys = new Set(existing.map((r) => r.key.toLowerCase()));

    const now = new Date().toISOString();
    for (const rule of seedRules) {
      if (existingKeys.has(rule.key.toLowerCase())) {
        continue;
      }

      await database.runAsync(
        `
          INSERT INTO filter_rules (type, key, category, threshold, operator, severity, created_at)
          VALUES ('ingredient', $key, $category, NULL, NULL, 'red_flag', $created_at);
        `,
        {
          $key: rule.key,
          $category: rule.category,
          $created_at: now,
        }
      );
    }

    for (const rule of seedRules) {
      await database.runAsync(
        `
          UPDATE filter_rules
          SET category = $category
          WHERE type = 'ingredient' AND key = $key AND category = '';
        `,
        {
          $key: rule.key,
          $category: rule.category,
        }
      );
    }
  } catch (error) {
    throw new Error(`Failed to seed missing filter rules: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

async function addTranslationsColumn(database: SQLite.SQLiteDatabase): Promise<void> {
  await addColumnIfMissing(database, 'filter_rules', 'translations TEXT');
}

/**
 * Keys that only the local edit screen ever wrote into `raw_json` (API data is stored
 * camelCase). Their presence marks a product the user has edited on this device.
 */
const LOCAL_EDIT_MARKER_KEYS = [
  'ingredients_text',
  'brands',
  'allergens_tags',
  'manufacturing_places',
  'serving_size',
  'nova_group',
];

/**
 * v7:
 * - favorites: remove duplicate rows (keep the oldest) and enforce one row per product
 * - products.edited_at: marks locally edited products, so fresh Open Food Facts data
 *   never overwrites the user's own corrections. Existing edits are detected from the
 *   keys the old edit screen wrote into raw_json.
 */
async function addFavoritesUniquenessAndEditTracking(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  try {
    await database.execAsync(`
      DELETE FROM favorites
      WHERE id NOT IN (SELECT MIN(id) FROM favorites GROUP BY product_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_product_id ON favorites(product_id);
    `);
  } catch (error) {
    throw new Error(`Failed to deduplicate favorites: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }

  await addColumnIfMissing(database, 'products', 'edited_at TEXT');

  try {
    const rows = await database.getAllAsync<{
      id: number;
      raw_json: string;
      scanned_at: string;
      last_seen_at: string | null;
    }>(
      'SELECT id, raw_json, scanned_at, last_seen_at FROM products WHERE raw_json IS NOT NULL AND edited_at IS NULL'
    );

    for (const row of rows) {
      if (!hasLocalEditMarkers(row.raw_json)) continue;
      await database.runAsync('UPDATE products SET edited_at = $edited_at WHERE id = $id', {
        $edited_at: row.last_seen_at ?? row.scanned_at,
        $id: row.id,
      });
    }
  } catch (error) {
    throw new Error(`Failed to backfill edited_at: ${getErrorMessage(error)}`, { cause: error });
  }
}

/**
 * v8: products.edited_fields lists which fields the user edited (JSON array), so
 * Open Food Facts can still update everything else. NULL with edited_at set means
 * "edited before field tracking existed": all editable fields are treated as edited.
 */
async function addEditedFieldsColumn(database: SQLite.SQLiteDatabase): Promise<void> {
  await addColumnIfMissing(database, 'products', 'edited_fields TEXT');
}

export function hasLocalEditMarkers(rawJson: string): boolean {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!parsed || typeof parsed !== 'object') return false;
    const root = parsed as Record<string, unknown>;
    const product =
      root.product && typeof root.product === 'object'
        ? (root.product as Record<string, unknown>)
        : root;
    return LOCAL_EDIT_MARKER_KEYS.some((key) => product[key] !== undefined);
  } catch {
    return false;
  }
}
