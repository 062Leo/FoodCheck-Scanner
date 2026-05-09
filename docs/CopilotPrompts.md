# GitHub Copilot Prompts – FoodScanner

Paste each prompt into the Copilot Chat panel in VS Code.
Always attach the listed context files before sending.

---

## Milestone 2 – Katalog & Favoriten

---

### Prompt M2-1 · Database Schema & Service

**Attach:** `02_Systemarchitektur.md`, `src/types/Product.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Implement the SQLite database layer.

Create the following file:
- `src/infrastructure/db/DatabaseService.ts`
  - Initialize expo-sqlite database
  - Create all three tables on first launch: `products`, `favorites`, `filter_rules`
  - Use versioned migrations (version stored in a `meta` table)
  - Schema must exactly match the SQL defined in 02_Systemarchitektur.md section 4
  - Export a singleton `db` instance and an `initDatabase()` function

Rules:
- TypeScript strict mode, no `any`
- Every async operation wrapped in try/catch, never silent fails
- Single responsibility: this file only handles init and migrations, no CRUD

When done, update TODO.md: mark `infrastructure/db/DatabaseService.ts` as done (change `- [ ]` to `- [x]`).
```

---

### Prompt M2-2 · ProductRepository

**Attach:** `02_Systemarchitektur.md`, `src/types/Product.ts`, `src/infrastructure/db/DatabaseService.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Implement the ProductRepository.

Create the following file:
- `src/infrastructure/db/ProductRepository.ts`
  - `insert(product: ProductRecord): Promise<void>` — insert or replace by EAN
  - `findByEan(ean: string): Promise<ProductRecord | null>`
  - `findAll(): Promise<ProductRecord[]>` — sorted by `scanned_at` DESC
  - `deleteByEan(ean: string): Promise<void>`

The `ProductRecord` type should include: id, ean, name, brands, ingredients, nova_score, nutriscore, raw_json, scanned_at, rating.
Define it in `src/types/Product.ts` if not already there.

Rules:
- Use the `db` singleton from DatabaseService
- TypeScript strict, no `any`
- Each method has its own try/catch with descriptive error messages
- Single responsibility: only CRUD, no business logic

Also create:
- `src/infrastructure/db/__tests__/ProductRepository.test.ts`
  - Mock expo-sqlite
  - Test: insert → findByEan returns correct record
  - Test: findAll returns records sorted by date
  - Test: deleteByEan removes record

When done, update TODO.md: mark `ProductRepository.ts` and its unit tests as done.
```

---

### Prompt M2-3 · FavoritesRepository

**Attach:** `02_Systemarchitektur.md`, `src/infrastructure/db/DatabaseService.ts`, `src/infrastructure/db/ProductRepository.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Implement the FavoritesRepository.

Create the following file:
- `src/infrastructure/db/FavoritesRepository.ts`
  - `add(productId: number): Promise<void>`
  - `remove(productId: number): Promise<void>`
  - `findAll(): Promise<ProductRecord[]>` — JOIN with products table, sorted by `added_at` DESC
  - `isFavorite(productId: number): Promise<boolean>`

Rules:
- Use the `db` singleton from DatabaseService
- TypeScript strict, no `any`
- Each method has its own try/catch
- ON DELETE CASCADE is already in the schema — do not re-implement it in code

Also create:
- `src/infrastructure/db/__tests__/FavoritesRepository.test.ts`
  - Test: add → isFavorite returns true
  - Test: add → remove → isFavorite returns false
  - Test: findAll returns only favorited products

When done, update TODO.md: mark `FavoritesRepository.ts` and its unit tests as done.
```

---

### Prompt M2-4 · catalogStore

**Attach:** `02_Systemarchitektur.md`, `src/infrastructure/db/ProductRepository.ts`, `src/infrastructure/db/FavoritesRepository.ts`, `src/types/Product.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Implement the Zustand catalog store.

Create the following file:
- `src/store/catalogStore.ts`
  - State: `products: ProductRecord[]`, `favorites: ProductRecord[]`, `isLoading: boolean`
  - Actions:
    - `loadAll()` — load products and favorites from their repositories
    - `addProduct(product: ProductRecord)` — insert via ProductRepository, then reload
    - `deleteProduct(ean: string)` — delete via ProductRepository, then reload
    - `toggleFavorite(productId: number)` — add or remove via FavoritesRepository, then reload favorites

Rules:
- Use Zustand (already installed)
- Store holds state only — no business logic, no direct SQLite calls (use repositories)
- TypeScript strict, no `any`
- All async actions handle errors gracefully (set isLoading false in finally block)

When done, update TODO.md: mark `catalogStore.ts` as done.
```

---

### Prompt M2-5 · Scan-to-DB Integration

**Attach:** `02_Systemarchitektur.md`, `src/store/catalogStore.ts`, `src/screens/ResultScreen/ResultScreen.tsx`, `src/types/ScanResult.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Wire the scan result into the database and add the favorites toggle to ResultScreen.

Changes needed:

1. In the ResultScreen (or wherever the scan result is processed after the API call):
   - After a successful analysis, call `catalogStore.addProduct(...)` to persist the result
   - Map the ScanResult + product data into a `ProductRecord` before saving
   - Do NOT block the UI — save in the background (fire-and-forget with error logging)

2. In `ResultScreen.tsx`:
   - Add a star icon button (★) in the top-right header area
   - On mount, check `catalogStore` whether the current product is already a favorite
   - Tapping the star calls `catalogStore.toggleFavorite(productId)`
   - Star is filled when favorite, outlined when not
   - Show haptik feedback on toggle (Haptics.impactAsync)

Rules:
- No business logic in the screen — delegate everything to the store
- TypeScript strict, no `any`
- If the product has not been saved yet (new scan), save it first, then toggle favorite

When done, update TODO.md: mark "Scan-Flow erweitern" and "ResultScreen Favoriten-Toggle" as done.
```

---

### Prompt M2-6 · CatalogScreen

**Attach:** `02_Systemarchitektur.md`, `03_UX-Konzept.md`, `src/store/catalogStore.ts`, `src/types/Product.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: 02_Systemarchitektur.md. UI reference: 03_UX-Konzept.md section 3.3.

Task: Implement the CatalogScreen.

Create `src/screens/CatalogScreen/CatalogScreen.tsx`:
- FlatList of all scanned products from `catalogStore.products`
- Call `catalogStore.loadAll()` on mount
- Each row shows: product name, brand, scan date, rating color dot, Nova score, favorite star
- Tapping a row navigates to ResultScreen — pass the cached `raw_json` so no new API call is made
- Filter chips at the top: All / OK / Warning / Critical — filter the list client-side
- Swipe-to-delete (React Native Reanimated or simple TouchableOpacity solution):
  - Show a red delete area on swipe left
  - On confirm: call `catalogStore.deleteProduct(ean)`
- Star icon in each row toggles favorite inline via `catalogStore.toggleFavorite(productId)`
- Empty state: centered text "No products scanned yet"

Color coding for rating dots/rows must match the design tokens in 03_UX-Konzept.md section 5:
- ok → #4CAF50, warning → #FFC107, critical → #F44336

Rules:
- TypeScript strict, no `any`
- No direct DB calls — use catalogStore only
- Keep the component under 150 lines; extract row into `src/components/ProductCard/ProductCard.tsx` if needed

When done, update TODO.md: mark `CatalogScreen` and filter chips as done.
```

---

### Prompt M2-7 · FavoritesScreen & Tab Navigation

**Attach:** `02_Systemarchitektur.md`, `03_UX-Konzept.md`, `src/store/catalogStore.ts`, `src/screens/CatalogScreen/CatalogScreen.tsx`, `app/(tabs)/_layout.tsx`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: 02_Systemarchitektur.md. UI reference: 03_UX-Konzept.md section 3.4.

Task: Implement FavoritesScreen and activate all 3 tabs.

1. Create `src/screens/FavoritesScreen/FavoritesScreen.tsx`:
   - Same list structure as CatalogScreen, but only shows `catalogStore.favorites`
   - No filter chips needed
   - Empty state: "No favorites yet – tap ★ on a scan result to save it"
   - Tapping a row navigates to ResultScreen with cached data (no new API call)
   - Star icon in each row toggles favorite via `catalogStore.toggleFavorite(productId)`

2. Update `app/(tabs)/_layout.tsx`:
   - Activate all 3 tabs: Scanner, Catalog, Favorites
   - Use appropriate icons (e.g. Ionicons: camera, list, star)
   - Scanner tab remains the default (index 0)

Rules:
- TypeScript strict, no `any`
- No direct DB or API calls in the screen

When done, update TODO.md: mark `FavoritesScreen`, empty states, and tab navigation as done.
```

---

### Prompt M2-8 · Offline Cache View

**Attach:** `02_Systemarchitektur.md`, `src/infrastructure/api/OpenFoodFactsClient.ts`, `src/infrastructure/db/ProductRepository.ts`, `src/screens/ResultScreen/ResultScreen.tsx`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Implement offline fallback for already-scanned products.

Update the scan flow so that when a barcode is scanned:
1. First check `ProductRepository.findByEan(ean)` — if found in local DB:
   - Skip the API call entirely
   - Navigate directly to ResultScreen with the cached data
   - Show a small offline/cached indicator badge ("Cached" or a cloud-off icon) on the ResultScreen
2. If NOT in local DB and device is offline:
   - Show existing Toast "No internet connection" (already implemented)
3. If NOT in local DB and device is online:
   - Proceed with normal API call flow (already implemented)

Rules:
- The cache-first check must happen regardless of network status
- TypeScript strict, no `any`
- Do not duplicate scan logic — refactor into a small helper function if needed

When done, update TODO.md: mark "Offline-Ansicht" as done. Also mark the full Milestone 2 acceptance criteria checkboxes as done if all pass.
```

---

## Milestone 3 – Custom Filter-Regeln

---

### Prompt M3-1 · FilterRule Types & DB Table

**Attach:** `02_Systemarchitektur.md`, `src/infrastructure/db/DatabaseService.ts`, `src/types/`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Finalize FilterRule types and activate the filter_rules table.

1. Create / update `src/types/FilterRule.ts`:
   - `FilterRuleType`: `'ingredient' | 'nutrient'`
   - `FilterRuleSeverity`: `'red_flag' | 'ok'`
   - `FilterRuleOperator`: `'gt' | 'lt' | 'eq'`
   - `FilterRule` interface: id, type, key, threshold (optional), operator (optional), severity, created_at
   - `NewFilterRule` type: same without id and created_at

2. Update `DatabaseService.ts`:
   - Bump the DB version
   - Add migration: CREATE TABLE `filter_rules` if not exists (schema from 02_Systemarchitektur.md section 4)
   - Add seed migration: insert all default hardcoded rules from `src/domain/rules/defaultRules.ts` into `filter_rules` table (run only if table is empty)

Rules:
- TypeScript strict, no `any`
- Migration must be idempotent (safe to run multiple times)

When done, update TODO.md: mark `FilterRule.ts` types and `filter_rules` table activation as done.
```

---

### Prompt M3-2 · FilterRuleRepository

**Attach:** `02_Systemarchitektur.md`, `src/types/FilterRule.ts`, `src/infrastructure/db/DatabaseService.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Implement FilterRuleRepository.

Create `src/infrastructure/db/FilterRuleRepository.ts`:
- `findAll(): Promise<FilterRule[]>`
- `insert(rule: NewFilterRule): Promise<void>`
- `update(id: number, changes: Partial<NewFilterRule>): Promise<void>`
- `deleteById(id: number): Promise<void>`

Also create `src/infrastructure/db/__tests__/FilterRuleRepository.test.ts`:
- Test: insert → findAll includes new rule
- Test: update changes the severity
- Test: deleteById removes the rule

Rules:
- Use `db` singleton from DatabaseService
- TypeScript strict, no `any`
- Each method has its own try/catch

When done, update TODO.md: mark `FilterRuleRepository.ts` as done.
```

---

### Prompt M3-3 · Dynamic RedFlagAnalyzer

**Attach:** `02_Systemarchitektur.md`, `src/domain/analysis/RedFlagAnalyzer.ts`, `src/domain/rules/defaultRules.ts`, `src/types/FilterRule.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Refactor RedFlagAnalyzer to use dynamic rules instead of hardcoded ones.

Update `src/domain/analysis/RedFlagAnalyzer.ts`:
- The `analyze(ingredientsText: string, rules: FilterRule[]): RedFlag[]` function now accepts a `rules` parameter
- Remove the direct import of `defaultRules.ts` from inside the analyzer
- The function remains a pure function (no DB calls, no side effects)
- Backward-compatible: if called without rules, fall back to defaultRules

Update all existing unit tests in `RedFlagAnalyzer.test.ts`:
- Pass rules explicitly in each test
- Add 3 new tests:
  - Custom rule "palmöl = ok" → palmöl no longer flagged
  - Custom rule "zucker = red_flag" → zucker is flagged
  - Nutrient rule with threshold: sugars_100g > 3 → flagged when nutriment value exceeds threshold

Rules:
- Domain layer must stay framework-independent (no expo, no SQLite imports)
- TypeScript strict, no `any`

When done, update TODO.md: mark "RedFlagAnalyzer auf dynamische Regeln" as done.
```

---

### Prompt M3-4 · filterStore

**Attach:** `02_Systemarchitektur.md`, `src/types/FilterRule.ts`, `src/infrastructure/db/FilterRuleRepository.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Implement the Zustand filter store.

Create `src/store/filterStore.ts`:
- State: `rules: FilterRule[]`, `isLoading: boolean`
- Actions:
  - `loadRules()` — load all rules from FilterRuleRepository
  - `addRule(rule: NewFilterRule)` — insert via repository, then reload
  - `updateRule(id: number, changes: Partial<NewFilterRule>)` — update via repository, then reload
  - `deleteRule(id: number)` — delete via repository, then reload

Also update the scan flow (wherever RedFlagAnalyzer is called):
- Before analysis, get current rules from `filterStore.rules`
- Pass them to `RedFlagAnalyzer.analyze(ingredientsText, rules)`
- Call `filterStore.loadRules()` on app start (in root layout or app init)

Rules:
- Store holds state only — no business logic
- TypeScript strict, no `any`

When done, update TODO.md: mark `filterStore.ts` as done.
```

---

### Prompt M3-5 · Filter Management UI

**Attach:** `02_Systemarchitektur.md`, `03_UX-Konzept.md`, `src/store/filterStore.ts`, `src/types/FilterRule.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: 02_Systemarchitektur.md.

Task: Build the Filter Rules management screen.

Create `src/screens/FilterScreen/FilterScreen.tsx`:
- List of all current rules from `filterStore.rules`
- Each row shows: key (ingredient name or nutrient), type badge, severity badge (RED FLAG / OK), delete button
- "Add Rule" button opens a modal/bottom sheet with two tabs:

  Tab 1 – Ingredient Rule:
  - Text input: ingredient keyword (e.g. "palmöl")
  - Toggle: RED FLAG / OK
  - Save button

  Tab 2 – Nutrient Rule:
  - Dropdown: select nutrient (sugars_100g, fat_100g, saturated-fat_100g, salt_100g, energy-kcal_100g)
  - Operator picker: > / < / =
  - Number input: threshold value
  - Toggle: RED FLAG / OK
  - Save button

- Tapping a rule row → edit modal (same form, prefilled)
- Swipe-to-delete or delete icon with confirmation

Add the FilterScreen as a new tab or as a settings route accessible from the tab bar.
Use the dark mode color palette from 03_UX-Konzept.md section 5.

Rules:
- TypeScript strict, no `any`
- All mutations go through filterStore — no direct DB calls in the screen

When done, update TODO.md: mark all Filter UI tasks as done.
```

---

## Milestone 4 – OCR & OFF Contribution

---

### Prompt M4-1 · Setup & Types

**Attach:** `02_Systemarchitektur.md`, `01_Lastenheft.md`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Install dependencies and create the ContributeFormData type.

1. Run the following installs (add to package.json / confirm with user if needed):
   - `@react-native-ml-kit/text-recognition`
   - `expo-secure-store`

2. Create `src/types/ContributeFormData.ts`:
   - `ContributeFormData` interface with these fields:
     - `ean: string`
     - `productName: string` (required)
     - `brands?: string`
     - `categories?: string`
     - `ingredientsText?: string`
     - `nutriments?: NutrimentData`
   - `NutrimentData` interface:
     - `energyKcal100g?: number`
     - `fat100g?: number`
     - `saturatedFat100g?: number`
     - `carbohydrates100g?: number`
     - `sugars100g?: number`
     - `fiber100g?: number`
     - `proteins100g?: number`
     - `salt100g?: number`

Rules:
- TypeScript strict, no `any`
- No logic in this file, types only

When done, update TODO.md: mark setup tasks and `ContributeFormData.ts` as done.
```

---

### Prompt M4-2 · OcrService

**Attach:** `02_Systemarchitektur.md`, `src/types/ContributeFormData.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Implement OcrService.

Create `src/infrastructure/ocr/OcrService.ts`:
- `recognizeText(imageUri: string): Promise<string>` — uses @react-native-ml-kit/text-recognition
  - Returns the full recognized text as a single string
  - On failure: throws a typed error (`OcrError`) with a descriptive message
- `parseNutriments(rawText: string): Partial<NutrimentData>` — pure function
  - Parses common German nutrient label patterns from raw OCR text
  - Looks for values next to keywords: Energie, Fett, gesättigte Fettsäuren, Kohlenhydrate, Zucker, Ballaststoffe, Eiweiß, Salz
  - Returns only the fields it can confidently parse, skips the rest
  - Best-effort: partial results are fine, never throws

Create `src/infrastructure/ocr/__tests__/OcrService.test.ts`:
- Mock @react-native-ml-kit/text-recognition
- Test: valid image → returns non-empty string
- Test: `parseNutriments` with sample German nutrient text → correct values extracted
- Test: `parseNutriments` with garbage text → returns empty object, no throw

Rules:
- `recognizeText` is the only function with a side effect (ML Kit call)
- `parseNutriments` must be a pure function (easy to test)
- TypeScript strict, no `any`

When done, update TODO.md: mark OcrService and its tests as done.
```

---

### Prompt M4-3 · OpenFoodFactsWriteClient

**Attach:** `02_Systemarchitektur.md`, `src/types/ContributeFormData.ts`, `src/infrastructure/api/OpenFoodFactsClient.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached 02_Systemarchitektur.md.

Task: Implement the OFF Write Client for contributing new products.

Create `src/infrastructure/api/OpenFoodFactsWriteClient.ts`:
- `saveCredentials(username: string, password: string): Promise<void>` — store in expo-secure-store
- `loadCredentials(): Promise<{ username: string; password: string } | null>`
- `uploadProduct(data: ContributeFormData): Promise<void>`
  - POST to `https://world.openfoodfacts.org/cgi/product_jqm2.pl`
  - Required fields: `code` (EAN), `user_id`, `password`, `product_name`
  - Optional fields: `brands`, `categories`, `ingredients_text`, and all nutriment fields mapped to OFF field names
  - Set User-Agent header: `FoodScanner/1.0 (private)`
  - On HTTP error or network error: throw typed `UploadError` with message

Create `src/infrastructure/api/__tests__/OpenFoodFactsWriteClient.test.ts`:
- Mock fetch and expo-secure-store
- Test: uploadProduct with valid data → fetch called with correct URL and body
- Test: uploadProduct when offline → throws UploadError
- Test: saveCredentials → loadCredentials returns same values

Rules:
- TypeScript strict, no `any`
- No business logic here — only HTTP and credential management

When done, update TODO.md: mark `OpenFoodFactsWriteClient.ts` and its tests as done.
```

---

### Prompt M4-4 · ContributeScreen (Steps 1 & 2 – Camera)

**Attach:** `02_Systemarchitektur.md`, `03_UX-Konzept.md`, `src/infrastructure/ocr/OcrService.ts`, `src/types/ContributeFormData.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: 02_Systemarchitektur.md. UI reference: 03_UX-Konzept.md section 3.5.

Task: Build ContributeScreen steps 1 and 2 — the two camera steps.

Create `src/screens/ContributeScreen/ContributeScreen.tsx`:
- Receives `ean: string` as a route param
- Internal state: `step: 1 | 2 | 3`, `ingredientsText: string`, `nutrimentRawText: string`

Step 1 – Photograph ingredients list:
- Full-screen camera preview using expo-camera
- Centered overlay label: "Point at the ingredients list"
- Two buttons at the bottom:
  - "Take Photo" → capture image → call `OcrService.recognizeText(uri)` → store result in `ingredientsText` → advance to step 2
  - "Skip →" → advance to step 2 without OCR (ingredientsText stays empty)
- Step indicator at top: "Step 1 of 2"
- Loading state while OCR is running (show a spinner, disable buttons)

Step 2 – Photograph nutrition table:
- Same structure as step 1
- Label: "Point at the nutrition table"
- "Take Photo" → OCR → store raw text in `nutrimentRawText` → advance to step 3
- "Skip →" → advance to step 3
- Step indicator: "Step 2 of 2"
- Back button returns to step 1

Rules:
- Camera permission must be requested (re-use existing permission pattern from ScannerScreen)
- TypeScript strict, no `any`
- No upload logic in this file — steps 1 & 2 only collect raw text

When done, update TODO.md: mark camera steps 1 and 2 of ContributeScreen as done.
```

---

### Prompt M4-5 · ContributeScreen (Step 3 – Form & Upload)

**Attach:** `02_Systemarchitektur.md`, `03_UX-Konzept.md`, `src/screens/ContributeScreen/ContributeScreen.tsx`, `src/infrastructure/api/OpenFoodFactsWriteClient.ts`, `src/infrastructure/ocr/OcrService.ts`, `src/domain/analysis/RedFlagAnalyzer.ts`, `src/store/catalogStore.ts`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: 02_Systemarchitektur.md. UI reference: 03_UX-Konzept.md section 3.5.

Task: Build ContributeScreen step 3 — the editable form and upload logic.

Continue in `src/screens/ContributeScreen/ContributeScreen.tsx`.

Step 3 – Review & confirm form:
- Pre-fill fields from OCR results passed from steps 1 & 2:
  - `ingredientsText` → ingredients field
  - `OcrService.parseNutriments(nutrimentRawText)` → nutriment fields
- Editable fields (all TextInput, scrollable form):
  - Product name * (required, validated before upload)
  - Brand / Manufacturer
  - Category (free text or simple dropdown with common values)
  - Ingredients list (multiline)
  - Nutrition per 100g (collapsible accordion): Energy kcal, Fat, Saturated fat, Carbohydrates, Sugar, Fiber, Protein, Salt
- Info banner: "This will be saved publicly on Open Food Facts"
- "Confirm & Upload" button:
  - Disabled if product name is empty
  - Shows confirmation Alert: "Are you sure? This will be publicly visible on Open Food Facts."
  - On confirm:
    1. Call `OpenFoodFactsWriteClient.uploadProduct(formData)` (show loading spinner)
    2. Run local analysis: `RedFlagAnalyzer.analyze` + `ProductRating.rate`
    3. Save to local DB via `catalogStore.addProduct`
    4. Navigate to ResultScreen with the analysis result
  - On upload error: show Toast with error message, still run local analysis and navigate

Add "Contribute" button to ResultScreen:
- Visible only when `scanResult.status === 'not_found'`
- Navigates to ContributeScreen with the scanned EAN as param

Rules:
- TypeScript strict, no `any`
- Extract the form into `src/components/ContributeForm/ContributeForm.tsx` if the file exceeds 200 lines
- Use dark mode colors from 03_UX-Konzept.md section 5

When done, update TODO.md: mark form step, upload logic, confirmation dialog, and "Beitragen" button in ResultScreen as done.
```

---

### Prompt M4-6 · OFF Account Setup Flow

**Attach:** `src/infrastructure/api/OpenFoodFactsWriteClient.ts`, `03_UX-Konzept.md`

```
You are working on a React Native Expo app called FoodScanner.
Architecture reference: see attached files.

Task: Implement the one-time OFF account setup flow.

When the user taps "Contribute" for the first time (or when `loadCredentials()` returns null):
1. Show a modal / bottom sheet before entering ContributeScreen:
   - Title: "Set up Open Food Facts account"
   - Short explanation: "To contribute products, you need a free Open Food Facts account."
   - Link button: "Register at openfoodfacts.org" → opens URL in browser (expo-linking)
   - Username text input
   - Password text input (secureTextEntry)
   - "Save & Continue" button → calls `saveCredentials()` → closes modal → proceeds to ContributeScreen
   - "Cancel" button → dismisses modal without navigating

2. Credentials are only stored locally via expo-secure-store (already implemented in WriteClient).
3. Once credentials are saved, the modal never shows again.

Rules:
- TypeScript strict, no `any`
- The modal should be a reusable component: `src/components/OffAccountSetup/OffAccountSetup.tsx`
- Do not store credentials in Zustand state — always read from secure-store

When done, update TODO.md: mark OFF account setup flow as done. Mark full Milestone 4 as complete if all acceptance criteria pass.
```
