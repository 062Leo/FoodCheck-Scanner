# HowToUse — FoodCheck

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
- Grant camera permission when prompted; if you denied it permanently, the app links to the system settings.
- Point the barcode (EAN-8/EAN-13/UPC-A) into the frame ("Barcode in den Rahmen halten") — scanning is automatic and the check digit filters out misreads.
- The result appears as a card over the camera (name, status, main reason) while the camera keeps running, so you can scan the next product right away.
- Optional: with **Settings → Allergen-Warnung / Allergen warning** switched on (off by default), a product that declares an allergen from **Meine Allergene / My allergens** shows it in an extra line ("Enthält Milch", "Kann Spuren enthalten: Erdnüsse").
- Tap the card to open the full Product screen; the close button dismisses it without leaving the scanner.
- No camera, or the code won't scan? Use **"Barcode eingeben" / "Enter barcode"** to type it in manually.
- The offline badge ("Offline – nur gespeicherte Produkte") appears whenever there is no network; a lookup then falls back to a previously saved product if there is one.

## 4. Product Screen

- **Traffic-light banner** at the top: OK, Warning, Critical, or Unknown (not enough data), together with the reason (e.g. Nova level, number of red flags, missing ingredient list).
- **Allergen warning** (only when switched on in the settings) right below the banner when the product contains, or may contain traces of, an allergen from your profile (based on Open Food Facts data — always check the package).
- Shows: product name, brand, red flags found, Nova score, Nutri-Score (if available), full nutrition table, allergens, multi-language ingredients, image gallery.
- **Star icon** (top right): toggle favorite.
- **Edit icon** (top right): opens the Edit Product screen for corrections or contributing new data to Open Food Facts.
- A footnote shows when the data comes from the offline cache, or is older than 7 days.
- Error states:
  - No internet and nothing cached → "no connection, this product is not saved yet"
  - Product not found on Open Food Facts → offer to add it yourself
  - Loading failed → retry

## 5. Catalog

- Lists all scanned products; refreshes silently in the background on every visit.
- **Search** matches name, brand or EAN; all words you type must match.
- **Filter chips** with counts: All / Critical / Warning / OK / Unknown / Missing ingredients.
- **Sort**: most recent, rating (critical first), name, Nova (most processed first), scan frequency.
- **Tap** a product → opens the Product screen from the stored data (no new API call).
- **Long-press** (or the "…" action) on a product → edit or delete it.
- Deleting a product shows an **Undo** action in a toast; undoing restores it completely (id, scan history, edit markers, favorite status).
- The star toggles the favorite directly on the card.

## 6. Favorites

- Shows only favorited products, using the same card and long-press menu as the Catalog.
- Empty state: "Noch keine Favoriten – tippe im Scan-Ergebnis auf ★" ("no favorites yet — tap the star").
- Removing a favorite (star or long-press menu) can be undone from the toast; it no longer deletes the whole product.

## 7. Filter Rules

- Accessible via **Settings → Filter-Regeln** (`/settings/filters`).
- Rules are grouped by category (only categories that contain rules are shown); tap a category to expand it, or search to expand every match.
- Tap **+** to add a rule, or tap an existing rule to edit it in a sheet:
  - **Ingredient rule**: keyword (translated automatically into 7 languages) + category, severity **Red Flag** or **Erlaubt/Allowed** (whitelists the ingredient).
  - **Nutrient rule**: pick a nutrient (sugar, fat, saturated fat, salt, energy), operator (>, <, =), threshold (comma decimals accepted), and severity.
- Editing a rule's category, threshold or severity keeps its stored translations; they are only replaced when you change the keyword itself.
- Rules persist across app restarts; the built-in rules (678 across 18 seeded categories) are pre-loaded and can be overridden or deleted like any other rule.
- Saving or deleting a rule re-rates the whole catalog in the background.

## 8. OCR & Product Contribution

When editing a product (via the Edit icon on the Product screen, or from a failed lookup):

1. Fill in what you know, or tap the camera icon next to Ingredients / Nutrition to photograph the label.
2. **Camera** → optionally **crop** the relevant area → **review** the recognised text, edit it, retake, or re-crop.
3. Recognition runs **on the device** by default (ML Kit) — the photo never leaves the phone. If it isn't good enough, you can explicitly choose Open Food Facts' cloud recognition; a dialog names the target server first, since that uploads the photo publicly under your account.
4. Save locally, and/or send the entered data to Open Food Facts.

- Product name is the only field required to save locally; sending to Open Food Facts requires a few more required fields (marked in the form) and an Open Food Facts account (set up once, stored securely via expo-secure-store).
- Sending to Open Food Facts asks for confirmation first and lists which fields will be published; it saves your changes locally before attempting the upload, so nothing is lost if it fails (offline, rejected, invalid credentials).
- Fields you leave untouched keep updating from Open Food Facts on the next lookup; fields you explicitly change stay as you set them, even after a later refresh.

## 9. Backup & Restore

- **Settings → Datenbank-Backup**: on Android, choose a folder once, then create a backup — it copies the database file itself into that folder with a timestamped name.
- **Automatic backup**: enable the switch to back up at most once a day on app start.
- **Restore**: pick a previously created `.db` file. It is checked first (must be a FoodCheck database); your current data is copied as a safety copy and restored automatically if anything goes wrong, so nothing is lost either way.
- The backup folder, the automatic-backup switch and the "last backup" time are properties of this device and are kept as they are, even when you restore an older backup.
- iOS does not support folder backups yet (Storage Access Framework is Android-only); the settings screen shows a note instead.
- Works fully offline — no cloud account needed.

## 10. Build a Standalone APK (Android)

```bash
npx eas-cli build --platform android --profile production
```

- Requires an **Expo account** and the **EAS CLI** configured (`eas-cli` is included as a dev dependency).
- The **production** profile builds an installable `.apk` (see `App/eas.json`) — there is currently no separate `preview` profile.
- Find the download link in the Expo dashboard or terminal output after the build completes.

## 11. Development Commands

```bash
cd App
npm test                 # Jest (49 suites, 418 tests)
npm run test:integration # Open Food Facts staging integration tests (opt-in)
npm run typecheck        # TypeScript type-check
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier
npm run format:check     # Prettier check
npm run doctor           # expo-doctor project health check
npm run bundle:check     # verifies the Android bundle exports
npm run check            # typecheck + lint + format:check + test + doctor + bundle:check
```

## 12. Troubleshooting

- **expo-camera / native module errors**: ensure Expo SDK version matches installed packages.
- **Peer dependency errors on `npm install`**: use `--legacy-peer-deps`.
- **Haptics not working (simulator)**: test on a real device.
- **Camera permission denied**: re-enable it in the system settings (the app links there directly after a permanent denial).
- **Credentials lost**: Open Food Facts account credentials and translation API keys are stored in the device secure store; re-enter them if you clear app data.
- **A backup file is rejected on restore**: it must be an unmodified `.db` file created by FoodCheck's own backup; your existing data is left untouched.
- **Lint errors about `␍` (CRLF)**: Prettier is configured with `endOfLine: auto`, so this should no longer happen; run `npm run format` if it does.
