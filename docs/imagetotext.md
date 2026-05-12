# Open Food Facts — Image-to-Text (OCR) Integration Guide

> **Purpose:** A complete developer reference for using Open Food Facts' OCR (Optical Character Recognition) infrastructure in your own food scanner app.

---

## Overview

Open Food Facts does **not** expose a standalone "send me an image, get me text back" OCR endpoint. Instead, their OCR pipeline works as follows:

1. **You upload an image** to the OFF server via the Product Image Upload API.
2. **OFF automatically sends** the image to **Google Cloud Vision** for OCR in the background.
3. **The OCR result** (a Google Cloud Vision JSON response) is stored and immediately accessible at a predictable URL — just replace `.jpg` with `.json` on the image URL.
4. **Robotoff** (OFF's AI service) then reads that JSON and generates structured predictions (ingredients, nutrition, labels, brands, etc.).

There are two main use-cases:
- **Existing products** → fetch the already-stored OCR JSON directly (no upload needed).
- **New/unknown products** → upload the image, then poll for the OCR result.

---

## Repositories Involved

| Repo | Purpose |
|---|---|
| [`openfoodfacts-server`](https://github.com/openfoodfacts/openfoodfacts-server) | Core server — handles image upload & stores OCR JSON |
| [`robotoff`](https://github.com/openfoodfacts/robotoff) | AI/ML service — reads OCR JSON and generates structured predictions |
| [`openfoodfacts-python`](https://github.com/openfoodfacts/openfoodfacts-python) | Python SDK — includes helpers for handling OCR results |
| [`off-nutrition-table-extractor`](https://github.com/openfoodfacts/off-nutrition-table-extractor) | Legacy (GSoC 2018) — local Tesseract-based pipeline, largely superseded by Robotoff |

---

## Base URLs

| Environment | URL |
|---|---|
| **Production** | `https://world.openfoodfacts.org` |
| **Staging (testing)** | `https://world.openfoodfacts.net` |
| **Robotoff** | `https://robotoff.openfoodfacts.org/api/v1` |
| **Image CDN** | `https://images.openfoodfacts.org/images/products/` |

> Use `.net` (staging) during development. Never hammer production with test traffic.

---

## Part 1 — Fetching OCR Results for Existing Products

If the product is already in the OFF database, its OCR JSON is **immediately available** — no upload required.

### 1.1 How Image URLs Are Structured

Product images follow this pattern:

```
https://images.openfoodfacts.org/images/products/{barcode_path}/{image_id}.jpg
```

The barcode path is the barcode split into groups of 3 digits, e.g. barcode `4012359114303` becomes `401/235/911/4303`.

**Example:**
```
# Raw full-resolution image
https://images.openfoodfacts.org/images/products/401/235/911/4303/1.jpg

# 400px thumbnail
https://images.openfoodfacts.org/images/products/401/235/911/4303/1.400.jpg

# OCR JSON (replace .jpg with .json)
https://images.openfoodfacts.org/images/products/401/235/911/4303/1.json
```

### 1.2 Fetching the OCR JSON

Just replace `.jpg` with `.json` in the image URL:

```bash
curl https://images.openfoodfacts.org/images/products/401/235/911/4303/1.json
```

The response is the **raw Google Cloud Vision JSON**, which includes:
- `textAnnotations` — full text found on the image
- `fullTextAnnotation` — structured text with bounding boxes per word/block/paragraph
- `labelAnnotations` — general image labels
- Other GCV analysis results

### 1.3 Get Image URLs from the Product API

To find which image IDs a product has, query the Product API:

```bash
curl "https://world.openfoodfacts.org/api/v2/product/4012359114303.json?fields=images"
```

The `images` field in the response lists all uploaded image IDs (e.g. `1`, `2`, `front_en`, `ingredients_de`, etc.).

### 1.4 Extract Plain Text from the OCR JSON

The most useful field for raw text extraction is `fullTextAnnotation.text`:

```javascript
async function getOcrText(barcode, imageId = 1) {
  // Build barcode path: "4012359114303" → "401/235/911/4303"
  const path = barcode.match(/.{1,3}/g).join('/').replace(/\/(\d{1,4})$/, '/$1');
  const url = `https://images.openfoodfacts.org/images/products/${path}/${imageId}.json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OCR not found: ${res.status}`);
  
  const data = await res.json();

  // Full plain text
  const plainText = data?.responses?.[0]?.fullTextAnnotation?.text ?? '';

  // All individual text annotations (first one is the full text joined)
  const annotations = data?.responses?.[0]?.textAnnotations ?? [];

  return { plainText, annotations };
}

// Usage
const { plainText } = await getOcrText('4012359114303', 1);
console.log(plainText);
```

---

## Part 2 — Uploading a New Image and Getting OCR

For products not yet in the database (or to add a new photo), you upload the image yourself. OFF immediately runs OCR on it.

### 2.1 Authentication

Write operations require a valid OFF account.

- Sign up at [world.openfoodfacts.org](https://world.openfoodfacts.org)
- Use your **username** (not email) as `user_id`

### 2.2 Upload the Image

**Endpoint:**
```
POST https://world.openfoodfacts.net/cgi/product_image_upload.pl
```

**Form fields:**

| Field | Value | Description |
|---|---|---|
| `user_id` | `your_username` | Your OFF account username |
| `password` | `your_password` | Your OFF account password |
| `code` | `4012359114303` | Product barcode |
| `imagefield` | `ingredients_en` | Image type + language code |
| `imgupload_ingredients_en` | `<binary>` | The image file (must match `imagefield`) |

**`imagefield` options:** `front`, `ingredients`, `nutrition`, `packaging`, `other`
Add a language suffix: `front_en`, `ingredients_de`, `nutrition_fr`, etc.

**The `imgupload_*` key must exactly match `imgupload_` + the `imagefield` value.**

**cURL example:**
```bash
curl -X POST https://world.openfoodfacts.net/cgi/product_image_upload.pl \
  -F user_id=your_username \
  -F password=your_password \
  -F code=4012359114303 \
  -F imagefield=ingredients_en \
  -F imgupload_ingredients_en=@/path/to/ingredients.jpg
```

**JavaScript (fetch) example:**
```javascript
async function uploadImage(barcode, imageFile, imagefield = 'ingredients_en') {
  const formData = new FormData();
  formData.append('user_id', 'your_username');
  formData.append('password', 'your_password');
  formData.append('code', barcode);
  formData.append('imagefield', imagefield);
  formData.append(`imgupload_${imagefield}`, imageFile);

  const res = await fetch(
    'https://world.openfoodfacts.net/cgi/product_image_upload.pl',
    { method: 'POST', body: formData }
  );
  return res.json();
}
```

**Successful response:**
```json
{
  "status": "status ok",
  "imgid": 123,
  "imagefield": "ingredients_en",
  "code": "4012359114303",
  "image": {
    "imgid": 123,
    "thumb_url": "123.100.jpg",
    "crop_url": "123.400.jpg"
  }
}
```

Save the `imgid` — you'll need it to build the OCR URL.

### 2.3 Fetch the OCR Result After Upload

After upload, the OCR JSON is available at:

```
https://images.openfoodfacts.org/images/products/{barcode_path}/{imgid}.json
```

OCR processing is **near-instant** but may take a few seconds. Poll with a short delay:

```javascript
async function waitForOcr(barcode, imgid, maxAttempts = 10, delayMs = 2000) {
  const path = barcode.match(/.{1,3}/g).join('/').replace(/\/(\d{1,4})$/, '/$1');
  const url = `https://images.openfoodfacts.org/images/products/${path}/${imgid}.json`;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data?.responses?.[0]?.fullTextAnnotation) {
        return data.responses[0].fullTextAnnotation.text;
      }
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error('OCR result not available after timeout');
}
```

### 2.4 Image Requirements

- Minimum size: **640 × 160 px**
- Formats: JPEG recommended
- License: images must be under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) — only upload photos taken by your users (with their consent)

---

## Part 3 — Robotoff: Structured Predictions from OCR

Robotoff reads the OCR JSON and returns structured, actionable predictions. This is the layer that turns raw OCR text into **ingredients lists, nutrition data, labels, brands**, etc.

**Robotoff base URL:**
```
https://robotoff.openfoodfacts.org/api/v1
```

### 3.1 Get OCR-Based Predictions for a Product

```bash
GET /predict/ocr_predictions?barcode=4012359114303
```

```bash
curl "https://robotoff.openfoodfacts.org/api/v1/predict/ocr_predictions?barcode=4012359114303"
```

### 3.2 Get Ingredient List from OCR

```bash
GET /predict/ingredient_list?ocr_url=<url_to_ocr_json>
```

```bash
curl "https://robotoff.openfoodfacts.org/api/v1/predict/ingredient_list?ocr_url=https://images.openfoodfacts.org/images/products/401/235/911/4303/1.json"
```

### 3.3 Extract Nutrition from an Image

Uses the Nutri-Sight LayoutLMv3 model (requires the image + its OCR JSON):

```bash
GET /predict/nutrition?image_url=<img_url>&ocr_url=<ocr_json_url>
```

```bash
curl "https://robotoff.openfoodfacts.org/api/v1/predict/nutrition?\
image_url=https://images.openfoodfacts.org/images/products/401/235/911/4303/1.jpg\
&ocr_url=https://images.openfoodfacts.org/images/products/401/235/911/4303/1.json"
```

Returns structured nutrition entities: `energy_kcal`, `fat`, `proteins`, `carbohydrates`, etc., each with `value`, `unit`, and confidence `score`.

### 3.4 Detect Language of Product Text

```bash
GET /predict/lang?text=<text>
```

Useful to determine which language to use when sending ingredient data back to OFF.

### 3.5 Get Insights (AI-Generated Facts) for a Product

```bash
GET /insights?barcode=4012359114303
```

Returns all current AI predictions (insights) for a product — brands, categories, labels, packaging codes, etc.

---

## Part 4 — Full End-to-End Flow for Your App

Here is the recommended flow for a food scanner app:

```
User scans barcode
        │
        ▼
GET /api/v2/product/{barcode}  ──────► Product found?
        │                                    │
        │ YES                                │ NO
        ▼                                    ▼
Fetch existing OCR JSON         Upload photo to OFF
(images → replace .jpg→.json)   POST /cgi/product_image_upload.pl
        │                                    │
        └────────────┬───────────────────────┘
                     ▼
          Parse fullTextAnnotation.text
                     │
                     ▼
          Call Robotoff for structured data:
          - /predict/ingredient_list
          - /predict/nutrition
          - /predict/ocr_predictions
                     │
                     ▼
          Display results in your UI
```

---

## Part 5 — Python SDK (optional)

The official Python SDK includes OCR helpers:

```bash
pip install openfoodfacts
```

```python
import openfoodfacts

api = openfoodfacts.API(user_agent="YourApp/1.0 (your@email.com)")

# Get product data
product = api.product.get("4012359114303")
images = product.get("images", {})

# The SDK also includes utilities for handling OCR JSON from Google Cloud Vision
```

---

## Part 6 — Key Notes & Gotchas

**Rate limits:** OFF enforces global rate limits. If exceeded, you get `HTTP 503`. For heavy traffic, consider hosting a local Product Opener instance and using the daily DB export.

**User-Agent:** Always set a descriptive `User-Agent` header:
```
User-Agent: YourAppName/1.0 (contact@yourapp.com)
```

**OCR JSON structure:** The JSON is the raw Google Cloud Vision response, nested under `responses[0]`. The actual text is at `responses[0].fullTextAnnotation.text`.

**Barcode path construction:**
```javascript
// "4012359114303" → "401/235/911/4303"
function barcodePath(barcode) {
  const padded = barcode.padStart(13, '0');
  return `${padded.slice(0,3)}/${padded.slice(3,6)}/${padded.slice(6,9)}/${padded.slice(9)}`;
}
```

**License:** Product data is under [OdBL](https://opendatacommons.org/licenses/odbl/). Images under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). You must attribute and contribute back.

**Register your app:** Fill out the [API usage form](https://world.openfoodfacts.org/api-usage) so OFF can identify your app and prevent accidental bans.

---

## Quick Reference — Most Important URLs

| Action | URL |
|---|---|
| Get product data | `GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json` |
| Get OCR JSON | `GET https://images.openfoodfacts.org/images/products/{barcode_path}/{imgid}.json` |
| Upload image | `POST https://world.openfoodfacts.net/cgi/product_image_upload.pl` |
| Robotoff predictions | `GET https://robotoff.openfoodfacts.org/api/v1/predict/ocr_predictions?barcode=...` |
| Robotoff ingredients | `GET https://robotoff.openfoodfacts.org/api/v1/predict/ingredient_list?ocr_url=...` |
| Robotoff nutrition | `GET https://robotoff.openfoodfacts.org/api/v1/predict/nutrition?image_url=...&ocr_url=...` |
| Robotoff API docs | `https://openfoodfacts.github.io/robotoff/references/api/` |
| OFF API docs | `https://openfoodfacts.github.io/openfoodfacts-server/api/` |
