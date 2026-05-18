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
- Instant barcode scanning (EAN-8/EAN-13) via camera
- Traffic-light rating: Green / Yellow / Red at a glance
- Red-flag detection for unhealthy ingredients (palm oil, glucose syrup, additives, etc.)
- Nova Score classification (1 = unprocessed, 4 = ultra-processed)

**Product Management**
- Full product catalog stored locally with SQLite — works offline
- Favorites: mark trusted products for quick access
- Custom filter rules: define your own ingredient and nutrient thresholds

**OCR Contribution**
- Photograph ingredient and nutrition labels
- Edit recognized text and upload missing data to Open Food Facts

**Privacy by Design**
- No backend server, no cloud sync, no tracking — 100% local
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
