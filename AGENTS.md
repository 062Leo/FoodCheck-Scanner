# FoodCheck Agent Guide

## Scope
- All source code lives in `App/`. Root `package-lock.json` is an empty workspace placeholder.
- All phases (0–4) are complete per the roadmap. Do not treat SQLite persistence, catalog, favorites, filter rules, or OCR as off-limits.

## Commands
Run from `App/`:
- `npm start` — Expo dev server
- `npm run android` / `npm run ios` / `npm run web`
- `npm test` — Jest (23 suites, 265 tests, all passing)
- `npm run lint` / `npm run lint:fix` — ESLint flat config (`eslint.config.js`)
- `npm run format` / `npm run format:check` — Prettier (single quotes, semi, trailingComma es5, printWidth 100, tabWidth 2)
- `npx tsc --noEmit` — type-check (0 errors)

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
- Tabs: Scanner (index), Catalog, Favorites, Settings. Stack screens: result, edit/[ean], settings/filters, settings/api-key.

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
- `npx tsc --noEmit` — type-check is clean (0 errors).
- Lint — clean (0 errors).
- `App/src/screens/ResultScreen.tsx` was the older dead version — the active one is `App/src/screens/ProductScreen.tsx`.

## Project Conventions
- TypeScript strict (`tsconfig.json` extends `expo/tsconfig.base` with `"strict": true`).
- Avoid `any` — ESLint enforces this. Prefer domain types from `App/src/types/`.
- No unnecessary comments; write self-documenting code.
- DI via constructor injection for domain classes, module-level singletons for repositories.
- `app.json` has `"newArchEnabled": true` — Expo New Architecture is enabled.
- No native Android/iOS directories in git (generated at build time).
- OFF User-Agent header must be `FoodCheck/1.0 (private)`.

## Reference Docs
- [Features & Capabilities](docs/Features.md) — complete feature list, DB schema, API integrations
- [How To Use](docs/HowToUse.md) — user-facing guide, troubleshooting
- [Technical Documentation](docs/TechnicalDocumentation.md) — architecture, data flow, tech stack, testing
- [Feature Todo List](docs/Todo.md) — planned / in-progress / done items
- `docs/01_Lastenheft.md` through `docs/04_Roadmap.md` — original project planning docs (referenced but may be outdated/removed)
- `docs/openfoodfacts_api_reference.md` / `docs/CURRENT_API_STATUS.md` — API reference docs (referenced but may be outdated/removed)
