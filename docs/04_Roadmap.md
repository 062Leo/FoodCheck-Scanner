# Roadmap – FoodScanner App

**Version:** 1.0  
**Stand:** 2025  
**Methode:** Iterative Entwicklung in klaren Phasen – jede Phase ist eigenständig deploybar auf dem eigenen Gerät.

---

## Phasen-Übersicht

```
Phase 0 │ Phase 1 │ Phase 2 │ Phase 3 │ Phase 4
  Setup │   MVP   │  Katalog │  Filter  │  OCR
 1 Tag  │ 4 Tage  │  3 Tage  │  5 Tage  │ ?
```

---

## Phase 0 – Projekt-Setup (~ 1 Tag)

**Ziel:** Lauffähiges Grundgerüst auf dem eigenen Gerät.

### Aufgaben
- [ ] `npx create-expo-app FoodScanner --template blank-typescript`
- [ ] Expo Go auf dem Gerät installieren und testen
- [ ] Abhängigkeiten installieren: `expo-camera`, `expo-sqlite`, `zustand`, `expo-router`
- [ ] Verzeichnisstruktur gemäß Systemarchitektur anlegen (leere Dateien)
- [ ] ESLint + Prettier konfigurieren
- [ ] Jest Setup: `jest.config.js`, erster Dummy-Test läuft durch
- [ ] GitHub-Repository anlegen, `.gitignore` korrekt setzen

### Abnahme
- App startet auf dem Gerät (weißer Screen reicht)
- `npm test` läuft fehlerfrei durch
- Verzeichnisstruktur stimmt mit Architektur überein

---

## Phase 1 – MVP: Scan & Bewertung (~ 4 Tage)

**Ziel:** Barcode scannen → Bewertung sehen. Kernfunktion vollständig.

### Aufgaben

**Tag 1 – Infrastruktur**
- [ ] `OpenFoodFactsClient.ts` implementieren (fetch + Typen)
- [ ] Unit-Test: API-Response-Parsing mit gemocktem JSON
- [ ] Kamera-Permission-Flow in `ScannerScreen` implementieren

**Tag 2 – Domain-Logik**
- [ ] `defaultRules.ts` mit hardcodierten Red-Flag-Listen befüllen
- [ ] `RedFlagAnalyzer.ts` implementieren (pure function, kein Framework)
- [ ] Unit-Tests für RedFlagAnalyzer (min. 10 Testfälle)
- [ ] `NovaScoreEvaluator.ts` implementieren
- [ ] `ProductRating.ts` – Gesamtbewertung aggregieren

**Tag 3 – Scanner Screen**
- [ ] `ScannerScreen` mit `expo-camera` und Barcode-Erkennung
- [ ] Navigation zu `ResultScreen` nach erfolgreichem Scan

**Tag 4 – Result Screen**
- [ ] `ResultScreen` mit Ampel-Banner, Red-Flag-Liste, Nova-Badge
- [ ] Fehlerbehandlung: Produkt nicht gefunden, API-Timeout

### Abnahme
- [ ] 5 verschiedene Produkte scannen und korrekte Bewertung erhalten
- [ ] Fehlerfall (unbekanntes Produkt) zeigt Toast ohne Crash
- [ ] Alle Unit-Tests grün

---

## Phase 2 – Katalog & Favoriten (~ 3 Tage)

**Ziel:** Jeder Scan wird gespeichert, Favoriten-Liste funktioniert.

### Aufgaben

**Tag 1 – Datenbank**
- [ ] `DatabaseService.ts` – SQLite initialisieren, Schema erstellen, Migrations-Logik vorbereiten
- [ ] `ProductRepository.ts` – insert, findByEan, findAll, delete
- [ ] `FavoritesRepository.ts` – add, remove, findAll, isFavorite
- [ ] Unit-Tests für Repositories (mit In-Memory-SQLite oder Mocks)

**Tag 2 – State & Integration**
- [ ] `catalogStore.ts` mit Zustand anlegen
- [ ] Scan-Flow erweitern: nach Analyse → in DB speichern
- [ ] Result Screen: Favoriten-Toggle implementieren und persistieren

**Tag 3 – Katalog & Favoriten Screens**
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

## Phase 3 – Custom Filter-Regeln (~ 5 Tage)

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

## Phase 4 – OCR für unbekannte Produkte (Zeitplan offen)

**Ziel:** Produkte ohne OFF-Eintrag manuell erfassen.

### Konzept
- Foto der Zutatenliste aufnehmen
- Text per OCR extrahieren (z. B. Google ML Kit, lokal auf Gerät)
- Extrahierter Text durch `RedFlagAnalyzer` laufen lassen
- Optional: manuell korrigieren
- Als "lokales Produkt" ohne EAN speichern

### Abhängigkeiten
- `expo-image-picker` oder `expo-camera`
- `@react-native-ml-kit/text-recognition` (Google ML Kit, kostenlos, on-device)

---

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
