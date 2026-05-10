# Technical Documentation — TrueFood-Scanner

## 1. Project Overview

**TrueFood-Scanner** is a React Native (Expo) mobile app for iOS and Android that scans food product barcodes and instantly evaluates them for unhealthy ingredients and processing levels. The app uses the Open Food Facts API for product data and on-device ML Kit for OCR.

- **Language:** TypeScript (strict mode)
- **Framework:** Expo (managed workflow) with Expo Router
- **State:** Zustand
- **Database:** expo-sqlite
- **OCR:** @react-native-ml-kit/text-recognition (on-device)
- **Translation:** DeepL API + MyMemory API
- **Credentials:** expo-secure-store

## 2. Architecture

The app follows a strict 4-layer architecture. Each layer communicates only with the one directly below it.

```
┌─────────────────────────────────────┐
│           UI Layer (Screens)         │  React Native components
├─────────────────────────────────────┤
│         State Layer (Zustand)        │  App-wide state, no business logic
├─────────────────────────────────────┤
│        Domain Layer (Services)       │  Business logic, rules, scoring
├─────────────────────────────────────┤
│    Infrastructure Layer (Adapters)   │  API, SQLite, camera, OCR
└─────────────────────────────────────┘
```

**Principles:** SOLID, Dependency Inversion, Single Responsibility.

### Layer Constraints

- `domain/` — framework-agnostic: no React, React Native, Expo, Zustand, or persistence imports.
- `infrastructure/` — wraps external dependencies, may import from `domain/` for interfaces.
- `types/` — pure, zero dependencies, imported by all layers.
- `screens/` — instantiate domain classes and infrastructure repositories directly.

## 3. Directory Structure

```
App/
├── app/                      # Expo Router file-based routes (real navigation)
├── src/
│   ├── screens/
│   │   ├── ScannerScreen/    # Camera + EAN detection
│   │   ├── ResultScreen/     # Traffic light banner + product details
│   │   ├── CatalogScreen/    # Scanned product list with filters
│   │   ├── FavoritesScreen/  # Favorite product list
│   │   ├── FilterScreen/     # Custom filter rules management
│   │   ├── SettingsScreen/   # Settings hub (Filters, API Key)
│   │   ├── ApiKeyScreen/     # Translation provider + API key management
│   │   ├── ContributeScreen/ # OCR flow + product form + OFF upload
│   │   └── EditProductScreen.tsx
│   ├── components/
│   │   ├── ProductCard/      # Reusable product list row
│   │   ├── SkeletonLoading/
│   │   ├── Toast/
│   │   ├── Accordion/        # Collapsible section component
│   │   ├── OcrCameraSheet/   # Bottom sheet OCR camera overlay
│   │   ├── OffAccountSetup/  # OFF credential setup modal
│   │   └── ContributeForm/   # Editable product form
│   ├── store/                # Zustand stores
│   │   ├── catalogStore.ts
│   │   ├── filterStore.ts
│   │   └── settingsStore.ts
│   ├── domain/
│   │   ├── analysis/
│   │   │   ├── RedFlagAnalyzer.ts      # Ingredients → red flags (pure)
│   │   │   ├── NovaScoreEvaluator.ts   # Nova 1-4 → label + color
│   │   │   ├── ProductRating.ts        # Red flags + Nova → final status
│   │   │   └── defaultRules.ts         # Hardcoded red flag list
│   │   └── translation/
│   │       └── Translator.ts           # Translation interface
│   ├── infrastructure/
│   │   ├── api/
│   │   │   ├── OpenFoodFactsClient.ts       # Read client (GET)
│   │   │   ├── OpenFoodFactsWriteClient.ts  # Write client (POST)
│   │   │   └── ...
│   │   ├── ocr/
│   │   │   └── OcrService.ts                # ML Kit text recognition wrapper
│   │   ├── translation/
│   │   │   ├── DeepLClient.ts               # DeepL API adapter (implements Translator)
│   │   │   ├── MyMemoryClient.ts            # MyMemory API adapter (implements Translator)
│   │   │   └── TranslationRouter.ts         # Provider delegation
│   │   └── db/
│   │       ├── DatabaseService.ts       # SQLite init + migrations
│   │       ├── ProductRepository.ts     # CRUD for products
│   │       ├── FavoritesRepository.ts   # CRUD for favorites
│   │       └── FilterRuleRepository.ts  # CRUD for custom rules
│   └── types/
│       ├── Product.ts
│       ├── ScanResult.ts
│       ├── FilterRule.ts
│       └── ContributeFormData.ts
├── assets/
├── app.json                 # Expo config (newArchEnabled: true)
├── tsconfig.json            # extends expo/tsconfig.base, strict: true
├── eslint.config.js         # ESLint flat config (ESLint 10)
├── jest.config.js           # jest-expo preset
└── package.json
```

## 4. Technology Stack

| Technology | Purpose |
|---|---|
| Expo (managed) | Framework, no native setup needed |
| TypeScript (strict) | Type safety, no `any` |
| Expo Router | File-based tab + stack navigation |
| Zustand | Lightweight state management |
| expo-sqlite | Local persistent relational database |
| expo-camera | Barcode scanning + OCR photo capture |
| @react-native-ml-kit/text-recognition | On-device OCR (no cloud, offline-capable) |
| expo-secure-store | Secure credential storage for OFF account |
| Jest + jest-expo | Unit testing (9 suites, 61 tests) |
| ESLint + Prettier | Code quality & formatting |

## 5. Data Flow

### 5.1 Scan Flow

```
User scans barcode
    → ScannerScreen (expo-camera / onBarcodeScanned)
    → ProductRepository.findByEan(ean) [local cache check]
        → Found? Navigate to ResultScreen with cached data
        → Not found + offline? Toast warning
        → Not found + online? OpenFoodFactsClient.getProductByEan(ean)
            → Status 1: parse response → RedFlagAnalyzer + NovaScoreEvaluator → ProductRating
            → Status 0: ResultScreen shows "not found" + contribute button
    → Save to ProductRepository in background
    → Navigate to ResultScreen
```

### 5.2 OCR & Contribution Flow

```
Product not found (OFF status=0)
    → "Contribute" button → ContributeScreen
    → Step 1: Photo of ingredients → OcrService.recognizeText() → raw text
    → Step 2: Photo of nutrition table → OcrService.recognizeText() → OcrService.parseNutriments()
    → Step 3: Editable form (pre-filled from OCR)
    → "Confirm & Upload":
        1. OpenFoodFactsWriteClient.uploadProduct(formData)
        2. RedFlagAnalyzer.analyze(ingredients, rules) + ProductRating.rate()
        3. ProductRepository.insert(product)
        4. Navigate to ResultScreen
```

## 6. Database Schema

### `products`
```sql
CREATE TABLE products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ean         TEXT NOT NULL UNIQUE,
  name        TEXT,
  brands      TEXT,
  ingredients TEXT,
  nova_score  INTEGER,
  nutriscore  TEXT,
  raw_json    TEXT,
  scanned_at  TEXT NOT NULL,
  rating      TEXT NOT NULL
);
```

### `favorites`
```sql
CREATE TABLE favorites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at   TEXT NOT NULL
);
```

### `filter_rules`
```sql
CREATE TABLE filter_rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,
  key         TEXT NOT NULL,
  threshold   REAL,
  operator    TEXT,
  severity    TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
```

## 7. External APIs

### Open Food Facts Read API

| Property | Value |
|---|---|
| Endpoint | `GET https://world.openfoodfacts.org/api/v2/product/{ean}.json` |
| Auth | User-Agent header (`FoodScanner/1.0 (private)`) |
| `fields` param | Filters returned fields |
| Rate limit | 15 req/min per IP |
| Product found | `status: 1` |
| Product not found | `status: 0` |

### Open Food Facts Write API

| Property | Value |
|---|---|
| Endpoint | `POST https://world.openfoodfacts.org/cgi/product_jqm2.pl` |
| Auth | `user_id` + `password` in form body |
| Required fields | `code`, `user_id`, `password`, `product_name` |
| App fields | `app_name`, `app_version`, `app_uuid` |
| Nutrition fields | `nutriment_energy-kcal`, `nutriment_fat`, `nutriment_saturated-fat`, `nutriment_carbohydrates`, `nutriment_sugars`, `nutriment_proteins`, `nutriment_salt`, `nutriment_fiber` |

### Staging Environment

- URL: `https://world.openfoodfacts.net`
- Requires `Authorization: Basic b2ZmOm9mZg==` header
- Separate account database from production

## 8. Translation Providers

| | DeepL Free | MyMemory |
|---|---|---|
| Endpoint | `POST https://api-free.deepl.com/v2/translate` | `GET https://api.mymemory.translated.net/get` |
| Auth | Header `DeepL-Auth-Key <key>` | Query `&key=<key>` (optional) |
| Without Key | Not usable | 5.000 words/day (anonymous) |
| With Key (free) | 500.000 chars/month | 10.000 words/day |
| Credit card | Required | Not required |
| Key format | String ending with `:fx` | Standard API key |
| Key storage | expo-secure-store | expo-secure-store |

### Architecture

- `domain/translation/Translator.ts` — interface with `translate(text, targetLang?)`
- `DeepLClient` and `MyMemoryClient` both implement `Translator`
- `TranslationRouter` delegates to the active provider (default: MyMemory)
- `settingsStore` manages provider selection and API keys
- User can switch provider in Settings → API Key screen

## 9. Domain Logic

### Red Flag Analysis

- `RedFlagAnalyzer.analyze(ingredientsText: string, rules: FilterRule[]): RedFlag[]`
- Case-insensitive substring matching against a list of rules.
- Returns found red flags sorted by occurrence in the ingredients list.
- Rules can be ingredient-based (keyword match) or nutrient-based (threshold comparison).
- If no custom rules provided, falls back to hardcoded `defaultRules`.

### Nova Score Evaluation

- `NovaScoreEvaluator.getLabel(novaGroup: number): string`
- Nova 1: "Unprocessed / Minimally processed" (Green)
- Nova 2: "Processed culinary ingredients" (Green)
- Nova 3: "Processed foods" (Yellow)
- Nova 4: "Ultra-processed food products" (Red)

### Product Rating

- `ProductRating.rate(redFlags: RedFlag[], novaGroup: number): ScanResult`
- OK (Green): 0 red flags, Nova 1–2
- Warning (Yellow): 1–2 red flags or Nova 3
- Critical (Red): 3+ red flags or Nova 4

## 10. UI Design Tokens

```
Background:   #121212
Surface:      #1E1E1E
Text Primary: #FFFFFF
Text Muted:   #9E9E9E
Accent:       #00BFA5

Status Green: #4CAF50
Status Yellow: #FFC107
Status Red:   #F44336

Nova 1:       #4CAF50
Nova 2:       #8BC34A
Nova 3:       #FFC107
Nova 4:       #F44336
```

Font: System default (SF Pro on iOS, Roboto on Android). Dark mode first.

## 11. Navigation

Expo Router file-based routing in `App/app/`:

- **Tabs**: Scanner (`index`), Catalog, Favorites, Settings
- **Stack screens**: `result`, `contribute`, `edit/[ean]`
- **Settings sub-routes**: `settings/filters`, `settings/api-key`
- `src/navigation/` is empty — do not add routes there.

## 12. Testing

- **Framework:** Jest with `jest-expo` preset
- **Count:** 20 suites, 195 tests (all passing)
- **Location:** `__tests__/` directories alongside source files
- **No snapshot tests** — all assertion-based `expect()` calls
- **Run all tests:** `npm test`
- **Run single file:** `npm test -- --testPathPattern=RedFlagAnalyzer`

## 13. Commands (run from `App/`)

| Command | Description |
|---|---|
| `npm start` | Expo dev server |
| `npm run android` | Run on connected Android device |
| `npm run ios` | Run on connected iOS device |
| `npm run web` | Run in browser |
| `npm test` | Run all Jest tests |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run format:check` | Prettier check |
| `npx tsc --noEmit` | TypeScript type-check |

## 14. Feature Status

| Feature | Phase | Status |
|---|---|---|
| Barcode scanning (EAN-8/EAN-13) | MVP | Done |
| OFF API product lookup | MVP | Done |
| Red flag ingredient analysis | MVP | Done |
| Result screen (traffic light, details) | MVP | Done |
| Local catalog (SQLite) | v2 | Done |
| Favorites list | v2 | Done |
| Offline cache for scanned products | v2 | Done |
| Custom filter rules (ingredient + nutrient) | v2 | Done |
| Filter profiles | v2 | Planned |
| OCR ingredients list | v3 | Done |
| OCR nutrition table | v3 | Done |
| OFF contribution/upload flow | v3 | Done |
| Editable product form | v3 | Done |
| Data source toggle (OFF vs. Local) | v3 | Done |
| Multi-language ingredients editor | v3 | Done |
| Translation (DeepL + MyMemory) | v3 | Done |
| Offline OFF database dump | v3 | Planned |
| CSV export | v3 | Planned |

## 15. Known Issues

1. `npx tsc --noEmit` fails with 4 errors:
   - `FilterRuleRepository.ts`: references `created_at` on `NewFilterRule` (which omits it)
   - `FilterRuleRepository.ts` `update` method uses `Record<string, unknown>` instead of typed SQLite bind params
   - `FilterScreen.tsx`: references `created_at` on `NewFilterRule`
2. `src/screens/ResultScreen.tsx` is a dead file — the active version is at `src/screens/ResultScreen/ResultScreen.tsx`.

## 16. Non-Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| NF-01 | Scan-to-Result < 10s | Done |
| NF-02 | Fully local on device (no backend) | Done |
| NF-03 | All data stays on device | Done |
| NF-04 | Operating cost 0€ | Done |
| NF-05 | Modular & testable (SOLID) | Done |
| NF-06 | No ads, no tracking, no analytics | Done |
