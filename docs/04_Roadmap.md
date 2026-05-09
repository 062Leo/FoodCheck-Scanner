# Roadmap – FoodScanner App

**Version:** 1.0  
**Stand:** 2025  
**Methode:** Iterative Entwicklung in klaren Phasen – jede Phase ist eigenständig deploybar auf dem eigenen Gerät.

---

## Phasen-Übersicht

```
Phase 0 │ Phase 1 │ Phase 2 │ Phase 3 │ Phase 4
  Setup │ MVP F01-F04 │ Soll/v2 │  Filter  │  OCR
  Setup │   MVP    │  Katalog │  Filter  │  OCR
```

---

## Phase 0 – Projekt-Setup

**Ziel:** Lauffähiges Grundgerüst auf dem eigenen Gerät.

### Aufgaben
- [x] `npx create-expo-app FoodScanner --template blank-typescript`
- [x] Expo Go auf dem Gerät installieren und testen
- [x] Abhängigkeiten installieren: `expo-camera`, `expo-sqlite`, `zustand`, `expo-router`
- [x] Verzeichnisstruktur gemäß Systemarchitektur anlegen (leere Dateien)
- [ ] ESLint + Prettier konfigurieren
- [x] Jest Setup: `jest.config.js`, erster Dummy-Test läuft durch
@@- [x] ESLint + Prettier konfigurieren
- [x] GitHub-Repository anlegen, `.gitignore` korrekt setzen

### Abnahme
- App startet auf dem Gerät (weißer Screen reicht)
- `npm test` läuft fehlerfrei durch
- Verzeichnisstruktur stimmt mit Architektur überein

---

## Phase 1 – MVP: Scan & Bewertung

**Ziel:** Barcode scannen → Bewertung sehen. Kernfunktion vollständig. Speicherung, Katalog und Favoriten sind noch nicht Teil des MVP.

### Aufgaben

**Schritt 1 – Infrastruktur**
- [x] `OpenFoodFactsClient.ts` implementieren (fetch + Typen)
- [x] Unit-Test: API-Response-Parsing mit gemocktem JSON
- [x] Kamera-Permission-Flow in `ScannerScreen` implementieren

**Schritt 2 – Domain-Logik**
- [x] `defaultRules.ts` mit hardcodierten Red-Flag-Listen befüllen
- [x] `RedFlagAnalyzer.ts` implementieren (pure function, kein Framework)
- [x] Unit-Tests für RedFlagAnalyzer (min. 10 Testfälle)
- [x] `NovaScoreEvaluator.ts` implementieren
- [x] `ProductRating.ts` – Gesamtbewertung aggregieren

**Schritt 3 – Scanner Screen**
- [x] `ScannerScreen` mit `expo-camera` und Barcode-Erkennung
- [x] Navigation zu `ResultScreen` nach erfolgreichem Scan

**Schritt 4 – Result Screen**
- [x] `ResultScreen` mit Ampel-Banner, Red-Flag-Liste, Nova-Badge
- [x] Fehlerbehandlung: Produkt nicht gefunden, API-Timeout

### Abnahme
- [x] 5 verschiedene Produkte scannen und korrekte Bewertung erhalten
- [x] Fehlerfall (unbekanntes Produkt) zeigt Toast ohne Crash
- [x] Alle Unit-Tests grün

---

## Phase 2 – Soll/v2: Katalog & Favoriten

**Ziel:** Jeder Scan wird gespeichert, Favoriten-Liste funktioniert. Entspricht den Soll-Kriterien F05-F08.

### Aufgaben

**Schritt 1 – Datenbank**
- [ ] `DatabaseService.ts` – SQLite initialisieren, Schema erstellen, Migrations-Logik vorbereiten
- [ ] `ProductRepository.ts` – insert, findByEan, findAll, delete
- [ ] `FavoritesRepository.ts` – add, remove, findAll, isFavorite
- [ ] Unit-Tests für Repositories (mit In-Memory-SQLite oder Mocks)

**Schritt 2 – State & Integration**
- [ ] `catalogStore.ts` mit Zustand anlegen
- [ ] Scan-Flow erweitern: nach Analyse → in DB speichern
- [ ] Result Screen: Favoriten-Toggle implementieren und persistieren

**Schritt 3 – Katalog & Favoriten Screens**
- [ ] `CatalogScreen` mit Liste, Filter-Chips, Tap-to-Detail
- [ ] `FavoritesScreen` mit Liste
- [ ] Tab-Navigation mit allen 3 Tabs
- [ ] Leerzustände (Empty States) für beide Listen

### Abnahme
- [ ] 10 Produkte scannen → alle im Katalog sichtbar
- [ ] Favorit setzen → erscheint in Favoriten-Tab
- [ ] App schließen und neu öffnen → Daten bleiben erhalten
- [ ] Produkt aus Katalog löschen → verschwindet aus beiden Listen

---

## Phase 3 – Custom Filter-Regeln

**Ziel:** Nutzer definiert eigene Red-Flag-Regeln und Grenzwerte.

### Aufgaben
- [ ] `FilterRule.types.ts` finalisieren (Ingredient-Rules + Nutrient-Rules mit Threshold)
- [ ] `filter_rules`-Tabelle in SQLite aktivieren und befüllen
- [ ] `FilterRuleRepository.ts` implementieren
- [ ] `RedFlagAnalyzer` auf dynamische Regeln umstellen (statt hardcoded)
- [ ] `filterStore.ts` mit Zustand
- [ ] UI: Filter-Verwaltungs-Screen (Liste, hinzufügen, bearbeiten, löschen)
- [ ] UI: Ingredient-Regel anlegen (Suchfeld + Severity-Toggle)
- [ ] UI: Nutrient-Regel anlegen (Nährwert auswählen, Operator, Grenzwert)
- [ ] Migrations-Logik: bestehende hardcodierte Regeln in DB importieren

### Abnahme
- [ ] Eigene Regel "Palmöl = OK" anlegen → erscheint nicht mehr als Red Flag
- [ ] Regel "Zucker > 3g/100ml = Warnung" → greift korrekt
- [ ] Regeln überleben App-Neustart

---

## Phase 4 – OCR & OFF-Contribution-Flow *(v3)*

**Ziel:** Produkte die nicht in Open Food Facts sind selbst erfassen – per Foto, OCR, editierbarem Formular und Upload zurück zu OFF. Sofortige lokale Analyse danach.

### Schritt 1 – Abhängigkeiten & Setup
- [ ] `@react-native-ml-kit/text-recognition` installieren (on-device OCR, kein API-Key)
- [ ] `expo-secure-store` installieren (sicheres Speichern des OFF-Accounts)
- [ ] OFF-Account anlegen (einmalig, kostenlos auf openfoodfacts.org)
- [ ] `types/ContributeFormData.ts` anlegen (alle Formularfelder typisiert)

### Schritt 2 – OcrService
- [ ] `infrastructure/ocr/OcrService.ts` implementieren
  - Nimmt `ImageUri` entgegen, gibt `string` (Rohtext) zurück
  - Wrapper um ML Kit – keine Business-Logik drin
- [ ] Unit-Test: Mock-Image → erwarteter Rohtext

### Schritt 3 – OFF Write Client
- [ ] `infrastructure/api/OpenFoodFactsWriteClient.ts` implementieren
  - POST zu `https://world.openfoodfacts.org/cgi/product_jqm2.pl`
  - Felder: `code` (EAN), `product_name`, `brands`, `categories`, `ingredients_text`, Nährwerte
  - Auth via gespeichertem OFF-Account (`expo-secure-store`)
- [ ] Fehlerbehandlung: offline, falsche Credentials, Server-Error
- [ ] Unit-Test mit gemocktem fetch

### Schritt 4 – ContributeScreen (3-Schritt-Flow)
- [ ] Screen-Struktur mit 3 Schritten anlegen (Schritt-Indikator oben)
- [ ] **Schritt 1 – Zutatenliste Foto:**
  - Kamera-Preview, "Foto aufnehmen"-Button
  - "Überspringen"-Button (springt zu Schritt 2)
  - Nach Foto: `OcrService` aufrufen, Rohtext als Zutatenliste vormerken
- [ ] **Schritt 2 – Nährwerte Foto:**
  - Gleicher Aufbau wie Schritt 1
  - "Überspringen"-Button (springt zu Schritt 3)
  - Nach Foto: `OcrService` aufrufen, Rohtext für Nährwert-Parsing vormerken
- [ ] **Schritt 3 – Formular:**
  - Alle Felder editierbar vorausfüllen (OCR-Ergebnisse oder leer)
  - Pflichtfeld-Validierung: Produktname darf nicht leer sein
  - Bestätigungs-Dialog vor Upload ("Wird öffentlich auf Open Food Facts gespeichert")
  - "Bestätigen & hochladen"-Button → `OpenFoodFactsWriteClient` + sofortige lokale Analyse
  - Bei Upload-Fehler: Toast, lokale Analyse trotzdem durchführen
- [ ] "Beitragen"-Button im ResultScreen bei `status === 0` (Produkt nicht gefunden) einbauen

### Schritt 5 – OFF-Account-Einrichtung
- [ ] Einmaliger Setup-Flow beim ersten Contribute-Versuch: Nutzername + Passwort eingeben
- [ ] Credentials sicher speichern mit `expo-secure-store`
- [ ] Link zu OFF-Registrierung falls noch kein Konto vorhanden

### Abnahme
- [ ] Zutatenliste fotografieren → Text wird erkannt und ins Formular übernommen
- [ ] Nährwerte fotografieren → Felder werden vorausgefüllt
- [ ] Beide Foto-Schritte überspringen → Formular bleibt leer, manuell ausfüllbar
- [ ] Formular ohne Produktname → Upload-Button deaktiviert
- [ ] Upload erfolgreich → Weiterleitung zu ResultScreen mit sofortiger Analyse
- [ ] Upload offline → Toast, lokale Analyse trotzdem sichtbar
- [ ] Bereits hochgeladenes Produkt: nach kurzer Zeit in OFF per EAN abrufbar


## Technische Qualitätsziele (gilt für alle Phasen)

| Ziel | Maßnahme |
|---|---|
| Testbarkeit | Domain-Logik hat null Framework-Abhängigkeiten |
| Modularität | Jede Datei hat genau eine Verantwortung |
| Typsicherheit | Kein `any` in TypeScript – ESLint-Regel aktiviert |
| Fehlerbehandlung | Jeder async-Call hat try/catch, niemals silent fails |
| Migrations-Sicherheit | DB-Schema nur über versionierte Migrations ändern |
| Lesbarkeit | Funktionen max. 30 Zeilen, sprechende Namen |

---

## Kontext-Übergabe ans KI-Tool (Vibe-Coding Workflow)

Für jede Coding-Session folgende Dateien als Kontext mitgeben:

1. `02_Systemarchitektur.md` → immer
2. `01_Lastenheft.md` → bei Fragen zu Anforderungen
3. Die konkrete Aufgabe aus dieser Roadmap als Prompt, z. B.:

> "Implementiere `RedFlagAnalyzer.ts` gemäß der Architektur in 02_Systemarchitektur.md. Die Datei liegt in `src/domain/analysis/`. Schreibe auch die zugehörigen Jest-Tests in `src/domain/analysis/__tests__/RedFlagAnalyzer.test.ts`. Verwende ausschließlich die Typen aus `src/types/`. Keine Framework-Abhängigkeiten."

---

## Status: Phasen & Aufgaben

| Phase | Titel | Completion | Status |
|---|---|---|---|
| **0** | Projekt-Setup | 86% | 🟡 In Progress |
@@| **0** | Projekt-Setup | 100% | ✅ Done |
| **1** | MVP: Scan & Bewertung | 100% | ✅ Done |
| **2** | Katalog & Favoriten | 0% | ⏳ Planned |
| **3** | Custom Filter-Regeln | 0% | ⏳ Planned |
| **4** | OCR & Manuelle Erfassung | 0% | ⏳ Future |

## Status: Phase 0 Details

| Task | Status |
|---|---|
| Expo-Projekt mit TypeScript erstellen | ✅ Done |
| Expo Go Installation & Test | ✅ Done |
| Abhängigkeiten installieren | ✅ Done |
| Verzeichnisstruktur anlegen | ✅ Done |
| ESLint + Prettier konfigurieren | ⏳ Pending |
@@| ESLint + Prettier konfigurieren | ✅ Done |
| Jest Setup | ✅ Done |
| GitHub-Repository | ✅ Done |

## Status: Phase 1 Details

| Schritt | Task | Status |
|---|---|---|
| **1** | OpenFoodFactsClient.ts | ✅ Done |
| | API-Test | ✅ Done |
| | Kamera-Permission-Flow | ✅ Done |
| **2** | defaultRules.ts | ✅ Done |
| | RedFlagAnalyzer.ts | ✅ Done |
| | RedFlagAnalyzer Tests | ✅ Done |
| | NovaScoreEvaluator.ts | ✅ Done |
| | ProductRating.ts | ✅ Done |
| **3** | ScannerScreen | ✅ Done |
| | Navigation zu ResultScreen | ✅ Done |
| **4** | ResultScreen | ✅ Done |
| | Fehlerbehandlung | ✅ Done |
| **Acceptance** | 5 Produkte testen | ✅ Done |
| | Fehlerfall-Handling | ✅ Done |
| | Unit-Tests grün | ✅ Done |
