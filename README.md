# FoodCheck Scanner

A React Native (Expo) mobile app that scans food barcodes and instantly evaluates products for unhealthy ingredients, processing levels and other product-level concerns (cans, contaminants, avoided companies) — powered by the Open Food Facts database and on-device ML Kit OCR.

## Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Releases & Downloads](#releases--downloads)
- [Tech Stack](#tech-stack)
- [Data Sources](#data-sources)
- [Limits](#limits)
- [Documentation](#documentation)

## Features

**Scanning & Analysis**
- Barcode scanning (EAN-8/EAN-13/UPC-A) via camera, with check-digit validation and manual entry as a fallback
- Scan results appear as a card over the camera so you can keep scanning the next product right away
- Traffic-light rating: OK / Warning / Critical, plus Unknown when there isn't enough data to judge a product
- Red-flag detection for unhealthy ingredients (palm oil, glucose syrup, additives, seed oils, genetic engineering, insects, hidden curing via celery extract, etc.) and a built-in additive-risk database
- Product checks that look at the whole product and count as red flags: more than 5 ingredients (limit editable), can/tin, large predatory fish (mercury), rice (arsenic), pesticide-prone crops without an organic label (mango, pepper, rice, tea, peanuts, green beans, cherries — based on the German BVL residue report 2023), dairy without raw milk, alcohol, meat substitutes, farmed fish
- Avoided brands and companies: a product from a brand or company on your list is rated Critical right away; an optional Wikidata lookup also collects the company's brands and subsidiaries
- Nova Score classification (1 = unprocessed, 4 = ultra-processed)
- Optional allergen warning (off by default): pick from the 14 EU allergens, and the scan card and product page warn when a product contains or may contain one of them
- Label badges on the product page (organic incl. Demeter/Bioland/Naturland, GMO-free, contains GMO, husbandry level 1–5, free range, MSC, ASC, raw milk), the packager code ("processed/packed in …") and a background note on almond pollination (display only)
- Egg code reader: type in the code printed on an egg to see the housing system and origin
- Fallback to USDA FoodData Central for barcodes Open Food Facts does not know — only with your own free api.data.gov key

**Product Management**
- Full product catalog stored locally with SQLite — works offline
- Search, filter and sort the catalog; favorites for quick access
- Deleting a product or removing a favorite can be undone
- Custom filter rules: define your own ingredient rules, nutrient thresholds and avoided brands/companies; switch off product checks or change the ingredient limit

**OCR Contribution**
- Photograph ingredient and nutrition labels — recognized on the device by default (ML Kit), so the photo never leaves the phone
- Open Food Facts cloud OCR is available as an explicit opt-in when on-device recognition isn't enough
- Edit recognized text and upload missing data to Open Food Facts

**Privacy by Design**
- No backend server of its own and no tracking; product data stays on the device except for what a feature explicitly needs to send (the scanned barcode to Open Food Facts — and to USDA FoodData Central if you saved a key and Open Food Facts does not know the product —, a company name you look up at Wikidata, ingredient text to the chosen translation service, or details/photos you choose to publish to Open Food Facts)
- Dark mode for comfortable supermarket use

## Quick Start

```bash
cd App
npm install
npm start
```

Scan the QR code with Expo Go or connect a device via USB.

## Releases & Downloads

Prefer to download the ready-built APK instead of compiling? Head to [Releases](https://github.com/062Leo/FoodCheck-Scanner/releases) and download the latest [FoodCheck_V1.0.apk](https://github.com/062Leo/FoodCheck-Scanner/releases/download/Release/FoodCheck_V1.0.apk) — install directly on your Android device.

## Tech Stack

TypeScript · Expo · React Native · Zustand · expo-sqlite · Expo Router · ML Kit OCR

## Data Sources

- **Product data** from [Open Food Facts](https://world.openfoodfacts.org) (Open Database License, ODbL).
- **Brands and subsidiaries of avoided companies** from [Wikidata](https://www.wikidata.org) (CC0), only when you start the lookup in a brand/company rule.
- **Products Open Food Facts does not know** from [USDA FoodData Central](https://fdc.nal.usda.gov) (CC0, mostly US products). Every user needs their own free key from api.data.gov (Settings → USDA FoodData Central); the app ships no key, and without one USDA is never asked. Products from USDA cannot be sent to Open Food Facts.
- **Pesticide-prone crops** from the German BVL report on pesticide residues in food 2023 (Nationale Berichterstattung Pflanzenschutzmittelrückstände).

## Limits

The app only knows what the product data says. In particular:

- No pesticide values per product: the pesticide check only flags crops that stand out in the 2023 monitoring report, when the product has no organic label.
- Vertical farming cannot be detected; there is no such field in the data.
- PFAS (e.g. Teflon coatings) in packaging or cookware cannot be detected.
- Checks based on categories, packaging or labels only work when Open Food Facts has that data; a product stored by an older app version gets it the next time it is scanned online.

## Documentation

- [How To Use](docs/HowToUse.md) — User guide & troubleshooting
- [Features](docs/Features.md) — Feature overview in detail (German)
- [Technical Documentation](docs/TechnicalDocumentation.md) — Architecture, APIs, database schema, domain logic
