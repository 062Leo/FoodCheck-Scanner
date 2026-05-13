import * as FileSystem from 'expo-file-system/legacy';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { initDatabase, db, resetDatabaseState } from './DatabaseService';

const DATABASE_NAME = 'foodscanner.db';
const DB_PATH = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
const META_BACKUP_URI = 'backup_uri';
const META_AUTO_BACKUP = 'backup_auto';
const META_LAST_BACKUP = 'backup_last_at';

export interface BackupFile {
  name: string;
  uri: string;
}

export const BackupService = {
  async getBackupUri(): Promise<string> {
    await initDatabase();
    if (!db) return '';

    try {
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM meta WHERE key = '" + META_BACKUP_URI + "'"
      );
      return row?.value || '';
    } catch {
      return '';
    }
  },

  async setBackupUri(uri: string): Promise<void> {
    await initDatabase();
    if (!db) return;

    await db.runAsync(
      'INSERT INTO meta (key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      { $key: META_BACKUP_URI, $value: uri }
    );
  },

  async pickBackupDirectory(): Promise<string> {
    if (Platform.OS !== 'android') {
      throw new Error('Directory picker is only supported on Android');
    }

    const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Directory permission denied');
    }

    await this.setBackupUri(permission.directoryUri);

    const dirName =
      permission.directoryUri.split('%3A').pop()?.split('/')[0] || permission.directoryUri;
    return dirName;
  },

  async createBackup(): Promise<string> {
    await initDatabase();

    if (db) {
      await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE)').catch(() => {});
    }

    const backupUri = await this.getBackupUri();
    if (!backupUri) {
      throw new Error('No backup directory selected');
    }

    const dbInfo = await FileSystem.getInfoAsync(DB_PATH);
    if (!dbInfo.exists) {
      throw new Error('Database file not found');
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const backupName = `foodscanner_backup_${timestamp}.db`;

    let backupPath: string;

    if (backupUri.startsWith('content://')) {
      const dbBase64 = await FileSystem.readAsStringAsync(DB_PATH, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileUri = await StorageAccessFramework.createFileAsync(
        backupUri,
        backupName,
        'application/octet-stream'
      );
      await FileSystem.writeAsStringAsync(fileUri, dbBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      backupPath = fileUri;
    } else {
      const dirInfo = await FileSystem.getInfoAsync(backupUri);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(backupUri, { intermediates: true });
      }

      backupPath = `${backupUri}${backupUri.endsWith('/') ? '' : '/'}${backupName}`;
      await FileSystem.copyAsync({ from: DB_PATH, to: backupPath });
    }

    await this.setLastBackupTime(now.toISOString());

    return backupPath;
  },

  async isBackupPathConfigured(): Promise<boolean> {
    const uri = await this.getBackupUri();
    return uri.length > 0;
  },

  async getLastBackupTime(): Promise<string | null> {
    await initDatabase();
    if (!db) return null;

    try {
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM meta WHERE key = '" + META_LAST_BACKUP + "'"
      );
      return row?.value ?? null;
    } catch {
      return null;
    }
  },

  async isAutoBackupEnabled(): Promise<boolean> {
    await initDatabase();
    if (!db) return false;

    try {
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM meta WHERE key = '" + META_AUTO_BACKUP + "'"
      );
      return row?.value === 'true';
    } catch {
      return false;
    }
  },

  async setAutoBackupEnabled(enabled: boolean): Promise<void> {
    await initDatabase();
    if (!db) return;

    await db.runAsync(
      'INSERT INTO meta (key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      { $key: META_AUTO_BACKUP, $value: enabled ? 'true' : 'false' }
    );
  },

  async setLastBackupTime(iso: string): Promise<void> {
    if (!db) return;

    try {
      await db.runAsync(
        'INSERT INTO meta (key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        { $key: META_LAST_BACKUP, $value: iso }
      );
    } catch {
      // silently ignore
    }
  },

  async pickRestoreFile(): Promise<BackupFile> {
    let getDocumentAsync:
      | ((opts: Record<string, unknown>) => Promise<{
          assets?: Array<{ uri: string; name: string }>;
          canceled?: boolean;
        }>)
      | undefined;

    try {
      const mod = globalThis.expo?.modules?.ExpoDocumentPicker;
      if (mod?.getDocumentAsync) {
        getDocumentAsync = mod.getDocumentAsync.bind(mod);
      }
    } catch {
      // not available via expo.modules
    }

    if (!getDocumentAsync) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('expo-document-picker');
        getDocumentAsync = mod.getDocumentAsync;
      } catch {
        throw new Error(
          'expo-document-picker not available. Run: npx expo prebuild --clean && npx expo run:android'
        );
      }
    }

    if (!getDocumentAsync) {
      throw new Error('expo-document-picker not available');
    }

    const result = await getDocumentAsync({ type: '*/*', copyToCacheDirectory: false });

    if (result.canceled || !result.assets?.[0]) {
      throw new Error('cancel');
    }

    const asset = result.assets[0];
    return { name: asset.name || 'backup.db', uri: asset.uri };
  },

  async restoreFromUri(fileUri: string): Promise<void> {
    const dbBase64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await db?.closeAsync();
    resetDatabaseState();

    const walPath = DB_PATH + '-wal';
    const shmPath = DB_PATH + '-shm';

    await FileSystem.deleteAsync(walPath, { idempotent: true }).catch(() => {});
    await FileSystem.deleteAsync(shmPath, { idempotent: true }).catch(() => {});
    await FileSystem.deleteAsync(DB_PATH, { idempotent: true }).catch(() => {});

    await FileSystem.writeAsStringAsync(DB_PATH, dbBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await initDatabase();

    const { useCatalogStore } = await import('../../store/catalogStore');
    const { useFilterStore } = await import('../../store/filterStore');

    useFilterStore.setState({ isInitialized: false, rules: [] });

    await useCatalogStore.getState().loadAll();
    await useFilterStore.getState().loadRules();
  },

  async performAutoBackup(): Promise<void> {
    try {
      const enabled = await this.isAutoBackupEnabled();
      if (!enabled) return;

      const hasPath = await this.isBackupPathConfigured();
      if (!hasPath) return;

      const lastBackup = await this.getLastBackupTime();
      if (lastBackup) {
        const lastDate = new Date(lastBackup);
        const now = new Date();
        const hoursSinceLastBackup = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastBackup < 24) {
          return;
        }
      }

      await this.createBackup();
    } catch {
      // silently ignore auto-backup failures
    }
  },
};
