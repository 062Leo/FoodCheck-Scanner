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
- The small **egg icon** ("Eiercode prüfen" / "Check egg code") at the right end of that row opens the egg code reader (see [Egg Code](#8-egg-code)).
- A barcode Open Food Facts doesn't know is looked up at USDA FoodData Central, but only if you saved your own key (see [USDA FoodData Central](#9-usda-fooddata-central)); if that lookup fails, the "not found" message says why (invalid key, limit reached, no answer, no connection).
- The offline badge ("Offline – nur gespeicherte Produkte") appears whenever there is no network; a lookup then falls back to a previously saved product if there is one.

## 4. Product Screen

- **Traffic-light banner** at the top: OK, Warning, Critical, or Unknown (not enough data), together with the reason (e.g. Nova level, number of red flags, missing ingredient list).
- **Allergen warning** (only when switched on in the settings) right below the banner when the product contains, or may contain traces of, an allergen from your profile (based on Open Food Facts data — always check the package).
- Shows: product name, brand, red flags found, Nova score, Nutri-Score (if available), full nutrition table, allergens, multi-language ingredients, image gallery.
- **Red flags** include ingredient matches, nutrient limits and **product checks** (e.g. "Konserve oder Dose", "Reis oder Reisprodukt", "Mehr als 5 Zutaten"), each with a short explanation. A product from a **brand or company you avoid** is rated Critical right away; the finding at the top names the company and the brand it was recognised by.
- **Badges** below the name show labels from Open Food Facts: organic (with Demeter/Bioland/Naturland), GMO-free, contains GMO, husbandry level 1–5, free range, MSC, ASC, raw milk.
- **"Verarbeitet/verpackt in" / "Processed/packed in"** shows the country (for German codes also the state) and the packager code. It names the establishment that last processed or packed the product — not where the raw materials come from.
- Products with almonds from the USA or of unknown origin show a background note on almond pollination in California; it is for information only and does not affect the rating.
- **Bottled water** shows a background note: natural mineral water, labelled as suitable for infant food, glass bottle (better than PET, but ANSES 2025 found microplastics from the cap paint), very low in minerals (given minerals below 50 mg/l, an approximation), rich in calcium or magnesium, and always that uranium, arsenic, pesticide metabolites (e.g. TFA), microplastics and cleaning residues cannot be detected from product data. It does not affect the rating.
- Products from USDA FoodData Central show a data-source note below the EAN.
- **Recall card** below the banner when a current warning from lebensmittelwarnung.de concerns the product: "Recall for this product" when the warning names its barcode, "Possibly affected" when only brand and name fit (compare batch and date on the package). "Open notice" opens the official page. The rating does not change.
- **Star icon** (top right): toggle favorite.
- **Edit icon** (top right): opens the Edit Product screen for corrections or contributing new data to Open Food Facts.
- A footnote shows when the data comes from the offline cache, or is older than 7 days.
- Error states:
  - No internet and nothing cached → "no connection, this product is not saved yet"
  - Product not found on Open Food Facts → offer to add it yourself
  - Loading failed → retry

### Recalls

- **Settings → Datenquellen & Schlüssel → Rückrufe** lists the current food warnings from lebensmittelwarnung.de (title, product, reason, federal states, date) with a link to each official notice.
- The list is loaded at app start at most every 6 hours and only when online, and is kept on the device.
- The source is the official RSS feed of lebensmittelwarnung.de. If it fails, the app tries again after a day without any message; if it keeps failing for 7 days or answers in an unknown form, the Recalls entry and the recall cards disappear until it works again.

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
  - **Marke / Konzern (brand / company)**: enter a brand or company you want to avoid. Optionally tap **"Konzern bei Wikidata suchen"**, pick the right entry, and the app collects the company's brands and subsidiaries (data from Wikidata, CC0) and stores them with the rule, so matching works offline. Without the lookup, or when Wikidata can't be reached, only the name itself is recognised. The rule's own name may appear anywhere in a brand ("Nestlé Deutschland AG"); a brand collected from Wikidata must be the whole brand or its first words ("Maggi" matches "Maggi Fix", "Lion" does not match "Golden Lion Foods"). Spaces and hyphens don't matter ("Kit Kat" = "KitKat"). Under **"Namen anzeigen"** every collected name can be switched off with a tap, for example generic or wrong names such as "Plus" or a perfume; the counter shows "N von M Marken aktiv". Long lists have a filter field and show 50 names at a time. The rule's own name always stays active, and **"Erneut abfragen"** keeps names switched off as long as they are still found. A match rates the product Critical, regardless of other findings.
- **Product checks** (category Verarbeitung, Verpackung, Schadstoffe and others) can't be created or deleted, but tapping one explains when it applies; set it to **Erlaubt/Allowed** to switch it off. For "Mehr als 5 Zutaten" you can change the limit (a whole number from 1). The checks: more than 5 ingredients, can/tin, large predatory fish (mercury), rice (arsenic), pesticide-prone crops without an organic label (mango, pepper, rice, tea, peanuts, green beans, cherries; German BVL report 2023), dairy without raw milk, alcohol, meat substitute, farmed fish, and for water (category Wasser): not a natural mineral water (table water, spring water and other water each get their own explanation), water in a plastic bottle (Columbia University/PNAS 2024: about 240,000 micro- and nanoplastic particles per litre), and values above the German limits for infant food (nitrate 10, nitrite 0.02, sodium 20, sulphate 240, fluoride 0.7, manganese 0.05 mg/l; only when the values are given).
- Editing a rule's category, threshold or severity keeps its stored translations; they are only replaced when you change the keyword itself.
- Rules persist across app restarts; the built-in rules (780: 768 ingredient rules across 24 categories plus 12 product checks) are pre-loaded. Ingredient rules can be overridden or deleted like any other rule; product checks can only be switched off. Updating from an older version adds only rules you don't already have (most recently the three water checks in the category Wasser) and removes the former packaging/propellant gas rules.
- The alcohol rules also flag alcohol-free beer and wine (they may contain up to 0.5 % vol.), but not vinegar or yeast made from a drink ("Weinessig", "Branntweinessig", "Bierhefe"), tartaric acid ("Weinsäure"), the usually alcohol-free soft drinks ginger beer, root beer and birch beer (their sugar or colours still count), grapes, vine leaves or "Rumpsteak".
- Saving or deleting a rule re-rates the whole catalog in the background.

## 8. Egg Code

- Open it from the **Scanner** (egg icon next to "Barcode eingeben") or **Settings → Hilfe & Info → Eiercode prüfen**.
- Type in the code printed on the egg, e.g. `0-DE-0312345`. Works offline.
- The first digit is the housing system: 0 organic, 1 free range, 2 barn, 3 cage (enriched colony cage). The app shows it with a short explanation.
- Then follows the country code; German codes also show the state, farm number and stall number.
- If the code is incomplete or wrong, a message says what is missing (e.g. unknown country code, too short).

## 9. USDA FoodData Central

- **Settings → Datenquellen & Schlüssel → USDA FoodData Central**: an optional fallback for barcodes Open Food Facts doesn't know, mostly products from the USA (data from the US Department of Agriculture, public domain/CC0).
- **You need your own free key** from api.data.gov ("Kostenlosen Schlüssel anfordern" opens the sign-up page). The app ships no key; without one, USDA is never asked.
- Paste the key and save it; it is stored in the device secure store and can be deleted again.
- A product found at USDA is saved like any other product and shows a data-source note. It is not looked up at USDA again; once Open Food Facts knows the barcode, its data is used, and whatever is missing there (e.g. ingredients or nutrition facts) still comes from the saved USDA data, with the data-source note shown as long as it does.
- Products from USDA can't be sent to Open Food Facts; your edits to them stay on the device.

## 10. OCR & Product Contribution

When editing a product (via the Edit icon on the Product screen, or from a failed lookup):

1. Fill in what you know, or tap the camera icon next to Ingredients / Nutrition to photograph the label.
2. **Camera** → optionally **crop** the relevant area → **review** the recognised text, edit it, retake, or re-crop.
3. Recognition runs **on the device** by default (ML Kit) — the photo never leaves the phone. If it isn't good enough, you can explicitly choose Open Food Facts' cloud recognition; a dialog names the target server first, since that uploads the photo publicly under your account.
4. Save locally, and/or send the entered data to Open Food Facts.

- Product name is the only field required to save locally; sending to Open Food Facts requires a few more required fields (marked in the form) and an Open Food Facts account (set up once, stored securely via expo-secure-store).
- Sending to Open Food Facts asks for confirmation first and lists which fields will be published; it saves your changes locally before attempting the upload, so nothing is lost if it fails (offline, rejected, invalid credentials).
- Fields you leave untouched keep updating from Open Food Facts on the next lookup; fields you explicitly change stay as you set them, even after a later refresh.

## 11. Backup & Restore

- **Settings → Datenbank-Backup**: on Android, choose a folder once, then create a backup — it copies the database file itself into that folder with a timestamped name.
- **Automatic backup**: enable the switch to back up at most once a day on app start.
- **Restore**: pick a previously created `.db` file. It is checked first (must be a FoodCheck database); your current data is copied as a safety copy and restored automatically if anything goes wrong, so nothing is lost either way.
- The backup folder, the automatic-backup switch and the "last backup" time are properties of this device and are kept as they are, even when you restore an older backup.
- iOS does not support folder backups yet (Storage Access Framework is Android-only); the settings screen shows a note instead.
- Works fully offline — no cloud account needed.

## 12. Build a Standalone APK (Android)

```bash
npx eas-cli build --platform android --profile production
```

- Requires an **Expo account** and the **EAS CLI** configured (`eas-cli` is included as a dev dependency).
- The **production** profile builds an installable `.apk` (see `App/eas.json`) — there is currently no separate `preview` profile.
- Find the download link in the Expo dashboard or terminal output after the build completes.

## 13. Development Commands

```bash
cd App
npm test                 # Jest (66 suites, 755 tests)
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

## 14. What the App Can't Know

- **Pesticides**: there are no residue values per product. The pesticide check only flags crops that stand out in the 2023 monitoring report, when the product has no organic label.
- **Vertical farming** can't be detected; there is no such field in the product data.
- **PFAS** (e.g. Teflon coatings) in packaging or cookware can't be detected.
- The **packager code** names the last processing or packing establishment, not the origin of the raw materials.
- All checks depend on what Open Food Facts (or USDA) knows: if category, packaging or labels are missing, a check can't apply. No warning does not mean harmless.
- Products saved by an older app version are fetched again in the background after the app starts (at most 10 requests per minute; offline it continues on the next start), so they get categories, packaging and labels without a new scan. Your own edits and USDA data are kept.

## 15. Troubleshooting

- **expo-camera / native module errors**: ensure Expo SDK version matches installed packages.
- **Peer dependency errors on `npm install`**: use `--legacy-peer-deps`.
- **Haptics not working (simulator)**: test on a real device.
- **Camera permission denied**: re-enable it in the system settings (the app links there directly after a permanent denial).
- **Credentials lost**: Open Food Facts account credentials, translation API keys and the USDA key are stored in the device secure store; re-enter them (keys under **Settings → Datenquellen & Schlüssel / Data sources & keys**) if you clear app data.
- **USDA lookup fails**: "Schlüssel ungültig" means the key was rejected — check it in Settings → Datenquellen & Schlüssel → USDA FoodData Central; "Limit erreicht" means the request limit of your api.data.gov key is used up for now.
- **Wikidata lookup fails**: you can still save the brand/company rule; it then only recognises the name itself. Open the rule later and run the lookup again.
- **A backup file is rejected on restore**: it must be an unmodified `.db` file created by FoodCheck's own backup; your existing data is left untouched.
- **Lint errors about `␍` (CRLF)**: Prettier is configured with `endOfLine: auto`, so this should no longer happen; run `npm run format` if it does.
