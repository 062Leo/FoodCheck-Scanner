# Technical Documentation — TrueFood-Scanner

## 1. Project Overview

**TrueFood-Scanner** is a React Native (Expo) mobile app for iOS and Android that scans food product barcodes and instantly evaluates them for unhealthy ingredients and processing levels. The app uses the Open Food Facts API for product data and on-device ML Kit for OCR.

- **Language:** TypeScript (strict mode)
- **Framework:** Expo SDK 54 (managed workflow) with Expo Router
- **State:** Zustand (4 stores)
- **Database:** expo-sqlite (SQLite)
- **OCR:** @react-native-ml-kit/text-recognition (on-device) + OFF Cloud Vision Pipeline
- **Translation:** DeepL API + MyMemory API (via domain Translator interface)
- **Text Processing:** SymSpell spell correction, ingredient segmentation, dictionary lookup
- **Credentials:** expo-secure-store
- **Navigation:** Expo Router file-based routing (App/app/)

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
│   │   ├── ScannerScreen.tsx          # Camera + EAN detection + backup UI
│   │   ├── ProductScreen.tsx          # Traffic light banner + product details
│   │   ├── CatalogScreen.tsx          # Scanned product list with filters
│   │   ├── FavoritesScreen.tsx        # Favorite product list
│   │   ├── FilterScreen.tsx           # Custom filter rules management
│   │   ├── SettingsScreen.tsx         # Settings hub (language, OFF, filters, API key, backup)
│   │   ├── ApiKeyScreen.tsx           # Translation provider + API key management
│   │   └── EditProductScreen.tsx      # Product edit + OFF contribution (OCR, upload)
│   ├── components/
│   │   ├── ProductCard.tsx            # Reusable product list row
│   │   ├── SkeletonLoading.tsx
│   │   ├── Toast.tsx
│   │   ├── Accordion.tsx              # Collapsible section component
│   │   ├── OcrCameraSheet.tsx         # Bottom sheet OCR camera overlay
│   │   ├── OffAccountSetup.tsx        # OFF credential setup modal
│   │   ├── ImageGallery.tsx           # Swipeable product image gallery
│   │   └── NutritionTable.tsx         # Full nutrition facts table
│   ├── store/                # Zustand stores
│   │   ├── catalogStore.ts
│   │   ├── filterStore.ts
│   │   ├── languageStore.ts           # Language persistence in SecureStore
│   │   └── settingsStore.ts
│   ├── i18n/                 # Internationalization
│   │   ├── translations.ts            # 597 translation keys (DE/EN)
│   │   └── useTranslation.ts          # React hook for language switching
│   ├── domain/
│   │   ├── analysis/
│   │   │   ├── RedFlagAnalyzer.ts      # Ingredients → red flags (pure)
│   │   │   ├── NovaScoreEvaluator.ts   # Nova 1-4 → label + color
│   │   │   ├── ProductRating.ts        # Red flags + Nova → final status
│   │   │   ├── IngredientParser.ts     # Ingredient list parsing
│   │   │   ├── IngredientTaxonomy.ts   # Additive/ingredient classification
│   │   │   ├── ProductNormalizer.ts    # Product data normalization
│   │   │   ├── ProductStatistics.ts    # Catalog statistics computation
│   │   │   ├── RobotoffInsightAnalyzer.ts # AI insight analysis
│   │   │   ├── ScoreLabels.ts          # Scoring label constants
│   │   │   ├── defaultRedFlagRules.ts  # 683 hardcoded red flag rules
│   │   │   ├── AdditiveTaxonomyTypes.ts
│   │   │   └── AdditiveTaxonomyData.ts
│   │   ├── translation/
│   │   │   └── Translator.ts           # Translation interface
│   │   ├── textProcessing/
│   │   │   ├── TextProcessor.ts        # Text processing pipeline interface
│   │   │   ├── TextSegmenter.ts        # Ingredient list segmentation
│   │   │   ├── DefaultTextSegmenter.ts
│   │   │   ├── Dictionary.ts           # Ingredient dictionary interface
│   │   │   ├── SpellCorrector.ts       # Spell correction interface
│   │   │   ├── SymSpellSpellCorrector.ts # SymSpell implementation
│   │   │   └── SymSpellConfig.ts
│   │   └── rules/
│   │       ├── defaultRules.ts         # Built-in filter rules
│   │       ├── seedRules.ts            # Initial DB seed rules
│   │       └── ingredientTranslations.ts # Multi-language ingredient names
│   ├── infrastructure/
│   │   ├── api/
│   │   │   ├── OpenFoodFactsClient.ts       # Read client (GET)
│   │   │   ├── OpenFoodFactsWriteClient.ts  # Write client (POST)
│   │   │   ├── OffOcrClient.ts              # OFF Cloud Vision OCR
│   │   │   ├── RobotoffClient.ts            # Robotoff AI predictions
│   │   │   ├── baseClient.ts                # HTTP client base
│   │   │   ├── config.ts                    # API configuration
│   │   │   ├── debounce.ts / retry.ts       # Utility decorators
│   │   │   └── ApiError.ts                  # Error types
│   │   ├── ocr/
│   │   │   ├── OcrService.ts                # ML Kit text recognition wrapper
│   │   │   └── OcrPreprocessor.ts           # Image preprocessing
│   │   ├── translation/
│   │   │   ├── DeepLClient.ts               # DeepL API adapter
│   │   │   ├── MyMemoryClient.ts            # MyMemory API adapter
│   │   │   └── TranslationRouter.ts         # Provider delegation
│   │   ├── textProcessing/
│   │   │   ├── AssetDictionaryProvider.ts   # Dictionary from app assets
│   │   │   └── createIngredientsTextProcessor.ts # Factory
│   │   ├── resolution/
│   │   │   └── ProductResolutionService.ts  # Product lookup orchestration
│   │   ├── media/
│   │   │   └── LocalImageCache.ts           # Local image file caching
│   │   └── db/
│   │       ├── DatabaseService.ts       # SQLite init + 7 migrations
│   │       ├── ProductRepository.ts     # CRUD for products
│   │       ├── FavoritesRepository.ts   # CRUD for favorites
│   │       ├── FilterRuleRepository.ts  # CRUD for filter rules
│   │       └── BackupService.ts         # JSON export/import
│   └── types/
│       ├── Product.ts
│       ├── ScanResult.ts
│       ├── FilterRule.ts
│       ├── ContributeFormData.ts
│       ├── Robotoff.ts
│       └── global.d.ts
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
| Expo SDK 54 (managed) | Framework, no native setup needed |
| TypeScript (strict) | Type safety, no `any` |
| Expo Router | File-based tab + stack navigation |
| Zustand | Lightweight state management (4 stores) |
| expo-sqlite | Local persistent relational database |
| expo-camera | Barcode scanning + OCR photo capture |
| @react-native-ml-kit/text-recognition | On-device OCR (no cloud, offline-capable) |
| expo-secure-store | Secure credential storage for OFF account + API keys |
| expo-file-system | Local image caching |
| expo-sharing | Native share sheet for backup export |
| Jest + jest-expo | Unit testing (23 suites, 265 tests) |
| ESLint 10 + Prettier | Code quality & formatting |

## 5. Data Flow

### 5.1 Scan Flow

```
User scans barcode
    → ScannerScreen (expo-camera / onBarcodeScanned)
    → ProductResolutionService.resolve(ean)
        → 1. ProductRepository.findByEan(ean) [local cache check]
            → Found + fresh (< 7 days)? Navigate to ProductScreen
            → Found but stale? Mark as stale, also try API
        → 2. Not found / stale + online? OpenFoodFactsClient.getProductByEan(ean)
            → Status 1: parse response → RedFlagAnalyzer + NovaScoreEvaluator → ProductRating
            → Status 0: ProductScreen shows "not found" + edit button
        → 3. Not found + offline? Toast warning
    → ProductRepository.upsert(product) in background
    → RobotoffClient.fetchInsights(ean) [async, 15min cache]
    → Navigate to ProductScreen
```

### 5.2 OCR & Edit/Contribution Flow

```
Product details → Edit icon → EditProductScreen
    → Pre-filled form from loaded product data
    → OCR ingredients list: OcrCameraSheet → OcrService.recognizeText() → raw text
    → OCR nutrition table: OcrCameraSheet → OcrService.recognizeText() → OcrService.parseNutriments()
    → Manual editing or translation (DeepL/MyMemory) per language
    → "Save":
        1. ProductRepository.updateProduct(formData) [local save]
        2. (optional) OpenFoodFactsWriteClient.uploadProduct(formData) [OFF upload]
        3. RedFlagAnalyzer.analyze() + ProductRating.rate() [re-analyze]
        4. Navigate back to ProductScreen
```

## 6. Database Schema

### `meta`
```sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```
Tracks migration version (`db_version`) and other metadata.

### `products`
```sql
CREATE TABLE IF NOT EXISTS products (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  ean                    TEXT NOT NULL UNIQUE,
  name                   TEXT,
  brands                 TEXT,
  ingredients            TEXT,
  nova_score             INTEGER,
  nutriscore             TEXT,
  raw_json               TEXT,
  scanned_at             TEXT NOT NULL,
  rating                 TEXT NOT NULL,
  data_version           INTEGER DEFAULT 1,
  last_api_fetch         TEXT,
  image_url              TEXT,
  image_ingredients_url  TEXT,
  image_nutrition_url    TEXT,
  image_packaging_url    TEXT,
  visit_count            INTEGER DEFAULT 1,
  last_seen_at           TEXT
);
```

### `favorites`
```sql
CREATE TABLE IF NOT EXISTS favorites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at   TEXT NOT NULL
);
```

### `filter_rules`
```sql
CREATE TABLE IF NOT EXISTS filter_rules (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT NOT NULL,
  key          TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT '',
  threshold    REAL,
  operator     TEXT,
  severity     TEXT NOT NULL,
  translations TEXT,
  is_favorite  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);
```

### Migrations (DatabaseService, version 7)

| Version | Migration | Description |
|---------|-----------|-------------|
| 1 | `createInitialSchema` | Create products, favorites, filter_rules tables |
| 2 | `seedDefaultFilterRules` | Seed 683 red flag rules from `seedRules.ts` |
| 3 | `addProductStorageColumns` | Add data_version, last_api_fetch, 4 image columns |
| 4 | `addVisitTrackingColumns` | Add visit_count, last_seen_at |
| 5 | `addCategoryColumn` | Add category column, backfill for existing rules |
| 6 | `addTranslationsColumn` | Add translations (JSON) for multi-language rule keywords |
| 7 | `addFavoriteColumn` | Add is_favorite for favorite rule marking |

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
| Multi-language | `product_name_de`, `ingredients_text_de`, etc. |

### Robotoff API

| Property | Value |
|---|---|
| Endpoint | `GET https://robotoff.openfoodfacts.org/api/v1/insights/{ean}` |
| Purpose | AI-predicted categories, labels, ingredients |
| Cache | 15-minute in-memory cache in `RobotoffClient` |
| Response | Insights array with confidence scores |

### OFF OCR (Google Cloud Vision Pipeline)

| Property | Value |
|---|---|
| Endpoint | `POST https://world.openfoodfacts.org/cgi/ingredients.pl` (OCR request) |
| Polling | Up to 10 attempts, 2s interval |
| Image prep | Max 2048px, JPEG compression via `OcrPreprocessor` |
| Client | `OffOcrClient` |

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

- **Tabs** (in `(tabs)/` group): Scanner (`index`), Catalog, Favorites, Settings
- **Stack screens**: `result`, `edit/[ean]`
- **Settings sub-routes**: `settings/filters`, `settings/api-key`
- `src/navigation/` is empty — do not add routes there.

### Route mapping

| File | Route |
|---|---|
| `app/(tabs)/index.tsx` | `/` (Scanner) |
| `app/(tabs)/catalog.tsx` | `/catalog` |
| `app/(tabs)/favorites.tsx` | `/favorites` |
| `app/(tabs)/settings.tsx` | `/settings` |
| `app/result.tsx` | `/result` |
| `app/edit/[ean].tsx` | `/edit/:ean` |
| `app/settings/filters.tsx` | `/settings/filters` |
| `app/settings/api-key.tsx` | `/settings/api-key` |

## 12. Testing

- **Framework:** Jest with `jest-expo` preset
- **Count:** 23 suites, 265 tests (all passing)
- **Location:** `__tests__/` directories alongside source files
- **No snapshot tests** — all assertion-based `expect()` calls
- **Run all tests:** `npm test`
- **Run single file:** `npm test -- --testPathPattern=RedFlagAnalyzer`

### Test coverage by module

| Module | Test files | Focus |
|---|---|---|
| API Clients | OpenFoodFactsClient, WriteClient, baseClient, retry, debounce, config, integration | HTTP, auth, rate limiting, error handling |
| DB Repositories | ProductRepository, FilterRuleRepository, FavoritesRepository | CRUD, migrations, edge cases |
| Domain Analysis | RedFlagAnalyzer, IngredientParser, IngredientTaxonomy, NovaScoreEvaluator, ProductRating, ScoreLabels | Business rules, scoring |
| OCR | OcrService | Text recognition, nutrition parsing |
| Translation | DeepLClient, MyMemoryClient | API integration, error handling |
| Types | Product, ProductScreenMerge | Data validation |

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

| Feature | Status |
|---|---|
| Barcode scanning (EAN-8/EAN-13) | Done |
| OFF API product lookup | Done |
| Red flag ingredient analysis (683 rules, 19 categories) | Done |
| Result screen (traffic light, details, data source toggle) | Done |
| Local catalog (SQLite) with search, filter, sort | Done |
| Favorites list | Done |
| Offline cache for scanned products (7-day stale detection) | Done |
| Custom filter rules (ingredient + nutrient, 19 category presets) | Done |
| Filter rule favorites (star marking, is_favorite) | Done |
| Multi-language ingredients search (8 languages) | Done |
| OCR ingredients list (on-device ML Kit + OFF Cloud Vision) | Done |
| OCR nutrition table (multi-language) | Done |
| OFF contribution/upload flow (via EditProductScreen) | Done |
| Editable product form (8 languages, OCR, translation) | Done |
| Translation (DeepL + MyMemory, auto-translate new rules) | Done |
| Product image gallery (swipeable, cached) | Done |
| Backup & restore (JSON export/import) | Done |
| Robotoff AI insights (15min cache) | Done |
| Scan result overlay (instant feedback on scan) | Planned |
| CSV / JSON catalog export | Planned |

## 15. Known Issues

1. **TypeScript type-check errors** (`npx tsc --noEmit`): 5 errors
   - `app/(tabs)/_layout.tsx:8` — `TranslationKey` type not found/imported (2 errors, regression)
   - `OcrCameraSheet.tsx:242` — `string` not assignable to `"ingredients" | "nutrition" | undefined`
   - `CatalogScreen.tsx:320` — `string` not assignable to translation key union type
   - `ProductScreen.tsx:352` — `string` not assignable to `ScanStatus`
2. **Lint (CRLF)**: 13,741 `prettier/prettier` errors from Windows line endings on WSL/Linux — fixable via `npm run lint:fix`
3. Previous `FilterRuleRepository`/`FilterScreen` type errors (referencing `created_at` on `NewFilterRule`) still present alongside the new errors

## 16. Non-Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| NF-01 | Scan-to-Result < 10s | Done |
| NF-02 | Fully local on device (no backend) | Done |
| NF-03 | All data stays on device | Done |
| NF-04 | Operating cost 0€ | Done |
| NF-05 | Modular & testable (SOLID) | Done |
| NF-06 | No ads, no tracking, no analytics | Done |
