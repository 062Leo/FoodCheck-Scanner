# FoodScanner – TODO

---

## ✅ Milestone 0 – Projekt-Setup
- [x] Expo-Projekt mit TypeScript erstellen
- [x] Expo Go auf Gerät installieren & testen
- [x] Abhängigkeiten installieren (`expo-camera`, `expo-sqlite`, `zustand`, `expo-router`, etc.)
- [x] Verzeichnisstruktur anlegen
- [x] ESLint + Prettier konfigurieren
- [x] Jest Setup & erster Dummy-Test
- [x] GitHub-Repository anlegen

---

## ✅ Milestone 1 – MVP: Scan & Bewertung

### Domain-Logik
- [x] `types/Product.ts` – Produkt-Modell
- [x] `types/ScanResult.ts` – Analyse-Ergebnis-Typen
- [x] `domain/rules/defaultRules.ts` – hardcodierte Red-Flag-Liste
- [x] `domain/analysis/RedFlagAnalyzer.ts` – pure function, keine Framework-Abhängigkeiten
- [x] `domain/analysis/NovaScoreEvaluator.ts` – Nova 1–4 → Label & Farbe
- [x] `domain/analysis/ProductRating.ts` – Red Flags + Nova → Gesamtstatus
- [x] Unit-Tests: RedFlagAnalyzer, NovaScoreEvaluator, ProductRating

### Infrastruktur & API
- [x] `infrastructure/api/OpenFoodFacts.types.ts` – API-Response-Typen
- [x] `infrastructure/api/OpenFoodFactsClient.ts` – fetch, User-Agent, null bei status=0
- [x] Offline-Check (`@react-native-community/netinfo`)

### Screens & Navigation
- [x] `app/_layout.tsx` – Root Stack
- [x] `app/(tabs)/_layout.tsx` – Tab Layout
- [x] `ScannerScreen` – Kamera, animierter Scan-Rahmen, Haptics, EAN-Erkennung
- [x] `ResultScreen` – Ampel-Banner, Red Flags, Nova-Badge, Zutatenliste (Accordion)
- [x] Shared Components: `SkeletonLoading`, `Toast`, `Accordion`
- [x] Fehler-States: Produkt nicht gefunden, kein Internet, Zurück-Button

### Abnahme
- [x] 5 Produkte scannen → korrekte Bewertung
- [x] Fehlerfall ohne Crash
- [x] Alle Unit-Tests grün

---

## ⏳ Milestone 2 – Katalog & Favoriten

### Datenbank
- [ ] `infrastructure/db/DatabaseService.ts` – SQLite init, Schema erstellen, Migrations-Logik
- [ ] `infrastructure/db/ProductRepository.ts` – `insert`, `findByEan`, `findAll`, `delete`
- [ ] `infrastructure/db/FavoritesRepository.ts` – `add`, `remove`, `findAll`, `isFavorite`
- [ ] Unit-Tests für beide Repositories

### State & Integration
- [ ] `store/catalogStore.ts` mit Zustand anlegen
- [ ] Scan-Flow erweitern: nach Analyse → Produkt in SQLite speichern
- [ ] `ResultScreen`: Favoriten-Toggle implementieren und persistieren

### Screens
- [ ] `CatalogScreen` – Produktliste, Filter-Chips (Alle/OK/Warnung/Kritisch), Tap → ResultScreen
- [ ] `FavoritesScreen` – Favoriten-Liste, Leerzustand
- [ ] Swipe-to-Delete im Katalog (mit Bestätigung)
- [ ] Tab-Navigation für alle 3 Tabs aktivieren
- [ ] Offline-Ansicht: gecachte Produkte ohne Internet anzeigen

### Abnahme
- [ ] 10 Produkte scannen → alle im Katalog sichtbar
- [ ] Favorit setzen → erscheint im Favoriten-Tab
- [ ] App neu starten → Daten bleiben erhalten
- [ ] Produkt löschen → verschwindet aus Katalog und Favoriten

---

## ⏳ Milestone 3 – Custom Filter-Regeln

### Domain & Datenbank
- [ ] `types/FilterRule.ts` – Typen finalisieren (Ingredient-Rule + Nutrient-Rule mit Threshold)
- [ ] `filter_rules`-Tabelle in SQLite aktivieren
- [ ] `infrastructure/db/FilterRuleRepository.ts` – CRUD für Regeln
- [ ] `RedFlagAnalyzer` auf dynamische Regeln umstellen (statt hardcoded)
- [ ] Migrations-Logik: hardcodierte Regeln als Seed in DB importieren

### State & UI
- [ ] `store/filterStore.ts` mit Zustand anlegen
- [ ] Filter-Verwaltungs-Screen – Liste aller Regeln, hinzufügen, bearbeiten, löschen
- [ ] UI: Ingredient-Regel anlegen (Suchfeld + Severity-Toggle: Red Flag / OK)
- [ ] UI: Nutrient-Regel anlegen (Nährwert auswählen, Operator `>` / `<`, Grenzwert eingeben)

### Abnahme
- [ ] Regel „Palmöl = OK" → taucht nicht mehr als Red Flag auf
- [ ] Regel „Zucker > 3 g/100 ml = Warnung" → greift korrekt
- [ ] Regeln überleben App-Neustart

---

## ⏳ Milestone 4 – OCR & OFF-Contribution-Flow *(v3)*

### Setup
- [ ] `@react-native-ml-kit/text-recognition` installieren
- [ ] `expo-secure-store` installieren
- [ ] OFF-Account anlegen (einmalig auf openfoodfacts.org)
- [ ] `types/ContributeFormData.ts` anlegen

### OcrService
- [ ] `infrastructure/ocr/OcrService.ts` – ML Kit Wrapper (ImageUri → Rohtext)
- [ ] Unit-Test für OcrService

### OFF Write Client
- [ ] `infrastructure/api/OpenFoodFactsWriteClient.ts` – POST zu OFF API
- [ ] Fehlerbehandlung: offline, Auth-Fehler, Server-Error
- [ ] Unit-Test mit gemocktem fetch

### ContributeScreen – 3-Schritt-Flow
- [ ] Screen-Grundstruktur mit Schritt-Indikator
- [ ] **Schritt 1:** Kamera für Zutatenliste, "Foto aufnehmen" + "Überspringen"
- [ ] **Schritt 2:** Kamera für Nährwerte, "Foto aufnehmen" + "Überspringen"
- [ ] **Schritt 3:** Editierbares Formular (Name, Marke, Kategorie, Zutaten, Nährwerte) – OCR-vorausgefüllt
- [ ] Pflichtfeld-Validierung (Produktname)
- [ ] Bestätigungs-Dialog vor Upload
- [ ] Upload → `OpenFoodFactsWriteClient` + sofortige lokale Analyse → ResultScreen
- [ ] Upload-Fehler → Toast, lokale Analyse trotzdem anzeigen

### OFF-Account Setup
- [ ] Einmaliger Setup-Flow beim ersten Contribute-Versuch
- [ ] Credentials speichern mit `expo-secure-store`
- [ ] "Beitragen"-Button im ResultScreen bei `status === 0` einbauen

### Abnahme
- [ ] Foto Zutatenliste → Text korrekt ins Formular übernommen
- [ ] Foto Nährwerte → Felder vorausgefüllt
- [ ] Beide Schritte überspringen → Formular manuell ausfüllbar
- [ ] Upload ohne Produktname → Button deaktiviert
- [ ] Upload erfolgreich → ResultScreen mit sofortiger Analyse
- [ ] Upload offline → Toast, Analyse trotzdem sichtbar
