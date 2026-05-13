# FoodCheck — Features & Capabilities

## Screens & Navigation

| Route | Screen | Beschreibung |
|-------|--------|-------------|
| `(tabs)/` | **Scanner** | Live-Kamera mit Barcode-Erkennung (EAN-8/13), Scan-Frame-Animation, Cache-first-Lookup, Offline-Fallback, Backup-Export/Import |
| `(tabs)/catalog` | **Catalog** | Alle gescannten Produkte durchsuchen, filtern (OK/Warning/Critical/Ohne Zutaten), sortieren, löschen |
| `(tabs)/favorites` | **Favorites** | Favorisierte Produkte anzeigen, entfavorisieren, löschen |
| `(tabs)/settings` | **Settings** | Sprache, OFF-Konto, Filter-Regeln, Übersetzungs-API-Key, Backup |
| `/result` | **Product** | Vollständige Produktanalyse: Red Flags, NOVA, Nährwerte, Allergene, Zutaten (mehrsprachig), KI-Erkenntnisse, Bildergalerie |
| `/settings/filters` | **Filter Rules** | 683 vordefinierte + eigene Zutaten-/Nährwert-Regeln verwalten |
| `/settings/api-key` | **API Keys** | DeepL/MyMemory API Keys konfigurieren |
| `/edit/[ean]` | **Edit Product** | Produktdaten bearbeiten + an Open Food Facts beitragen: Zutaten (8 Sprachen), Nährwerte, Allergene, Herkunft — lokal + Upload an OFF |

---

## Scanner

- **Live-Kamera** mit Barcode-Erkennung (EAN-8, EAN-13)
- **Cache-first**: Produkt wird zuerst in lokaler SQLite-Datenbank gesucht
- **Online-Fallback**: Wenn nicht im Cache → Open Food Facts API
- **Stale-Detection**: Daten älter als 7 Tage werden als "veraltet" markiert
- **Animationen**: Pulsierender Scan-Rahmen, grüner Flash bei erfolgreichem Scan
- **Haptisches Feedback** bei Scan
- **Kamera-Steuerung**: Front/Rück-Kamera wechseln, Taschenlampe (nur Rückkamera)
- **Offline-Badge** bei Netzwerkausfall
- **Kamera-Berechtigungen**: Anfrage-Flow mit Hinweis bei Verweigerung

---

## Produkt-Analyse

### Red Flag System
- **683 vordefinierte Zutaten-Regeln** in 19 Kategorien (E-Nummern, Farbstoffe, Konservierungsstoffe, Süßungsmittel, gehärtete Fette, etc.)
- **Eigene Filter-Regeln**: Benutzer kann Zutaten- und Nährwert-Regeln hinzufügen/ändern/löschen
- **Zwei Typen**:
  - **Zutaten-Regel**: Keyword-Matching in Produkt-Zutatenliste — jetzt **mehrsprachig** (de/en/fr/it/es/nl/pt/pl)
  - **Nährwert-Regel**: Schwellwert-Vergleich (gt/lt/eq) für sugars, fat, saturated-fat, salt, energy-kcal
- **Severity**: `red_flag` (kritisch) oder `ok` (blockiert Red-Flag-Matching für diese Zutat)
- **Auto-Translation**: Neue Zutaten werden via MyMemory automatisch in 7 Sprachen übersetzt
- **Additiv-Taxonomie**: 300+ E-Nummern mit Risikostufen (none/low/medium/high), Aliasen und Funktionsklassen

### NOVA-Bewertung
- NOVA-Score 1–4 (unverarbeitet → ultra-verarbeitet)
- Farbcodierte Anzeige

### Nutri-Score
- Anzeige Nutri-Score A–E mit farbiger Kennzeichnung

### Robotoff KI-Erkenntnisse
- Abruf von AI-Vorhersagen (Kategorie, Label, Zutat) von Robotoff API
- 15-minütiger In-Memory-Cache
- Anzeige mit Konfidenzbalken

---

## Product Screen (Detailansicht)

- **Status-Badge**: OK / Warning / Critical (abhängig von Red-Flag-Anzahl + NOVA-Score)
- **Red Flags**: Liste gefundener Zutaten mit Schweregrad (critical/warning) und Kategorie
- **KI-Erkenntnisse**: Robotoff-Vorhersagen mit Konfidenz
- **Nährwerte**: 5-Karten-Übersicht (Kalorien, Fett, Zucker, Eiweiß, Salz) + vollständige Nährwerttabelle (8 Zeilen)
- **Zutatenliste**: Mehrsprachig (de/en/fr/it/es/nl/pt/pl) mit Accordion; pro Sprache Übersetzen-Button (DeepL/MyMemory)
- **Allergene**: Enthält-Tags + Spuren-Warnung
- **Bildergalerie**: Swipeable (Vorderseite, Zutaten, Nährwerte, Verpackung)
- **Zusatzinfos**: Herkunft, Herstellungsort, Geschäfte, letzte Aktualisierung
- **Datenquellen-Umschalter**: Live OFF API vs. lokaler Cache
- **Favoriten**: Stern-Toggle im Header
- **Bearbeiten**: Stift-Icon → EditProductScreen
- **Fehler-Behandlung**: Offline (Cache), Nicht gefunden (Beitragen-CTA), generischer Fehler
- **Disclaimer**: Daten stammen von OFF-Beitragenden

---

## Catalog (Produktkatalog)

- **Volltextsuche**: Name, Marke, EAN (SQLite LIKE)
- **Statistik-Leiste**: Gesamtprodukte, Gesamtscans, % Nova 4, Kritische Anzahl
- **Filter-Chips**: Alle / OK / Warning / Critical / Ohne Zutaten
- **Sortierung**: Datum, Name, Bewertung, NOVA, Scan-Häufigkeit (auf/absteigend)
- **Collections**: "Meist gescannt", "Höchstes Risiko" als Section-Header
- **Produktkarte**: Status-Punkt, Name, Marke, Datum, NOVA-Badge, Favorit/Edit/Löschen
- **Wischen zum Löschen**: PanResponder Swipe-Geste

---

## Favorites

- **Lokale Favoriten-Tabelle** (SQLite JOIN products)
- **Toggle** vom ProductScreen oder CatalogScreen aus
- **Auto-Save**: Produkt wird vor Favorisierung in DB gespeichert
- **Produktkarte** mit allen Aktionen (ansehen, bearbeiten, entfavorisieren, löschen)
- **Leerzustand** mit Hinweis

---

## Edit Product (Produkt bearbeiten)

- **Produktidentität**: Name, Marke, Menge
- **Bewertung**: Kategorie, NOVA-Score (1–4)
- **Zutaten (8 Sprachen)**: de, en, fr, it, es, nl, pt, pl
  - Pro Sprache: OCR-Scan (Kamera), Übersetzen (DeepL/MyMemory), Entfernen
  - "In alle Sprachen übersetzen": Batch-Übersetzung sequentiell
  - Sprache hinzufügen: Auswahl aus verfügbaren Sprachen
- **OCR-Kamera (3 Phasen)**: Kamera → Zuschneiden → Prüfen
  - Nutzt Open Food Facts Google Cloud Vision OCR
  - Zuschneide-Werkzeug mit Drag-to-Crop
  - Extrahierten Text bearbeiten, neu zuschneiden, neu aufnehmen
- **Nährwerte**: 8 Felder (Energie, Fett, gesättigte FS, Kohlenhydrate, Zucker, Ballaststoffe, Eiweiß, Salz)
  - OCR-Scan für Nährwerttabellen mit Sprachautomatik (DE/EN/FR/IT)
- **Allergene**: Enthält (kommagetrennt), Spuren
- **Zusatzinfos**: Herkunft, Herstellungsort, Geschäfte, Portionsgröße
- **Speichern**: Lokal in SQLite (ProductRepository.updateProduct)
- **Upload an OFF**: Sendet alle Daten an Open Food Facts (erfordert OFF-Konto)
- **Ungespeicherte-Änderungen-Warnung**: Navigation-Guard mit Discard-Dialog
- **Auto-Erstellung**: Legt Produkt-Stub an, falls kein lokaler Eintrag existiert

---

## Filter Rules Management

- **683 vordefinierte Seed-Regeln** (19 Kategorien) — automatisch bei erster DB-Erstellung
- **Kategorie-Gruppierung**: SectionList mit Ein-/Ausklappen
- **Suche**: Filtert Regeln nach Zutat, Kategorie, Typ, Severity (auch übersetzte Namen)
- **Regel hinzufügen/bearbeiten**:
  - **Zutaten-Regel**: Keyword + Kategorie (19 Presets)
  - **Nährwert-Regel**: Nährwert (5 Optionen) + Operator (gt/lt/eq) + Grenzwert + Kategorie
  - **Severity**: RED FLAG / OK
- **Auto-Translation**: Neue Zutaten werden via MyMemory in 7 Sprachen übersetzt
- **Display**: Zutaten-Keywords werden in aktueller App-Sprache (DE/EN) angezeigt
- **Löschen** mit Bestätigungsdialog
- **19 Kategorie-Presets**: Süßungsmittel, Farbstoffe, Konservierungsstoffe, Geschmacksverstärker & Aromen, Emulgatoren & Stabilisatoren, Verdickungs- & Geliermittel, Säuren & Säureregulatoren, Antioxidationsmittel, Gehärtete Fette & raffinierte Öle, Zucker & Sirupe, Modifizierte Stärken, Phosphate & Mineralstoffe, Füll- & Trägerstoffe, Proteine & Fleischersatz, Trenn- & Überzugsmittel, Treib- & Schutzgase, Metalle, E-Nummern, Sonstige Zusatzstoffe

---

## Settings

| Einstellung | Beschreibung |
|-------------|-------------|
| **Sprache** | DE ↔ EN (App-UI umschaltbar, 2 Stores: settingsStore + languageStore) |
| **OFF-Konto** | Open Food Facts Login/Logout für Produktbeiträge |
| **Filter-Regeln** | Link zur Filter-Regel-Verwaltung |
| **Übersetzungs-API** | DeepL/MyMemory Key-Verwaltung |
| **Backup** | SQLite-Daten exportieren/importieren (JSON) |

### API Key Screen
- **Provider-Wahl**: DeepL vs MyMemory
- **Status-Anzeige**: Key konfiguriert / Anonym (5.000 Wörter/Tag) / Kein Key
- **Key speichern/löschen** (SecureStore)

---

## Mehrsprachigkeit

- **UI-Sprachen**: Deutsch, Englisch (597 Übersetzungsschlüssel in `i18n/translations.ts`)
- **Runtime-Switch**: `useTranslation()` Hook + `languageStore` (Zustand, persistiert in SecureStore)
- **Zutaten-Suche**: 7 Sprachen (de, en, fr, it, es, nl, pt, pl)
- **Zutaten-Bearbeitung**: 8 Sprachen (alle oben + en als Editiersprache)
- **Produkt-Zutaten**: Mehrsprachige Anzeige mit Accordion
- **Nährwert-OCR**: Automatische Spracherkennung (DE/EN/FR/IT)
- **Übersetzungsdienste**: DeepL (Free API) und MyMemory (anonym oder mit Key)

---

## OCR (Texterkennung)

- **On-Device**: ML Kit Text Recognition (Latin Script)
  - Texterkennung mit Konfidenzwerten (`OcrService`)
  - Vorverarbeitung durch `OcrPreprocessor` (Kontrast, Schärfe)
  - Qualitätsprüfung (Rauschfilter, Sonderzeichen-Erkennung)
  - Nährwert-Parsing mit Sprachautomatik (8 Nährwerte)
- **Cloud**: Open Food Facts Google Cloud Vision Pipeline (`OffOcrClient`)
  - Bild-Upload → Polling auf OCR-Ergebnis (max. 10 Versuche, 2s Interval)
  - Bildvorverarbeitung (Max 2048px, JPEG)
  - Zuschneide-Empfehlungen basierend auf Seitenverhältnis

---

## Daten-Persistenz

| Speicher | Was | Technologie |
|----------|-----|-------------|
| **SQLite** | Produkte, Favoriten, Filter-Regeln | expo-sqlite |
| **SecureStore** | OFF-Zugangsdaten, API-Keys, Sprache, Provider | expo-secure-store |
| **FileSystem** | Produktbilder (4 Typen) | expo-file-system |
| **Zustand** | In-Memory State (4 Stores: filter, catalog, language, settings) | zustand |

### Datenbank-Schema
- **`meta`**: key (PK), value — Migrations-Tracking
- **`products`**: id, ean (UNIQUE), name, brands, ingredients, nova_score, nutriscore, raw_json, scanned_at, rating, data_version, last_api_fetch, image_url, image_ingredients_url, image_nutrition_url, image_packaging_url, visit_count, last_seen_at
- **`favorites`**: id, product_id (FK → products.id CASCADE), added_at
- **`filter_rules`**: id, type, key, category, threshold, operator, severity, translations (JSON), created_at
- **6 Migrationen**: initiales Schema → Seed Rules → Produkt-Spalten → Visit-Tracking → Kategorie-Spalte → Translations-Spalte

### Backup & Wiederherstellung
- **Export**: Vollständiger SQLite-Dump als JSON-Datei (Produkte, Favoriten, Filter-Regeln) via `BackupService`
- **Import**: JSON-Datei einlesen und DB wiederherstellen
- **ShareSheet**: Export-Datei über native Share-Funktion teilen (AirDrop, Mail, Files etc.)
- **Keine Cloud-Abhängigkeit**: Backup ist komplett lokal, keine Server-Infrastruktur

---

## Externe APIs

| API | Nutzung |
|-----|---------|
| **Open Food Facts v2** | Produktsuche (nach EAN, Text), Batch-Barcode-Abfrage, Feldvorschläge, Taxonomie |
| **Open Food Facts Write** | Produkt-Upload (mehrsprachig, mit Authentifizierung) |
| **Robotoff** | KI-Vorhersagen für Kategorien, Labels, Inhaltsstoffe |
| **DeepL Free API** | Übersetzung (API-Key benötigt) |
| **MyMemory** | Übersetzung (anonym 5k Wörter/Tag, mit Key 10k/Tag) |
| **OFF OCR (Google Cloud Vision)** | Bild-zu-Text über OFF-Pipeline |

---

## Testing

- **23 Test-Suiten**, **265 Tests**, alle erfolgreich
- Getestete Module: Analyse (RedFlagAnalyzer, IngredientParser, IngredientTaxonomy, NovaScoreEvaluator, ProductRating), API-Clients, Repositories, OCR, Übersetzungen, Übersetzungs-Clients, Types, Produktkarten-Merge

---

## Technische Details

- **Expo SDK 54** mit New Architecture (`newArchEnabled: true`)
- **TypeScript strict mode**
- **Schichtenarchitektur**: `screens/` → `store/` → `domain/` → `infrastructure/` (types/ importierbar von allen)
- **Navigation**: Expo Router (file-based), 4 Tabs + 4 Stack-Screens
- **State Management**: Zustand (4 Stores: filter, catalog, language, settings)
- **DI-Pattern**: Constructor Injection für Domain-Klassen, Module-Level-Singletons für Repositories
- **ESLint 10** (Flat Config) + Prettier
