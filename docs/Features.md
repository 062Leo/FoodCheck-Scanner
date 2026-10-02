# FoodCheck — Features & Capabilities

## Screens & Navigation

| Route | Screen | Beschreibung |
|-------|--------|-------------|
| `(tabs)/` | **Scanner** | Live-Kamera mit Barcode-Erkennung (EAN-8/13, UPC-A), Ergebniskarte über der Kamera, manuelle Eingabe, Offline-Badge |
| `(tabs)/catalog` | **Catalog** | Alle gescannten Produkte durchsuchen, filtern (OK/Warning/Critical/Unknown/Ohne Zutaten), sortieren |
| `(tabs)/favorites` | **Favorites** | Favorisierte Produkte anzeigen, entfavorisieren, bearbeiten, löschen |
| `(tabs)/settings` | **Settings** | Filter-Regeln, Sprache, Open-Food-Facts-Konto, Übersetzung, Backup, Anleitung |
| `/result` | **Product** | Vollständige Produktanalyse: Ampel mit Begründung, Red Flags, NOVA, Nährwerte, Allergene, Zutaten (mehrsprachig), KI-Erkenntnisse, Bildergalerie |
| `/settings/filters` | **Filter Rules** | Vordefinierte + eigene Zutaten-/Nährwert-Regeln verwalten |
| `/settings/api-key` | **Übersetzung** | DeepL/MyMemory auswählen und API-Key verwalten |
| `/settings/about` | **Über FoodCheck** | Anleitung, Erklärung der Ampel-Bewertung, Datenschutz, Datenquelle, Version |
| `/edit/[ean]` | **Edit Product** | Produktdaten bearbeiten + an Open Food Facts beitragen: Zutaten (8 Sprachen), Nährwerte, Allergene, Herkunft — lokal + Upload an OFF |

---

## Scanner

- **Live-Kamera** mit Barcode-Erkennung (EAN-8, EAN-13, UPC-A wird als EAN-13 gespeichert)
- **Prüfziffer-Validierung**: Fehllesungen bei schlechtem Licht werden verworfen, bevor ein Lookup startet
- **Scannen in Folge**: Ein Treffer wird als Karte über der Kamera angezeigt (Status-Icon, Name, Hauptgrund); die Kamera läuft weiter, das nächste Produkt kann sofort gescannt werden. Tippen auf die Karte öffnet die Details aus den frisch gespeicherten Daten (kein zweiter Netzwerkaufruf)
- **Ein Lookup gleichzeitig** (`ScanGate`): derselbe Code wird nicht erneut ausgelöst, solange er im Bild bleibt; eine während eines Lookups manuell eingegebene Nummer wird nachgeholt statt verworfen
- **Cache-first**: Produkt wird zuerst in der lokalen SQLite-Datenbank gesucht
- **Online-Fallback**: Bei Netzwerkfehler oder Timeout (8 s) wird, falls vorhanden, das zwischengespeicherte Produkt gezeigt
- **Manuelle Eingabe**: Barcode über Ziffernblock eingeben, auch ohne Kamerazugriff nutzbar
- **Haptisches Feedback**: unterschiedlich für Erfolg / Warnung / Fehler
- **Taschenlampe** (nur Rückkamera); der Frontkamera-Wechsel und die pulsierende Rahmenanimation wurden entfernt
- **Offline-Badge** bei Netzwerkausfall
- **Kamera-Berechtigungen**: Anfrage-Flow mit Hinweis bei Verweigerung, Link zu den Systemeinstellungen bei dauerhafter Verweigerung

---

## Produkt-Analyse

### Red Flag System
- **678 vordefinierte Zutaten-Regeln** in 18 belegten Kategorien (19 Kategorie-Presets stehen beim Anlegen einer neuen Regel zur Auswahl)
- **Eigene Filter-Regeln**: Benutzer kann Zutaten- und Nährwert-Regeln hinzufügen/ändern/löschen; Severity `Red Flag` oder `Erlaubt` (whitelistet eine Zutat oder — solange die Bedingung zutrifft — eine Nährwert-Regel)
- **Zwei Typen**:
  - **Zutaten-Regel**: Keyword-Matching in der Zutatenliste, span-basiert (ein Treffer innerhalb eines längeren Treffers einer anderen Regel zählt nicht); mehrsprachig (de/en/fr/it/es/nl/pt/pl)
  - **Nährwert-Regel**: Schwellwert-Vergleich (gt/lt/eq) gegen die Produkt-Nährwerte (sugars_100g, fat_100g, saturated-fat_100g, salt_100g, energy-kcal_100g)
- **Additiv-Taxonomie**: rund 160 E-Nummern mit Risikostufen (none/low/medium/high) und Funktionsklassen; ergänzt Treffer, die keine Zutaten-Regel bereits erfasst hat
- **Ein Fund pro Substanz**: dieselbe E-Nummer zählt nur einmal; ein Schlüssel ohne Suffix und seine Suffix-Variante (E500/E500ii) sowie austauschbare Familienmitglieder (E150a–d) werden zusammengefasst
- **Auto-Translation**: Neue Zutaten-Keywords werden beim Speichern parallel in 7 Sprachen übersetzt; das Bearbeiten eines Keywords löscht vorhandene Übersetzungen nur, wenn sich das Keyword ändert

### NOVA-Bewertung
- NOVA-Score 1–4 (unverarbeitet → ultra-verarbeitet); ein fehlender oder ungültiger Wert gilt als unbekannt, nicht als NOVA 1
- Farbcodierte Anzeige

### Nutri-Score
- Anzeige Nutri-Score A–E mit farbiger Kennzeichnung, sofern von Open Food Facts geliefert

### Robotoff KI-Erkenntnisse
- Abruf von AI-Vorhersagen (Kategorie, Label, Zutat) von der Robotoff API, nur wenn das Produkt nicht aus dem Offline-Cache angezeigt wird
- 15-minütiger In-Memory-Cache
- Anzeige mit Konfidenzbalken

---

## Product Screen (Detailansicht)

- **Ampel-Banner**: OK / Warning / Critical / Unknown, mit Text-Begründung (nicht nur Farbe) — z. B. NOVA-Stufe, Anzahl Red Flags, fehlende Zutatenliste
- **Red Flags**: Liste gefundener Zutaten und Nährwert-Überschreitungen mit Schweregrad (critical/warning) und Kategorie
- **KI-Erkenntnisse**: Robotoff-Vorhersagen mit Konfidenz
- **Nährwerte**: vollständige Nährwerttabelle; Werte werden in der UI-Sprache formatiert, nur tatsächlich vorhandene Zeilen werden gestreift dargestellt
- **Zutatenliste**: mehrsprachig (Sprach-Chips für alle vorhandenen Texte) mit Übersetzen-Button pro Sprache (DeepL/MyMemory)
- **Allergene**: die 14 EU-Allergene in der App-Sprache (Deutsch/Englisch), dazu Spuren
- **Bildergalerie**: Swipeable (Vorderseite, Zutaten, Nährwerte, Verpackung)
- **Zusatzinfos**: Herkunft, Herstellungsort, Geschäfte
- **Datenquellen-Hinweis**: Fußnote statt Umschalter — zeigt an, wenn die Daten aus dem Offline-Cache stammen oder älter als 7 Tage sind
- **Favoriten**: Stern-Toggle im Header
- **Bearbeiten**: Stift-Icon → EditProductScreen
- **Fehler-Behandlung**: Offline (Cache oder "noch nicht gespeichert"), Nicht gefunden (Beitragen-CTA), genereller Fehler mit Retry
- **Disclaimer**: Daten stammen von OFF-Beitragenden

---

## Catalog (Produktkatalog)

- **Volltextsuche**: Name, Marke, EAN — alle Suchwörter müssen treffen, gefiltert wird die bereits geladene Liste (keine SQL-Anfrage pro Tastenanschlag)
- **Zusammenfassungszeile**: Anzahl Produkte, Scans, Anteil NOVA 4
- **Filter-Chips mit Zählern**: Alle / Critical / Warning / OK / Unknown / Ohne Zutaten
- **Sortierung**: zuletzt gesehen, Bewertung (kritisch zuerst), Name, NOVA (am stärksten verarbeitet zuerst), Scan-Häufigkeit
- **Produktkarte**: Thumbnail, Status als Icon + Text, ein Favoriten-Button; Bearbeiten und Löschen über ein Long-Press-Menü
- **Löschen mit Undo**: Ein gelöschtes Produkt kann per Toast-Aktion vollständig wiederhergestellt werden (inkl. ID, Scan-Historie, Bearbeitungsmarkierungen und Favoritenstatus)
- **Kein Vollbild-Spinner** bei jedem Tab-Besuch; die Liste aktualisiert sich im Hintergrund
- **Leerzustände** mit passendem nächsten Schritt (scannen, Filter zurücksetzen)

---

## Favorites

- **Lokale Favoriten-Tabelle** (SQLite JOIN products), pro Produkt höchstens ein Eintrag
- **Toggle** vom ProductScreen oder CatalogScreen aus; Entfernen kann per Toast rückgängig gemacht werden
- **Dieselbe Produktkarte** wie im Katalog (Long-Press-Menü für Bearbeiten/Löschen; der Stern entfernt nur den Favoriten, nicht mehr das ganze Produkt)
- **Leerzustand** mit Hinweis

---

## Edit Product (Produkt bearbeiten)

- **Produktidentität**: Name, Marke, Menge, Kategorien
- **Bewertung**: NOVA-Score (1–4)
- **Zutaten (8 Sprachen)**: de, en, fr, it, es, nl, pt, pl
  - Pro Sprache: OCR-Scan (Kamera), Übersetzen (DeepL/MyMemory), Entfernen
  - Sprache hinzufügen: Auswahl aus verfügbaren Sprachen
- **OCR-Kamera (Kamera → Zuschneiden → Prüfen)**:
  - Erkennung standardmäßig auf dem Gerät (ML Kit) — das Foto verlässt das Telefon nicht
  - Zuschneide-Werkzeug optional (auch „ganzes Foto“ möglich), mit korrekter Umrechnung auf das Kamerabild
  - Erkennung durch Open Food Facts (Google Cloud Vision) nur nach ausdrücklicher Zustimmung in einem Dialog, der den Zielserver nennt; lädt das Foto öffentlich unter dem eigenen Konto hoch
  - Erkannten Text bearbeiten, neu zuschneiden, neu aufnehmen
- **Nährwerte**: Energie, Fett, gesättigte Fettsäuren, Kohlenhydrate, Zucker, Ballaststoffe, Eiweiß, Salz
  - OCR-Scan für Nährwerttabellen mit Sprachautomatik (DE/EN/FR/IT); Komma-Dezimalzahlen und „<0,5“ werden erkannt
  - Werte werden validiert (keine „NaN“-Werte mehr lokal gespeichert oder an Open Food Facts gesendet)
- **Allergene**: Enthält (kommagetrennt), Spuren
- **Zusatzinfos**: Herkunft, Herstellungsort, Geschäfte, Portionsgröße
- **Speichern**: lokal in SQLite; merkt sich, welche Felder verändert wurden, damit ein späteres Update von Open Food Facts nur die nicht bearbeiteten Felder überschreibt
- **Upload an OFF**: fragt vor dem Senden nach Bestätigung, nennt Zielserver und zu sendende Felder; speichert zuerst lokal, sendet dann nur die Felder, die du auf diesem Gerät geändert hast (bei Produkten, die Open Food Facts noch nicht kennt: alle ausgefüllten) – unveränderte, evtl. veraltete Werte überschreiben keine neueren Korrekturen anderer; ohne Änderung meldet die App „nichts zu senden“; Entwicklungs-Builds senden an den Staging-, Release-Builds an den Produktivserver
- **Ungespeicherte-Änderungen-Warnung**: Navigation-Guard mit Bestätigungsdialog
- **Auto-Erstellung**: Legt einen Produkt-Stub an, falls für den Barcode noch kein lokaler Eintrag existiert

---

## Filter Rules Management

- **678 vordefinierte Seed-Regeln** — automatisch bei erster DB-Erstellung, ergänzt durch spätere App-Updates
- **Kategorie-Gruppierung**: nur Kategorien mit Regeln werden angezeigt, sortiert nach angezeigtem Namen; bei Suche werden alle Kategorien mit Treffer aufgeklappt
- **Suche**: filtert nach Zutat/Kategorie (auch übersetzte Namen)
- **Regel-Editor als Sheet**: Chips statt Rohschlüssel und gt/lt/eq, Komma-Schwellwerte, Validierungsmeldungen, Speicher-Fortschritt und Fehler-Feedback, Löschen direkt im Editor
- **Regel hinzufügen/bearbeiten**:
  - **Zutaten-Regel**: Keyword + Kategorie (19 Presets)
  - **Nährwert-Regel**: Nährwert (5 Optionen) + Operator (gt/lt/eq) + Grenzwert + feste Kategorie „Nährwerte“
  - **Severity**: RED FLAG / Erlaubt (mit Erklärung der jeweiligen Wirkung)
- **Bearbeiten ohne Datenverlust**: eine gespeicherte Übersetzung bleibt erhalten, solange sich das Keyword nicht ändert
- **Auto-Translation**: Neue Zutaten werden parallel in 7 Sprachen übersetzt
- **Löschen** mit Bestätigungsdialog
- **19 Kategorie-Presets**: Süßungsmittel, Farbstoffe, Konservierungsstoffe, Geschmacksverstärker & Aromen, Emulgatoren & Stabilisatoren, Verdickungs- & Geliermittel, Säuren & Säureregulatoren, Antioxidationsmittel, Gehärtete Fette & raffinierte Öle, Zucker & Sirupe, Modifizierte Stärken, Phosphate & Mineralstoffe, Füll- & Trägerstoffe, Proteine & Fleischersatz, Trenn- & Überzugsmittel, Treib- & Schutzgase, Metalle, E-Nummern, Sonstige Zusatzstoffe

---

## Settings

Die Einstellungen sind als gruppierte Liste aufgebaut:

| Gruppe | Beschreibung |
|-------------|-------------|
| **Bewertung** | Filter-Regeln mit Anzahl der aktiven Regeln; Schalter **Allergen-Warnung** (standardmäßig aus), darunter **Meine Allergene**, solange sie an ist |
| **Sprache** | DE ↔ EN (App-UI umschaltbar); darunter der Zugang zur Übersetzungs-Einstellung |
| **Open Food Facts Konto** | Login/Logout für Produktbeiträge, zeigt den Zielserver |
| **Datenbank-Backup** | Speicherort wählen (Android), Backup erstellen, automatisches Backup, Wiederherstellen |
| **Hilfe & Info** | Anleitung & Über FoodCheck |

### Meine Allergene (`/settings/allergens`)
- Optional: nur aktiv, wenn der Schalter „Allergen-Warnung“ in den Einstellungen an ist (standardmäßig aus); aus = keine Warnungen, keine Hinweise
- Auswahl aus den 14 EU-Allergenen, gespeichert in der Datenbank (Teil jedes Backups)
- Scan-Karte (inkl. Screenreader-Ansage) und Produktseite warnen bei „Enthält …“ und „Kann Spuren enthalten …“ laut Open Food Facts
- Hinweis: Grundlage sind die OFF-Angaben (`allergens_tags`, `traces`); keine Warnung heißt nicht unbedenklich
- Die Ampel-Bewertung bleibt davon unberührt

### Übersetzungs-Einstellung (`/settings/api-key`)
- **Provider-Wahl**: DeepL vs MyMemory
- **Status-Anzeige**: Key konfiguriert / Anonym (5.000 Wörter/Tag) / Kein Key
- **Key speichern/löschen** (SecureStore), vollständig übersetzt (nicht mehr fest auf Deutsch)

---

## Mehrsprachigkeit

- **UI-Sprachen**: Deutsch, Englisch (`i18n/translations.ts`)
- **Runtime-Switch**: `useTranslation()` Hook + `languageStore` (Zustand, persistiert in SecureStore); die Sprache wechselt sofort, das Speichern erfolgt im Hintergrund
- **Zutaten-Suche**: 7 Sprachen (de, fr, it, es, nl, pt, pl) zusätzlich zum englischen Schlüssel
- **Zutaten-Bearbeitung**: 8 Sprachen (de, en, fr, it, es, nl, pt, pl)
- **Produkt-Zutaten**: mehrsprachige Anzeige mit Sprach-Chips
- **Nährwert-OCR**: automatische Spracherkennung (DE/EN/FR/IT)
- **Übersetzungsdienste**: DeepL (Free API) und MyMemory (anonym oder mit Key); MyMemory-Fehlermeldungen (HTTP 200 mit Fehlertext) werden nicht mehr als Übersetzung übernommen, Anfragen haben ein Timeout

---

## OCR (Texterkennung)

- **On-Device (Standard)**: ML Kit Text Recognition (lateinische Schrift)
  - Texterkennung mit Konfidenzwerten (`OcrService`)
  - Vorverarbeitung durch `OcrPreprocessor` (Größenanpassung, Qualitätsschätzung)
  - Nährwert-Parsing zeilenweise mit Sprachautomatik: erkennt Tausendertrennzeichen, Komma-Dezimalzahlen, „<0,5“, „Spuren“, sowie kJ/kcal- und „Brennwert“-Angaben
- **Cloud (nur nach ausdrücklicher Zustimmung)**: Open Food Facts Google Cloud Vision Pipeline (`OffOcrClient`)
  - Zustimmungsdialog nennt den Zielserver, bevor irgendetwas hochgeladen wird
  - Bild-Upload → Polling auf OCR-Ergebnis (max. 10 Versuche, 2 s Intervall)
  - Verwendet sprachspezifische Bildfelder (`ingredients_de`, `nutrition_de`, …) und den aktuellen Schreib-Server (Staging in Entwicklungs-Builds, Produktiv in Release-Builds)
  - Zuschneide-Auswahl wird korrekt auf das tatsächliche Kamerabild umgerechnet

---

## Daten-Persistenz

| Speicher | Was | Technologie |
|----------|-----|-------------|
| **SQLite** | Produkte, Favoriten, Filter-Regeln, Meta (Migrationsstand, Backup-Einstellungen) | expo-sqlite |
| **SecureStore** | OFF-Zugangsdaten, Übersetzungs-API-Keys, Sprache, Provider | expo-secure-store |
| **FileSystem** | Backup-Datei (Kopie der SQLite-Datenbank) | expo-file-system |
| **Zustand** | In-Memory State (4 Stores: filter, catalog, language, settings) | zustand |

### Datenbank-Schema
- **`meta`**: key (PK), value — Migrations-Tracking, Rating-Fingerprint, Backup-Einstellungen
- **`products`**: id, ean (UNIQUE), name, brands, ingredients, nova_score, nutriscore, raw_json, scanned_at, rating, data_version, last_api_fetch, image_url, image_ingredients_url, image_nutrition_url, image_packaging_url, visit_count, last_seen_at, edited_at, edited_fields
- **`favorites`**: id, product_id (FK → products.id CASCADE, UNIQUE-Index), added_at
- **`filter_rules`**: id, type, key, category, threshold, operator, severity, translations (JSON), created_at
- **8 Migrationen**: initiales Schema → Seed Rules → Produkt-Spalten → Visit-Tracking → Kategorie-Spalte → Translations-Spalte → Favoriten-Eindeutigkeit + edited_at → edited_fields

### Backup & Wiederherstellung
- **Backup**: Kopiert die SQLite-Datenbankdatei selbst (kein JSON-Export) in einen vom Nutzer gewählten Ordner (Android: Storage Access Framework); der Dateiname trägt Zeitstempel
- **Automatisches Backup**: höchstens einmal täglich beim App-Start, wenn aktiviert und ein Ordner gewählt ist
- **Wiederherstellen**: Die gewählte Datei wird zuerst geprüft (SQLite-Kopfzeile + enthält die FoodCheck-Tabellen); erst danach wird die aktuelle Datenbank ersetzt
- **Sicherheitskopie**: Die bisherige Datenbank wird vor dem Ersetzen kopiert und bei einem Fehler automatisch zurückgespielt, sodass nichts verloren geht
- **Geräteeinstellungen bleiben erhalten**: Backup-Ordner, Automatik-Schalter und Zeitpunkt des letzten Backups dieses Geräts werden von einer wiederhergestellten Datei nicht überschrieben
- **iOS**: Ordner-Backups sind derzeit nur unter Android möglich (Hinweis in den Einstellungen)
- **Keine Cloud-Abhängigkeit**: Backup ist komplett lokal, keine Server-Infrastruktur

---

## Externe APIs

| API | Nutzung |
|-----|---------|
| **Open Food Facts v2 (Read)** | Produktsuche nach EAN, 8-Sekunden-Timeout mit Cache-Fallback |
| **Open Food Facts Write** | Produkt-Upload (mehrsprachig, mit Authentifizierung); Staging in Entwicklungs-, Produktiv in Release-Builds |
| **Open Food Facts OCR (Google Cloud Vision)** | Bild-zu-Text, nur nach expliziter Zustimmung |
| **Robotoff** | KI-Vorhersagen für Kategorien, Labels, Inhaltsstoffe |
| **DeepL Free API** | Übersetzung (API-Key benötigt) |
| **MyMemory** | Übersetzung (anonym 5k Wörter/Tag, mit Key 10k/Tag) |

---

## Testing

- **49 Test-Suiten**, **418 Tests**, alle erfolgreich (`npx jest --maxWorkers=2 --silent`)
- Datenbank- und Repository-Tests laufen gegen echtes SQLite (`node:sqlite`-Testdouble), nicht gegen String-Vergleichs-Mocks
- **Golden-Ratings**: 32 Referenzprodukte mit fest hinterlegtem Bewertungsergebnis, damit Änderungen an der Bewertungslogik als bewusster, überprüfbarer Diff sichtbar werden
- Getestete Module: Analyse (RedFlagAnalyzer, IngredientParser, IngredientTaxonomy, NovaScoreEvaluator, ProductRating), Services (Lookup, Edit, Re-Rating), API-Clients, Repositories/Migrationen, Backup, OCR, Übersetzungen, Screens/Features
- Integrationstests gegen die echte Open Food Facts API sind opt-in (`npm run test:integration`) und laufen ausschließlich gegen den Staging-Server

---

## Technische Details

- **Expo SDK 54** mit New Architecture (`newArchEnabled: true`)
- **TypeScript strict mode**
- **Schichtenarchitektur**: `app/` (Routen) → `src/screens/` → `src/features/` (Screen-Hooks/-Komponenten) → `src/services/` → `src/domain/` → `src/infrastructure/`; Design-System in `src/ui/`
- **Navigation**: Expo Router (file-based), 4 Tabs + Stack-Screens (Product, Edit) + 3 Settings-Unterseiten
- **State Management**: Zustand (4 Stores: filter, catalog, language, settings)
- **DI-Pattern**: Constructor Injection für Domain-Klassen und Services, Module-Level-Singletons für Repositories
- **ESLint 10** (Flat Config, `.mjs`) + Prettier (`endOfLine: auto`, damit CRLF-Arbeitskopien unter Windows lintfrei bleiben)
