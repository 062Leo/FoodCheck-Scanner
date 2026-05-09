# Systemarchitektur – FoodScanner App

**Version:** 1.0  
**Stand:** 2025  
**Framework:** Expo (React Native) · TypeScript · expo-sqlite

---

## 1. Architektur-Übersicht

Die App folgt einer **strikten Schichtenarchitektur** mit vier Ebenen. Jede Schicht kommuniziert nur mit der direkt darunterliegenden. Das ermöglicht einfaches Testen und spätere Erweiterung.

```
┌─────────────────────────────────────┐
│           UI Layer (Screens)         │  React Native Komponenten
├─────────────────────────────────────┤
│         State Layer (Zustand)        │  App-weiter State, keine Business-Logik
├─────────────────────────────────────┤
│        Domain Layer (Services)       │  Business-Logik, Regeln, Bewertung
├─────────────────────────────────────┤
│    Infrastructure Layer (Adapter)    │  API, SQLite, Kamera
└─────────────────────────────────────┘
```

**Prinzipien:** SOLID · Dependency Inversion · Single Responsibility · kein direkter State-Zugriff aus der Domain-Schicht

---

## 2. Verzeichnisstruktur

```
src/
├── screens/              # UI Layer – ein Ordner pro Screen
│   ├── ScannerScreen/
│   ├── ResultScreen/
│   ├── CatalogScreen/           # v2/Soll
│   ├── FavoritesScreen/         # v2/Soll
│   └── ContributeScreen/        # v3 – OCR + OFF-Upload-Flow
│
├── components/           # Wiederverwendbare UI-Bausteine
│   ├── ProductCard/
│   ├── RedFlagBadge/
│   ├── NovaScoreBadge/
│   └── ContributeForm/          # v3 – editierbares Produktformular
│
├── store/                # State Layer (Zustand)
│   ├── catalogStore.ts
│   └── filterStore.ts
│
├── domain/               # Business-Logik (Framework-unabhängig!)
│   ├── analysis/
│   │   ├── RedFlagAnalyzer.ts       # Zutatenliste → Red Flags
│   │   ├── NovaScoreEvaluator.ts    # Nova-Score → Bewertung
│   │   └── ProductRating.ts        # Gesamt-Rating aggregieren
│   └── rules/
│       ├── defaultRules.ts          # Hardcodierte Red-Flag-Listen (MVP)
│       └── FilterRule.types.ts      # Typen für spätere Custom Rules (v2)
│
├── infrastructure/       # Adapter zur Außenwelt
│   ├── api/
│   │   ├── OpenFoodFactsClient.ts        # HTTP-Client Read (fetch)
│   │   ├── OpenFoodFactsWriteClient.ts   # HTTP-Client Write/Upload (v3)
│   │   └── OpenFoodFacts.types.ts        # API-Response- und Upload-Typen
│   ├── ocr/
│   │   └── OcrService.ts                 # ML Kit Text Recognition Wrapper (v3)
│   └── db/
│       ├── DatabaseService.ts       # SQLite-Setup & Migrations (v2/Soll)
│       ├── ProductRepository.ts     # CRUD für Katalog (v2/Soll)
│       └── FavoritesRepository.ts   # CRUD für Favoriten (v2/Soll)
│
├── navigation/           # Expo Router / React Navigation Config
│   └── AppNavigator.tsx
│
└── types/                # Geteilte Domain-Typen
    ├── Product.ts
    ├── ScanResult.ts
    ├── FilterRule.ts
    └── ContributeFormData.ts     # v3 – Felder für OFF-Upload-Formular
```

---

## 3. Datenfluss – Scan-Prozess

```
Nutzer drückt "Scan"
        │
        ▼
[ScannerScreen]
  expo-camera erkennt EAN
        │
        ▼
[OpenFoodFactsClient]
  GET /api/v0/product/{EAN}.json
        │
        ▼
[RedFlagAnalyzer]                [NovaScoreEvaluator]
  Zutaten → Red Flags              Nova 1–4 → Label
        │                                │
        └──────────────┬────────────────┘
                       ▼
               [ProductRating]
             aggregiert Gesamt-Rating
                       │
                       ▼
              [ResultScreen]
             zeigt Ergebnis an
```

Persistenz in SQLite, Katalog und Favoriten sind erst ab Phase 2/Soll vorgesehen.

---

## 3b. Datenfluss – OCR & Contribution-Flow *(v3)*

Wird ausgelöst wenn OFF-API `status === 0` zurückgibt (Produkt unbekannt).

```
ResultScreen zeigt "Produkt nicht gefunden"
  + Button "Zu Open Food Facts beitragen"
        │
        ▼
[ContributeScreen] – Schritt 1: Zutatenliste fotografieren (optional)
  expo-camera Foto aufnehmen
        │
        ▼
[OcrService]  ←  @react-native-ml-kit/text-recognition (on-device)
  Bild → Rohtext
        │
        ▼
[ContributeScreen] – Schritt 2: Nährwerte fotografieren (optional)
  expo-camera zweites Foto aufnehmen
        │
        ▼
[OcrService]
  Bild → Rohtext (Nährwerttabelle)
        │
        ▼
[ContributeScreen] – Schritt 3: Formular
  Felder vorausgefüllt mit OCR-Text, User kann alles editieren:
  • Produktname (Pflicht)
  • Marke / Hersteller
  • Kategorie (Dropdown)
  • Zutatenliste (Freitext, vorausgefüllt aus Foto 1)
  • Nährwerte pro 100g (vorausgefüllt aus Foto 2):
    Energie, Fett, gesättigte Fettsäuren, Kohlenhydrate,
    Zucker, Ballaststoffe, Eiweiß, Salz
        │
        ▼ Nutzer tippt "Bestätigen & hochladen"
        │
        ├──► [OpenFoodFactsWriteClient]
        │      POST zu OFF API (mit OFF-Account-Credentials)
        │      Produkt wird öffentlich in OFF-DB eingetragen
        │
        └──► [RedFlagAnalyzer] + [ProductRating]
               Sofortige lokale Analyse mit eingegebenen Daten
               → Navigation zu ResultScreen mit Ergebnis
```

**Wichtig:** Beide Foto-Schritte sind optional (überspringbar per "Überspringen"-Button). Das Formular kann auch vollständig manuell ausgefüllt werden. Nur Produktname ist Pflichtfeld für den Upload.

**OFF-Account:** Für den Upload wird ein (einmaliges) kostenloses OFF-Konto benötigt. Credentials werden sicher im Gerät gespeichert (`expo-secure-store`).

---

## 4. Datenbankschema (SQLite)

### Tabelle: `products` *(v2/Soll)*
```sql
CREATE TABLE products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ean         TEXT NOT NULL UNIQUE,
  name        TEXT,
  brands      TEXT,
  ingredients TEXT,         -- Rohtext der Zutatenliste
  nova_score  INTEGER,      -- 1–4
  nutriscore  TEXT,         -- A–E
  raw_json    TEXT,         -- vollständiger OFF-API-Response als JSON-String
  scanned_at  TEXT NOT NULL, -- ISO 8601
  rating      TEXT NOT NULL  -- 'ok' | 'warning' | 'critical'
);
```

### Tabelle: `favorites` *(v2/Soll)*
```sql
CREATE TABLE favorites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at   TEXT NOT NULL
);
```

### Tabelle: `filter_rules` *(vorbereitet für v2)*
```sql
CREATE TABLE filter_rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL, -- 'ingredient' | 'nutrient'
  key         TEXT NOT NULL, -- z. B. 'palmöl' oder 'sugars_100g'
  threshold   REAL,          -- für numerische Grenzwerte
  operator    TEXT,          -- 'gt' | 'lt' | 'eq'
  severity    TEXT NOT NULL, -- 'red_flag' | 'ok'
  created_at  TEXT NOT NULL
);
```

---

## 5. Externe Schnittstellen

### Open Food Facts API

| Eigenschaft | Wert |
|---|---|
| Basis-URL | `https://world.openfoodfacts.org/api/v0/product/` |
| Auth | Keine (kein API-Key) |
| Format | JSON |
| Nutzungslimit | Fair-Use (privat problemlos) |
| User-Agent | Pflicht: `FoodScanner/1.0 (privat)` |

**Wichtige Response-Felder:**
```
product.product_name
product.ingredients_text
product.ingredients_text_de
product.nutriments
product.nova_group
product.nutriscore_grade
product.additives_tags[]
```

**Fehlerfall:** Wenn `status === 0` → Produkt nicht gefunden → Nutzer informieren, nicht crashen.

---

## 6. Domain-Logik: Red-Flag-Analyse (MVP)

Der `RedFlagAnalyzer` bekommt einen reinen String (Zutatenliste) und gibt ein Array von gefundenen Flags zurück. Keine Abhängigkeit zu React oder SQLite.

```typescript
// Typen
type RedFlagSeverity = 'critical' | 'warning';

interface RedFlag {
  ingredient: string;   // gefundener Begriff
  category: string;     // z. B. 'Zucker', 'Kritische Öle'
  severity: RedFlagSeverity;
}

// Interface (ermöglicht späteres Testen mit Mock-Regeln)
interface IRedFlagAnalyzer {
  analyze(ingredientsText: string): RedFlag[];
}
```

**Matching-Strategie:** Case-insensitive Substring-Suche in der Zutatenliste. Beispiel: `"Glukose-Fructose-Sirup"` matched auf Regel `"fructose-sirup"`.

---

## 7. Technologie-Entscheidungen

| Entscheidung | Gewählt | Begründung |
|---|---|---|
| Framework | Expo (managed) | Kein eigenes Native-Setup, Barcode-Scanner inklusive |
| Sprache | TypeScript | Typsicherheit, bessere KI-Unterstützung beim Vibe-Coding |
| State | Zustand | Minimale API, kein Boilerplate, kein Redux-Overhead |
| Datenbank | expo-sqlite | Nativ, persistent, offline-fähig, relationale Struktur |
| Navigation | Expo Router | Dateibasiertes Routing, einfacher als React Navigation |
| Testing | Jest + React Native Testing Library | Standard im React-Native-Ökosystem |
| OCR (v3) | @react-native-ml-kit/text-recognition | On-device, kostenlos, keine Cloud, funktioniert offline |
| Credentials (v3) | expo-secure-store | Sicheres Speichern des OFF-Accounts auf dem Gerät |

---

## Status: Module & Komponenten

| Modul | Komponente | Beschreibung | Status |
|---|---|---|---|
| **Domain** | RedFlagAnalyzer | Zutatenliste → Red Flags (pure) | ✅ Done |
| | NovaScoreEvaluator | Nova 1-4 → Label & Farbe | ✅ Done |
| | ProductRating | Red Flags + Nova → Status | ✅ Done |
| | defaultRules | Hardcodierte Red-Flag Liste | ✅ Done |
| **Infrastructure** | OpenFoodFactsClient | OFF API fetch + parsing | ✅ Done |
| | OpenFoodFacts.types | API-Response Typen | ✅ Done |
| | DatabaseService | SQLite Setup & Migrations | ✅ Done |
| | ProductRepository | CRUD Katalog | ✅ Done |
| | FavoritesRepository | CRUD Favoriten | ✅ Done |
| **Screens** | ScannerScreen | Kamera + EAN-Erkennung | ✅ Done |
| | ResultScreen | Ampel-Banner + Details | ✅ Done |
| | CatalogScreen | Produktliste | ✅ Done |
| | FavoritesScreen | Favoriten-Liste | ✅ Done |
| | ContributeScreen | OCR-Flow + Formular + OFF-Upload | ✅ Done |
| **Components** | SkeletonLoading | Loading-Skeleton | ✅ Done |
| | Toast | Fehler-Meldungen | ✅ Done |
| | Accordion | Zutatenliste expandierbar | ✅ Done |
| | ContributeForm | Editierbares Produktformular | ✅ Done |
| **Types** | Product | Produkt-Modell | ✅ Done |
| | ScanResult | Analyse-Ergebnis | ✅ Done |
| | ContributeFormData | Felder für OFF-Upload | ✅ Done |
| **Infrastructure** | OcrService | ML Kit Text Recognition Wrapper | ✅ Done |
| | OpenFoodFactsWriteClient | OFF API Upload (POST) | ✅ Done |
| **State** | catalogStore | Zustand (v2) | ✅ Done |
| | filterStore | Zustand (v2) | ✅ Done |
| **Navigation** | Routing (Expo Router) | Tab + Stack Layout | ✅ Done |
