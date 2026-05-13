# HowToUse — TrueFood-Scanner

## 1. Prerequisites

- Node.js + npm installed
- Expo Go app on your phone (Android/iOS)
- (Optional) Expo CLI: `npm install -g expo-cli`

## 2. Project Setup & Run

```bash
cd App
npm install
npm start          # Expo dev server
# or target a platform:
npm run android
npm run ios
npm run web
```

Scan the QR code with Expo Go, or connect a device via USB.

## 3. Scanner

- Open the **Scanner** tab — the camera activates immediately.
- Grant camera permission when prompted.
- Point the barcode (EAN-8/EAN-13) into the scan frame — scanning is automatic.
- Haptic feedback confirms a successful scan, then the Result Screen opens.

## 4. Result Screen

- **Traffic Light Banner** at the top: Green (OK), Yellow (Warning), Red (Critical).
- Shows: product name, brand, found red flags (favorites prioritized), Nova score, expandable ingredients list.
- **Star icon** (top right): toggle favorite.
- **Data Source Toggle**: switch between OFF Database and Local Database.
- **Edit icon** (top right): opens Edit Product screen for corrections or contributing new data to OFF.
- Error states:
  - No internet → Toast "Kein Internet – Produkt kann nicht abgerufen werden"
  - Product not found → Toast "Produkt nicht in der Datenbank"
  - API timeout → Toast "Zeitüberschreitung – bitte erneut versuchen"

## 5. Catalog

- Lists all scanned products, sorted by date (newest first).
- **Filter chips** at the top: All / OK / Warning / Critical.
- **Tap** a product → opens Result Screen from cache (no new API call).
- **Swipe left** → delete product from catalog (with confirmation).
- **Star** inline → toggle favorite.

## 6. Favorites

- Shows only favorited products.
- Empty state: "Noch keine Favoriten – tippe im Scan-Ergebnis auf ★"
- Same interaction as Catalog.

## 7. Filter Rules

- Accessible via **Settings → Filter Rules** (`/settings/filters`).
- View, add, edit, and delete custom filter rules.
- **Ingredient rules**: keyword + RED FLAG / OK severity.
- **Nutrient rules**: select nutrient (sugar, fat, salt, etc.), set threshold + operator (>, <, =), assign severity.
- **Favorite toggle**: mark rules with a star to prioritize them in scan results.
- Rules persist across app restarts.
- Default hardcoded rules are pre-loaded; you can override any of them.

## 8. OCR & Product Contribution

When editing a product (via Edit icon on Product Screen):

1. **Step 1** — Photograph the ingredients list (or skip).
2. **Step 2** — Photograph the nutrition table (or skip).
3. **Step 3** — Review & edit the pre-filled form, then save locally and/or upload to Open Food Facts.

- OCR runs on-device via ML Kit (no cloud, works offline) and/or via OFF Cloud OCR pipeline.
- Product name is the only required field.
- On first upload: set up a free Open Food Facts account (stored securely via expo-secure-store).
- After upload: immediate local analysis.
- If upload fails (offline, server error): data is still saved locally.

## 9. Backup & Restore

- **Settings → Backup**: Export entire database (products, favorites, filter rules) as JSON.
- Share via native share sheet (AirDrop, Mail, Files, etc.).
- Import a previously exported backup to restore all data.
- Works fully offline — no cloud account needed.

## 10. Build Standalone APK (Android)

```bash
npx eas-cli build --platform android --profile preview
```

- Requires an **Expo account** and the **EAS CLI** configured (`eas-cli` is included as a dev dependency).
- The **preview** profile produces a `.apk` file (installable on Android devices) without Play Store signing.
- Find the download link in the Expo dashboard or terminal output after the build completes.
- For a production `.aab` (Play Store): use `--profile production`.

## 11. Development Commands

```bash
cd App
npm test                 # Jest (23 suites, 265 tests)
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier
npm run format:check     # Prettier check
npx tsc --noEmit         # TypeScript type-check
```

## 12. Troubleshooting

- **expo-camera / native module errors**: ensure Expo SDK version matches installed packages.
- **Peer dependency errors on `npm install`**: use `--legacy-peer-deps`.
- **Haptics not working (simulator)**: test on a real device.
- **Camera permission denied**: re-enable in system settings.
- **Credentials lost**: OFF account credentials and API keys are stored in the device secure store; re-enter them if you clear app data.
- **Lint errors about `␍` (CRLF)**: run `npm run lint:fix` to convert Windows line endings on WSL/Linux.
