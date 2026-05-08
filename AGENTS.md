# TrueFood-Scanner Agent Guide

## Scope
- Work primarily in `App/`; that folder contains the Expo app, TypeScript source, and Jest setup.
- Keep changes aligned with the current MVP phase unless the task explicitly targets later roadmap items.

## Architecture Rules
- Follow the layered structure in `App/src/`: `screens` -> `store` -> `domain` -> `infrastructure`.
- Keep `App/src/domain/` framework-agnostic. Do not import React, React Native, Expo, Zustand, or persistence libraries there.
- Treat `App/src/infrastructure/api/OpenFoodFactsClient.ts` as the external data boundary; validate missing or partial API data defensively.
- Keep app state in Zustand stores only when needed; avoid adding Redux or Context-based app state.
- Apply SOLID principles strictly in every change.
- Prefer modular, loosely coupled design over large shared modules or convenience abstractions.
- Use dependency injection and interfaces to isolate dependencies, enable mocking, and keep business logic testable.

## Project Conventions
- Use TypeScript strictly. Avoid `any` and prefer explicit domain types from `App/src/types/`.
- Prefer small, testable functions and pure domain logic.
- Add tests alongside the touched domain code, following the existing `App/src/domain/analysis/__tests__/` pattern.
- Do not add SQLite-backed persistence, catalog features, favorites, or OCR unless the task explicitly targets Phase 2+.
- Write clean, self-documenting code with clear names and straightforward control flow.
- Do not add unnecessary comments; only use them when the code cannot reasonably explain itself.

## Commands
- Start the app: `cd App && npm start`
- Android: `cd App && npm run android`
- iOS: `cd App && npm run ios`
- Web: `cd App && npm run web`
- Tests: `cd App && npm test`

## Reference Docs
- [Systemarchitektur](docs/02_Systemarchitektur.md) for layer boundaries and data flow.
- [Roadmap](docs/04_Roadmap.md) for phase scope and MVP vs. later features.
- [Lastenheft](docs/01_Lastenheft.md) for requirements and acceptance criteria.
- [UX-Konzept](docs/03_UX-Konzept.md) for screen behavior and visual requirements.

## Agent Behavior
- Prefer minimal, focused edits that match existing conventions.
- Link to the docs above instead of repeating their content.
- If a requested change crosses phases or layers, call out the boundary before making it.