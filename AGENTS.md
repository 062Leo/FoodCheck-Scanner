# TrueFood-Scanner Agent Guide

## Scope
- All source code lives in `App/`. Root `package-lock.json` is an empty workspace placeholder.
- All phases (0–4) are complete per the roadmap. Do not treat SQLite persistence, catalog, favorites, filter rules, or OCR as off-limits.

## Commands
Run from `App/`:
- `npm start` — Expo dev server
- `npm run android` / `npm run ios` / `npm run web`
- `npm test` — Jest (9 suites, 61 tests, all passing)
- `npm run lint` / `npm run lint:fix` — ESLint flat config (`eslint.config.js`)
- `npm run format` / `npm run format:check` — Prettier (single quotes, semi, trailingComma es5, printWidth 100, tabWidth 2)
- `npx tsc --noEmit` — type-check (currently has 4 known errors in FilterRuleRepository/FilterScreen, see below)

No dedicated `typecheck` script exists.

## Architecture

### Layer structure (`App/src/`)
```
screens/  →  store/  →  domain/  →  infrastructure/
components/                       ↑
  types/  ←───────────────────────┘ (zero deps, imported by all layers)
```

- `domain/` must remain **framework-agnostic**: no React, React Native, Expo, Zustand, or persistence imports. Only `types/` and local files.
- `infrastructure/` wraps external dependencies (OFF API, SQLite via expo-sqlite, ML Kit). It may import from `domain/` for interfaces (e.g. `Dictionary`) and seed data.
- `types/` is pure — no imports from other layers besides itself.

### Routing
- Expo Router file-based routing in `App/app/` — this is the real navigation source.
- `App/src/navigation/` is **empty** — do not add routes there.
- Tabs: Scanner (index), Catalog, Favorites, Filters. Stack screens: result, contribute, edit/[ean].

### Actual wiring pattern
Screens commonly instantiate domain classes and infrastructure repositories **directly** (e.g. `new ProductRating(new RedFlagAnalyzer(), new NovaScoreEvaluator())`). The Zustand stores (`catalogStore`, `filterStore`) handle persistence state, not domain orchestration. Follow this existing pattern rather than forcing everything through stores.

## ESLint & Prettier
- **Active config**: `eslint.config.js` (flat config for ESLint 10). `.eslintrc.json` is legacy, ignored by ESLint 10, and `.eslintignore` is also deprecated — keep them but don't modify.
- Key rules: `@typescript-eslint/no-explicit-any` is **error**, `no-unused-vars` is off in favor of `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: "^_"` / `varsIgnorePattern: "^_"`.
- Prettier runs as an ESLint plugin (`prettier/prettier: error`).

## Testing
- Jest preset `jest-expo` with custom `transformIgnorePatterns` for Expo/RCT modules.
- Test files in `__tests__/` directories alongside source.
- No snapshot tests; all tests are assertions-based.
- To run a single test file: `npm test -- --testPathPattern=RedFlagAnalyzer`

## Known Issues
- `npx tsc --noEmit` fails with 4 errors: `FilterRuleRepository.ts` references `created_at` on `NewFilterRule` (which omits it), and the `update` method uses `Record<string, unknown>` instead of the typed SQLite bind params. `FilterScreen.tsx` also references `created_at` on `NewFilterRule`. Lint and tests pass; type-check is the safety gap.
- `App/src/screens/ResultScreen.tsx` is an older dead version — the active one is `App/src/screens/ResultScreen/ResultScreen.tsx`.

## Project Conventions
- TypeScript strict (`tsconfig.json` extends `expo/tsconfig.base` with `"strict": true`).
- Avoid `any` — ESLint enforces this. Prefer domain types from `App/src/types/`.
- No unnecessary comments; write self-documenting code.
- DI via constructor injection for domain classes, module-level singletons for repositories.
- `app.json` has `"newArchEnabled": true` — Expo New Architecture is enabled.
- No native Android/iOS directories in git (generated at build time).
- OFF User-Agent header must be `FoodScanner/1.0 (private)`.

## Reference Docs
- [Systemarchitektur](docs/02_Systemarchitektur.md) — layer boundaries, data flow, DB schema
- [Roadmap](docs/04_Roadmap.md) — all phases complete, useful for understanding what was built
- [Lastenheft](docs/01_Lastenheft.md) — requirements and acceptance criteria
- [UX-Konzept](docs/03_UX-Konzept.md) — screen behavior and visual design tokens
- [OFF API Reference](docs/openfoodfacts_api_reference.md) — complete OFF API technical reference
- [Current API Status](docs/CURRENT_API_STATUS.md) — audit of existing OFF integration with gap analysis
