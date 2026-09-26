/// <reference types="node" />
/**
 * Backup and restore against real SQLite files in a temporary folder
 * (expo-file-system and expo-sqlite are mapped onto the local file system).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackupService, BackupError } from '../BackupService';
import {
  resetDatabaseState,
  db,
  initDatabase,
  getMetaValue,
  setMetaValue,
  META_ALLERGEN_PROFILE,
} from '../DatabaseService';
import { ProductRepository } from '../ProductRepository';
import { productRecord } from '../../../testing/testDatabase';

const mockRoot = { dir: '' };

function mockToPath(uri: string): string {
  return path.join(mockRoot.dir, uri.replace(/^file:\/\/\/?/, ''));
}

jest.mock('expo-file-system/legacy', () => {
  const nodeFs = jest.requireActual('fs') as typeof import('fs');
  const nodePath = jest.requireActual('path') as typeof import('path');
  const ensureDir = (file: string) => nodeFs.mkdirSync(nodePath.dirname(file), { recursive: true });
  return {
    documentDirectory: 'file:///doc/',
    EncodingType: { Base64: 'base64', UTF8: 'utf8' },
    readAsStringAsync: async (uri: string) =>
      nodeFs.readFileSync(mockToPath(uri)).toString('base64'),
    writeAsStringAsync: async (uri: string, data: string) => {
      const file = mockToPath(uri);
      ensureDir(file);
      nodeFs.writeFileSync(file, Buffer.from(data, 'base64'));
    },
    deleteAsync: async (uri: string) => nodeFs.rmSync(mockToPath(uri), { force: true }),
    copyAsync: async ({ from, to }: { from: string; to: string }) => {
      ensureDir(mockToPath(to));
      nodeFs.copyFileSync(mockToPath(from), mockToPath(to));
    },
    getInfoAsync: async (uri: string) => ({ exists: nodeFs.existsSync(mockToPath(uri)) }),
    makeDirectoryAsync: async (uri: string) =>
      nodeFs.mkdirSync(mockToPath(uri), { recursive: true }),
    StorageAccessFramework: {},
  };
});

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async (name: string) => {
    const { NodeSqliteDatabase } = jest.requireActual('../../../testing/nodeSqlite');
    const nodeFs = jest.requireActual('fs') as typeof import('fs');
    const file = mockToPath(`doc/SQLite/${name}`);
    nodeFs.mkdirSync((jest.requireActual('path') as typeof import('path')).dirname(file), {
      recursive: true,
    });
    return new NodeSqliteDatabase(file);
  }),
}));

const products = new ProductRepository();

async function names(): Promise<string[]> {
  return (await products.findAllSummaries()).map((p) => p.name ?? '');
}

describe('BackupService with real files', () => {
  beforeEach(async () => {
    mockRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foodcheck-backup-'));
    resetDatabaseState();
    await initDatabase();
    await BackupService.setBackupUri('file:///backups/');
  });

  afterEach(async () => {
    await db?.closeAsync();
    resetDatabaseState();
    fs.rmSync(mockRoot.dir, { recursive: true, force: true });
  });

  it('creates a backup that restores the data exactly', async () => {
    await products.saveScan(productRecord({ ean: '4000000000001', name: 'Vorher' }));
    const backupUri = await BackupService.createBackup();
    expect(await BackupService.getLastBackupTime()).toEqual(expect.any(String));

    await products.saveScan(productRecord({ ean: '4000000000002', name: 'Nachher' }));
    await products.deleteByEan('4000000000001');
    expect(await names()).toEqual(['Nachher']);

    await BackupService.restoreFromUri(backupUri);

    expect(await names()).toEqual(['Vorher']);
  });

  it('keeps the backup settings of this device', async () => {
    const backupUri = await BackupService.createBackup();
    await BackupService.setBackupUri('file:///other-folder/');
    await BackupService.setAutoBackupEnabled(true);

    await BackupService.restoreFromUri(backupUri);

    expect(await BackupService.getBackupUri()).toBe('file:///other-folder/');
    expect(await BackupService.isAutoBackupEnabled()).toBe(true);
  });

  it('keeps the allergen profile when the backup has none', async () => {
    const backupUri = await BackupService.createBackup();
    await setMetaValue(META_ALLERGEN_PROFILE, '["milk"]');

    await BackupService.restoreFromUri(backupUri);

    expect(await getMetaValue(META_ALLERGEN_PROFILE)).toBe('["milk"]');
  });

  it('takes the allergen profile from the backup when it has one', async () => {
    await setMetaValue(META_ALLERGEN_PROFILE, '["gluten"]');
    const backupUri = await BackupService.createBackup();
    await setMetaValue(META_ALLERGEN_PROFILE, '["milk"]');

    await BackupService.restoreFromUri(backupUri);

    expect(await getMetaValue(META_ALLERGEN_PROFILE)).toBe('["gluten"]');
  });

  it('rejects a file that is not a database and keeps all data', async () => {
    await products.saveScan(productRecord({ name: 'Bleibt' }));
    fs.mkdirSync(path.join(mockRoot.dir, 'downloads'), { recursive: true });
    fs.writeFileSync(path.join(mockRoot.dir, 'downloads', 'photo.jpg'), 'not a database');

    await expect(BackupService.restoreFromUri('file:///downloads/photo.jpg')).rejects.toEqual(
      expect.objectContaining({ code: 'not-a-backup' })
    );
    expect(await names()).toEqual(['Bleibt']);
  });

  it('rejects an SQLite file of another app', async () => {
    await products.saveScan(productRecord({ name: 'Bleibt' }));
    const { NodeSqliteDatabase } = jest.requireActual('../../../testing/nodeSqlite');
    const foreignFile = path.join(mockRoot.dir, 'downloads', 'other.db');
    fs.mkdirSync(path.dirname(foreignFile), { recursive: true });
    const foreign = new NodeSqliteDatabase(foreignFile);
    foreign.native.exec('CREATE TABLE notes (text TEXT)');
    await foreign.closeAsync();

    await expect(BackupService.restoreFromUri('file:///downloads/other.db')).rejects.toBeInstanceOf(
      BackupError
    );
    expect(await names()).toEqual(['Bleibt']);
  });

  it('migrates an older backup after restoring it', async () => {
    const { NodeSqliteDatabase } = jest.requireActual('../../../testing/nodeSqlite');
    const { LEGACY_V2_SCHEMA } = jest.requireActual('../../../testing/databaseFixtures');
    const oldFile = path.join(mockRoot.dir, 'downloads', 'old.db');
    fs.mkdirSync(path.dirname(oldFile), { recursive: true });
    const old = new NodeSqliteDatabase(oldFile);
    old.native.exec(LEGACY_V2_SCHEMA);
    old.native.exec(
      "INSERT INTO products (ean, name, scanned_at, rating) VALUES ('4000000000009', 'Alt', '2025-01-01', 'OK')"
    );
    await old.closeAsync();

    await BackupService.restoreFromUri('file:///downloads/old.db');

    const restored = await products.findByEan('4000000000009');
    expect(restored).toMatchObject({ name: 'Alt', visit_count: 1, edited_at: null });
  });

  it('skips the automatic backup if the last one is recent', async () => {
    await BackupService.setAutoBackupEnabled(true);
    await BackupService.setLastBackupTime(new Date().toISOString());
    const spy = jest.spyOn(BackupService, 'createBackup');

    await BackupService.performAutoBackup();

    expect(spy).not.toHaveBeenCalled();
  });
});
