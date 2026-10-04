# Open Tasks — FoodCheck

State of branch `feature/natural-food-checks` (database version 12, `RATING_LOGIC_VERSION` 8,
794 built-in rules, 72 test suites / 847 tests). Items 01 and 02 are done; everything else below
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
- **Migration 12:** category Wasser-Tests with 13 rules and the Nestlé rule (216 names, 195
  active) appear once; an existing own Nestlé rule is kept and not duplicated; findings on a
  real Volvic, Perrier or Gut & Günstig water show reason and sources.
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
- **Water checks, open points** ❓:
  - No infant-food label exists in the Open Food Facts label taxonomy; the note matches label
    tags containing säugling/sauglings/infant/nourrisson/baby (not "not recommended"). Not seen
    on a real product yet.
  - Many waters carry both `en:natural-mineral-waters` and `en:table-waters` (e.g. a regional
    brand); such products currently flag as table water. Kept strict for now. ❓ Keep or let
    natural mineral water win.
  - Nitrite, manganese, arsenic and uranium are hardly ever entered; arsenic and uranium have no
    Open Food Facts field, so they are not checked.
  - The golden products contain no water with categories, so the golden baseline did not
    change. 💡 Add a few waters to the golden set.
  - The category preset "Wasser" is also offered for new ingredient rules. ❓ Keep?
- **Water test rules (migration 12), open points** ❓:
  - "Reinbeker Klosterquelle Frische Brise" matches every Frische Brise variant of that brand,
    not only the still one that Öko-Test rated; "Frische Brise" is also a product line with
    several variants. ⚠️ Possibly too broad; narrow it with "Still" once real product names
    are known.
  - Product names on Open Food Facts vary ("Naturelle" vs. "Naturell", missing variant
    words), so some criticised waters may not match. Not checked against real entries yet.
  - The test results (Öko-Test 07/2025 and 07/2026) are taken from the press articles named
    as sources; the original Öko-Test issues were not checked.
  - Perrier, Vittel, Contrex and Hépar also match the Nestlé company rule, so such a water is
    critical and additionally carries the water test red flag.
  - Hépar is not linked to Nestlé in Wikidata; it was added to the frozen Nestlé names by hand.
  - Pre-excluded Nestlé names (generic or non-food, switch on in the editor): Arpège, Lanvin,
    Nintendo Cereal System, Teenage Mutant Ninja Turtles Cereal, Petfinder, Plus, Lion, Nuts,
    Crisp, Fab, Fitness, Orion, Felix, Tip Top, Baton, Mirage, Cabana, Jede, Boost, Panna,
    Eskimo.
  - The golden rule sets contain no product or company rules, so the golden baseline did not
    change.

<a id="t06"></a>
## 06 Known limits

Not fixable from the product data:

- No pesticide values per product; the pesticide check only flags crops from the BVL report 2023.
- Water: uranium, arsenic, pesticide metabolites (e.g. TFA), microplastics and cleaning residues
  from bottle washing are not in the product data; the water note says so.
- Vertical farming cannot be detected.
- PFAS / Teflon in packaging or cookware cannot be detected.
- The packager code names the last processing or packing establishment, not the origin of the raw
  materials.
- New genomic techniques: from 17.07.2028, category-1 NGT plants need no food label
  (Regulation (EU) 2026/1388). ⚠️ Research note from an earlier session, not re-verified; such
  products cannot be recognised by the app.
