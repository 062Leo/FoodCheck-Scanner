# Open Tasks — FoodCheck

State of branch `feature/natural-food-checks` (database version 10, `RATING_LOGIC_VERSION` 5,
777 built-in rules, 65 test suites / 746 tests). Everything below is still open; nothing here is
implemented yet.

Markers: 👤 decided by the owner · 💡 proposal · ❓ open · ⚠️ risk · 🔴 high · 🟠 medium · ⚪ low

<details>
<summary>Contents</summary>

- [01 Deselectable company names](#t01)
- [02 Settings group "Data sources & keys"](#t02)
- [03 Testing on the phone with Expo Go](#t03)
- [04 Push and pull request](#t04)
- [05 Open questions and ideas](#t05)
- [06 Known limits](#t06)

</details>

<a id="t01"></a>
## 01 Deselectable company names 👤 🔴

Approved by the owner. **Why:** the Wikidata lookup collects generic or wrong brand names. For
Nestlé it returns names such as "Plus", "Lion", "Nuts", "Crisp", "Felix", "Fitness", and entries
that are not food at all, such as the perfume "Arpège". Users must be able to switch single names
off without deleting the whole company rule.

Files: `App/src/features/filters/CompanyRuleForm.tsx`, `App/src/features/filters/RuleEditorSheet.tsx`,
`App/src/domain/analysis/companyRules.ts`.

1. **Data:** extend `CompanyData` with `excluded?: string[]`, stored in the same JSON in the rule's
   `translations` column (`{ wikidataId, names, excluded }`). `parseCompanyData` must keep
   accepting the old JSON without `excluded` (no migration needed).
2. **Matching:** `findAvoidedCompanies` ignores excluded names; compare normalized
   (`normalizeCompanyName` / `companyWords`), not raw strings.
3. **UI:** each collected name is a toggleable list row; a counter shows "N von M Marken aktiv" /
   "N of M brands active" (both i18n strings). Today the form only shows the first names as joined
   text (`VISIBLE_NAMES`).
   - ⚠️ Must stay usable with 200+ names (up to 1,000 are collected) **inside the sheet**, which is a
     `ScrollView`: a `FlatList` there causes the nested VirtualizedList warning. Options 💡: render
     plain rows with a search/filter field and paging, or a separate full-screen picker.
4. **"Erneut abfragen" / refresh:** keeps exclusions for names that are still present in the new
   result; exclusions for vanished names are dropped.
5. The rule's own name (its `key`) cannot be excluded.
6. **Re-rating:** the rating fingerprint must change when exclusions change.
   `ratingFingerprint` in `App/src/services/CatalogRatingService.ts` already hashes `translations`,
   so storing `excluded` there is enough — add a test that proves it.
7. **Tests:** parsing old and new JSON, matching with exclusions (normalized), refresh keeping
   exclusions, own name not excludable, fingerprint change, the form/sheet with many names (no
   VirtualizedList warning). Update `docs/Features.md`, `docs/HowToUse.md`,
   `docs/TechnicalDocumentation.md`.

<a id="t02"></a>
## 02 Settings group "Data sources & keys" 👤 🟠

Approved by the owner. New group "Datenquellen & Schlüssel" / "Data sources & keys" in
`App/src/screens/SettingsScreen.tsx`:

- Move the translation API key row (`settings.translation`) and the USDA key row (`settings.usda`)
  out of the group "Sprache" / "Language" into the new group.
- Position: after the rules group, before "Hilfe & Info". ❓ The current order is Bewertung (rules),
  Sprache, Open Food Facts Konto, Datenbank-Backup, Hilfe & Info — whether the new group goes
  directly after "Bewertung" or directly before "Hilfe & Info" is not stated; confirm.
- Add the i18n group title (de/en), update `App/src/screens/__tests__/SettingsScreen.test.tsx`
  and the settings tables in `docs/Features.md` and `docs/HowToUse.md`.

<a id="t03"></a>
## 03 Testing on the phone with Expo Go 🔴

Nothing of this branch has been tried on a device yet.

Setup: in `App/` run `npx expo start --offline --port 8081`, connect the phone via USB and run
`adb reverse tcp:8081 tcp:8081`, then open the project in Expo Go.

Check:

- **Migrations 9 and 10** on the existing test database (a v8 installation with user data):
  rules, products and favorites survive; new rules are added once; no duplicates.
- **Background refresh** of stored products (`StoredProductRefreshService`): runs after start,
  at most 10 requests per minute, catalog ratings update, edits and USDA data are kept, stops
  offline and continues on the next start.
- **Company lookup with Wikidata:** search, pick, collected brands, refresh, matching on real
  products (brand start, "Kit Kat"/"KitKat").
- **Egg code reader** (`/egg-code`) from the scanner and from Settings → Hilfe & Info.
- **USDA key:** save, delete, lookup of a US barcode, error messages (invalid key, limit).
- **Layout** of the buttons "Barcode eingeben" and "Eiercode prüfen" on narrow screens
  (wrapping, truncation, touch targets).

<a id="t04"></a>
## 04 Push and pull request 👤 🔒

The branch is local only. Push it and open a pull request only after the owner's explicit OK.

<a id="t05"></a>
## 05 Open questions and ideas ❓

- **Recalls from lebensmittelwarnung.de:** only an unofficial API exists. ❓ Decide whether to use
  it at all.
- **USDA lookup when Open Food Facts has an entry without ingredients:** today USDA is only asked
  for barcodes Open Food Facts does not know. 💡 Also ask when the entry lacks ingredients.
- **Egg codes of other countries** accept any farm number (e.g. "0-AT-1"); only German codes are
  checked in detail. ⚪
- **"nicht gezüchtet"** is flagged by the seed rule "gezüchtet" (category Zuchtfisch). Too strict,
  intentionally kept for now. ⚪
- **Category preset "Treib- & Schutzgase"** is still offered in the rule editor
  (`CATEGORY_PRESETS` in `RuleEditorSheet.tsx`), although no seeded rule uses it since
  migration 9 removed the gas rules. ❓ Keep or remove.
- **Commit message of `cc28830`** says checks are only created on fresh installs; in fact
  migration 9 creates them on existing installations too. History is not rewritten; this note is
  the correction.
- **About text and BVL:** the About data-source text names Open Food Facts, USDA FoodData Central
  and Wikidata, but not the BVL report used for the pesticide-risk crops. ❓ Add it?
- **Alcohol rules, remaining edge cases** ⚪: "Rum" only counts at the start of a word, so a
  compound like "Inländerrum" is missed (needed to avoid "durum", "Krume", "Serum"); "ginger beer"
  and "root beer" (usually alcohol-free soft drinks) count as beer; "Porto" also matches the
  Italian word for harbour.

<a id="t06"></a>
## 06 Known limits

Not fixable from the product data:

- No pesticide values per product; the pesticide check only flags crops from the BVL report 2023.
- Vertical farming cannot be detected.
- PFAS / Teflon in packaging or cookware cannot be detected.
- The packager code names the last processing or packing establishment, not the origin of the raw
  materials.
- New genomic techniques: from 17.07.2028, category-1 NGT plants need no food label
  (Regulation (EU) 2026/1388). ⚠️ Research note from an earlier session, not re-verified; such
  products cannot be recognised by the app.
