# Open Tasks — FoodCheck

State of branch `feature/natural-food-checks` (database version 10, `RATING_LOGIC_VERSION` 6,
777 built-in rules, 70 test suites / 785 tests). Items 01 and 02 are done; everything else below
is still open.

Markers: 👤 decided by the owner · 💡 proposal · ❓ open · ⚠️ risk · 🔴 high · 🟠 medium · ⚪ low

<details>
<summary>Contents</summary>

- [01 Deselectable company names ✅](#t01)
- [02 Settings group "Data sources & keys" ✅](#t02)
- [03 Testing on the phone with Expo Go](#t03)
- [04 Push and pull request](#t04)
- [05 Open questions and ideas](#t05)
- [06 Known limits](#t06)

</details>

<a id="t01"></a>
## 01 Deselectable company names 👤 ✅

Done. Each collected name can be switched off in the company rule (counter "N von M Marken
aktiv", filter field and pages of 50 names, no nested list). Exclusions are stored as `excluded`
in the rule's `translations` JSON, compared normalized, kept on refresh for names still present;
the rule's own name cannot be switched off. Still to try on the phone (see [03](#t03)).

<a id="t02"></a>
## 02 Settings group "Data sources & keys" 👤 ✅

Done. The translation and USDA key rows moved from "Sprache" into the new group
"Datenquellen & Schlüssel" / "Data sources & keys", placed directly after the rules group
"Bewertung" (owner's decision).

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
  products (brand start, "Kit Kat"/"KitKat"); switching single brands off with 200+ names
  (scrolling, filter, "show more").
- **Egg code reader** (`/egg-code`) from the scanner and from Settings → Hilfe & Info.
- **USDA key:** save, delete, lookup of a US barcode, error messages (invalid key, limit).
- **Recalls:** Settings → Rückrufe appears after the first start online; list, links to the
  official notices, recall card on a product named in a current warning; flight mode keeps the
  cached list; nothing shows up while the source fails. The feature reads only the official
  RSS feed.
- **Layout** of the full-width "Barcode eingeben" button and the small egg icon next to it on
  narrow screens (truncation, touch target).

<a id="t04"></a>
## 04 Push and pull request 👤 🔒

The branch is local only. Push it and open a pull request only after the owner's explicit OK.

<a id="t05"></a>
## 05 Open questions and ideas ❓

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
  compound like "Inländerrum" is missed (needed to avoid "durum", "Krume", "Serum"); "Porto" also
  matches the Italian word for harbour.

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
