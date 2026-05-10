# Current OpenFoodFacts API Integration — Audit

**Date:** 2026-05-10  
**Audit scope:** All OFF-related code in `App/src/`

---

## 1. Existing API Client Code

### 1.1 `infrastructure/api/OpenFoodFactsClient.ts` — Read Client

| Aspect | Current | Should be |
|--------|---------|------------|
| Endpoint | `GET https://world.openfoodfacts.org/api/v0/product/{ean}.json` | `/api/v2/product/{ean}` (v2 is stable; v0 is deprecated) |
| `fields` param | Not used — fetches entire product blob | Use `fields=` to reduce payload |
| User-Agent | `FoodScanner/1.0 (privat)` | `FoodScanner/1.0 (contact@email.com)` (format required) |
| Environment | Hardcoded production URL | Should be configurable (staging vs. production) |
| Auth (staging) | Not supported | Needs `Authorization: Basic b2ZmOm9mZg==` for staging |
| Error handling | Generic try/catch, swallows original error | Should throw typed errors preserving HTTP status |
| Product not found | `data.status === 0` → returns `null` | OK, matches spec |
| Returns | `Product` domain model | OK |

**Mapped fields from API response:**
`product_name`, `brands`, `nova_group`, `ingredients_text` (prefers `_de`, falls back to generic), `ingredients_text_de`, `ingredients_text_en`, all `ingredients_text_*` variants, `image_url`

**Not fetched:** `nutrition_grades`, `nutriscore_data`, `ecoscore_grade`, `allergens_tags`, `categories`, `misc_tags`, `quantity`, `serving_size`, `labels_tags`

---

### 1.2 `infrastructure/api/OpenFoodFactsWriteClient.ts` — Write Client

| Aspect | Current | Should be |
|--------|---------|------------|
| Endpoint | `POST https://world.openfoodfacts.org/cgi/product_jqm2.pl` | OK |
| User-Agent | `FoodScanner/1.0 (privat)` | Same format issue as read client |
| Auth | `user_id` + `password` from `expo-secure-store` | OK (Method B) |
| `app_name` | **Missing** | Required for app-level account |
| `app_version` | **Missing** | Required for app-level account |
| `app_uuid` | **Missing** | Required (per-user salted UUID) |
| `nutrition_data_per` | **Missing** | Should be sent (`100g` or `serving`) |
| Nutriement field names | `nutriments_energy-kcal_100g`, `nutriments_fat_100g`, etc. | OFF expects `nutriment_` (singular) prefix: `nutriment_energy-kcal`, `nutriment_fat`, `nutriment_saturated-fat`, etc. **These are likely wrong.** |
| Error handling | `UploadError` typed class | OK but no retry on 429/503 |
| Exponential backoff | **None** | Required for 429/503 responses |
| `no_nutrition_data` flag | Not supported | Missing |

**Sent fields:** `code`, `user_id`, `password`, `product_name`, `brands`, `categories`, `ingredients_text`, 8 nutriment fields (energy-kcal, fat, saturated-fat, carbohydrates, sugars, fiber, proteins, salt — all per 100g).

---

### 1.3 Helper Functions / Utilities

| What | Where | Exists? |
|------|-------|---------|
| `getProductByBarcode(barcode)` | `OpenFoodFactsClient.getProductByEan()` | Yes |
| `updateProduct(barcode, payload)` | `OpenFoodFactsWriteClient.uploadProduct()` | Yes |
| `saveCredentials` / `loadCredentials` | `OpenFoodFactsWriteClient` | Yes |
| Credential storage UI | `components/OffAccountSetup/OffAccountSetup.tsx` | Yes |
| `getSearchProducts(options)` | — | **No** |
| `getProductsByBarcodes(barcodes[])` | — | **No** |
| `getFieldSuggestions(tagtype, term)` | — | **No** |
| `getTaxonomySuggestions(tagtype, query, lang?)` | — | **No** |
| `submitNutritionData(barcode, nutriments)` | — | **No** |
| `getMissingScoreTags(product)` | — | **No** |
| `getNutriScoreLabel(grade)` | `NovaScoreEvaluator` (partial) | Partial — Nova only |
| `getNovaGroupLabel(group)` | `NovaScoreEvaluator` | Yes |
| `getEcoScoreLabel(grade)` | — | **No** |
| `canComputeNutriScore(product)` | — | **No** |
| Central API config file | — | **No** |
| Exponential backoff retry wrapper | — | **No** |
| `generateAppUUID(userId)` | — | **No** |
| Base HTTP client wrapper | — | **No** |

---

## 2. Screen Integration Points

| Screen | Read Client | Write Client | Notes |
|--------|------------|--------------|-------|
| `ResultScreen/ResultScreen.tsx` | Yes (primary scan flow) | Yes (missing data modal) | Also handles offline cache merge |
| `ResultScreen.tsx` (dead) | Yes | No | Older version, not used by routing |
| `ContributeScreen/ContributeScreen.tsx` | Yes (pre-fill form) | Yes (upload on submit) | |
| `EditProductScreen.tsx` | No | Yes (upload button) | Has module-level singleton `writeClient` |
| `OffAccountSetup/OffAccountSetup.tsx` | No | Yes (credential save) | Component for initial setup |

---

## 3. Key Gaps vs. Task 1 Requirements

### 🔴 Critical — Write client issues
1. **Nutriment field names are likely wrong** — uses `nutriments_` prefix instead of OFF's `nutriment_`. Confirm against real API before proceeding.
2. **Missing `app_name`, `app_version`, `app_uuid`** — OFF recommends these for all write requests. Without `app_uuid`, a single abusive user could get the entire app account banned.

### 🟡 High — Read client needs upgrade
3. Uses **v0 API** — should be v2 with `fields` query param for efficiency.
4. **No staged client config** — hardcoded production URL. Should support staging (`world.openfoodfacts.net`) with Basic Auth.
5. **No exponential backoff** — 429 (rate limit) and 503 responses will cause failures instead of retries.
6. User-Agent format doesn't comply with OFF requirements (`email` instead of `privat`).

### 🟢 Medium — Missing features needed later
7. **No product search** (`/api/v2/search`) — needed for Task 1.
8. **No taxonomy/field suggestions** — needed for autocomplete in forms.
9. **No Eco-Score display** — only NovaScore is evaluated.
10. **No `misc_tags` interpretation** — can't detect what data is missing for score computation.
11. **No integration tests against staging** — all existing tests mock fetch, no real API verification.

### ⚠️ Pre-existing note
12. The app already uses **production URL** directly — no staging phase was done. The OFF usage form and terms of use acceptance may not have been completed. This should be verified before any work begins.

---

## 4. Authentication Summary

| Operation | Method | Current State |
|-----------|--------|---------------|
| Read (GET) | User-Agent header only | ✅ Implemented (format issue) |
| Write (POST) | `user_id` + `password` per request | ✅ Implemented |
| Credential storage | `expo-secure-store` (off_username, off_password) | ✅ Implemented |
| App-level account fields | `app_name`, `app_version`, `app_uuid` | ❌ Missing |

---

## 5. Recommendation Summary

For **Task 1** (`TODO_OFF.md`), the following order is recommended based on this audit:

1. **Fix the write client first** — correct nutriment field names and add `app_name`/`app_version`/`app_uuid` (the current code may silently fail or corrupt data).
2. **Create a central config** with staging/production toggle (Group 1).
3. **Add exponential backoff** and typed error handling (Group 2).
4. **Upgrade read client** to v2 with `fields` param (Group 3).
5. **Add search** (Group 4) and taxonomy suggestions (Group 5).
6. **Add score display helpers** for Eco-Score + missing data detection (Group 7).
7. **Integration tests against staging** before switching anything to production (Group 8).
