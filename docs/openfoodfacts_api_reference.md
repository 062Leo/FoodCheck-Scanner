# Open Food Facts API — Technical Integration Reference

> **Purpose:** This document is a complete technical reference for integrating the Open Food Facts (OFF) API into a mobile or web application. It is structured so an AI coding assistant can implement a full integration without needing to consult external sources.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Licensing & Legal Requirements](#2-licensing--legal-requirements)
3. [Environments](#3-environments)
4. [Authentication](#4-authentication)
5. [Rate Limits](#5-rate-limits)
6. [Core API Endpoints](#6-core-api-endpoints)
   - 6.1 Get Product by Barcode (READ)
   - 6.2 Search for Products (READ)
   - 6.3 Add or Edit a Product (WRITE)
   - 6.4 Get Taxonomy Suggestions (READ)
   - 6.5 Get Field Suggestions (READ)
7. [Response Structure](#7-response-structure)
8. [Key Data Fields Reference](#8-key-data-fields-reference)
9. [Computed Scores (Nutri-Score, NOVA, Eco-Score)](#9-computed-scores-nutri-score-nova-eco-score)
10. [Error Handling](#10-error-handling)
11. [Testing Strategy (Staging → Production)](#11-testing-strategy-staging--production)
12. [SDK Options](#12-sdk-options)
13. [Full Code Examples](#13-full-code-examples)
14. [Checklist Before Going Live](#14-checklist-before-going-live)

---

## 1. Overview

Open Food Facts is an open-source, community-built food product database. The API allows developers to:
- **Read** product data (ingredients, nutritional values, allergens, images, scores)
- **Write** new product data or enrich existing products
- **Search** products by category, nutrition grade, brand, and more

**Current stable API version:** `v2`  
**Next version (active development, may change):** `v3`

Base URLs:
| Environment | Base URL |
|---|---|
| Production | `https://world.openfoodfacts.org` |
| Staging (testing) | `https://world.openfoodfacts.net` |

All endpoints return **JSON**. The `.json` suffix can be appended to product URLs as an alternative to content negotiation.

---

## 2. Licensing & Legal Requirements

Before any API usage, the following is **mandatory**:

1. **Read and accept** the [Terms of Use](https://world.openfoodfacts.org/terms-of-use).
2. **Fill out the API usage form:** https://docs.google.com/forms/d/e/1FAIpQLSdIE3D8qvjC_zRJw1W8OmuHhsWJ_NSckiiniAHlfaVwUZCziQ/viewform

**Licenses:**
| Asset | License |
|---|---|
| Database | Open Database License (ODbL 1.0) |
| Individual contents | Database Contents License (DbCL 1.0) |
| Product images | Creative Commons Attribution ShareAlike (CC BY-SA 3.0) |

> ⚠️ Data is provided voluntarily by users. There is **no guarantee of accuracy, completeness, or reliability**. Your app must communicate this to end users.

---

## 3. Environments

### 3.1 Production
- URL: `https://world.openfoodfacts.org`
- Contains the **real, live database**
- Do **not** use for testing or development

### 3.2 Staging
- URL: `https://world.openfoodfacts.net`
- Protected by HTTP Basic Auth to prevent search engine indexing
  - **Username:** `off`
  - **Password:** `off`
- Use this for **all development and testing**
- Has its **own separate account database** — a production account does not work here; create a separate staging account

**Adding the Basic Auth header (staging only):**
```
Authorization: Basic b2ZmOm9mZg==
```
`b2ZmOm9mZg==` is the base64 encoding of `off:off`.

---

## 4. Authentication

### 4.1 Read Operations (GET)
No account authentication is required. However, a **custom `User-Agent` header is mandatory** on every request:

```
User-Agent: AppName/Version (contact@email.com)
```

Example:
```
User-Agent: MyFoodApp/1.0 (dev@myfoodapp.com)
```

Omitting this header may cause your requests to be treated as bot traffic and result in an IP ban.

### 4.2 Write Operations (POST / PUT / DELETE)
Authentication is **required**. Two methods:

**Method A — Session Cookie (preferred):**
1. POST login credentials to obtain a session cookie.
2. Include the session cookie in subsequent write requests.
3. Constraint: session must always come from the same IP address. Max 10 sessions per user (oldest auto-expire).

**Method B — Credentials as POST Parameters:**
Pass `user_id` and `password` as body parameters directly in each write request.

> ⚠️ `user_id` is the **username**, NOT the email address.

### 4.3 App-Level Account (Recommended Pattern)
Create one shared account for your app so users don't need individual OFF accounts. Include these parameters in all write requests:

| Parameter | Description |
|---|---|
| `app_name` | Your app's name (e.g., `MyFoodApp`) |
| `app_version` | Your app's version (e.g., `1.2`) |
| `app_uuid` | A salted, per-user UUID so moderators can ban individual users without banning your whole app |

---

## 5. Rate Limits

| Request Type | Limit |
|---|---|
| Product read queries (`GET /api/v*/product`) | **15 req/min per IP** |
| Search queries (`GET /api/v*/search`) | **10 req/min per IP** |
| Product write queries | **No limit** |

- If a mobile app makes requests on behalf of users, the rate limit applies **per user's IP**, not your server's IP.
- Exceeding limits can result in an **IP ban**. Email `reuse@openfoodfacts.org` to request removal.
- **Do not use the search API for search-as-you-type** — you will be banned very quickly.
- If you need **hundreds or thousands of products**, download the full dataset as CSV/JSONL from https://world.openfoodfacts.org/data instead of making individual requests.

---

## 6. Core API Endpoints

---

### 6.1 Get Product by Barcode (READ)

Retrieves all data for a single product identified by its barcode (EAN-13, UPC-A, etc.).

**Method:** `GET`  
**Endpoint:**
```
/api/v2/product/{barcode}
```

**Example (staging):**
```
GET https://world.openfoodfacts.net/api/v2/product/3017624010701
```

**Limit fields returned** using the `fields` query parameter (strongly recommended to reduce payload size):
```
GET https://world.openfoodfacts.net/api/v2/product/3017624010701?fields=product_name,nutrition_grades,nutriments,ingredients_text
```

**Common `fields` values:**
| Field | Description |
|---|---|
| `product_name` | Product display name |
| `brands` | Brand name(s) |
| `categories` | Product categories |
| `ingredients_text` | Raw ingredients list as a string |
| `nutriments` | Nutritional values object |
| `nutrition_grades` | Nutri-Score letter (a–e) |
| `nutriscore_data` | Detailed Nutri-Score computation data |
| `nova_group` | NOVA group (1–4, food processing classification) |
| `ecoscore_grade` | Eco-Score letter (a–e) |
| `allergens_tags` | Allergen tags list |
| `image_front_url` | URL of front product image |
| `image_nutrition_url` | URL of nutrition label image |
| `quantity` | Product quantity/weight as printed on packaging |
| `serving_size` | Serving size |
| `misc_tags` | Missing data tags (useful for determining what's needed for score computation) |
| `labels_tags` | Label tags (organic, fair-trade, etc.) |
| `countries_tags` | Countries where product is sold |
| `code` | Barcode number |
| `_id` | Internal OFF product ID |

**Get revision/blame info** (who last edited each field):
```
GET https://world.openfoodfacts.org/api/v2/product/3017620422003.json?blame=1
```

**Minimal example response:**
```json
{
  "code": "3017624010701",
  "product": {
    "nutrition_grades": "e",
    "product_name": "Nutella"
  },
  "status": 1,
  "status_verbose": "product found"
}
```

**Product not found response:**
```json
{
  "code": "0000000000000",
  "status": 0,
  "status_verbose": "product not found"
}
```

---

### 6.2 Search for Products (READ)

**Method:** `GET`  
**Endpoint:**
```
/api/v2/search
```

> ⚠️ Full-text search is only available in the **v1 API** or the beta Search-a-licious service. The v2 search API supports **filter/facet-based search only**.

**Example — Orange Juice with Nutri-Score C:**
```
GET https://world.openfoodfacts.net/api/v2/search?categories_tags_en=Orange%20Juice&nutrition_grades_tags=c&fields=code,product_name,nutrition_grades
```

**Common filter parameters:**
| Parameter | Example | Description |
|---|---|---|
| `categories_tags_en` | `Orange Juice` | Filter by category (English) |
| `nutrition_grades_tags` | `a`, `b`, `c`, `d`, `e` | Filter by Nutri-Score |
| `brands_tags` | `nestle` | Filter by brand |
| `labels_tags` | `en:organic` | Filter by label |
| `countries_tags` | `en:france` | Filter by country |
| `nova_groups_tags` | `1`, `2`, `3`, `4` | Filter by NOVA group |
| `code` | `3263859883713,8437011606013` | Fetch multiple specific barcodes |

**Pagination parameters:**
| Parameter | Default | Description |
|---|---|---|
| `page` | 1 | Page number |
| `page_size` | 24 | Results per page (max 200) |

**Sorting:**
```
sort_by=last_modified_t      # most recently modified
sort_by=popularity_key       # most scanned
sort_by=product_name         # alphabetical
```

**Example — fetch multiple barcodes at once:**
```
GET https://world.openfoodfacts.org/api/v2/search?code=3263859883713,8437011606013,6111069000451&fields=code,product_name
```

**Example search response:**
```json
{
  "count": 1629,
  "page": 1,
  "page_count": 24,
  "page_size": 24,
  "products": [
    {
      "code": "3123340008288",
      "nutrition_grades": "c",
      "product_name": "Jus d'orange"
    }
  ],
  "skip": 0
}
```

**V1 full-text search (for keyword search):**
```
GET https://world.openfoodfacts.org/cgi/search.pl?search_terms=nutella&search_simple=1&action=process&json=1
```

---

### 6.3 Add or Edit a Product (WRITE)

**Method:** `POST`  
**Endpoint:**
```
/cgi/product_jqm2.pl
```

**Required parameters (always):**
| Parameter | Description |
|---|---|
| `user_id` | Your OFF username |
| `password` | Your OFF password |
| `code` | Product barcode |

**Optional product parameters (add what you have):**
| Parameter | Example Value | Description |
|---|---|---|
| `product_name` | `Nutella` | Product name |
| `brands` | `Ferrero` | Brand name |
| `categories` | `Spreads, Chocolate spreads` | Categories (comma-separated) |
| `quantity` | `400g` | Product quantity |
| `serving_size` | `15g` | Serving size |
| `ingredients_text` | `Sugar, palm oil, ...` | Raw ingredient list |
| `nutriment_energy` | `2255` | Energy value |
| `nutriment_energy_unit` | `kJ` | Energy unit |
| `nutriment_fat` | `30.9` | Fat (per 100g) |
| `nutriment_saturated-fat` | `10.6` | Saturated fat |
| `nutriment_carbohydrates` | `57.5` | Carbohydrates |
| `nutriment_sugars` | `56.3` | Sugars |
| `nutriment_proteins` | `6.3` | Proteins |
| `nutriment_salt` | `0.107` | Salt |
| `nutriment_sodium` | `0.015` | Sodium |
| `nutriment_sodium_unit` | `g` | Sodium unit |
| `nutrition_data_per` | `100g` or `serving` | Per 100g or per serving |
| `no_nutrition_data` | `on` | Indicate nutrition facts are absent from label |
| `labels` | `en:organic` | Product labels |
| `countries` | `en:germany` | Countries sold |
| `app_name` | `MyFoodApp` | Your app name |
| `app_version` | `1.0` | Your app version |
| `app_uuid` | `abc123-salted-uuid` | Per-user salted UUID |

**To ADD to existing field values** (instead of replacing), prefix field name with `add_`:
```
add_categories=Snacks
add_labels=en:fair-trade
add_brands=NewBrand
```

**Nutrition data basis:**
```
nutrition_data_per=100g
# OR
nutrition_data_per=serving
serving_size=38g
```

**Prepared product nutrition (separate from as-sold):**
```
nutriment_energy-kj=450             # as-sold
nutriment_energy-kj_prepared=380    # prepared/cooked
```

**Successful write response:**
```json
{
  "status_verbose": "fields saved",
  "status": 1
}
```

**cURL example:**
```bash
curl -X POST https://world.openfoodfacts.net/cgi/product_jqm2.pl \
  -F user_id=YOUR_USERNAME \
  -F password=YOUR_PASSWORD \
  -F code=0180411000803 \
  -F nutriment_sodium=0.015 \
  -F nutriment_sodium_unit=g \
  -F categories="Orange Juice" \
  -F app_name=MyFoodApp \
  -F app_version=1.0 \
  -F app_uuid=user-salted-uuid-here
```

---

### 6.4 Get Taxonomy Suggestions (v3 API)

**Method:** `GET`  
**Endpoint:**
```
/api/v3/taxonomy_suggestions
```

**Parameters:**
| Parameter | Description |
|---|---|
| `tagtype` | Taxonomy type: `labels`, `categories`, `packaging_materials`, etc. |
| `string` | Partial string to search |
| `lc` | Language code (e.g., `en`, `de`, `fr`) |
| `get_synonyms` | `1` to include synonyms |

**Examples:**
```
GET https://world.openfoodfacts.org/api/v3/taxonomy_suggestions?tagtype=labels&lc=en&string=org&get_synonyms=1
GET https://world.openfoodfacts.org/api/v3/taxonomy_suggestions?tagtype=categories&string=juice
```

---

### 6.5 Get Field Suggestions / Autocomplete (Legacy)

```
GET https://world.openfoodfacts.org/cgi/suggest.pl?tagtype=categories&term=ju
GET https://world.openfoodfacts.org/cgi/suggest.pl?tagtype=brands&term=ne
GET https://world.openfoodfacts.org/cgi/suggest.pl?tagtype=labels&term=or
GET https://world.openfoodfacts.org/cgi/suggest.pl?tagtype=ingredients&term=su
GET https://world.openfoodfacts.org/cgi/suggest.pl?tagtype=allergens&term=gl
GET https://world.openfoodfacts.org/cgi/suggest.pl?tagtype=nutrients&term=so
GET https://world.openfoodfacts.org/cgi/suggest.pl?tagtype=countries&term=ger
```

Returns a plain JSON array of matching string suggestions.

---

## 7. Response Structure

A typical product response envelope:

```json
{
  "code": "3017624010701",
  "status": 1,
  "status_verbose": "product found",
  "product": {
    "product_name": "Nutella",
    "brands": "Ferrero",
    "nutrition_grades": "e",
    "nova_group": 4,
    "ecoscore_grade": "d",
    "nutriments": { ... },
    "nutriscore_data": { ... },
    "ingredients_text": "Sugar, palm oil ...",
    "allergens_tags": ["en:gluten", "en:nuts"],
    "categories_tags": ["en:spreads"],
    "image_front_url": "https://images.openfoodfacts.org/...",
    "misc_tags": ["en:nutriscore-computed"]
  }
}
```

**`status` field:**
| Value | Meaning |
|---|---|
| `1` | Product found |
| `0` | Product not found |

---

## 8. Key Data Fields Reference

### `nutriments` Object (values are per 100g unless `_serving` suffix)
```json
{
  "energy-kj": 2255,
  "energy-kj_100g": 2255,
  "energy-kj_serving": 338,
  "energy-kcal": 539,
  "fat": 30.9,
  "fat_100g": 30.9,
  "saturated-fat": 10.6,
  "carbohydrates": 57.5,
  "sugars": 56.3,
  "fiber": 0,
  "proteins": 6.3,
  "salt": 0.107,
  "sodium": 0.042
}
```
The pattern is: `{nutrient}`, `{nutrient}_100g`, `{nutrient}_serving`, `{nutrient}_unit`, `{nutrient}_value`.

### `misc_tags` — Diagnosing Missing Score Data
If a product has no Nutri-Score/Eco-Score, check `misc_tags`:
```
en:nutriscore-not-computed
en:nutriscore-missing-category
en:nutriscore-missing-nutrition-data
en:nutriscore-missing-nutrition-data-sodium
en:ecoscore-not-computed
en:ecoscore-extended-data-not-computed
```
These tags tell you exactly what data is needed to trigger score computation.

---

## 9. Computed Scores (Nutri-Score, NOVA, Eco-Score)

These are **automatically computed by the OFF backend** when sufficient data is present. You do not call a separate endpoint — they appear in the product read response.

### Nutri-Score
- **Field:** `nutrition_grades` → letter `a` to `e`
- **Required data:** `nutriments` (energy, fat, saturated fat, sugars, sodium, fiber, proteins) + `categories`
- **Detailed computation fields:** `nutriscore_data`

### NOVA Group (Food Processing)
- **Field:** `nova_group` → integer `1` to `4`
  - 1 = Unprocessed / minimally processed
  - 2 = Processed culinary ingredients
  - 3 = Processed foods
  - 4 = Ultra-processed food products
- **Required data:** `ingredients_text` + `categories`

### Eco-Score (Environmental Impact)
- **Field:** `ecoscore_grade` → letter `a` to `e`
- **Required data:** `categories` + `labels` (packaging, origin, etc.)

### Immediate Computation Pattern
If your users need a score instantly (e.g., nutrition app), send the required data fields in a POST write, then immediately issue a GET read to retrieve the computed score.

---

## 10. Error Handling

| HTTP Status | Meaning | Action |
|---|---|---|
| `200 OK` | Request successful | Parse JSON response normally |
| `301 Moved` | Barcode normalized/redirected | Follow redirect |
| `400 Bad Request` | Invalid parameters | Check parameter format |
| `403 Forbidden` | Authentication failed | Check `user_id`/`password` |
| `404 Not Found` | Product doesn't exist | `status: 0` in body |
| `429 Too Many Requests` | Rate limit exceeded | Implement exponential backoff |
| `503 Service Unavailable` | Global rate limit hit | Back off, retry later |

**Always check the `status` field in the JSON body**, even on HTTP 200:
```javascript
if (data.status === 0) {
  // Product not in database
}
```

---

## 11. Testing Strategy (Staging → Production)

### Step-by-Step Safe Testing Plan

**Step 1 — Test reads on staging (no account needed):**
```javascript
const response = await fetch(
  "https://world.openfoodfacts.net/api/v2/product/3017624010701?fields=product_name,nutrition_grades",
  {
    headers: {
      "Authorization": "Basic " + btoa("off:off"),
      "User-Agent": "MyApp/1.0 (test@myapp.com)"
    }
  }
);
const data = await response.json();
```

**Step 2 — Create a staging account:**
Go to `https://world.openfoodfacts.net` and register. This account is isolated from production.

**Step 3 — Test writes on staging:**
Use your staging credentials to POST product edits. No real products are affected.

**Step 4 — Verify computed scores on staging:**
After a write, GET the product and check that `nutrition_grades`, `nova_group`, or `ecoscore_grade` have been computed. Check `misc_tags` if they haven't.

**Step 5 — Switch base URL to production:**
Change `world.openfoodfacts.net` → `world.openfoodfacts.org`. Remove the `Authorization: Basic` header (not needed in production). Create a separate production account.

---

## 12. SDK Options

Use an SDK to avoid manually building HTTP requests:

| Language | Package / Repo |
|---|---|
| **Dart / Flutter** | `openfoodfacts` on [pub.dev](https://pub.dev/packages/openfoodfacts) |
| **Python** | `openfoodfacts` on [PyPI](https://pypi.org/project/openfoodfacts/) |
| **Swift (iOS)** | [openfoodfacts-swift](https://github.com/openfoodfacts/openfoodfacts-swift) |
| **Kotlin (Android)** | [openfoodfacts-kotlin](https://github.com/openfoodfacts/openfoodfacts-kotlin) |
| **NodeJS** | [openfoodfacts-nodejs](https://github.com/openfoodfacts/openfoodfacts-nodejs) |
| **React Native** | [openfoodfacts-react-native](https://github.com/openfoodfacts/openfoodfacts-react-native) |
| **Java** | [openfoodfacts-java](https://github.com/openfoodfacts/openfoodfacts-java) |
| **PHP** | [openfoodfacts-php](https://github.com/openfoodfacts/openfoodfacts-php) |
| **C# / .NET** | [openfoodfacts-csharp](https://github.com/openfoodfacts/openfoodfacts-csharp) |
| **Ruby** | [openfoodfacts-ruby](https://github.com/openfoodfacts/openfoodfacts-ruby) |
| **Go** | [openfoodfacts-go](https://github.com/openfoodfacts/openfoodfacts-go) |
| **Rust** | [openfoodfacts-rust](https://github.com/openfoodfacts/openfoodfacts-rust) |

---

## 13. Full Code Examples

### JavaScript / TypeScript — Read product by barcode

```typescript
const BASE_URL = "https://world.openfoodfacts.net"; // Change to .org for production
const USER_AGENT = "MyFoodApp/1.0 (dev@myfoodapp.com)";

interface ProductResponse {
  status: number;
  status_verbose: string;
  code: string;
  product?: {
    product_name: string;
    nutrition_grades: string;
    nova_group: number;
    ecoscore_grade: string;
    nutriments: Record<string, number | string>;
    allergens_tags: string[];
    image_front_url: string;
  };
}

async function getProductByBarcode(barcode: string): Promise<ProductResponse> {
  const fields = [
    "product_name",
    "brands",
    "nutrition_grades",
    "nova_group",
    "ecoscore_grade",
    "nutriments",
    "allergens_tags",
    "ingredients_text",
    "image_front_url",
    "misc_tags",
  ].join(",");

  const url = `${BASE_URL}/api/v2/product/${barcode}?fields=${fields}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      // Only needed on staging:
      "Authorization": "Basic " + btoa("off:off"),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.json();
}

// Usage:
const result = await getProductByBarcode("3017624010701");
if (result.status === 1 && result.product) {
  console.log(result.product.product_name);      // "Nutella"
  console.log(result.product.nutrition_grades);  // "e"
} else {
  console.log("Product not found");
}
```

---

### JavaScript / TypeScript — Write product data

```typescript
async function updateProduct(params: {
  barcode: string;
  userId: string;
  password: string;
  category?: string;
  sodiumValue?: number;
}) {
  const formData = new FormData();
  formData.append("user_id", params.userId);
  formData.append("password", params.password);
  formData.append("code", params.barcode);
  formData.append("app_name", "MyFoodApp");
  formData.append("app_version", "1.0");
  formData.append("app_uuid", generateSaltedUUID(params.userId));

  if (params.category) formData.append("categories", params.category);
  if (params.sodiumValue !== undefined) {
    formData.append("nutriment_sodium", String(params.sodiumValue));
    formData.append("nutriment_sodium_unit", "g");
  }

  const response = await fetch(
    `${BASE_URL}/cgi/product_jqm2.pl`,
    { method: "POST", body: formData, headers: { "User-Agent": USER_AGENT } }
  );

  const data = await response.json();
  if (data.status !== 1) {
    throw new Error(`Write failed: ${data.status_verbose}`);
  }
  return data;
}
```

---

### JavaScript — Search products

```typescript
async function searchProducts(options: {
  category?: string;
  nutritionGrade?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (options.category) params.set("categories_tags_en", options.category);
  if (options.nutritionGrade) params.set("nutrition_grades_tags", options.nutritionGrade);
  params.set("page", String(options.page ?? 1));
  params.set("page_size", String(options.pageSize ?? 24));
  params.set("fields", "code,product_name,nutrition_grades,image_front_url");

  const response = await fetch(
    `${BASE_URL}/api/v2/search?${params.toString()}`,
    { headers: { "User-Agent": USER_AGENT, "Authorization": "Basic " + btoa("off:off") } }
  );

  return response.json();
}
```

---

### Python — Read product by barcode

```python
import requests

BASE_URL = "https://world.openfoodfacts.net"  # Use .org for production
HEADERS = {
    "User-Agent": "MyFoodApp/1.0 (dev@myfoodapp.com)",
    # Remove Authorization header in production:
    "Authorization": "Basic b2ZmOm9mZg=="
}

def get_product(barcode: str) -> dict:
    fields = "product_name,brands,nutrition_grades,nova_group,nutriments,allergens_tags,misc_tags"
    url = f"{BASE_URL}/api/v2/product/{barcode}?fields={fields}"
    
    response = requests.get(url, headers=HEADERS)
    response.raise_for_status()
    data = response.json()
    
    if data.get("status") == 0:
        return None  # Product not found
    return data.get("product")

product = get_product("3017624010701")
if product:
    print(product["product_name"])       # Nutella
    print(product["nutrition_grades"])   # e
```

---

### Python — Write product data

```python
def update_product(barcode: str, user_id: str, password: str, **fields):
    payload = {
        "user_id": user_id,
        "password": password,
        "code": barcode,
        "app_name": "MyFoodApp",
        "app_version": "1.0",
        **fields
    }
    
    response = requests.post(
        f"{BASE_URL}/cgi/product_jqm2.pl",
        data=payload,
        headers=HEADERS
    )
    response.raise_for_status()
    data = response.json()
    
    if data.get("status") != 1:
        raise Exception(f"Write failed: {data.get('status_verbose')}")
    return True

# Example usage:
update_product(
    barcode="0180411000803",
    user_id="my_staging_user",
    password="my_staging_password",
    nutriment_sodium=0.015,
    nutriment_sodium_unit="g",
    categories="Orange Juice"
)
```

---

## 14. Checklist Before Going Live

- [ ] API usage form submitted: https://docs.google.com/forms/d/e/1FAIpQLSdIE3D8qvjC_zRJw1W8OmuHhsWJ_NSckiiniAHlfaVwUZCziQ/viewform
- [ ] Terms of use accepted: https://world.openfoodfacts.org/terms-of-use
- [ ] Licenses for data and images understood (ODbL + CC BY-SA)
- [ ] Custom `User-Agent` header set on **every** request
- [ ] All development and testing done on staging (`world.openfoodfacts.net`)
- [ ] Staging account created separately from production account
- [ ] Rate limits respected (15 req/min reads, 10 req/min searches)
- [ ] No search-as-you-type using the search API
- [ ] Production account created at `world.openfoodfacts.org`
- [ ] `Authorization: Basic` header removed for production requests
- [ ] Base URL switched from `.net` to `.org`
- [ ] App communicates data reliability disclaimer to users
- [ ] `app_name`, `app_version`, `app_uuid` included in all write requests
- [ ] Error handling for `status: 0` (product not found) implemented
- [ ] Error handling for HTTP 429 / 503 (rate limit) with backoff implemented

---

*Reference documentation:*
- *API Introduction: https://openfoodfacts.github.io/openfoodfacts-server/api/*
- *OpenAPI v2: https://openfoodfacts.github.io/openfoodfacts-server/api/ref-v2/*
- *API CheatSheet: https://openfoodfacts.github.io/openfoodfacts-server/api/ref-cheatsheet/*
- *Slack #api channel: https://slack.openfoodfacts.org*
