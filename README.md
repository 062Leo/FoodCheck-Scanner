# FoodCheck Scanner

A React Native (Expo) mobile app that scans food barcodes and instantly evaluates products for unhealthy ingredients and processing levels — powered by the Open Food Facts database and on-device ML Kit OCR.

## Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Releases & Downloads](#releases--downloads)
- [Tech Stack](#tech-stack)
- [Data Source](#data-source)
- [Documentation](#documentation)

## Features

**Scanning & Analysis**
- Barcode scanning (EAN-8/EAN-13/UPC-A) via camera, with check-digit validation and manual entry as a fallback
- Scan results appear as a card over the camera so you can keep scanning the next product right away
- Traffic-light rating: OK / Warning / Critical, plus Unknown when there isn't enough data to judge a product
- Red-flag detection for unhealthy ingredients (palm oil, glucose syrup, additives, etc.) and a built-in additive-risk database
- Nova Score classification (1 = unprocessed, 4 = ultra-processed)
- Optional allergen warning (off by default): pick from the 14 EU allergens, and the scan card and product page warn when a product contains or may contain one of them

**Product Management**
- Full product catalog stored locally with SQLite — works offline
- Search, filter and sort the catalog; favorites for quick access
- Deleting a product or removing a favorite can be undone
- Custom filter rules: define your own ingredient and nutrient thresholds

**OCR Contribution**
- Photograph ingredient and nutrition labels — recognized on the device by default (ML Kit), so the photo never leaves the phone
- Open Food Facts cloud OCR is available as an explicit opt-in when on-device recognition isn't enough
- Edit recognized text and upload missing data to Open Food Facts

**Privacy by Design**
- No backend server of its own and no tracking; product data stays on the device except for what a feature explicitly needs to send (the scanned barcode to Open Food Facts, ingredient text to the chosen translation service, or details/photos you choose to publish to Open Food Facts)
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

## Data Source

Product data from [Open Food Facts](https://world.openfoodfacts.org) (Open Database License).

## Documentation

- [How To Use](docs/HowToUse.md) — User guide & troubleshooting
- [Technical Documentation](docs/TechnicalDocumentation.md) — Architecture, APIs, database schema, domain logic
