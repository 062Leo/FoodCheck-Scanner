# TrueFood-Scanner

A React Native (Expo) mobile app that scans food product barcodes and instantly evaluates them for unhealthy ingredients and processing levels — using the Open Food Facts database and on-device OCR.

## Features

- **Barcode Scanner** — Point the camera, scan EAN-8/EAN-13 automatically
- **Traffic Light Rating** — Green (OK), Yellow (Warning), Red (Critical) at a glance
- **Red Flag Detection** — Finds unhealthy ingredients (palm oil, glucose syrup, additives, etc.)
- **Nova Score** — Food processing classification (1 = unprocessed, 4 = ultra-processed)
- **Product Catalog** — All scanned products stored locally (SQLite, offline-capable)
- **Favorites** — Mark trusted products as favorites
- **Custom Filter Rules** — Define your own ingredient/nutrient thresholds
- **OCR Contribution** — Photograph ingredients & nutrition labels, edit, and upload to Open Food Facts
- **Dark Mode** — Designed for supermarket use
- **100% Local** — No backend server, no cloud sync, no tracking

## Quick Start

```bash
cd App
npm install
npm start
```

Scan the QR code with Expo Go, or connect a device via USB.

## Documentation

- [HowToUse.md](docs/HowToUse.md) — User guide
- [TechnicalDocumentation.md](docs/TechnicalDocumentation.md) — Architecture, APIs, database schema, domain logic

## Tech Stack

TypeScript • Expo • React Native • Zustand • expo-sqlite • Expo Router • ML Kit OCR

## Data Source

Product data from [Open Food Facts](https://world.openfoodfacts.org) (Open Database License).
