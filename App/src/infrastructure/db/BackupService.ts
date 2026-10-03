import * as FileSystem from 'expo-file-system/legacy';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import {
  DATABASE_NAME,
  db,
  deleteMetaValue,
  getMetaValue,
  initDatabase,
  META_ALLERGEN_PROFILE,
  META_ALLERGEN_WARNING,
  resetDatabaseState,
  setMetaValue,
} from './DatabaseService';

const DATABASE_DIR = `${FileSystem.documentDirectory}SQLite/`;
const DB_PATH = `${DATABASE_DIR}${DATABASE_NAME}`;
const CANDIDATE_NAME = 'restore-candidate.db';
const CANDIDATE_PATH = `${DATABASE_DIR}${CANDIDATE_NAME}`;
const SAFETY_COPY_PATH = `${DATABASE_DIR}foodscanner.pre-restore.db`;

const META_BACKUP_URI = 'backup_uri';
const META_AUTO_BACKUP = 'backup_auto';
const META_LAST_BACKUP = 'backup_last_at';
/** Settings of this device that a restored file must not overwrite. */
const DEVICE_META_KEYS = [META_BACKUP_URI, META_AUTO_BACKUP, META_LAST_BACKUP];
/**
 * Kept when the restored file does not have them, e.g. a backup made before the allergen
 * profile existed must not silently switch the allergen warnings off.
 */
const KEEP_IF_MISSING_META_KEYS = [META_ALLERGEN_PROFILE, META_ALLERGEN_WARNING];

/** Base64 of "SQLite format 3", the first 15 bytes of every SQLite database file. */
const SQLITE_HEADER_BASE64 = 'U1FMaXRlIGZvcm1hdCAz';
const AUTO_BACKUP_INTERVAL_HOURS = 24;

export type BackupErrorCode =
  | 'unsupported-platform'
  | 'permission-denied'
  | 'no-directory'
  | 'no-database'
  | 'cancelled'
  | 'not-a-backup'
  | 'restore-failed';

/** Error with a code the UI translates; `message` is for logs only. */
export class BackupError extends Error {
  constructor(
    public readonly code: BackupErrorCode,
    message: string = code
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

export interface BackupFile {
  name: string;
  uri: string;
}

async function metaValue(key: string): Promise<string | null> {
  try {
    return await getMetaValue(key);
  } catch {
    return null;
  }
}

async function checkpoint(): Promise<void> {
  const database = db ?? (await initDatabase());
  // Moves the write-ahead log into the main file so a file copy is complete.
  await database.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');
}

async function deleteDatabaseFiles(path: string): Promise<void> {
  for (const suffix of ['', '-wal', '-shm']) {
    await FileSystem.deleteAsync(path + suffix, { idempotent: true }).catch(() => {});
  }
}

/** Checks that a file is an SQLite database of this app before anything is replaced. */
async function assertIsAppDatabase(base64: string): Promise<void> {
  if (!base64.startsWith(SQLITE_HEADER_BASE64)) {
    throw new BackupError('not-a-backup', 'File is not an SQLite database');
  }

  await deleteDatabaseFiles(CANDIDATE_PATH);
  await FileSystem.writeAsStringAsync(CANDIDATE_PATH, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  let candidate: SQLite.SQLiteDatabase | null = null;
  try {
    candidate = await SQLite.openDatabaseAsync(CANDIDATE_NAME);
    const tables = await candidate.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('products', 'meta')"
    );
    if (tables.length < 2) {
      throw new BackupError('not-a-backup', 'Database does not contain FoodCheck tables');
    }
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError('not-a-backup', `Database cannot be read: ${String(error)}`);
  } finally {
    await candidate?.closeAsync().catch(() => {});
    await deleteDatabaseFiles(CANDIDATE_PATH);
  }
}

export const BackupService = {
  async getBackupUri(): Promise<string> {
    return (await metaValue(META_BACKUP_URI)) ?? '';
  },

  async setBackupUri(uri: string): Promise<void> {
    await setMetaValue(META_BACKUP_URI, uri);
  },

  async isBackupPathConfigured(): Promise<boolean> {
    return (await BackupService.getBackupUri()).length > 0;
  },

  /** Human-readable folder name of an Android storage-access URI. */
  directoryLabel(uri: string): string {
    return decodeURIComponent(uri.split('%3A').pop()?.split('/')[0] ?? uri) || uri;
  },

  async pickBackupDirectory(): Promise<string> {
    if (Platform.OS !== 'android') {
      throw new BackupError('unsupported-platform');
    }
    const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) {
      throw new BackupError('permission-denied');
    }
    await BackupService.setBackupUri(permission.directoryUri);
    return BackupService.directoryLabel(permission.directoryUri);
  },

  /** Copies the database file into the chosen folder. Returns the new file's URI. */
  async createBackup(): Promise<string> {
    const backupUri = await BackupService.getBackupUri();
    if (!backupUri) {
      throw new BackupError('no-directory');
    }

    await checkpoint();
    const dbInfo = await FileSystem.getInfoAsync(DB_PATH);
    if (!dbInfo.exists) {
      throw new BackupError('no-database');
    }

    const now = new Date();
    const backupName = `foodscanner_backup_${now.toISOString().replace(/[:.]/g, '-')}.db`;
    const contents = await FileSystem.readAsStringAsync(DB_PATH, {
      encoding: FileSystem.EncodingType.Base64,
    });

    let backupPath: string;
    if (backupUri.startsWith('content://')) {
      backupPath = await StorageAccessFramework.createFileAsync(
        backupUri,
        backupName,
        'application/octet-stream'
      );
    } else {
      await FileSystem.makeDirectoryAsync(backupUri, { intermediates: true }).catch(() => {});
      backupPath = `${backupUri}${backupUri.endsWith('/') ? '' : '/'}${backupName}`;
    }
    await FileSystem.writeAsStringAsync(backupPath, contents, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await BackupService.setLastBackupTime(now.toISOString());
    return backupPath;
  },

  async getLastBackupTime(): Promise<string | null> {
    return metaValue(META_LAST_BACKUP);
  },

  async setLastBackupTime(iso: string): Promise<void> {
    await setMetaValue(META_LAST_BACKUP, iso).catch(() => {});
  },

  async isAutoBackupEnabled(): Promise<boolean> {
    return (await metaValue(META_AUTO_BACKUP)) === 'true';
  },

  async setAutoBackupEnabled(enabled: boolean): Promise<void> {
    await setMetaValue(META_AUTO_BACKUP, enabled ? 'true' : 'false');
  },

  async pickRestoreFile(): Promise<BackupFile> {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) {
      throw new BackupError('cancelled');
    }
    const asset = result.assets[0];
    return { name: asset.name || 'backup.db', uri: asset.uri };
  },

  /**
   * Replaces the database with a backup file.
   *
   * The file is checked first (SQLite header + FoodCheck tables); the current database
   * is kept as a safety copy and put back if anything fails. Backup settings of this
   * device (folder, auto backup, last backup) are kept. Callers reload their stores
   * afterwards.
   */
  async restoreFromUri(fileUri: string): Promise<void> {
    const contents = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await assertIsAppDatabase(contents);

    const deviceMeta = new Map<string, string>();
    for (const key of DEVICE_META_KEYS) {
      const value = await metaValue(key);
      if (value !== null) deviceMeta.set(key, value);
    }
    const currentMeta = new Map<string, string>();
    for (const key of KEEP_IF_MISSING_META_KEYS) {
      const value = await metaValue(key);
      if (value !== null) currentMeta.set(key, value);
    }

    await checkpoint().catch(() => {});
    await FileSystem.deleteAsync(SAFETY_COPY_PATH, { idempotent: true }).catch(() => {});
    await FileSystem.copyAsync({ from: DB_PATH, to: SAFETY_COPY_PATH });

    await db?.closeAsync();
    resetDatabaseState();

    try {
      await deleteDatabaseFiles(DB_PATH);
      await FileSystem.writeAsStringAsync(DB_PATH, contents, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await initDatabase();
      for (const key of DEVICE_META_KEYS) {
        const value = deviceMeta.get(key);
        await (value === undefined ? deleteMetaValue(key) : setMetaValue(key, value));
      }
      for (const [key, value] of currentMeta) {
        if ((await getMetaValue(key)) === null) await setMetaValue(key, value);
      }
    } catch (error) {
      await db?.closeAsync().catch(() => {});
      resetDatabaseState();
      await deleteDatabaseFiles(DB_PATH);
      await FileSystem.copyAsync({ from: SAFETY_COPY_PATH, to: DB_PATH });
      await initDatabase();
      throw new BackupError(
        'restore-failed',
        `Restore failed and was rolled back: ${String(error)}`
      );
    }

    await FileSystem.deleteAsync(SAFETY_COPY_PATH, { idempotent: true }).catch(() => {});
  },

  /** Creates a backup at most once a day if enabled and a folder is set. */
  async performAutoBackup(): Promise<void> {
    try {
      if (!(await BackupService.isAutoBackupEnabled())) return;
      if (!(await BackupService.isBackupPathConfigured())) return;

      const lastBackup = await BackupService.getLastBackupTime();
      if (lastBackup) {
        const hours = (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60);
        if (hours < AUTO_BACKUP_INTERVAL_HOURS) return;
      }
      await BackupService.createBackup();
    } catch (error) {
      console.warn('Automatic backup failed:', error);
    }
  },
};
