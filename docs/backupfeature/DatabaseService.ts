import * as SQLite from 'expo-sqlite';
import { seedRules } from '../../domain/rules/seedRules';

const DATABASE_NAME = 'foodscanner.db';
const DATABASE_VERSION = 7;
const META_SCHEMA_VERSION_KEY = 'schema_version';

type Migration = (database: SQLite.SQLiteDatabase) => Promise<void>;

export let db: SQLite.SQLiteDatabase | null = null;
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function resetDatabaseState(): void {
  db = null;
  initializationPromise = null;
}

const migrations: Record<number, Migration> = {
  1: createInitialSchema,
  2: seedDefaultFilterRules,
  3: addProductStorageColumns,
  4: addVisitTrackingColumns,
  5: addCategoryColumn,
  6: addTranslationsColumn,
  7: addFavoriteColumn,
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

async function migrateSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const currentVersion = await getSchemaVersion(database);

    if (currentVersion > DATABASE_VERSION) {
      throw new Error(
        `Unsupported database version ${currentVersion}. Expected at most ${DATABASE_VERSION}.`
      );
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

    if (typeof dbAny.withExclusiveTransactionAsync === 'function') {
      await dbAny.withExclusiveTransactionAsync(migrate);
      return;
    }

    if (typeof dbAny.withTransactionAsync === 'function') {
      await dbAny.withTransactionAsync(migrate);
      return;
    }

    await migrate(database);
  } catch (error) {
    throw new Error(`Failed to migrate database schema: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

async function getSchemaVersion(database: SQLite.SQLiteDatabase): Promise<number> {
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
    const seedStatements = seedRules.map((rule) => ({
      type: 'ingredient' as const,
      key: rule.key,
      category: rule.category,
      threshold: null,
      operator: null,
      severity: 'red_flag' as const,
      created_at: now,
    }));

    for (const rule of seedStatements) {
      await database.runAsync(
        `
          INSERT INTO filter_rules (type, key, category, threshold, operator, severity, created_at)
          VALUES ($type, $key, $category, $threshold, $operator, $severity, $created_at);
        `,
        {
          $type: rule.type,
          $key: rule.key,
          $category: rule.category,
          $threshold: rule.threshold,
          $operator: rule.operator,
          $severity: rule.severity,
          $created_at: rule.created_at,
        }
      );
    }
  } catch (error) {
    throw new Error(`Failed to seed default filter rules: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

async function addProductStorageColumns(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = [
    'data_version INTEGER DEFAULT 1',
    'last_api_fetch TEXT',
    'image_url TEXT',
    'image_ingredients_url TEXT',
    'image_nutrition_url TEXT',
    'image_packaging_url TEXT',
  ];

  for (const colDef of columns) {
    const colName = colDef.split(' ')[0];
    try {
      await database.execAsync(`ALTER TABLE products ADD COLUMN ${colDef};`);
    } catch (error) {
      const msg = getErrorMessage(error);
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        throw new Error(`Failed to add column ${colName}: ${msg}`, { cause: error });
      }
    }
  }
}

async function addVisitTrackingColumns(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = ['visit_count INTEGER DEFAULT 1', 'last_seen_at TEXT'];

  for (const colDef of columns) {
    const colName = colDef.split(' ')[0];
    try {
      await database.execAsync(`ALTER TABLE products ADD COLUMN ${colDef};`);
    } catch (error) {
      const msg = getErrorMessage(error);
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        throw new Error(`Failed to add column ${colName}: ${msg}`, { cause: error });
      }
    }
  }
}

async function addCategoryColumn(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await database.execAsync(`
      ALTER TABLE filter_rules ADD COLUMN category TEXT NOT NULL DEFAULT '';
    `);
  } catch (error) {
    const message = getErrorMessage(error);
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw new Error(`Failed to add category column: ${message}`, { cause: error });
    }
  }

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
          VALUES ($type, $key, $category, NULL, NULL, $severity, $created_at);
        `,
        {
          $type: 'ingredient',
          $key: rule.key,
          $category: rule.category,
          $severity: 'red_flag',
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
  try {
    await database.execAsync(`
      ALTER TABLE filter_rules ADD COLUMN translations TEXT;
    `);
  } catch (error) {
    const message = getErrorMessage(error);
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw new Error(`Failed to add translations column: ${message}`, { cause: error });
    }
  }
}

async function addFavoriteColumn(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await database.execAsync(`
      ALTER TABLE filter_rules ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
    `);
  } catch (error) {
    const message = getErrorMessage(error);
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw new Error(`Failed to add is_favorite column: ${message}`, { cause: error });
    }
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
