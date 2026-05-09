# FoodScanner – TODO

---

## ✅ Milestone 0 – Projekt-Setup
- [x] Expo-Projekt mit TypeScript erstellen
- [x] Expo Go auf Gerät installieren & testen
- [x] Abhängigkeiten installieren (`expo-camera`, `expo-sqlite`, `zustand`, `expo-router`, etc.)
- [x] Verzeichnisstruktur anlegen
- [x] ESLint + Prettier konfigurieren

## ✅ Milestone 1 – MVP: Scan & Bewertung
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

### State & Integration
 ### Setup
 - [x] `@react-native-ml-kit/text-recognition` installieren
 - [x] `expo-secure-store` installieren
 - [x] OFF-Account anlegen (einmalig auf openfoodfacts.org)
 - [x] `types/ContributeFormData.ts` anlegen

### Abnahme
 - [x] `@react-native-ml-kit/text-recognition` installieren
 - [x] `expo-secure-store` installieren
 - [x] OFF-Account anlegen (einmalig auf openfoodfacts.org)
 - [x] `types/ContributeFormData.ts` anlegen
 
 ### OcrService

## ⏳ Milestone 3 – Custom Filter-Regeln

### Domain & Datenbank
 [x] `infrastructure/db/FilterRuleRepository.ts` – CRUD für Regeln (insert, findAll, update, deleteById + 3/3 tests passing)

### State & UI

### Abnahme


## ⏳ Milestone 4 – OCR & OFF-Contribution-Flow *(v3)*
 - [x] `filter_rules`-Tabelle in SQLite aktivieren
 - [x] `infrastructure/db/FilterRuleRepository.ts` – CRUD für Regeln (insert, findAll, update, deleteById + 3/3 tests passing)
- [x] `RedFlagAnalyzer` auf dynamische Regeln umstellen (statt hardcoded)
 
 ### State & UI
 - [x] `store/filterStore.ts` mit Zustand anlegen

### OcrService

### OFF Write Client
 ### Domain & Datenbank
 - [x] `types/FilterRule.ts` – Typen finalisieren (Ingredient-Rule + Nutrient-Rule mit Threshold)
 - [x] `filter_rules`-Tabelle in SQLite aktivieren
 - [x] Migrations-Logik: hardcodierte Regeln als Seed in DB importieren
 - [x] `infrastructure/db/FilterRuleRepository.ts` – CRUD für Regeln (insert, findAll, update, deleteById + 3/3 tests passing)
 - [ ] `RedFlagAnalyzer` auf dynamische Regeln umstellen (statt hardcoded)
 
 ### State & UI
 - [x] `store/filterStore.ts` mit Zustand anlegen
- [x] Filter-Verwaltungs-Screen – Liste aller Regeln, hinzufügen, bearbeiten, löschen
- [x] UI: Ingredient-Regel anlegen (Suchfeld + Severity-Toggle: Red Flag / OK)
- [x] UI: Nutrient-Regel anlegen (Nährwert auswählen, Operator `>` / `<`, Grenzwert eingeben)

### ContributeScreen – 3-Schritt-Flow
 - [ ] `@react-native-ml-kit/text-recognition` installieren
 - [ ] `expo-secure-store` installieren
 - [ ] OFF-Account anlegen (einmalig auf openfoodfacts.org)
 - [ ] `types/ContributeFormData.ts` anlegen

### OFF-Account Setup

### Abnahme
 ### State & Integration
 - [x] Scan-Flow erweitern: nach Analyse → Produkt in SQLite speichern
 - [x] Tab-Navigation für alle 3 Tabs aktivieren
 - [x] Offline-Ansicht: gecachte Produkte ohne Internet anzeigen
 
 ### Abnahme
 - [x] 10 Produkte scannen → alle im Katalog sichtbar
 - [x] Favorit setzen → erscheint im Favoriten-Tab
 - [x] App neu starten → Daten bleiben erhalten
 - [x] Produkt löschen → verschwindet aus Katalog und Favoriten
 
 ---
 
 ## ⏳ Milestone 3 – Custom Filter-Regeln
 
 ### Domain & Datenbank
 - [x] `types/FilterRule.ts` – Typen finalisieren (Ingredient-Rule + Nutrient-Rule mit Threshold)
 - [x] `filter_rules`-Tabelle in SQLite aktivieren
 - [x] Migrations-Logik: hardcodierte Regeln als Seed in DB importieren
 - [x] `infrastructure/db/FilterRuleRepository.ts` – CRUD für Regeln (insert, findAll, update, deleteById + 3/3 tests passing)
 - [ ] `RedFlagAnalyzer` auf dynamische Regeln umstellen (statt hardcoded)
 
 ### State & UI
 - [x] `store/filterStore.ts` mit Zustand anlegen
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
 - [x] `@react-native-ml-kit/text-recognition` installieren
 - [x] `expo-secure-store` installieren
 - [x] OFF-Account anlegen (einmalig auf openfoodfacts.org)
 - [x] `types/ContributeFormData.ts` anlegen
 
 ### OcrService
 - [x] `infrastructure/ocr/OcrService.ts` – ML Kit Wrapper (ImageUri → Rohtext) + parseNutriments()
 - [x] Unit-Test für OcrService (recognizeText + parseNutriments mit 8 tests passing)
 
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
