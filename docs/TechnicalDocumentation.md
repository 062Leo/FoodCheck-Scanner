# Technical Documentation — FoodCheck

## 1. Project Overview

**FoodCheck** is a React Native (Expo) mobile app for iOS and Android that scans food product barcodes and instantly evaluates them for unhealthy ingredients and processing levels. The app uses the Open Food Facts API for product data and on-device ML Kit for OCR.

- **Language:** TypeScript (strict mode)
- **Framework:** Expo SDK 54 (managed workflow) with Expo Router; `App/index.ts` only imports `expo-router/entry` — there is no separate root component
- **State:** Zustand (4 stores)
- **Database:** expo-sqlite (SQLite)
- **OCR:** @react-native-ml-kit/text-recognition (on-device, default) + Open Food Facts Cloud Vision pipeline (opt-in, after explicit consent)
- **Translation:** DeepL API + MyMemory API (via the domain `Translator` interface)
- **Credentials:** expo-secure-store
- **Navigation:** Expo Router file-based routing (`App/app/`)

## 2. Architecture

The app follows a layered architecture. Each layer instantiates and calls into the ones below it; `domain/` stays framework-agnostic.

```
┌───────────────────────────────────────────┐
│  app/            Expo Router routes (thin) │
├───────────────────────────────────────────┤
│  src/screens/    Screen components         │
├───────────────────────────────────────────┤
│  src/features/   Screen-specific hooks     │
│                  and subcomponents         │
├───────────────────────────────────────────┤
│  src/services/   Orchestration: lookup,    │
│                  edit, re-rating, rule     │
│                  translation               │
├───────────────────────────────────────────┤
│  src/domain/     Pure business logic:      │
│                  rating, rules, forms,     │
│                  barcode, catalog, OCR     │
├───────────────────────────────────────────┤
│  src/infrastructure/  Adapters: API, DB,   │
│                  OCR, network, translation │
└───────────────────────────────────────────┘
```

The design system lives in `src/ui/` (design tokens, base components, status components, form fields) and is used by screens and features directly. `src/testing/` holds shared test fixtures and a real-SQLite-on-`node:sqlite` double for `expo-sqlite`, used by the database and repository tests.

**Principles:** SOLID, Dependency Inversion, Single Responsibility.

### Layer Constraints

- `domain/` — framework-agnostic: no React, React Native, Expo, Zustand, or persistence imports.
- `infrastructure/` — wraps external dependencies (SQLite, fetch, ML Kit, SecureStore); may import from `domain/` for interfaces and types.
- `services/` — combines repositories, API clients and domain logic into the operations a screen needs (lookup, save/edit, re-rate, translate a rule).
- `types/` — pure, zero dependencies, imported by all layers.
- `screens/` and `features/` — instantiate domain classes, services and infrastructure repositories directly.

## 3. Directory Structure

```
App/
├── app/                        # Expo Router file-based routes
│   ├── (tabs)/                 # Scanner, Catalog, Favorites, Settings tabs
│   ├── settings/                # filters, api-key (translation), about
│   ├── edit/[ean].tsx
│   └── result.tsx
├── src/
│   ├── screens/
│   │   ├── ScannerScreen.tsx          # Camera + barcode detection + scan result card
│   │   ├── ProductScreen.tsx          # Traffic-light hero + product details
│   │   ├── CatalogScreen.tsx          # Scanned product list: search, filter, sort
│   │   ├── FavoritesScreen.tsx        # Favorite product list
│   │   ├── FilterScreen.tsx           # Custom filter rules management
│   │   ├── SettingsScreen.tsx         # Settings hub (grouped list rows)
│   │   ├── ApiKeyScreen.tsx           # Translation provider + API key management
│   │   ├── AboutScreen.tsx            # Guide, rating explanation, privacy, data source
│   │   └── EditProductScreen.tsx      # Product edit + OFF contribution (OCR, upload)
│   ├── features/                # Screen-specific hooks and subcomponents
│   │   ├── scanner/                   # useScanSession, ScanGate, ScanResultCard, ManualEntrySheet
│   │   ├── product/                   # useProductDetails, useRobotoffInsights, FindingsList, IngredientsSection
│   │   ├── edit/                      # useProductEditForm, LanguagePicker
│   │   ├── filters/                   # RuleEditorSheet
│   │   └── catalog/                   # useProductListActions (open/favorite/edit/delete + undo)
│   ├── services/
│   │   ├── ProductLookupService.ts    # Cache-first lookup, merge, rate, persist
│   │   ├── ProductEditService.ts      # Load/save an edit session, contribute to OFF
│   │   ├── CatalogRatingService.ts    # Re-rates stored products when rules/logic change
│   │   └── RuleTranslationService.ts  # Translates a new rule keyword into search languages
│   ├── components/               # Shared, screen-agnostic components
│   │   ├── ProductCard.tsx            # Reusable product list row
│   │   ├── SkeletonLoading.tsx, Toast.tsx, Accordion.tsx
│   │   ├── OcrCameraSheet.tsx         # Camera → crop → review OCR sheet
│   │   ├── OffAccountSetup.tsx        # OFF credential setup modal
│   │   ├── ImageGallery.tsx           # Swipeable product image gallery
│   │   └── NutritionTable.tsx         # Full nutrition facts table
│   ├── store/                    # Zustand stores
│   │   ├── catalogStore.ts, filterStore.ts, languageStore.ts, settingsStore.ts
│   │   └── reloadStores.ts            # Reloads all stores after a backup restore
│   ├── i18n/
│   │   ├── translations.ts            # DE/EN UI strings (~800 keys)
│   │   ├── useTranslation.ts, languageLabel.ts, categoryLabels.ts
│   ├── domain/
│   │   ├── analysis/
│   │   │   ├── RedFlagAnalyzer.ts      # Ingredients + nutrients → red flags (pure)
│   │   │   ├── IngredientMatching.ts   # Span-based text matching primitives
│   │   │   ├── NovaScoreEvaluator.ts   # Nova 1-4 → label + color
│   │   │   ├── ProductRating.ts        # Red flags + Nova → status + reasons
│   │   │   ├── rateProduct.ts          # Single entry point (falls back to built-in defaultRules)
│   │   │   ├── IngredientParser.ts     # Ingredient list tokenizing
│   │   │   ├── IngredientTaxonomy.ts   # Additive risk/function-class lookup
│   │   │   ├── ProductNormalizer.ts    # Open Food Facts JSON ↔ Product
│   │   │   ├── RobotoffInsightAnalyzer.ts
│   │   │   ├── defaultRedFlagRules.ts  # Re-exports domain/rules/defaultRules (fallback only)
│   │   │   ├── AdditiveTaxonomyTypes.ts, AdditiveTaxonomyData.ts
│   │   │   └── __fixtures__/           # Golden rating fixtures for 32 reference products
│   │   ├── product/
│   │   │   ├── productForm.ts          # Edit-form parsing, validation, OFF payload mapping
│   │   │   ├── editedFields.ts         # Which fields the user changed (kept across OFF refreshes)
│   │   │   ├── mergeProductData.ts     # Combines fresh OFF data with local edits
│   │   │   └── productName.ts
│   │   ├── barcode/barcode.ts          # EAN-8/EAN-13/UPC-A check-digit validation
│   │   ├── catalog/catalogQuery.ts     # Filter, search, sort, counts for the catalog
│   │   ├── ocr/
│   │   │   ├── nutritionLabel.ts       # Pure parser for recognised nutrition tables
│   │   │   └── ocrGeometry.ts          # Maps a crop selection onto the captured photo
│   │   ├── translation/Translator.ts   # Translation interface
│   │   └── rules/
│   │       ├── defaultRules.ts         # Small hardcoded fallback rule list
│   │       ├── seedRules.ts            # 678 seed red-flag rules (DB seed, migration 2)
│   │       ├── ruleGroups.ts           # Groups rules by category for the Filter Rules screen
│   │       └── ingredientTranslations.ts # Multi-language ingredient search terms
│   ├── infrastructure/
│   │   ├── api/
│   │   │   ├── OpenFoodFactsClient.ts       # Read client (GET), 8 s timeout
│   │   │   ├── OpenFoodFactsWriteClient.ts  # Write client (POST), staging/production
│   │   │   ├── OffOcrClient.ts              # OFF Cloud Vision OCR (consent-gated)
│   │   │   ├── RobotoffClient.ts            # Robotoff AI predictions, 15 min cache
│   │   │   ├── fetchWithTimeout.ts          # fetch with AbortController timeout
│   │   │   ├── config.ts                    # Base URLs, write environment, app UUID
│   │   │   ├── debounce.ts / retry.ts       # Utility decorators
│   │   │   └── ApiError.ts                  # Error types
│   │   ├── ocr/
│   │   │   ├── OcrService.ts                # ML Kit text recognition wrapper
│   │   │   └── OcrPreprocessor.ts           # Image resize + quality estimate
│   │   ├── translation/
│   │   │   ├── DeepLClient.ts, MyMemoryClient.ts, TranslationRouter.ts
│   │   ├── network/connectivity.ts     # isOnline() / subscribeToConnectivity()
│   │   └── db/
│   │       ├── DatabaseService.ts       # SQLite init + 8 migrations
│   │       ├── ProductRepository.ts     # CRUD, scan vs. refresh vs. edit writes
│   │       ├── FavoritesRepository.ts   # CRUD for favorites
│   │       ├── FilterRuleRepository.ts  # CRUD for filter rules
│   │       └── BackupService.ts         # Raw SQLite file backup/restore
│   ├── testing/                  # Test-only helpers (not shipped)
│   │   ├── nodeSqlite.ts               # expo-sqlite double backed by node:sqlite
│   │   ├── testDatabase.ts             # useTestDatabase() + productRecord() fixture
│   │   ├── databaseFixtures.ts, screenMocks.ts
│   ├── shared/errors.ts          # getErrorMessage()
│   └── types/
│       ├── Product.ts, ScanResult.ts, FilterRule.ts, Robotoff.ts, global.d.ts
├── assets/
├── app.json                 # Expo config (newArchEnabled: true)
├── eas.json                  # EAS build profile (production → Android .apk)
├── tsconfig.json             # extends expo/tsconfig.base, strict: true
├── eslint.config.mjs         # ESLint flat config (ESLint 10)
├── jest.config.js / jest.integration.config.js
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
| @react-native-community/netinfo | Connectivity check for the offline fallback |
| expo-secure-store | Secure credential storage for the OFF account + translation API keys |
| expo-image-manipulator | OCR photo preprocessing (resize, crop) |
| expo-file-system | Backup file read/write, image folders |
| expo-document-picker | Picking a backup file to restore |
| expo-haptics | Scan/save feedback |
| expo-build-properties | Android SDK version pins |
| Jest + jest-expo | Unit testing (49 suites, 411 tests) |
| ESLint 10 (flat config) + Prettier | Code quality & formatting |

## 5. Data Flow

### 5.1 Scan Flow

```
User points the camera at a barcode
  → ScannerScreen (expo-camera onBarcodeScanned, EAN-13/EAN-8/UPC-A)
  → useScanSession.onBarcode(raw)
      → normalizeBarcode(raw): check-digit validation; UPC-A → EAN-13
      → ScanGate.tryAcquire(): one lookup at a time; a code still in view is not
        looked up again until it leaves view (ref-based, not React state)
  → ProductLookupService.lookup(ean, 'scan', rules)
      1. ProductRepository.findByEan(ean)              [local cache]
      2. Offline? Show the cached product, or "offline" if there is none.
      3. Online: OpenFoodFactsClient.getProductByEan(ean), 8 s timeout
         (fetchWithTimeout); on timeout/server error, fall back to the cached
         product if there is one.
      4. mergeProductData(fresh, cached, editedFields): a locally edited field
         keeps the user's value; everything else takes the fresh OFF data.
      5. rateProduct(product, rules) → ScanResult (status + reasons)
      6. ProductRepository.saveScan(record): counts as a visit
  → Result shown as a card over the camera (ScanResultCard); the camera keeps
    running so the next product can be scanned immediately.
  → Tapping the card opens ProductScreen from the freshly stored data
    (no second network request); typing a barcode in while a lookup runs
    queues it instead of dropping it.
```

Barcodes typed manually (`ManualEntrySheet`) or retried from the card go through the same `ScanGate`/`ProductLookupService` path with `explicit = true`, skipping the repeat-suppression window.

### 5.2 OCR & Edit/Contribution Flow

```
Product details → Edit icon → EditProductScreen (useProductEditForm)
  → ProductEditService.open(ean): loads the stored product, or an empty form
    for a new barcode; nothing is written until the user saves.
  → OCR (OcrCameraSheet): camera → optional crop → recognition → review
      - Ingredients / nutrition table: OcrService.recognizeText() (ML Kit,
        on-device, default)
      - Optional, after an explicit consent dialog naming the target server:
        OffOcrClient uploads the photo to Open Food Facts and polls for the
        Google Cloud Vision result
      - Nutrition table text → OcrService.parseNutriments() /
        domain/ocr/nutritionLabel.ts (pure parser)
  → Manual editing, or translation per language (DeepL/MyMemory via
    TranslationRouter)
  → "Save":
      1. productForm.applyForm(): comma decimals and "<0,5" accepted, values
         validated
      2. rateProduct() re-rates the product
      3. editedFields.changedFields() records which fields changed
      4. ProductRepository.saveEdit() stores product + edited_fields,
         sets edited_at
  → "Send to Open Food Facts" (after confirmation, listing the fields to be
    sent): saves locally first, then
      OpenFoodFactsWriteClient.updateProduct() → staging server in
      development builds, production in release builds
      (EXPO_PUBLIC_OFF_WRITE_ENV overrides)
  → Navigates back to ProductScreen, which reloads the saved data locally
    (no network call).
```

## 6. Database Schema

### `meta`
```sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```
Tracks the migration version (`schema_version`) and other metadata (rating fingerprint, backup folder/auto-backup/last-backup time).

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
  last_seen_at           TEXT,
  edited_at              TEXT,
  edited_fields          TEXT
);
```
`edited_at` marks a product as locally edited, so a fresh Open Food Facts fetch no longer silently overwrites the user's corrections. `edited_fields` is a JSON array of the fields the user actually changed (see `domain/product/editedFields.ts`); `NULL` with `edited_at` set means "edited before field tracking existed" and is treated as every editable field being edited.

### `favorites`
```sql
CREATE TABLE IF NOT EXISTS favorites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at   TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_favorites_product_id ON favorites(product_id);
```

### `filter_rules`
```sql
CREATE TABLE IF NOT EXISTS filter_rules (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT NOT NULL,     -- 'ingredient' | 'nutrient'
  key          TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT '',
  threshold    REAL,
  operator     TEXT,              -- 'gt' | 'lt' | 'eq'
  severity     TEXT NOT NULL,     -- 'red_flag' | 'ok'
  translations TEXT,              -- JSON: { [languageCode]: term }
  created_at   TEXT NOT NULL
);
```

### Migrations (`DatabaseService`, version 8)

| Version | Migration | Description |
|---------|-----------|-------------|
| 1 | `createInitialSchema` | Create products, favorites, filter_rules tables |
| 2 | `seedDefaultFilterRules` | Seed 678 red-flag rules from `seedRules.ts` |
| 3 | `addProductStorageColumns` | Add data_version, last_api_fetch, 4 image columns |
| 4 | `addVisitTrackingColumns` | Add visit_count, last_seen_at |
| 5 | `addCategoryColumn` | Add category column; backfill missing seed rules and categories |
| 6 | `addTranslationsColumn` | Add translations (JSON) for multi-language rule keywords |
| 7 | `addFavoritesUniquenessAndEditTracking` | Deduplicate favorites + unique index; add products.edited_at, backfilled from raw_json markers left by the old edit screen |
| 8 | `addEditedFieldsColumn` | Add products.edited_fields |

Migrations are append-only and run inside a transaction (or sequentially where the platform has no transaction API); a database newer than the app's `DATABASE_VERSION` is left untouched with a warning instead of being downgraded.

## 7. External APIs

### Open Food Facts Read API

| Property | Value |
|---|---|
| Endpoint | `GET https://world.openfoodfacts.org/api/v2/product/{ean}.json` |
| Auth | User-Agent header |
| Timeout | 8 s (`fetchWithTimeout`); on timeout/offline the cached product is shown instead |
| Product found | `status: 1` |
| Product not found | `status: 0` |

### Open Food Facts Write API

| Property | Value |
|---|---|
| Endpoint | `POST {WRITE_BASE_URL}/cgi/product_jqm2.pl` |
| Target | `https://world.openfoodfacts.net` (staging) in development builds, `https://world.openfoodfacts.org` (production) in release builds; `EXPO_PUBLIC_OFF_WRITE_ENV` overrides |
| Auth | `user_id` + `password` in the form body, entered once and stored via expo-secure-store |
| Required fields | `code`, `user_id`, `password`, `product_name` |
| Success | Read from the JSON status field (not "response contains a 1") |
| Multi-language | `product_name_de`, `ingredients_text_de`, etc. |

### Robotoff API

| Property | Value |
|---|---|
| Endpoint | `GET https://robotoff.openfoodfacts.org/api/v1/insights/{ean}` |
| Purpose | AI-predicted categories, labels, ingredients, shown with a confidence bar |
| Cache | 15-minute in-memory cache in `RobotoffClient`; only fetched when the product is shown from a live/local source, not from the offline cache |

### Open Food Facts OCR (Google Cloud Vision)

| Property | Value |
|---|---|
| Used | Only after an explicit consent dialog naming the target server; on-device ML Kit recognition is the default |
| Upload | `POST {WRITE_BASE_URL}/cgi/product_image_upload.pl`, language-specific `imagefield` (`ingredients_<lang>` / `nutrition_<lang>`), makes the photo public under the user's account |
| Polling | `GET {WRITE_IMAGES_URL}/images/products/{barcodePath}/{imgid}.json`, up to 10 attempts, 2 s interval, 8 s timeout per attempt |
| Client | `OffOcrClient` |

## 8. Translation Providers

| | DeepL Free | MyMemory |
|---|---|---|
| Endpoint | `POST https://api-free.deepl.com/v2/translate` | `GET https://api.mymemory.translated.net/get` |
| Auth | Header `DeepL-Auth-Key <key>` | Query `&key=<key>` (optional) |
| Without key | Not usable | 5,000 words/day (anonymous) |
| With key (free) | 500,000 chars/month | 10,000 words/day |
| Timeout | via `fetchWithTimeout` | 10 s |
| Key storage | expo-secure-store | expo-secure-store |

- `domain/translation/Translator.ts` — interface with `translate(text, targetLang?)`
- `DeepLClient` and `MyMemoryClient` both implement `Translator`
- `TranslationRouter` delegates to the provider chosen in `settingsStore` (default: MyMemory)
- MyMemory quota/input errors arrive as HTTP 200 with the error text in the translation field; only a `responseStatus` of 200 is treated as a real result
- `RuleTranslationService.translateRuleKeyword()` translates a new filter-rule keyword into all 7 ingredient search languages in parallel (`Promise.allSettled`); a failed language is simply skipped

## 9. Domain Logic

### Red Flag Analysis (`RedFlagAnalyzer`)

- `analyze(ingredientsText, rules?, nutriments?)`: applies ingredient keyword rules and nutrient threshold rules; `analyzeTaxonomy(ingredientsText, rules?)`: additionally flags medium/high-risk additives from the built-in taxonomy that no keyword rule already covers. `ProductRating` merges both, deduplicating by ingredient name/E-number.
- Matching is span-based (`IngredientMatching.ts`, `IngredientStructure`): a match inside a longer match of another rule is dropped (e.g. "sugar" inside "Zuckerkulör"), E-numbers need code boundaries (`E140` does not match `E1400`) and recognise spaced forms (`E 330`).
- One finding per substance: the same E-number counts once; a bare key and its suffixed form (`E500` / `E500ii`), and interchangeable family members (`E150a–d`), count once; distinct family members (`E472a` vs `E472c`) count separately.
- Functional class labels (Emulsifier, Colour, …) only count when nothing more specific was found in the same ingredient item.
- Context-bound words (`Amaranth`, `Caramel`) only count as colours in a colour context within the same ingredient.
- `ok`-severity rules whitelist an ingredient (by key, translation, or resolved E-number) or a nutrient condition, suppressing both keyword and taxonomy findings for it; an `ok` nutrient rule only whitelists while its own condition holds.
- Nutrient rules are evaluated against `product.nutriments` (sugars_100g, fat_100g, saturated-fat_100g, salt_100g, energy-kcal_100g), not against the ingredient text.
- Built-in data: 678 seed ingredient rules across 18 categories (19 category presets are offered when adding a new rule), plus an additive taxonomy of ~160 E-numbers with risk levels (`none`/`low`/`medium`/`high`) and function classes (`AdditiveTaxonomyData.ts`). A small hardcoded `defaultRules` list is used only as a last-resort fallback if no rules are available at all.

### Nova Score Evaluation

- `NovaScoreEvaluator.evaluate(novaGroup)` → label + colour for Nova 1 (unprocessed) through Nova 4 (ultra-processed); an invalid or missing Nova value is treated as "unknown", never as Nova 1.

### Product Rating (`ProductRating.rate`)

- **Critical**: Nova 4, or 3 or more red flags (`CRITICAL_RED_FLAG_COUNT`)
- **Warning**: 1–2 red flags, or Nova 3
- **Unknown**: no ingredient list, no Nova score, and no nutrient-rule finding (i.e. `redFlagCount === 0`)
- **OK**: none of the above
- The result also carries machine-readable `reasons` (`nova`, `redFlags`, `ingredientsMissing`, `insufficientData`, `noFindings`) used to build the "why" text shown in the UI.
- `rateProduct()` (`domain/analysis/rateProduct.ts`) is the single entry point used by the scanner, the product screen and the edit screen.
- `CatalogRatingService` re-rates every stored product (in batches of 25, yielding to the UI thread) whenever the rule set or the rating logic changes. A fingerprint (`RATING_LOGIC_VERSION` + a hash of all rules) stored in `meta.rating_fingerprint` decides whether a re-rate is needed; `RATING_LOGIC_VERSION` is bumped whenever a change in the rating code would alter results, forcing a one-time recompute for existing installs.

## 10. UI Design Tokens (`src/ui/theme.ts`)

```
Background:      #121212      Surface:        #1E1E1E
Text:            #FFFFFF      Text Secondary: #BDBDBD
Text Muted:      #9E9E9E      Accent:         #4CAF50

Status OK:       #4CAF50      Status Warning: #FFC107
Status Critical: #EF5350      Status Unknown: #9E9E9E

Nova 1: #4CAF50   Nova 2: #8BC34A   Nova 3: #FFC107   Nova 4: #EF5350
Nutri-Score A–E:  #038141 · #85BB2F · #FECB02 · #EE8100 · #E63E11
```

All colours are design tokens (`colors`, `spacing`, `radius`, `typography`, `TOUCH_TARGET = 48`); no component uses a colour literal. Contrast against the background is documented in `theme.ts` (text 18.7:1, accent 6.7:1, all filled status/accent surfaces ≥ 4.5:1 using the matching `on*` colour). Shared components live in `src/ui/components.tsx` (`Button`, `IconButton`, `Chip`, `Card`, `ListRow`, `EmptyState`, `PageTitle`, `SectionTitle`, `ScreenHeader`), `src/ui/status.tsx` (`StatusBadge`, `StatusHero`, status icon/label/reason helpers) and `src/ui/FormField.tsx`. Font: system default (SF Pro on iOS, Roboto on Android). Dark mode only (`userInterfaceStyle: "dark"`).

## 11. Navigation

Expo Router file-based routing in `App/app/`:

- **Tabs** (in `(tabs)/` group): Scanner (`index`), Catalog, Favorites, Settings
- **Stack screens**: `result` (Product screen, params: `ean`, `source: 'scan' | 'recent' | 'view'`), `edit/[ean]` (params: `ean`, `then: 'show'` to return to the product after saving)
- **Settings sub-routes**: `settings/filters`, `settings/api-key` (translation provider & key), `settings/about` (guide, rating explanation, privacy, data source)

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
| `app/settings/about.tsx` | `/settings/about` |

## 12. Testing

- **Framework:** Jest with the `jest-expo` preset
- **Count:** 49 suites, 411 tests (all passing; measured with `npx jest --maxWorkers=2 --silent`)
- **Location:** `__tests__/` directories alongside source files
- **No snapshot tests** — all assertion-based `expect()` calls
- **Real SQLite in tests:** database and repository tests run against `node:sqlite` through a test double (`src/testing/nodeSqlite.ts`, `useTestDatabase()`), not string-matching mocks; migration tests start from literal legacy schemas with seeded data and check data survival, idempotency and rollback of a failing migration
- **Golden ratings:** `src/domain/analysis/__fixtures__/` pins the rating output (status, Nova, red flags) of 32 realistic reference products under the seeded and a customised rule set, so a refactor either reproduces the same ratings or shows a reviewed diff
- **Run all tests:** `npm test`
- **Run a single file:** `npm test -- --testPathPattern=RedFlagAnalyzer`
- **Integration tests:** `npm run test:integration` (`jest.integration.config.js`) exercise the real Open Food Facts API; opt-in only, and forced to the staging server regardless of environment

### Test coverage by module

| Module | Test files | Focus |
|---|---|---|
| API Clients | OpenFoodFactsClient, OpenFoodFactsWriteClient, OffOcrClient, fetchWithTimeout, retry, debounce, config, ApiError, staging integration | HTTP, auth, timeouts, error handling |
| DB / Repositories | ProductRepository, FilterRuleRepository, FavoritesRepository, migrations, BackupService | CRUD, migrations, backup/restore against real SQLite |
| Domain Analysis | RedFlagAnalyzer, RedFlagMatching, IngredientParser, IngredientTaxonomy, NovaScoreEvaluator, ProductRating, golden ratings | Rating rules, matching correctness |
| Domain Product/Catalog/OCR/Barcode | productForm, catalogQuery, nutritionLabel, ocrGeometry, barcode | Validation, parsing, pure logic |
| Domain Rules | ingredientTranslations, ruleGroups | Multi-language lookup, grouping/sorting |
| Services | ProductLookupService, ProductEditService, CatalogRatingService | Cache-first lookup, edit tracking, re-rating |
| OCR / Translation | OcrService, DeepLClient, MyMemoryClient | Recognition, quota/error handling |
| Screens / Features | CatalogScreen, EditProductScreen, FilterScreen, ProductScreen, ScannerScreen, SettingsScreen, ScanGate, RuleEditorSheet, OcrCameraSheet | Screen behaviour with React Native Testing Library |

## 13. Commands (run from `App/`)

| Command | Description |
|---|---|
| `npm start` | Expo dev server |
| `npm run android` | Run on connected Android device |
| `npm run ios` | Run on connected iOS device |
| `npm run web` | Run in browser |
| `npm run typecheck` | TypeScript type-check (`tsc --noEmit`) |
| `npm run lint` / `npm run lint:fix` | ESLint check / auto-fix |
| `npm run format` / `npm run format:check` | Prettier write / check |
| `npm test` | Run all Jest unit tests |
| `npm run test:integration` | Run the Open Food Facts staging integration tests (opt-in) |
| `npm run doctor` | `expo-doctor` project health check |
| `npm run bundle:check` | `expo export` for Android, verifying the bundle builds |
| `npm run check` | Runs typecheck, lint, format:check, test, doctor and bundle:check in sequence — the full quality gate |

## 14. Feature Status

| Feature | Status |
|---|---|
| Barcode scanning (EAN-8/EAN-13/UPC-A) with check-digit validation | Done |
| Manual barcode entry | Done |
| Scan result card (scan in a row without leaving the camera) | Done |
| OFF API product lookup with offline/cache fallback | Done |
| Red flag ingredient analysis (678 rules, additive-risk taxonomy) | Done |
| Nova classification and traffic-light rating (OK/Warning/Critical/Unknown) | Done |
| Local catalog (SQLite) with search, filter, sort, undoable delete | Done |
| Favorites with undoable remove | Done |
| Offline cache for scanned products (7-day stale indicator) | Done |
| Custom filter rules (ingredient + nutrient, category grouping, auto-translation) | Done |
| Multi-language ingredient search (7 languages + English key) | Done |
| OCR ingredients & nutrition table (on-device ML Kit by default) | Done |
| Open Food Facts cloud OCR (explicit consent) | Done |
| OFF contribution/upload flow with confirmation and field tracking | Done |
| Editable product form (8 languages, OCR, translation, validation) | Done |
| Translation (DeepL + MyMemory, auto-translate new rules) | Done |
| Product image gallery (swipeable) | Done |
| Backup & restore (raw SQLite file, validated, safety copy, rollback) | Done |
| Robotoff AI insights (15 min cache) | Done |
| CSV / JSON catalog export | Planned |

## 15. Known Issues

- `npm run typecheck` — clean (0 errors)
- `npm run lint` — clean (0 errors, ESLint 10 flat config)
- `npm test` — 49 suites, 411 tests, all passing
- `npm run test:integration` requires network access to the OFF staging server and is not part of `npm run check`

## 16. Non-Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| NF-01 | Scan-to-Result < 10s | Done (8 s request timeout, cache-first) |
| NF-02 | No backend of the app's own | Done |
| NF-03 | Catalog, favorites, rules and backups stay on the device; only the scanned barcode (to Open Food Facts), ingredient text you translate (to the chosen provider) and details/photos you explicitly send go elsewhere | Done |
| NF-04 | Operating cost 0€ | Done |
| NF-05 | Modular & testable (SOLID) | Done |
| NF-06 | No ads, no tracking, no analytics | Done |
