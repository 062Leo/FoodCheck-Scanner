# Backup-Feature: Implementierungsdokumentation

## Übersicht

Das Backup-Feature ermöglicht es Nutzern, die gesamte SQLite-Datenbank der App als Datei zu exportieren und später wiederherzustellen. Es unterstützt manuelle Backups, automatische tägliche Backups und das Wiederherstellen (Restore) aus einer zuvor gesicherten `.db`-Datei.

**Daten, die gesichert werden:**
- Gescannte Produkte (`products` Tabelle)
- Favoriten (`favorites` Tabelle)
- Filter-Regeln (`filter_rules` Tabelle)
- Meta-Daten / Backup-Einstellungen (`meta` Tabelle)
- Alle durchgeführten Datenbank-Migrationen (Schema-Version)

---

## Architektur / Beteiligte Dateien

| Datei | Rolle |
|---|---|
| `App/src/infrastructure/db/BackupService.ts` | **Kern-Service**: Backup erstellen, wiederherstellen, automatisches Backup, Ordnerauswahl, Meta-Persistenz |
| `App/src/infrastructure/db/DatabaseService.ts` | **Datenbank-Lebenszyklus**: Datenbank initialisieren, zurücksetzen, `meta`-Tabelle erstellen |
| `App/src/screens/SettingsScreen.tsx` | **UI**: Backup-Steuerelemente, Restore-Bestätigung, Auto-Backup-Toggle |
| `App/app/_layout.tsx` | **Auto-Backup-Trigger** bei App-Start |
| `App/src/i18n/translations.ts` | **Übersetzungen** (DE + EN) aller Backup-/Restore-Texte |
| `App/src/store/catalogStore.ts` | Zustand-Store: nach Restore neu geladen |
| `App/src/store/filterStore.ts` | Zustand-Store: nach Restore zurückgesetzt und neu geladen |
| `App/package.json` | Abhängigkeiten: `expo-document-picker`, `expo-file-system` |

---

## 1. BackupService — Der Kern-Service

**Datei:** `App/src/infrastructure/db/BackupService.ts` (258 Zeilen)

### 1.1 Singleton-Pattern

`BackupService` wird als `export const BackupService = { ... }` exportiert — ein Modul-Singleton, das direkt importiert und verwendet wird. Es gibt keine Klasse oder Instanziierung.

```typescript
import { BackupService } from '../infrastructure/db/BackupService';
```

### 1.2 Konfiguration persistieren (Meta-Tabelle)

Alle Backup-Einstellungen werden in der zentralen `meta`-Tabelle der SQLite-Datenbank gespeichert:

| Meta-Key | Typ | Beschreibung |
|---|---|---|
| `backup_uri` | `TEXT` | Speicherort-URI des Backup-Ordners |
| `backup_auto` | `TEXT` (`'true'`/`'false'`) | Auto-Backup aktiviert? |
| `backup_last_at` | `TEXT` | ISO-Zeitstempel des letzten Backups |

**Lese-/Schreibmethoden:**

- **`getBackupUri(): Promise<string>`** — Liest `backup_uri` aus der `meta`-Tabelle.
- **`setBackupUri(uri: string): Promise<void>`** — Schreibt `backup_uri` mit `INSERT ... ON CONFLICT DO UPDATE` (Upsert).
- **`isAutoBackupEnabled(): Promise<boolean>`** — Liest `backup_auto`, gibt `true`/`false` zurück.
- **`setAutoBackupEnabled(enabled: boolean): Promise<void>`** — Schreibt `backup_auto`.
- **`getLastBackupTime(): Promise<string | null>`** — Liest `backup_last_at`.
- **`setLastBackupTime(iso: string): Promise<void>`** — Schreibt `backup_last_at` (Fehler werden still ignoriert).

### 1.3 Backup-Ordner auswählen

**`pickBackupDirectory(): Promise<string>`**

1. Nur auf Android unterstützt — auf iOS wird ein Fehler geworfen.
2. Verwendet die **Storage Access Framework (SAF)** API von `expo-file-system/legacy`:
   ```typescript
   const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
   ```
3. Bei erteilter Berechtigung wird die `directoryUri` in der `meta`-Tabelle gespeichert.
4. Gibt einen menschenlesbaren Ordnernamen zurück (extrahiert aus der URI via `%3A`-Split).

### 1.4 Backup erstellen

**`createBackup(): Promise<string>`**

Ablauf:

```
1. initDatabase()             → Datenbank ist geöffnet und migrationsbereit
2. PRAGMA wal_checkpoint(TRUNCATE)  → WAL-Datei in Haupt-DB zurückschreiben (Konsistenz)
3. getBackupUri()             → Gespeicherten Ordner-URI laden
4. Fehler, wenn kein Ordner konfiguriert
5. FileSystem.getInfoAsync()  → Prüfen, ob DB-Datei existiert
6. Timestamp generieren:      → foodscanner_backup_YYYY-MM-DDTHH-mm-ss-Z.db
7. Je nach URI-Typ kopieren:
```

**Zwei Pfade je nach URI-Typ:**

#### Pfad A: `content://` URI (Android SAF)
```typescript
const dbBase64 = await FileSystem.readAsStringAsync(DB_PATH, {
  encoding: FileSystem.EncodingType.Base64,
});
const fileUri = await StorageAccessFramework.createFileAsync(
  backupUri, backupName, 'application/octet-stream'
);
await FileSystem.writeAsStringAsync(fileUri, dbBase64, {
  encoding: FileSystem.EncodingType.Base64,
});
```
→ Datenbank als Base64 auslesen, neue Datei via SAF erstellen, Base64-Inhalt schreiben.

#### Pfad B: `file://` URI (iOS / lokales Dateisystem)
```typescript
const backupPath = `${backupUri}${backupUri.endsWith('/') ? '' : '/'}${backupName}`;
await FileSystem.copyAsync({ from: DB_PATH, to: backupPath });
```
→ Einfaches Kopieren der DB-Datei mit `FileSystem.copyAsync`. Erstellt ggf. Zwischenverzeichnisse.

**Abschluss:**
- `setLastBackupTime(now.toISOString())` — Zeitstempel aktualisieren
- Rückgabe des Backup-Pfads (wird im UI-Alert angezeigt)

### 1.5 Backup wiederherstellen (Restore)

**`pickRestoreFile(): Promise<BackupFile>`**

1. Versucht `expo-document-picker` zu laden:
   - Zuerst über `globalThis.expo?.modules?.ExpoDocumentPicker?.getDocumentAsync`
   - Fallback via `require('expo-document-picker')` (für native Module ohne Expo-Modules)
2. Öffnet Dateiauswahl mit `type: '*/*'` (alle Dateien), `copyToCacheDirectory: false` (direkter Zugriff)
3. Gibt `{ name, uri }` des ausgewählten Backups zurück.
4. Bei Abbruch durch Nutzer wird `'cancel'` Error geworfen.

**`restoreFromUri(fileUri: string): Promise<void>`**

```
1. Backup-Datei als Base64 einlesen
2. Datenbank schließen:           await db?.closeAsync()
3. Datenbank-Zustand zurücksetzen: resetDatabaseState()
4. WAL/SHM-Dateien löschen:       deleteAsync('-wal', '-shm')
5. Alte DB-Datei löschen:         deleteAsync(DB_PATH)
6. Backup als neue DB schreiben:  writeAsStringAsync(DB_PATH, base64)
7. Datenbank neu initialisieren:  await initDatabase()
8. Filter-Store zurücksetzen:     useFilterStore.setState({ isInitialized: false, rules: [] })
9. Stores neu laden:              useCatalogStore.getState().loadAll()
                                  useFilterStore.getState().loadRules()
```

**Wichtig:** Die Stores werden nach dem Restore neu geladen, damit die UI die wiederhergestellten Daten anzeigt.

### 1.6 Automatisches Backup bei App-Start

**`performAutoBackup(): Promise<void>`**

Wird in `_layout.tsx` beim App-Start aufgerufen. Alle Fehler werden still ignoriert.

Prüfungen in Reihenfolge:
1. Auto-Backup aktiviert? (`backup_auto === 'true'`)
2. Backup-Pfad konfiguriert? (`backup_uri` nicht leer)
3. Letztes Backup älter als 24 Stunden? (`(now - lastBackup) / 3600000 >= 24`)

Wenn alle Bedingungen erfüllt → `createBackup()` aufrufen.

---

## 2. DatabaseService — Datenbank-Lebenszyklus

**Datei:** `App/src/infrastructure/db/DatabaseService.ts` (395 Zeilen)

### Für Backup relevante Teile:

#### `initDatabase(): Promise<SQLiteDatabase>`
- Singleton-Pattern mit `initializationPromise` verhindert parallele Initialisierungen.
- Öffnet `foodscanner.db`, aktiviert `PRAGMA foreign_keys = ON` und `PRAGMA journal_mode = WAL`.
- Erstellt die `meta`-Tabelle (falls nicht vorhanden):
  ```sql
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  ```
- Führt alle ausstehenden Migrationen aus (aktuell Version 7).

#### `resetDatabaseState(): void`
- Setzt `db = null` und `initializationPromise = null`.
- Wird von `BackupService.restoreFromUri()` aufgerufen, bevor die neue DB-Datei geschrieben wird.

#### Schema-Version
- Gespeichert als `schema_version` in der `meta`-Tabelle.
- Beim Backup wird die gesamte DB-Datei kopiert — inklusive Schema-Version und aller migrierten Tabellen.

---

## 3. SettingsScreen — Benutzeroberfläche

**Datei:** `App/src/screens/SettingsScreen.tsx` (Backup-relevante Teile in Zeilen 20-318)

### 3.1 Zustandsvariablen

| State | Typ | Beschreibung |
|---|---|---|
| `backupCreating` | `boolean` | Lade-Indikator während Backup-Erstellung |
| `lastBackupTime` | `string \| null` | Letzter Backup-Zeitstempel für Anzeige |
| `autoBackup` | `boolean` | Auto-Backup-Schalter-Status |
| `backupDirLabel` | `string` | Anzeigename des gewählten Ordners |
| `hasCustomPath` | `boolean` | Ob ein Pfad ausgewählt wurde |
| `pickingDir` | `boolean` | Lade-Indikator während Ordnerauswahl |
| `restoring` | `boolean` | Lade-Indikator während Wiederherstellung |

### 3.2 Initialisierung (`useEffect`)

Beim Mounten der Komponente werden alle Backup-Einstellungen geladen:
```typescript
BackupService.getLastBackupTime().then(setLastBackupTime);
BackupService.isAutoBackupEnabled().then(setAutoBackup);
BackupService.getBackupUri().then((uri) => { ... });
BackupService.isBackupPathConfigured().then(setHasCustomPath);
```

### 3.3 UI-Abschnitte

#### Backup-Pfad-Auswahl
- Zeigt den aktuellen Ordner oder "Kein Ordner gewählt"
- Button "Ordner wählen" → `pickBackupDirectory()`
- Deaktiviert-Status während `pickingDir`

#### Backup-Erstellung
- Zeigt Datum des letzten Backups oder "Noch kein Backup"
- Button "Backup jetzt erstellen" → `createBackup()`
- Deaktiviert, wenn kein Pfad ausgewählt oder Backup läuft
- Bei Erfolg: Alert mit Backup-Pfad

#### Wiederherstellung
- Button "Wiederherstellen" → Bestätigungsdialog → `pickRestoreFile()` → `restoreFromUri()`
- Bei Erfolg: Alert "Backup erfolgreich wiederhergestellt"
- Deaktiviert während `restoring`

#### Auto-Backup Toggle
- `Switch`-Komponente mit `handleAutoBackupToggle`
- Deaktiviert, wenn kein Pfad konfiguriert
- Beschriftung: "Täglich bei App-Start"

### 3.4 iOS-Hinweis

Auf iOS wird ein Info-Text angezeigt:
> "Auf iOS wird das Backup im App-Dokumente-Ordner gespeichert."

Hintergrund: Auf iOS funktioniert der SAF-Directory-Picker nicht — das Backup wird stattdessen im App-eigenen Dokumentenverzeichnis abgelegt.

---

## 4. Auto-Backup bei App-Start

**Datei:** `App/app/_layout.tsx` (34 Zeilen)

```typescript
useEffect(() => {
  void loadRules();
  void loadLanguage();
  void BackupService.performAutoBackup();  // ← Auto-Backup
}, [loadRules, loadLanguage]);
```

Der Aufruf erfolgt zusammen mit `loadRules()` und `loadLanguage()` im `useEffect` der Root-Layout-Komponente. Fehler werden stillschweigend ignoriert (Try/Catch innerhalb von `performAutoBackup`).

---

## 5. Übersetzungen (i18n)

**Datei:** `App/src/i18n/translations.ts` (Backup-relevante Keys)

Alle Backup-Strings sind zweisprachig (Deutsch/Englisch) im `settings.*`-Namespace:

| Key | Deutsch | Englisch |
|---|---|---|
| `settings.backup` | Datenbank-Backup | Database Backup |
| `settings.backupHint` | Produkte, Filter-Regeln & Favoriten als Datei sichern | Save products, filter rules & favorites as file |
| `settings.backupCreate` | Backup jetzt erstellen | Create Backup Now |
| `settings.backupCreating` | Erstelle Backup... | Creating backup... |
| `settings.backupLast` | Letztes Backup: {{date}} | Last backup: {{date}} |
| `settings.backupNever` | Noch kein Backup | No backup yet |
| `settings.backupAuto` | Automatisches Backup | Automatic Backup |
| `settings.backupAutoHint` | Täglich bei App-Start | Daily on app start |
| `settings.backupSuccess` | Backup gespeichert:\n{{path}} | Backup saved to:\n{{path}} |
| `settings.backupPath` | Speicherort | Storage Location |
| `settings.backupPathNone` | Kein Ordner gewählt | No folder selected |
| `settings.backupPathChoose` | Ordner wählen | Choose folder |
| `settings.backupNoPathHint` | Zuerst Speicherort wählen | Select storage location first |
| `settings.backupPicking` | Öffne... | Opening... |
| `settings.backupIosHint` | Auf iOS wird das Backup im App-Dokumente-Ordner gespeichert. | On iOS the backup is saved in the app documents folder. |
| `settings.restore` | Backup wiederherstellen | Restore Backup |
| `settings.restoreHint` | Gesicherte Datenbank-Datei (.db) auswählen | Select a saved database file (.db) |
| `settings.restoreBtn` | Wiederherstellen | Restore |
| `settings.restoreConfirm` | Datenbank ersetzen? | Replace database? |
| `settings.restoreConfirmMsg` | Alle aktuellen Daten werden durch das Backup ersetzt. Fortfahren? | All current data will be replaced by the backup. Continue? |
| `settings.restoreSuccess` | Backup erfolgreich wiederhergestellt. | Backup restored successfully. |
| `settings.restoreEmpty` | Keine Backup-Dateien gefunden. | No backup files found. |

---

## 6. Store-Reload nach Restore

Nach einem erfolgreichen Restore werden die Zustand-Stores neu initialisiert:

**`catalogStore`** (`App/src/store/catalogStore.ts`):
- `loadAll()` lädt alle Produkte und Favoriten aus der (neuen) Datenbank.

**`filterStore`** (`App/src/store/filterStore.ts`):
- Wird zuerst zurückgesetzt: `setState({ isInitialized: false, rules: [] })`
- Dann `loadRules()` — lädt alle Filter-Regeln aus der Datenbank.
- Grund für das Zurücksetzen: Der Store cached `isInitialized`, was ein erneutes Laden verhindern würde.

---

## 7. Abhängigkeiten

Aus `App/package.json`:

| Paket | Version | Verwendung |
|---|---|---|
| `expo-file-system` | `~19.0.22` | Dateioperationen: Lesen, Schreiben, Kopieren, Löschen, SAF-Zugriff |
| `expo-document-picker` | `~14.0.8` | Dateiauswahl-Dialog für Restore |
| `expo-sqlite` | `~16.0.10` | SQLite-Datenbank (via `DatabaseService`) |
| `zustand` | `^5.0.13` | State-Management (Store-Reload nach Restore) |

---

## 8. Datenbank-Dateipfad

Die Datenbank liegt unter:
```
{FileSystem.documentDirectory}SQLite/foodscanner.db
```

Mit zugehörigen WAL/Journal-Dateien:
- `foodscanner.db-wal`
- `foodscanner.db-shm`

Beim Backup wird vor dem Kopieren `PRAGMA wal_checkpoint(TRUNCATE)` ausgeführt, um die WAL-Datei in die Haupt-DB zurückzuschreiben. Beim Restore werden WAL- und SHM-Dateien gelöscht, bevor die Backup-Datei geschrieben wird.

---

## 9. Datenfluss-Diagramm

### Backup erstellen (manuell)
```
SettingsScreen.tsx
  → handleCreateBackup()
    → BackupService.createBackup()
      → initDatabase()
      → PRAGMA wal_checkpoint(TRUNCATE)
      → getBackupUri() (aus meta-Tabelle)
      → FileSystem.readAsStringAsync(DB_PATH, base64)
      → SAF.createFileAsync() oder FileSystem.copyAsync()
      → setLastBackupTime()
    ← backupPath (String)
  → Alert mit Pfad
```

### Backup wiederherstellen
```
SettingsScreen.tsx
  → handleRestore()
    → Alert: Bestätigung
      → BackupService.pickRestoreFile()
        → expo-document-picker getDocumentAsync()
        → Nutzer wählt .db-Datei
      ← { name, uri }
      → BackupService.restoreFromUri(uri)
        → FileSystem.readAsStringAsync(uri, base64)
        → db.closeAsync()
        → resetDatabaseState()
        → deleteAsync(wal, shm, db)
        → writeAsStringAsync(DB_PATH, base64)
        → initDatabase()
        → useFilterStore.setState({ isInitialized: false, rules: [] })
        → useCatalogStore.getState().loadAll()
        → useFilterStore.getState().loadRules()
```

### Auto-Backup (App-Start)
```
_layout.tsx
  → useEffect on mount
    → BackupService.performAutoBackup()
      → isAutoBackupEnabled()?
      → isBackupPathConfigured()?
      → getLastBackupTime() > 24h?
      → createBackup() (wie oben)
```

---

## 10. Fehlerbehandlung

| Methode | Fehlerstrategie |
|---|---|
| `createBackup()` | Wirft Error bei fehlendem Ordner / fehlender DB-Datei |
| `pickRestoreFile()` | Wirft `'cancel'` bei Abbruch, sonst Error bei fehlendem Picker |
| `restoreFromUri()` | Lässt Fehler durch (wird in UI abgefangen) |
| `performAutoBackup()` | **Still** — alle Fehler werden mit leerem Catch ignoriert |
| `setLastBackupTime()` | Still — Fehler werden ignoriert |
| Meta-Leseoperationen | Leerer Catch-Block, gibt `''` / `null` / `false` zurück |

---

## 11. Plattform-Unterstützung

| Funktion | Android | iOS |
|---|---|---|
| Backup-Ordner auswählen (SAF-Directory-Picker) | Ja | Nein (Fehler) |
| Backup erstellen (SAF `content://` URI) | Ja | — |
| Backup erstellen (`file://` Copy) | Ja (Fallback) | Ja |
| Datei für Restore auswählen | Ja | Ja |
| Auto-Backup | Ja | Ja (falls Pfad manuell gesetzt) |

---

## 12. Bekannte Einschränkungen

1. **Keine Backup-Tests:** Es gibt keine dedizierten Jest-Tests für das Backup-Feature.
2. **iOS-Ordnerauswahl:** Auf iOS kann kein externer Ordner gewählt werden. Der Nutzer muss das App-Dokumentenverzeichnis verwenden.
3. **Keine inkrementellen Backups:** Jedes Backup ist ein vollständiger Snapshot der gesamten Datenbankdatei.
4. **Kein Cloud-Backup:** Backups existieren nur lokal als Dateien.
5. **Schema-Versions-Kompatibilität:** Wenn eine neuere App-Version das Schema ändert und ein Nutzer ein altes Backup wiederherstellt, wird die Migration bei `initDatabase()` automatisch nachgeholt.
