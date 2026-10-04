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

/** Schema of the release before the filter list update (v8). */
export const V8_SCHEMA = `
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
    last_seen_at TEXT,
    edited_at TEXT,
    edited_fields TEXT
  );
  CREATE TABLE favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX idx_favorites_product_id ON favorites(product_id);
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
  INSERT INTO meta (key, value) VALUES ('schema_version', '8');
`;

/** Schema of the release before the alcohol rules (v9): the filter list update. */
export const V9_SCHEMA = `
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
    last_seen_at TEXT,
    edited_at TEXT,
    edited_fields TEXT
  );
  CREATE TABLE favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX idx_favorites_product_id ON favorites(product_id);
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
  INSERT INTO meta (key, value) VALUES ('schema_version', '9');
`;

/** Seed rules of v8 that the filter list update (v9) removed: packaging and propellant gases. */
export const SEED_RULES_REMOVED_IN_V9 = [
  { key: 'Carbon Dioxide', category: 'Phosphate & Mineralstoffe' },
  { key: 'Nitrous Oxide', category: 'Phosphate & Mineralstoffe' },
  { key: 'Packaging Gas', category: 'Füll- & Trägerstoffe' },
  { key: 'Propellants', category: 'Füll- & Trägerstoffe' },
  { key: 'E290', category: 'E-Nummern' },
  { key: 'E938', category: 'E-Nummern' },
  { key: 'E939', category: 'E-Nummern' },
  { key: 'E941', category: 'E-Nummern' },
  { key: 'E942', category: 'E-Nummern' },
  { key: 'E948', category: 'E-Nummern' },
  { key: 'E949', category: 'E-Nummern' },
];

/** Seed rule keys that the filter list update (v9) added. */
export const SEED_KEYS_ADDED_IN_V9 = [
  'E120',
  'E200',
  'E203',
  'E214',
  'E215',
  'E219',
  'E460',
  'E461',
  'E462',
  'E463',
  'E464',
  'E465',
  'E466',
  'E476',
  'E492',
  'E493',
  'E494',
  'E495',
  'E952',
  'E1404',
  'E1410',
  'E1412',
  'E1413',
  'E1414',
  'E1420',
  'E1422',
  'E1440',
  'E1442',
  'E1450',
  'E1452',
  'E1520',
  'Carboxymethylcellulose',
  'Methylcellulose',
  'Hydroxypropyl Methylcellulose',
  'Cellulose',
  'Polyglycerol Polyricinoleate',
  'Sorbitan Tristearate',
  'Sorbitan Monolaurate',
  'Sorbitan Monooleate',
  'Sorbitan Monopalmitate',
  'Cyclamate',
  'Carmine',
  'Cochineal',
  'Sorbic Acid',
  'Ethylparaben',
  'PHB-Ester',
  'Celery Extract',
  'Selleriesaftpulver',
  'Propylene Glycol',
  'Propylenglycol',
  'Citronensäure',
  'Genetically Modified',
  'gentechnisch verändert',
  'Acheta domesticus',
  'Tenebrio molitor',
  'Locusta migratoria',
  'Alphitobius diaperinus',
  'Insects',
  'Sunflower Oil',
  'Sonnenblumenkernöl',
  'Rapeseed Oil',
  'Canola Oil',
  'Corn Oil',
  'Maisöl',
  'Safflower Oil',
  'Grapeseed Oil',
  'Rice Bran Oil',
  'Vegetable Oil',
  'Meat Substitute',
  'Pea Protein',
  'Erbseneiweiß',
  'Wheat Protein',
  'Weizeneiweiß',
  'Seitan',
  'Mycoprotein',
  'Fava Bean Protein',
  'Aquaculture',
  'gezüchtet',
  'Alcohol',
  'Ethanol',
  'Pasteurised',
  'Pasteurized',
  'UHT',
  'ultrahocherhitzt',
  'wärmebehandelt',
  'H-Milch',
];

/** Seed rule keys that the alcohol rules (v10) added. */
export const SEED_KEYS_ADDED_IN_V10 = [
  'Wine',
  'Port Wine',
  'Sherry',
  'Marsala',
  'Sake',
  'Beer',
  'Brandy',
  'Weinbrand',
  'Cognac',
  'Kirschwasser',
  'Rum',
  'Whisky',
  'Whiskey',
  'Vodka',
  'Liqueur',
];

/** Check keys that the water checks (v11) added. */
export const CHECK_KEYS_ADDED_IN_V11 = [
  'water_not_mineral',
  'water_plastic_bottle',
  'water_contaminants',
];

/** Keys of the product rules migration 12 adds (category Wasser-Tests). */
export const PRODUCT_RULE_KEYS_ADDED_IN_V12 = [
  'Forstetal Calciumquelle Pure',
  'Naturpark Quelle Naturelle',
  'Vitrex Naturelle',
  'Reinbeker Klosterquelle Frische Brise',
  'Gut & Günstig Mineralwasser',
  'Bad Harzburger Medium',
  'Naturalis Medium',
  'Volvic',
  'Gerolsteiner Naturell',
  'Perrier',
  'Vittel',
  'Contrex',
  'Hépar',
];

/** Number of rules migration 12 adds to a database that has none of them. */
export const RULES_ADDED_IN_V12 = PRODUCT_RULE_KEYS_ADDED_IN_V12.length;

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
