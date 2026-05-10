# Open Food Facts API — Implementation TODO

> **Instructions for the AI:** Work through these tasks in order. Each group is a self-contained unit — complete all tasks in a group before moving to the next. Check off tasks as you complete them. Reference `openfoodfacts_api_reference.md` for all technical details, endpoints, and code examples.

---

## Group 1 — Project Setup & Configuration

> Goal: Establish a clean foundation before any API code is written.

- [ ] **1.1** Create a central config file (e.g. `config/api.ts` or `config/api.py`) that exports:
  - `BASE_URL` pointing to the **staging** environment (`https://world.openfoodfacts.net`)
  - `USER_AGENT` string in the format `AppName/Version (email)`
  - `STAGING_AUTH` Basic Auth header value (`Basic b2ZmOm9mZg==`)
  - `APP_NAME`, `APP_VERSION` constants for write requests

- [ ] **1.2** Create a `generateAppUUID(userId: string)` helper function that produces a consistent, salted UUID per user (used in write requests to allow per-user moderation without banning the whole app account).

- [ ] **1.3** Create a base HTTP client / fetch wrapper that:
  - Always attaches the `User-Agent` header
  - Attaches `Authorization: Basic b2ZmOm9mZg==` only when `BASE_URL` points to staging
  - Returns parsed JSON or throws a typed error

---

## Group 2 — Error Handling & Rate Limit Safety

> Goal: Make all API calls safe and resilient before building any features on top.

- [ ] **2.1** Define a typed `ApiError` class / exception that captures:
  - HTTP status code
  - `status_verbose` from the OFF JSON body (when available)
  - Whether the error is retryable (429, 503) or permanent (400, 403, 404)

- [ ] **2.2** Implement an exponential backoff retry wrapper:
  - Retry up to 3 times on HTTP `429` (Too Many Requests) and `503` (Service Unavailable)
  - Wait 2s → 4s → 8s between retries
  - Do **not** retry on `400`, `403`, or `404`

- [ ] **2.3** Add a "product not found" guard:
  - Even on HTTP `200`, check `response.status === 0`
  - Return `null` (or throw a `ProductNotFoundError`) when status is `0`

---

## Group 3 — Read: Get Product by Barcode

> Goal: Implement the core product lookup by barcode.

- [ ] **3.1** Create a `getProductByBarcode(barcode: string)` function that:
  - Calls `GET /api/v2/product/{barcode}`
  - Requests only the needed fields via the `fields` query parameter:
    `product_name, brands, categories, nutrition_grades, nova_group, ecoscore_grade, nutriments, allergens_tags, ingredients_text, image_front_url, image_nutrition_url, quantity, serving_size, misc_tags, labels_tags, code`
  - Returns the typed product object or `null` if not found

- [ ] **3.2** Define a `Product` type / interface / dataclass that maps all fields from the `fields` list above, including the nested `nutriments` object with common sub-fields (`energy-kcal_100g`, `fat_100g`, `saturated-fat_100g`, `carbohydrates_100g`, `sugars_100g`, `proteins_100g`, `salt_100g`, `fiber_100g`).

- [ ] **3.3** Write a `getMissingScoreTags(product: Product): string[]` helper that extracts `misc_tags` entries beginning with `en:nutriscore-missing-` or `en:ecoscore-` — used later to prompt users to fill in missing data.

---

## Group 4 — Read: Search for Products

> Goal: Implement filtered product search.

- [ ] **4.1** Create a `SearchOptions` type with optional fields:
  - `category` (string)
  - `nutritionGrade` (`'a' | 'b' | 'c' | 'd' | 'e'`)
  - `brand` (string)
  - `novaGroup` (`1 | 2 | 3 | 4`)
  - `label` (string, e.g. `en:organic`)
  - `country` (string, e.g. `en:germany`)
  - `page` (number, default `1`)
  - `pageSize` (number, default `24`, max `200`)
  - `sortBy` (`'last_modified_t' | 'popularity_key' | 'product_name'`)

- [ ] **4.2** Create a `searchProducts(options: SearchOptions)` function that:
  - Calls `GET /api/v2/search` with the appropriate query parameters
  - Always requests only: `code, product_name, nutrition_grades, nova_group, image_front_url, brands`
  - Returns `{ products: Product[], count: number, page: number, pageCount: number }`

- [ ] **4.3** Create a `getProductsByBarcodes(barcodes: string[])` bulk lookup function that:
  - Passes multiple barcodes as a comma-separated `code` parameter to `/api/v2/search`
  - Returns a map of `{ [barcode]: Product | null }`
  - Useful for batch-enriching a list of scanned products

> ⚠️ Do **not** implement search-as-you-type using this endpoint. It will trigger a rate-limit ban. Use only on explicit user confirmation (button press, form submit).

---

## Group 5 — Read: Autocomplete & Taxonomy Suggestions

> Goal: Enable field suggestions when users type category, brand, label, etc.

- [ ] **5.1** Create a `getFieldSuggestions(tagtype: string, term: string): Promise<string[]>` function that:
  - Calls `GET /cgi/suggest.pl?tagtype={tagtype}&term={term}`
  - Supports tagtypes: `categories`, `brands`, `labels`, `ingredients`, `allergens`, `countries`, `packaging_shapes`, `packaging_materials`
  - Returns a plain string array

- [ ] **5.2** Create a `getTaxonomySuggestions(tagtype: string, query: string, lang?: string)` function using the v3 API:
  - Calls `GET /api/v3/taxonomy_suggestions?tagtype={tagtype}&string={query}&lc={lang}`
  - Use this for richer, synonym-aware suggestions

- [ ] **5.3** Add client-side debouncing (minimum **400ms** delay) to any UI that calls either suggestion function — do **not** fire a request on every keystroke.

---

## Group 6 — Write: Add or Edit a Product

> Goal: Implement authenticated product data submission.

- [ ] **6.1** Create a `ProductWritePayload` type that covers all writable fields:
  - Basic: `product_name`, `brands`, `categories`, `quantity`, `serving_size`, `labels`, `countries`
  - Nutrition basis: `nutrition_data_per` (`'100g' | 'serving'`), `serving_size`
  - Nutriments: `nutriment_energy`, `nutriment_energy_unit`, `nutriment_fat`, `nutriment_saturated-fat`, `nutriment_carbohydrates`, `nutriment_sugars`, `nutriment_proteins`, `nutriment_salt`, `nutriment_sodium`, `nutriment_sodium_unit`, `nutriment_fiber`
  - Flags: `no_nutrition_data` (`'on'`)
  - Additive fields (prefix `add_`): `add_categories`, `add_labels`, `add_brands`

- [ ] **6.2** Create an `updateProduct(barcode: string, payload: ProductWritePayload)` function that:
  - POSTs to `POST /cgi/product_jqm2.pl` using `multipart/form-data`
  - Always includes `user_id`, `password`, `code`, `app_name`, `app_version`, `app_uuid`
  - Checks response for `status: 1` and throws on failure

- [ ] **6.3** Create a `submitNutritionData(barcode: string, nutriments: NutrimentPayload)` convenience wrapper around `updateProduct` specifically for submitting nutritional values — used when `misc_tags` reveals missing score data.

---

## Group 7 — Computed Scores Display Logic

> Goal: Correctly interpret and display Nutri-Score, NOVA group, and Eco-Score.

- [ ] **7.1** Create a `getNutriScoreLabel(grade: string | null): string` helper that maps `'a'–'e'` to display labels (e.g. `'A – Very good'`) and returns `'Not available'` for null/undefined.

- [ ] **7.2** Create a `getNovaGroupLabel(group: number | null): string` helper that maps `1–4` to descriptions:
  - 1 → `"Unprocessed / Minimally processed"`
  - 2 → `"Processed culinary ingredients"`
  - 3 → `"Processed foods"`
  - 4 → `"Ultra-processed food products"`

- [ ] **7.3** Create a `getEcoScoreLabel(grade: string | null): string` helper analogous to the Nutri-Score label mapper.

- [ ] **7.4** Create a `canComputeNutriScore(product: Product): boolean` function that checks `misc_tags` for the absence of `en:nutriscore-not-computed` — returns `true` if the score was successfully computed.

---

## Group 8 — Integration Tests (Staging)

> Goal: Verify the full integration works end-to-end against the real staging API before switching to production.

- [ ] **8.1** Write a test that calls `getProductByBarcode('3017624010701')` (Nutella) against staging and asserts:
  - `status === 1`
  - `product.product_name === 'Nutella'`
  - `product.nutrition_grades === 'e'`
  - `product.nutriments` is a non-empty object

- [ ] **8.2** Write a test that calls `searchProducts({ category: 'Orange Juice', nutritionGrade: 'c' })` and asserts:
  - `count > 0`
  - All returned products have `nutrition_grades === 'c'`

- [ ] **8.3** Write a test that calls `getProductByBarcode('0000000000000')` (non-existent) and asserts:
  - The function returns `null` (not an exception)

- [ ] **8.4** Write a test for the write flow (staging account required):
  - Call `updateProduct` with a test barcode and a `categories` value on staging
  - Immediately call `getProductByBarcode` on the same barcode
  - Assert the category field was saved

- [ ] **8.5** Write a test that triggers the rate-limit retry logic:
  - Mock a `429` response once, then a success
  - Assert the function retried and ultimately returned data

---

## Group 9 — Switch to Production

> Goal: Flip the environment from staging to production safely.

- [ ] **9.1** Update the config file:
  - Set `BASE_URL` to `https://world.openfoodfacts.org`
  - Remove or conditionally skip the `Authorization: Basic` header (only for staging)

- [ ] **9.2** Create a **production** OFF account at `https://world.openfoodfacts.org` and store credentials securely (environment variables, secrets manager — never hardcoded).

- [ ] **9.3** Verify that all integration tests from Group 8 still pass against production (read tests only — skip the write test or use a dedicated production test barcode).

- [ ] **9.4** Add a visible disclaimer in the app UI (e.g. in a footer, info modal, or tooltip near nutritional data):
  > *"Product data is provided by Open Food Facts contributors and may be incomplete or inaccurate."*

---

## Group 10 — Final Go-Live Checklist

> Goal: Confirm every requirement from the OFF API docs is met before release.

- [ ] **10.1** API usage form submitted → https://docs.google.com/forms/d/e/1FAIpQLSdIE3D8qvjC_zRJw1W8OmuHhsWJ_NSckiiniAHlfaVwUZCziQ/viewform
- [ ] **10.2** Terms of use accepted → https://world.openfoodfacts.org/terms-of-use
- [ ] **10.3** `User-Agent` header is present on **every** outgoing request (read and write)
- [ ] **10.4** `app_name`, `app_version`, `app_uuid` are included in **every** write request
- [ ] **10.5** No search-as-you-type feature is making live search API calls
- [ ] **10.6** Exponential backoff is active for `429` and `503` responses
- [ ] **10.7** `status: 0` (product not found) is handled gracefully everywhere in the UI
- [ ] **10.8** Production `BASE_URL` is set and `Authorization: Basic` staging header is removed
- [ ] **10.9** Credentials are stored in environment variables — not in source code
- [ ] **10.10** Data reliability disclaimer is visible to end users in the app

---

*Reference: `openfoodfacts_api_reference.md`*
