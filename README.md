# FoodCheck Scanner

A React Native (Expo) mobile app that scans food barcodes and instantly evaluates products for unhealthy ingredients, processing levels and other product-level concerns (cans, contaminants, avoided companies), powered by the Open Food Facts database and on-device ML Kit OCR.

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
- Red-flag detection for unhealthy ingredients (palm oil, glucose syrup, additives, seed oils, genetic engineering, insects, hidden curing via celery extract, alcohol incl. wine, beer and spirits, etc.) with 794 built-in rules (768 ingredient rules in 8 languages, 12 product checks (three of them for bottled water), 13 water test rules and Nestlé as an avoided company) and a built-in additive-risk database; negations and look-alikes such as "alkoholfrei", wine vinegar, tartaric acid or brewer's yeast are not counted
- Product checks that look at the whole product and count as red flags: more than 5 ingredients (limit editable), can/tin, large predatory fish (mercury), rice (arsenic), pesticide-prone crops without an organic label (mango, pepper, rice, tea, peanuts, green beans, cherries; based on the German BVL residue report 2023), dairy without raw milk, alcohol, meat substitutes, farmed fish
- Avoided brands and companies: a product from a brand or company on your list is rated Critical right away; an optional Wikidata lookup also collects the company's brands and subsidiaries, which match a product brand that is or starts with them ("Maggi" → "Maggi Fix"), regardless of spaces and hyphens ("Kit Kat" = "KitKat"); Nestlé is on the list from the start (216 frozen Wikidata names, generic ones switched off)
- Water test rules (category Wasser-Tests): 13 waters criticised by Öko-Test 2025/2026 or for Nestlé's prohibited treatment (Perrier, Vittel, Contrex, Hépar) count as one red flag each and show the reason and sources
- Nova Score classification (1 = unprocessed, 4 = ultra-processed)
- Optional allergen warning (off by default): pick from the 14 EU allergens, and the scan card and product page warn when a product contains or may contain one of them
- Label badges on the product page (organic incl. Demeter/Bioland/Naturland, GMO-free, contains GMO, husbandry level 1–5, free range, MSC, ASC, raw milk), the packager code ("processed/packed in …") and background notes on almond pollination and bottled water (display only)
- Egg code reader: type in the code printed on an egg to see the housing system and origin
- Fallback to USDA FoodData Central for barcodes Open Food Facts does not know, only with your own free api.data.gov key; if Open Food Facts later has only a sparse entry, the stored USDA data fills its gaps
- Food recalls and warnings from lebensmittelwarnung.de: a list under Settings → Recalls, and a card on the product page when a current warning names its barcode (or, marked "possibly affected", fits its brand and name); does not change the rating, and disappears quietly when the source is unavailable

**Product Management**
- Full product catalog stored locally with SQLite, so it works offline
- Products stored by an older app version are fetched again in the background after the app starts (at most 10 requests per minute), so the product checks get the newer data without a new scan
- Search, filter and sort the catalog; favorites for quick access
- Deleting a product or removing a favorite can be undone
- Custom filter rules: define your own ingredient rules, nutrient thresholds and avoided brands/companies; switch off product checks (they cannot be deleted) or change the ingredient limit

**OCR Contribution**
- Photograph ingredient and nutrition labels: recognized on the device by default (ML Kit), so the photo never leaves the phone
- Open Food Facts cloud OCR is available as an explicit opt-in when on-device recognition isn't enough
- Edit recognized text and upload missing data to Open Food Facts

**Privacy by Design**
- No backend server of its own and no tracking; product data stays on the device except for what a feature explicitly needs to send (the scanned barcode to Open Food Facts (and to USDA FoodData Central if you saved a key and Open Food Facts does not know the product), a company name you look up at Wikidata, a request for the current warning list to lebensmittelwarnung.de (no product data is sent), ingredient text to the chosen translation service, or details/photos you choose to publish to Open Food Facts)
- Dark mode for comfortable supermarket use

## Quick Start

```bash
cd App
npm install
npm start
```

Scan the QR code with Expo Go or connect a device via USB.

## Releases & Downloads

Prefer to download the ready-built APK instead of compiling? Head to [Releases](https://github.com/062Leo/FoodCheck-Scanner/releases) and download the latest [FoodCheck_V1.0.apk](https://github.com/062Leo/FoodCheck-Scanner/releases/download/Release/FoodCheck_V1.0.apk) and install it directly on your Android device.

## Tech Stack

TypeScript · Expo · React Native · Zustand · expo-sqlite · Expo Router · ML Kit OCR

## Data Sources

- **Product data** from [Open Food Facts](https://world.openfoodfacts.org) (Open Database License, ODbL).
- **Brands and subsidiaries of avoided companies** from [Wikidata](https://www.wikidata.org) (CC0), only when you start the lookup in a brand/company rule.
- **Products Open Food Facts does not know** from [USDA FoodData Central](https://fdc.nal.usda.gov) (CC0, mostly US products). Every user needs their own free key from api.data.gov (Settings → USDA FoodData Central); the app ships no key, and without one USDA is never asked. Products from USDA cannot be sent to Open Food Facts.
- **Food recalls and warnings** from [lebensmittelwarnung.de](https://www.lebensmittelwarnung.de) (German federal states and BVL). Read from the official RSS feed; if it fails for a week or answers in an unknown form, the feature is hidden.
- **Pesticide-prone crops** from the German BVL report on pesticide residues in food 2023 (Nationale Berichterstattung Pflanzenschutzmittelrückstände).

## Limits

The app only knows what the product data says. In particular:

- No pesticide values per product: the pesticide check only flags crops that stand out in the 2023 monitoring report, when the product has no organic label.
- Vertical farming cannot be detected; there is no such field in the data.
- PFAS (e.g. Teflon coatings) in packaging or cookware cannot be detected.
- The packager code names the last processing or packing establishment, not the origin of the raw materials.
- Checks based on categories, packaging or labels only work when Open Food Facts has that data; a product stored by an older app version gets it from the background refresh after the app starts.

## Documentation

- [How To Use](docs/HowToUse.md): User guide & troubleshooting
- [Features](docs/Features.md): Feature overview in detail (German)
- [Technical Documentation](docs/TechnicalDocumentation.md): Architecture, APIs, database schema (version 12, 12 migrations), domain logic
- [Open Tasks](docs/OpenTasks.md): Remaining work, phone tests, open questions and known limits
