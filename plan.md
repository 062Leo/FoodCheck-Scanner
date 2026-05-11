# TrueFood Scanner — Feature Expansion Roadmap

## Project Context

TrueFood Scanner is a React Native + Expo mobile application focused on food transparency and ingredient analysis.

The app already includes a significant amount of functionality and infrastructure:

- Barcode scanning
- Open Food Facts API integration
- Local SQLite product storage
- OCR support via ML Kit
- Product analysis pipeline
- Red flag detection
- NOVA score analysis
- Favorites system
- Offline-capable scanned product catalog
- Layered architecture:
  - UI
  - State
  - Domain
  - Infrastructure

The project is intentionally backend-less:
- No custom cloud backend
- No tracking
- No user accounts
- Local-first architecture

Important architectural constraint:

We do NOT want a full offline Open Food Facts dump.

Instead:
- Products should only become offline-available after the user scans them once while online.
- When a product is scanned:
  1. Fetch all data from APIs
  2. Normalize and store locally
  3. Make the product permanently available offline
- Future scans of the same product should work entirely offline.

When implementing new features:
- Existing implementations must always be reviewed first.
- Avoid duplicate logic.
- Replace or refactor existing systems where necessary instead of stacking parallel implementations.
- Reuse existing architecture patterns and abstractions whenever possible.

---

# Phase 1 — Persistent Offline Product System

## Goal

Transform the current scan cache into a robust local-first offline product system.

---

## Task Group: Analyze Existing Storage Flow

### Tasks

- Review current SQLite schema
- Identify how scanned products are currently persisted
- Locate duplicate product models/types
- Audit existing repository and storage abstractions
- Identify temporary cache logic that should become persistent
- Document current scan → fetch → save lifecycle
- Verify how images are currently stored or referenced

---

## Task Group: Introduce Permanent Offline Product Records

### Tasks

- Create a dedicated persistent scanned-products table
- Store:
  - barcode
  - product metadata
  - ingredient data
  - nutrition data
  - NOVA score
  - analysis results
  - timestamps
  - image references
- Add migration support for older schemas
- Normalize nested API responses before storage
- Create typed domain models for offline products
- Ensure backward compatibility with existing scans

---

## Task Group: Offline-First Scan Resolution

### Tasks

- Implement lookup priority:
  1. local database
  2. API fallback
- Detect network availability before API requests
- Prevent unnecessary API calls for already-known products
- Add stale-data handling strategy
- Add versioning for locally stored product data
- Add background refresh capability when online
- Ensure scans work fully offline after first successful fetch

---

## Task Group: Product Media Persistence

### Tasks

- Evaluate current image handling
- Download and locally persist scanned product images
- Create local image cache manager
- Replace remote image URLs with local references when available
- Implement cleanup strategy for orphaned media
- Add image compression/resizing pipeline if needed

---

# Phase 2 — Robotoff AI Integration

## Goal

Integrate Open Food Facts Robotoff insights into the analysis pipeline.

---

## Task Group: Existing Analysis Audit

### Tasks

- Review current RedFlagAnalyzer implementation
- Review current NOVA analysis flow
- Identify extension points for AI insights
- Remove duplicated ingredient classification logic if Robotoff already provides it

---

## Task Group: Robotoff API Client

### Tasks

- Create infrastructure/api/RobotoffClient.ts
- Implement typed API responses
- Add retry/error handling
- Add timeout handling
- Add request cancellation support
- Add response validation
- Cache Robotoff responses locally

---

## Task Group: AI Insight Processing

### Tasks

- Create domain/analysis/RobotoffInsightAnalyzer.ts
- Convert Robotoff insights into internal warning structures
- Merge Robotoff results with existing RedFlag analysis
- Add confidence scoring
- Add unsupported insight filtering
- Ensure deterministic analysis output

---

## Task Group: UI Integration

### Tasks

- Add AI insights section to ResultScreen
- Differentiate:
  - local analysis
  - AI-generated insights
- Add expandable explanation cards
- Add loading/error states
- Ensure UI consistency with current design system

---

# Phase 3 — Advanced Ingredient Intelligence

## Goal

Replace simplistic ingredient matching with structured taxonomy-based analysis.

---

## Task Group: OFF Taxonomy Integration

### Tasks

- Analyze existing ingredient parsing logic
- Replace substring-based additive detection
- Import OFF additive taxonomy
- Convert taxonomy into app-compatible JSON format
- Build additive lookup service
- Add multilingual additive aliases
- Add E-number normalization support

---

## Task Group: Ingredient Risk Engine

### Tasks

- Create structured ingredient risk scoring
- Support:
  - additives
  - emulsifiers
  - sweeteners
  - preservatives
  - oils
- Add configurable severity levels
- Add confidence scoring
- Add ingredient grouping support
- Add duplicate detection

---

## Task Group: Rule System Refactor

### Tasks

- Review current custom filter rule system
- Remove overlapping rule logic
- Refactor rules into modular analyzers
- Support composable rule pipelines
- Add unit-test coverage for all analyzers

---

# Phase 4 — OCR Pipeline Improvements

## Goal

Improve ingredient extraction quality and OCR usability.

---

## Task Group: Existing OCR Audit

### Tasks

- Analyze current ML Kit OCR integration
- Identify weak points in preprocessing
- Identify language limitations
- Audit current OCR correction logic

---

## Task Group: OCR Preprocessing Pipeline

### Tasks

- Add image sharpening
- Add contrast normalization
- Add rotation correction
- Add blur detection
- Add low-light detection
- Add crop assistance
- Benchmark OCR accuracy improvements

---

## Task Group: Structured OCR Extraction

### Tasks

- Separate:
  - ingredients
  - nutrition values
  - allergens
- Add heuristic parsing rules
- Add fallback parsing modes
- Add confidence indicators
- Improve multilingual text handling

---

# Phase 5 — Product History & Intelligence

## Goal

Turn the local product database into a useful long-term knowledge system.

---

## Task Group: Scan History Refactor

### Tasks

- Review existing product catalog implementation
- Replace duplicate scan entries
- Add scan timestamps
- Add last-seen tracking
- Add product revisit statistics
- Add search indexing

---

## Task Group: Smart Product Collections

### Tasks

- Add:
  - recently scanned
  - most scanned
  - highest risk
  - favorites
- Add filtering capabilities
- Add sorting capabilities
- Add category grouping

---

## Task Group: Local Analytics

### Tasks

- Add local consumption statistics
- Add ingredient trend analysis
- Add additive frequency tracking
- Add ultra-processed product ratio
- Ensure analytics remain fully offline

---

# Phase 6 — Architecture Hardening

## Goal

Prepare the codebase for long-term maintainability and scaling.

---

## Task Group: Domain Refactor

### Tasks

- Remove duplicated models
- Separate DTOs from domain entities
- Standardize repository interfaces
- Introduce stricter typing
- Add domain validation layer

---

## Task Group: State Management Cleanup

### Tasks

- Audit Zustand stores
- Remove duplicated derived state
- Add selector optimization
- Reduce unnecessary rerenders
- Separate UI state from domain state

---

## Task Group: Testing Infrastructure

### Tasks

- Add unit tests for analyzers
- Add repository tests
- Add offline flow tests
- Add OCR parsing tests
- Add API contract tests
- Add regression test suite

---

# Phase 7 — UI/UX Modernization

## Goal

Improve scan usability and result readability.

---

## Task Group: Scan Flow Improvements

### Tasks

- Improve scan feedback animations
- Add scan success states
- Add offline scan indicators
- Add retry flows
- Improve low-light usability

---

## Task Group: Result Screen Redesign

### Tasks

- Redesign product summary cards
- Improve ingredient readability
- Add risk visualization
- Add expandable detail sections
- Add analysis explanations
- Improve accessibility

---

## Task Group: Performance Optimization

### Tasks

- Reduce ResultScreen rerenders
- Optimize FlatList rendering
- Optimize image loading
- Reduce SQLite query overhead
- Add lazy loading where possible

---

# Final Notes

Implementation priorities:

1. Persistent offline product system
2. Robotoff integration
3. Ingredient intelligence refactor
4. OCR improvements
5. Product intelligence features
6. Architecture hardening
7. UI modernization

Core principle:
Only products scanned by the user should become available offline.
No full Open Food Facts database dump should ever be bundled or downloaded.