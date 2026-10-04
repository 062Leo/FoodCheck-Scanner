import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { seedRules } from '../../domain/rules/seedRules';
import { normalizeCompanyName } from '../../domain/analysis/companyRules';
import { getErrorMessage } from '../../shared/errors';

export const DATABASE_NAME = 'foodscanner.db';
export const DATABASE_VERSION = 12;
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
  9: updateFilterList,
  10: addAlcoholRules,
  11: addWaterChecks,
  12: migrateToV12,
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

/** v9: packaging and propellant gases, no longer part of the filter list. */
const V9_REMOVED_INGREDIENT_KEYS = [
  'Carbon Dioxide',
  'Nitrous Oxide',
  'Packaging Gas',
  'Propellants',
  'E290',
  'E938',
  'E939',
  'E941',
  'E942',
  'E948',
  'E949',
];

/**
 * v9: ingredient rules added to the filter list. A frozen copy instead of `seedRules`:
 * later changes to the seed list must not change what this migration does.
 */
const V9_ADDED_INGREDIENT_RULES: { key: string; category: string }[] = [
  { key: 'E120', category: 'E-Nummern' },
  { key: 'E200', category: 'E-Nummern' },
  { key: 'E203', category: 'E-Nummern' },
  { key: 'E214', category: 'E-Nummern' },
  { key: 'E215', category: 'E-Nummern' },
  { key: 'E219', category: 'E-Nummern' },
  { key: 'E460', category: 'E-Nummern' },
  { key: 'E461', category: 'E-Nummern' },
  { key: 'E462', category: 'E-Nummern' },
  { key: 'E463', category: 'E-Nummern' },
  { key: 'E464', category: 'E-Nummern' },
  { key: 'E465', category: 'E-Nummern' },
  { key: 'E466', category: 'E-Nummern' },
  { key: 'E476', category: 'E-Nummern' },
  { key: 'E492', category: 'E-Nummern' },
  { key: 'E493', category: 'E-Nummern' },
  { key: 'E494', category: 'E-Nummern' },
  { key: 'E495', category: 'E-Nummern' },
  { key: 'E952', category: 'E-Nummern' },
  { key: 'E1404', category: 'E-Nummern' },
  { key: 'E1410', category: 'E-Nummern' },
  { key: 'E1412', category: 'E-Nummern' },
  { key: 'E1413', category: 'E-Nummern' },
  { key: 'E1414', category: 'E-Nummern' },
  { key: 'E1420', category: 'E-Nummern' },
  { key: 'E1422', category: 'E-Nummern' },
  { key: 'E1440', category: 'E-Nummern' },
  { key: 'E1442', category: 'E-Nummern' },
  { key: 'E1450', category: 'E-Nummern' },
  { key: 'E1452', category: 'E-Nummern' },
  { key: 'E1520', category: 'E-Nummern' },
  { key: 'Carboxymethylcellulose', category: 'Verdickungs- & Geliermittel' },
  { key: 'Methylcellulose', category: 'Verdickungs- & Geliermittel' },
  { key: 'Hydroxypropyl Methylcellulose', category: 'Verdickungs- & Geliermittel' },
  { key: 'Cellulose', category: 'Verdickungs- & Geliermittel' },
  { key: 'Polyglycerol Polyricinoleate', category: 'Emulgatoren & Stabilisatoren' },
  { key: 'Sorbitan Tristearate', category: 'Emulgatoren & Stabilisatoren' },
  { key: 'Sorbitan Monolaurate', category: 'Emulgatoren & Stabilisatoren' },
  { key: 'Sorbitan Monooleate', category: 'Emulgatoren & Stabilisatoren' },
  { key: 'Sorbitan Monopalmitate', category: 'Emulgatoren & Stabilisatoren' },
  { key: 'Cyclamate', category: 'Süßungsmittel' },
  { key: 'Carmine', category: 'Farbstoffe' },
  { key: 'Cochineal', category: 'Farbstoffe' },
  { key: 'Sorbic Acid', category: 'Konservierungsstoffe' },
  { key: 'Ethylparaben', category: 'Konservierungsstoffe' },
  { key: 'PHB-Ester', category: 'Konservierungsstoffe' },
  { key: 'Celery Extract', category: 'Konservierungsstoffe' },
  { key: 'Selleriesaftpulver', category: 'Konservierungsstoffe' },
  { key: 'Propylene Glycol', category: 'Füll- & Trägerstoffe' },
  { key: 'Propylenglycol', category: 'Füll- & Trägerstoffe' },
  { key: 'Citronensäure', category: 'Säuren & Säureregulatoren' },
  { key: 'Genetically Modified', category: 'Gentechnik' },
  { key: 'gentechnisch verändert', category: 'Gentechnik' },
  { key: 'Acheta domesticus', category: 'Insekten' },
  { key: 'Tenebrio molitor', category: 'Insekten' },
  { key: 'Locusta migratoria', category: 'Insekten' },
  { key: 'Alphitobius diaperinus', category: 'Insekten' },
  { key: 'Insects', category: 'Insekten' },
  { key: 'Sunflower Oil', category: 'Samenöle' },
  { key: 'Sonnenblumenkernöl', category: 'Samenöle' },
  { key: 'Rapeseed Oil', category: 'Samenöle' },
  { key: 'Canola Oil', category: 'Samenöle' },
  { key: 'Corn Oil', category: 'Samenöle' },
  { key: 'Maisöl', category: 'Samenöle' },
  { key: 'Safflower Oil', category: 'Samenöle' },
  { key: 'Grapeseed Oil', category: 'Samenöle' },
  { key: 'Rice Bran Oil', category: 'Samenöle' },
  { key: 'Vegetable Oil', category: 'Samenöle' },
  { key: 'Meat Substitute', category: 'Proteine & Fleischersatz' },
  { key: 'Pea Protein', category: 'Proteine & Fleischersatz' },
  { key: 'Erbseneiweiß', category: 'Proteine & Fleischersatz' },
  { key: 'Wheat Protein', category: 'Proteine & Fleischersatz' },
  { key: 'Weizeneiweiß', category: 'Proteine & Fleischersatz' },
  { key: 'Seitan', category: 'Proteine & Fleischersatz' },
  { key: 'Mycoprotein', category: 'Proteine & Fleischersatz' },
  { key: 'Fava Bean Protein', category: 'Proteine & Fleischersatz' },
  { key: 'Aquaculture', category: 'Zuchtfisch' },
  { key: 'gezüchtet', category: 'Zuchtfisch' },
  { key: 'Alcohol', category: 'Alkohol' },
  { key: 'Ethanol', category: 'Alkohol' },
  { key: 'Pasteurised', category: 'Erhitzte Milch' },
  { key: 'Pasteurized', category: 'Erhitzte Milch' },
  { key: 'UHT', category: 'Erhitzte Milch' },
  { key: 'ultrahocherhitzt', category: 'Erhitzte Milch' },
  { key: 'wärmebehandelt', category: 'Erhitzte Milch' },
  { key: 'H-Milch', category: 'Erhitzte Milch' },
];

/** v9: the product checks, a frozen copy of `CHECK_SEEDS` at this version. */
const V9_CHECK_RULES: {
  key: string;
  category: string;
  threshold: number | null;
  operator: 'gt' | null;
}[] = [
  { key: 'ingredient_count', category: 'Verarbeitung', threshold: 5, operator: 'gt' },
  { key: 'canned', category: 'Verpackung', threshold: null, operator: null },
  { key: 'mercury_fish', category: 'Schadstoffe', threshold: null, operator: null },
  { key: 'rice_arsenic', category: 'Schadstoffe', threshold: null, operator: null },
  { key: 'pesticide_risk', category: 'Schadstoffe', threshold: null, operator: null },
  { key: 'not_raw_milk', category: 'Erhitzte Milch', threshold: null, operator: null },
  { key: 'alcoholic', category: 'Alkohol', threshold: null, operator: null },
  { key: 'meat_substitute', category: 'Proteine & Fleischersatz', threshold: null, operator: null },
  { key: 'farmed_fish', category: 'Zuchtfisch', threshold: null, operator: null },
];

/**
 * v9: updates the filter list.
 * - removes the packaging and propellant gas rules
 * - adds the new ingredient rules and the product checks, unless a rule of the same
 *   type and key (any case, any severity) already exists, so the user's own rules are
 *   neither duplicated nor overridden
 */
async function updateFilterList(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    for (const key of V9_REMOVED_INGREDIENT_KEYS) {
      await database.runAsync(
        "DELETE FROM filter_rules WHERE type = 'ingredient' AND lower(key) = lower($key)",
        { $key: key }
      );
    }

    const existing = await database.getAllAsync<{ type: string; key: string }>(
      "SELECT type, key FROM filter_rules WHERE type IN ('ingredient', 'check')"
    );
    const existingKeys = new Set(existing.map((r) => `${r.type}|${r.key.toLowerCase()}`));
    const now = new Date().toISOString();

    for (const rule of V9_ADDED_INGREDIENT_RULES) {
      if (existingKeys.has(`ingredient|${rule.key.toLowerCase()}`)) continue;
      await database.runAsync(
        `
          INSERT INTO filter_rules (type, key, category, threshold, operator, severity, created_at)
          VALUES ('ingredient', $key, $category, NULL, NULL, 'red_flag', $created_at);
        `,
        { $key: rule.key, $category: rule.category, $created_at: now }
      );
    }

    for (const rule of V9_CHECK_RULES) {
      if (existingKeys.has(`check|${rule.key.toLowerCase()}`)) continue;
      await database.runAsync(
        `
          INSERT INTO filter_rules (type, key, category, threshold, operator, severity, created_at)
          VALUES ('check', $key, $category, $threshold, $operator, 'red_flag', $created_at);
        `,
        {
          $key: rule.key,
          $category: rule.category,
          $threshold: rule.threshold,
          $operator: rule.operator,
          $created_at: now,
        }
      );
    }
  } catch (error) {
    throw new Error(`Failed to update the filter list: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

/**
 * v10: wine, beer and spirits added to the category Alkohol. A frozen copy instead of
 * `seedRules`: later changes to the seed list must not change what this migration does.
 */
const V10_ADDED_INGREDIENT_RULES: { key: string; category: string }[] = [
  { key: 'Wine', category: 'Alkohol' },
  { key: 'Port Wine', category: 'Alkohol' },
  { key: 'Sherry', category: 'Alkohol' },
  { key: 'Marsala', category: 'Alkohol' },
  { key: 'Sake', category: 'Alkohol' },
  { key: 'Beer', category: 'Alkohol' },
  { key: 'Brandy', category: 'Alkohol' },
  { key: 'Weinbrand', category: 'Alkohol' },
  { key: 'Cognac', category: 'Alkohol' },
  { key: 'Kirschwasser', category: 'Alkohol' },
  { key: 'Rum', category: 'Alkohol' },
  { key: 'Whisky', category: 'Alkohol' },
  { key: 'Whiskey', category: 'Alkohol' },
  { key: 'Vodka', category: 'Alkohol' },
  { key: 'Liqueur', category: 'Alkohol' },
];

/**
 * v10: adds the new alcohol rules, unless an ingredient rule with the same key (any
 * case, any severity) already exists, so the user's own rules are neither duplicated
 * nor overridden.
 */
async function addAlcoholRules(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const existing = await database.getAllAsync<{ key: string }>(
      "SELECT key FROM filter_rules WHERE type = 'ingredient'"
    );
    const existingKeys = new Set(existing.map((r) => r.key.toLowerCase()));
    const now = new Date().toISOString();

    for (const rule of V10_ADDED_INGREDIENT_RULES) {
      if (existingKeys.has(rule.key.toLowerCase())) continue;
      await database.runAsync(
        `
          INSERT INTO filter_rules (type, key, category, threshold, operator, severity, created_at)
          VALUES ('ingredient', $key, $category, NULL, NULL, 'red_flag', $created_at);
        `,
        { $key: rule.key, $category: rule.category, $created_at: now }
      );
    }
  } catch (error) {
    throw new Error(`Failed to add the alcohol rules: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

/** v11: the water checks, a frozen copy of the `CHECK_SEEDS` entries added at this version. */
const V11_ADDED_CHECK_RULES: { key: string; category: string }[] = [
  { key: 'water_not_mineral', category: 'Wasser' },
  { key: 'water_plastic_bottle', category: 'Wasser' },
  { key: 'water_contaminants', category: 'Wasser' },
];

/**
 * v11: adds the water checks, unless a check rule with the same key (any case, any
 * severity) already exists, so the user's own settings are neither duplicated nor
 * overridden.
 */
async function addWaterChecks(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const existing = await database.getAllAsync<{ key: string }>(
      "SELECT key FROM filter_rules WHERE type = 'check'"
    );
    const existingKeys = new Set(existing.map(({ key }) => key.toLowerCase()));
    const now = new Date().toISOString();

    for (const { key, category } of V11_ADDED_CHECK_RULES) {
      if (existingKeys.has(key.toLowerCase())) continue;
      await database.runAsync(
        `
          INSERT INTO filter_rules (type, key, category, threshold, operator, severity, created_at)
          VALUES ('check', $key, $category, NULL, NULL, 'red_flag', $created_at);
        `,
        { $key: key, $category: category, $created_at: now }
      );
    }
  } catch (error) {
    throw new Error(`Failed to add the water checks: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

/** v12: sources of the seeded product rules. */
const V12_SOURCES = {
  leinetal24: {
    title: 'leinetal24',
    url: 'https://www.leinetal24.de/verbraucher/test-wasser-news-aktuell-uran-kassel-oeko-test-still-zr-90005521.html',
  },
  tOnline: {
    title: 't-online',
    url: 'https://www.t-online.de/leben/testberichte/id_100787666/-oeko-test-stille-mineralwasser-mit-bedenklichen-inhaltsstoffen.html',
    date: '2025-06-26',
  },
  utopia: {
    title: 'Utopia',
    url: 'https://utopia.de/news/mineralwasser-test-stiftung-warentest',
    date: '2026-08-05',
  },
  heidelberg24: {
    title: 'heidelberg24',
    url: 'https://www.heidelberg24.de/verbraucher/einkauf-test/das-beste-stilles-wasser-oekotest-discounter-vergleich-mineralwasser-fluorid-94355632.html',
  },
  theLocalBan: {
    title: 'The Local',
    url: 'https://www.thelocal.fr/20250925/french-consumer-group-seeks-perrier-sales-ban',
    date: '2025-09-25',
  },
  theLocalCourt: {
    title: 'The Local',
    url: 'https://www.thelocal.fr/20251119/french-court-says-perrier-can-be-sold-as-natural-mineral-water',
    date: '2025-11-19',
  },
} as const;

const V12_URANIUM = {
  de: 'Öko-Test 07/2025: „ungenügend“ – erhöhter Urangehalt.',
  en: 'Öko-Test 07/2025: “insufficient” – elevated uranium content.',
};

const V12_NESTLE_TREATMENT = {
  de: 'Nestlé räumte 2024 ein, diese Wässer verboten mit Aktivkohle und UV aufbereitet zu haben.',
  en: 'In 2024 Nestlé admitted to having treated these waters with activated carbon and UV, which is not allowed.',
};

/**
 * v12: waters criticised in tests or for prohibited treatment, a frozen copy. Each one
 * is a rule of type "product" whose data (brand, name words, reason, sources) is stored
 * as JSON in the `translations` column.
 */
const V12_PRODUCT_RULES: {
  key: string;
  brand: string;
  nameWords: string[];
  reason: { de: string; en: string };
  sources: { title: string; url: string; date?: string }[];
}[] = [
  {
    key: 'Forstetal Calciumquelle Pure',
    brand: 'Forstetal',
    nameWords: ['Calciumquelle', 'Pure'],
    reason: V12_URANIUM,
    sources: [V12_SOURCES.leinetal24],
  },
  {
    key: 'Naturpark Quelle Naturelle',
    brand: 'Naturpark Quelle',
    nameWords: ['Naturelle'],
    reason: V12_URANIUM,
    sources: [V12_SOURCES.leinetal24],
  },
  {
    key: 'Vitrex Naturelle',
    brand: 'Vitrex',
    nameWords: ['Naturelle'],
    reason: V12_URANIUM,
    sources: [V12_SOURCES.leinetal24],
  },
  {
    key: 'Reinbeker Klosterquelle Frische Brise',
    brand: 'Reinbeker Klosterquelle',
    nameWords: ['Frische Brise'],
    reason: {
      de: 'Öko-Test 07/2025: „ungenügend“ – erhöhte Keimzahl, Süßstoffe und Chrom(VI).',
      en: 'Öko-Test 07/2025: “insufficient” – elevated germ count, sweeteners and chromium(VI).',
    },
    sources: [V12_SOURCES.tOnline],
  },
  {
    key: 'Gut & Günstig Mineralwasser',
    brand: 'Gut & Günstig',
    nameWords: ['Mineralwasser'],
    reason: {
      de: 'Öko-Test 2025/2026: Still und Medium abgewertet wegen Chrom(VI) und TFA.',
      en: 'Öko-Test 2025/2026: still and medium variants downgraded for chromium(VI) and TFA.',
    },
    sources: [V12_SOURCES.tOnline, V12_SOURCES.utopia],
  },
  {
    key: 'Bad Harzburger Medium',
    brand: 'Bad Harzburger',
    nameWords: ['Medium'],
    reason: {
      de: 'Öko-Test 07/2026: „mangelhaft“ – Arsen deutlich über dem Orientierungswert, erhöhte TFA.',
      en: 'Öko-Test 07/2026: “poor” – arsenic well above the guideline value, elevated TFA.',
    },
    sources: [V12_SOURCES.utopia],
  },
  {
    key: 'Naturalis Medium',
    brand: 'Naturalis',
    nameWords: ['Medium'],
    reason: {
      de: 'Öko-Test 07/2026: „ungenügend“ – Chrom(VI).',
      en: 'Öko-Test 07/2026: “insufficient” – chromium(VI).',
    },
    sources: [V12_SOURCES.utopia],
  },
  {
    key: 'Volvic',
    brand: 'Volvic',
    nameWords: [],
    reason: {
      de: 'Öko-Test 07/2025: nur „ausreichend“ – erhöhter Nitratgehalt.',
      en: 'Öko-Test 07/2025: only “sufficient” – elevated nitrate content.',
    },
    sources: [V12_SOURCES.heidelberg24],
  },
  {
    key: 'Gerolsteiner Naturell',
    brand: 'Gerolsteiner',
    nameWords: ['Naturell'],
    reason: {
      de: 'Öko-Test 07/2025: nur „befriedigend“ – erhöhtes Chrom(VI).',
      en: 'Öko-Test 07/2025: only “satisfactory” – elevated chromium(VI).',
    },
    sources: [V12_SOURCES.heidelberg24],
  },
  ...['Perrier', 'Vittel', 'Contrex', 'Hépar'].map((brand) => ({
    key: brand,
    brand,
    nameWords: [],
    reason: V12_NESTLE_TREATMENT,
    sources: [V12_SOURCES.theLocalBan, V12_SOURCES.theLocalCourt],
  })),
];

/**
 * v12: adds the product rules for criticised waters, unless a product rule with the
 * same name (any case, any severity) already exists, so a rule the user switched off
 * or deleted and re-added is neither duplicated nor overridden.
 */
async function addWaterTestRules(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const existing = await database.getAllAsync<{ key: string }>(
      "SELECT key FROM filter_rules WHERE type = 'product'"
    );
    const existingKeys = new Set(existing.map(({ key }) => key.toLowerCase()));
    const now = new Date().toISOString();

    for (const { key, brand, nameWords, reason, sources } of V12_PRODUCT_RULES) {
      if (existingKeys.has(key.toLowerCase())) continue;
      const data = { brand, nameWords, waterOnly: true, reason, sources };
      await database.runAsync(
        `
          INSERT INTO filter_rules (type, key, category, threshold, operator, severity, translations, created_at)
          VALUES ('product', $key, 'Wasser-Tests', NULL, NULL, 'red_flag', $translations, $created_at);
        `,
        { $key: key, $translations: JSON.stringify(data), $created_at: now }
      );
    }
  } catch (error) {
    throw new Error(`Failed to add the water test rules: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

/** v12: the avoided company Nestlé. */
const V12_NESTLE_RULE_NAME = 'Nestlé';

/** Names collected from Wikidata for Q160746 on 2026-10-04, plus Hépar. */
const V12_NESTLE_NAMES: readonly string[] = [
  'Nestlé',
  'Abuelita',
  'Acqua Panna',
  'Acqua Vera',
  'Aero',
  'Aero chocolate',
  'After Eight',
  "Allen's",
  'Antiperle',
  'BabyNes',
  'Balaton',
  'Bärenmarke',
  'Bear Brand',
  'Beverage Partners Worldwide',
  'Big Turk',
  'Biscoitos São Luiz',
  'Black Magic',
  'Blue Riband biscuit',
  'Bonka',
  'Boost',
  'Bottle Caps',
  'Bracafé',
  'Buitoni',
  'Café El Águila',
  'Caramac',
  'Carlos V chocolate bar',
  'Carnation',
  'Centroproizvod',
  'Cereal Partners Worldwide',
  'Cerelac',
  'Chambourcy',
  'Cheekies',
  'Chocapic',
  'Chocolat Kohler',
  'Chokito',
  'Cini Minis',
  'Cinnamon Toast Crunch',
  'Coffee Crisp',
  'Coffee-Mate',
  'Cookie Crisp',
  'Crisp',
  "D'Onofrio",
  'Dancow',
  'DiGiorno',
  'Dinossauro',
  'Dolce Gusto',
  'Drammens Is',
  "Dreyer's",
  'El Chaná',
  'Fab',
  'Fitness',
  'Fitness cereal',
  'Friskies PetCare Company',
  'Froneri',
  'Garden Gourmet',
  'Garoto',
  'Gerber Products Company',
  'Golden Nuggets',
  'Hollandia',
  'Hot Pockets',
  'Hsu Fu Chi',
  'Ice Mountain',
  'Jede',
  'Kit Kat',
  'Kofila',
  'La Lechera',
  'Lanvin',
  'Lean Cuisine',
  'Lion',
  'Lion Bar',
  'Lion Cereal',
  'Litoral',
  'Lollo',
  "Mackintosh's Toffee",
  'Maggi',
  'Matchmakers',
  'Menier Chocolate',
  'Milkybar',
  'Milo',
  'Mirage',
  'Mivina',
  'Mövenpick Ice Cream',
  'Munchies confectionery',
  'Nescafé',
  'Nescau',
  'Nespresso',
  'Nesquik',
  'Nesquik Cereal',
  'Nestea',
  'Nestlé (Canada)',
  'Nestlé (United States)',
  'Nestlé Bulgaria',
  'Nestlé Česko',
  'Nestlé Chunky',
  "Nestlé Côte d'Ivoire",
  'Nestlé Crunch',
  'Nestlé Deutschland',
  'Nestlé Dibs',
  'Nestle España',
  'Nestlé Hellas',
  'Nestlé India',
  'Nestlé Ireland',
  'Nestlé Milk Chocolate',
  'Nestle Nido',
  'Nestlé Purina PetCare',
  'Nestlé Rossiya',
  'Nestlé Tex',
  'Nestlé United Kingdom',
  'Nestlé Waters',
  'Nuts',
  'Nuts (Schokoriegel)',
  'Oh Henry!',
  'Osem',
  'Osem Investments',
  'Panna',
  'Peppermint Crisp',
  'Perrier',
  'Perugina',
  'Polly Waffle',
  'Polo mint',
  'Prestígio',
  'Quality Street',
  'Rolo',
  "Rowntree's",
  "Rowntree's Fruit Gums",
  "Rowntree's Fruit Pastilles",
  'Ruchoco',
  'Sanpellegrino S.p.A.',
  'Schokoladenfabrik Menier',
  "Seattle's Best Coffee",
  'Shreddies',
  'Sical',
  'Skinny Cow',
  'Smarties',
  'Société des Produits Nestlé',
  "Stouffer's",
  'Svitoch',
  'The Willy Wonka Candy Company',
  'Thomy',
  'Tivall CZ',
  'Tombstone',
  'Uncle Tobys',
  'Unilac, Inc.',
  'Vascolet',
  'Violet Crumble',
  'Vitaflo',
  'Vitaflo International Ltd.',
  'Vittel',
  'Wagner Pizza',
  'Wagner Tiefkühlprodukte',
  'Walnut Whip',
  'Winiary',
  'Yes Torty',
  'Yorkie chocolate bar',
  'Zoégas Kaffe',
  'Alpo',
  'Antica Gelateria del Corso',
  'Aquarel',
  'Arpège',
  'Bacio Perugina',
  'Baton',
  "Beggin' Strips product line",
  'Beneful',
  'Bissli',
  'Cabana',
  'Cailler',
  'Choco Crossies',
  'Coffee Mate Dirty Soda',
  'contrex',
  'Deer Park Spring Water',
  'Drumstick',
  "Edy's Pie",
  'Erikli',
  'Eskimo',
  'Fawdon Factory',
  'Felix',
  'Fontalegre',
  'Friskies',
  'Froneri Ice Cream Deutschland',
  'Gerber Baby',
  'Gerber Singles',
  'Golden Grahams',
  'Häagen-Dazs',
  'Henniez',
  'Henniez (Mineralwasser)',
  'Joker Is',
  "Kelly's of Cornwall",
  'Lentilky',
  "Lily's Kitchen",
  'Maxibon',
  'Nestlé Pure Life',
  'Nestlé Waters France',
  'Orion',
  'Orion (Schokoladenfabrik)',
  'Ozarka',
  'Peters Ice Cream',
  'Petfinder',
  'Plus',
  'Poland Spring',
  'Purina One',
  'R&R Ice Cream Deutschland',
  'Ralston Purina',
  'S.Pellegrino',
  'San Pellegrino',
  'Sanpellegrino sparkling drink',
  'Sarotti',
  'Serenata de Amor',
  'Tip Top',
  'Tivall',
  'Villa Panna',
  'Charrier',
  'Jelly Tip',
  'Nintendo Cereal System',
  'Studentská pečeť',
  'Teenage Mutant Ninja Turtles Cereal',
  'Hépar',
];

/** Generic or non-food names, switched off; the user can switch them on in the editor. */
const V12_NESTLE_EXCLUDED: readonly string[] = [
  'Arpège',
  'Lanvin',
  'Nintendo Cereal System',
  'Teenage Mutant Ninja Turtles Cereal',
  'Petfinder',
  'Plus',
  'Lion',
  'Nuts',
  'Crisp',
  'Fab',
  'Fitness',
  'Orion',
  'Felix',
  'Tip Top',
  'Baton',
  'Mirage',
  'Cabana',
  'Jede',
  'Boost',
  'Panna',
  'Eskimo',
];

/**
 * v12: adds Nestlé as an avoided company, unless a company rule with the same
 * normalized name exists. Its brands are a frozen Wikidata lookup of Q160746
 * (CC0, 2026-10-04) plus Hépar; generic and non-food names start switched off.
 */
async function addNestleCompanyRule(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const existing = await database.getAllAsync<{ key: string }>(
      "SELECT key FROM filter_rules WHERE type = 'company'"
    );
    const own = normalizeCompanyName(V12_NESTLE_RULE_NAME);
    if (existing.some(({ key }) => normalizeCompanyName(key) === own)) return;
    const data = {
      wikidataId: 'Q160746',
      names: V12_NESTLE_NAMES,
      excluded: V12_NESTLE_EXCLUDED,
    };
    await database.runAsync(
      `
        INSERT INTO filter_rules (type, key, category, threshold, operator, severity, translations, created_at)
        VALUES ('company', $key, 'Marken & Konzerne', NULL, NULL, 'red_flag', $translations, $created_at);
      `,
      {
        $key: V12_NESTLE_RULE_NAME,
        $translations: JSON.stringify(data),
        $created_at: new Date().toISOString(),
      }
    );
  } catch (error) {
    throw new Error(`Failed to add the Nestlé company rule: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

/** v12: product rules for criticised waters and Nestlé as an avoided company. */
async function migrateToV12(database: SQLite.SQLiteDatabase): Promise<void> {
  await addWaterTestRules(database);
  await addNestleCompanyRule(database);
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
