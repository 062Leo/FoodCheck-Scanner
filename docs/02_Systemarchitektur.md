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
│   ├── CatalogScreen/
│   └── FavoritesScreen/
│
├── components/           # Wiederverwendbare UI-Bausteine
│   ├── ProductCard/
│   ├── RedFlagBadge/
│   └── NovaScoreBadge/
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
│   │   ├── OpenFoodFactsClient.ts   # HTTP-Client (fetch)
│   │   └── OpenFoodFacts.types.ts   # API-Response-Typen
│   └── db/
│       ├── DatabaseService.ts       # SQLite-Setup & Migrations
│       ├── ProductRepository.ts     # CRUD für Katalog
│       └── FavoritesRepository.ts   # CRUD für Favoriten
│
├── navigation/           # Expo Router / React Navigation Config
│   └── AppNavigator.tsx
│
└── types/                # Geteilte Domain-Typen
    ├── Product.ts
    ├── ScanResult.ts
    └── FilterRule.ts
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
           [ProductRepository]
             speichert in SQLite
                       │
                       ▼
              [ResultScreen]
             zeigt Ergebnis an
```

---

## 4. Datenbankschema (SQLite)

### Tabelle: `products`
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

### Tabelle: `favorites`
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
