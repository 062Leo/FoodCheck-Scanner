import * as SQLite from 'expo-sqlite';
import { defaultRules } from '../../domain/rules/defaultRules';

const DATABASE_NAME = 'foodscanner.db';
const DATABASE_VERSION = 2;
const META_SCHEMA_VERSION_KEY = 'schema_version';

type Migration = (database: SQLite.SQLiteDatabase) => Promise<void>;

let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export let db: SQLite.SQLiteDatabase | null = null;

const migrations: Record<number, Migration> = {
  1: createInitialSchema,
  2: seedDefaultFilterRules,
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
    throw new Error(`Database initialization failed: ${getErrorMessage(error)}`);
  }
}

async function enablePragmas(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await database.execAsync(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
    `);
  } catch (error) {
    throw new Error(`Failed to enable SQLite pragmas: ${getErrorMessage(error)}`);
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
    throw new Error(`Failed to create meta table: ${getErrorMessage(error)}`);
  }
}

async function migrateSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const currentVersion = await getSchemaVersion(database);

    if (currentVersion > DATABASE_VERSION) {
      throw new Error(`Unsupported database version ${currentVersion}. Expected at most ${DATABASE_VERSION}.`);
    }

    if (currentVersion === DATABASE_VERSION) {
      return;
    }

    await database.withExclusiveTransactionAsync(async (transaction) => {
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
    });
  } catch (error) {
    throw new Error(`Failed to migrate database schema: ${getErrorMessage(error)}`);
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
    throw new Error(`Failed to read schema version: ${getErrorMessage(error)}`);
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
    throw new Error(`Failed to store schema version: ${getErrorMessage(error)}`);
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
        rating TEXT NOT NULL
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
        threshold REAL,
        operator TEXT,
        severity TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  } catch (error) {
    throw new Error(`Failed to create initial schema: ${getErrorMessage(error)}`);
  }
}

async function seedDefaultFilterRules(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    // Check if filter_rules table already has data (idempotent check)
    const existingRules = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM filter_rules;'
    );

    if (existingRules && existingRules.count > 0) {
      // Already seeded, skip
      return;
    }

    // Map default rules to FilterRule records
    // Both 'critical' and 'warning' severities map to 'red_flag'
    const now = new Date().toISOString();
    const seedStatements = defaultRules.map((rule) => ({
      type: 'ingredient' as const,
      key: rule.searchTerm,
      threshold: null,
      operator: null,
      severity: 'red_flag' as const,
      created_at: now,
    }));

    // Insert all rules
    for (const rule of seedStatements) {
      await database.runAsync(
        `
          INSERT INTO filter_rules (type, key, threshold, operator, severity, created_at)
          VALUES ($type, $key, $threshold, $operator, $severity, $created_at);
        `,
        {
          $type: rule.type,
          $key: rule.key,
          $threshold: rule.threshold,
          $operator: rule.operator,
          $severity: rule.severity,
          $created_at: rule.created_at,
        }
      );
    }
  } catch (error) {
    throw new Error(`Failed to seed default filter rules: ${getErrorMessage(error)}`);
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}