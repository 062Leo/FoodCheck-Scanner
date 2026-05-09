# Lastenheft – FoodScanner App

**Version:** 1.0  
**Stand:** 2025  
**Autor:** Solo-Dev (privat, nicht-kommerziell)  
**Status:** Freigegeben für Entwicklung

---

## 1. Projektziel

Eine native Mobile-App für iOS & Android, mit klarem Fokus auf Android, die Lebensmittel per Barcode-Scan sofort auf ungesunde Inhaltsstoffe und Verarbeitungsgrad prüft. Der Nutzer soll innerhalb einer Sekunde verstehen, ob ein Produkt unbedenklich ist – ohne lange Texte lesen zu müssen.

**Abgrenzung:** Die App ist ausschließlich für den privaten Gebrauch des Entwicklers konzipiert. Kein kommerzieller Betrieb, keine Monetarisierung, kein Multi-User-Betrieb.

---

## 2. Zielgruppe

| Merkmal | Beschreibung |
|---|---|
| Nutzer | Ausschließlich der Entwickler selbst |
| Geräte | Eigenes Android-Gerät |
| Markt | Deutsche Supermarktprodukte (Rewe, Edeka, Aldi, Lidl, Penny, …) |

---

## 3. Funktionale Anforderungen

### 3.1 Muss-Kriterien (MVP)

| ID | Anforderung |
|---|---|
| F-01 | Barcode (EAN-8 / EAN-13) per Kamera scannen |
| F-02 | Produktdaten von Open Food Facts API abrufen (Name, Zutaten, Nährwerte, Nova-Score) |
| F-03 | Zutatenliste gegen eine hardcodierte Red-Flag-Liste matchen |
| F-04 | Ergebnis-Screen anzeigen: Status (OK / Warnung / Kritisch), gefundene Red Flags, Nova-Score |

### 3.2 Soll-Kriterien (v2)

| ID | Anforderung |
|---|---|
| F-05 | Jedes gescannte Produkt automatisch im lokalen Katalog speichern (EAN, Name, Scan-Datum, Bewertung) |
| F-06 | Katalog-Screen: Liste aller gescannten Produkte, sortiert nach Datum |
| F-07 | Favoriten-Liste: Produkte als „safe" markieren und separat einsehen |
| F-08 | Offline-Ansicht: bereits gescannte Produkte auch ohne Internet anzeigen |
| F-09 | Benutzerdefinierte Filter-Regeln: Nutzer kann einzelne Zutaten als Red Flag / OK markieren |
| F-10 | Numerische Grenzwerte: z. B. „Zucker nur Red Flag wenn > 3 g / 100 ml" |
| F-11 | Filter-Profile: mehrere Regelsets speichern und umschalten |

### 3.3 Kann-Kriterien (v3, Zukunft)

| ID | Anforderung |
|---|---|
| F-12 | Unbekannte Produkte per OCR erfassen: Foto von Zutatenliste → Text-Erkennung → editierbares Formular → Bestätigung → Upload zu Open Food Facts |
| F-13 | Nährwerte per OCR ergänzen: optionales zweites Foto der Nährwerttabelle → Text-Erkennung → Formularfelder vorausfüllen |
| F-14 | OFF-Contribution-Flow: ausgefülltes Formular (Name, Marke, Kategorie, Zutaten, Nährwerte) lokal analysieren UND zu Open Food Facts hochladen |
| F-15 | Offline-Datenbank: Open Food Facts Dump lokal speichern für schnellere Suche |
| F-16 | Export: Katalog als CSV exportieren |

---

## 4. Nicht-funktionale Anforderungen

| ID | Anforderung |
|---|---|
| NF-01 | Scan-to-Result in < 10 Sekunden (bei guter Verbindung) |
| NF-02 | App läuft vollständig lokal auf dem Gerät – kein eigener Backend-Server |
| NF-03 | Alle Daten bleiben auf dem Gerät (kein Cloud-Sync) |
| NF-04 | Betriebskosten: 0 € (Open Food Facts ist kostenlos, kein API-Key nötig) |
| NF-05 | Code ist modular und testbar aufgebaut (SOLID-Prinzipien, klare Schichten) |
| NF-06 | Keine Werbung, kein Tracking, keine externen Analytics-Dienste |

---

## 5. Datenquellen

| Quelle | Inhalt | Kosten | Lizenz |
|---|---|---|---|
| Open Food Facts API (Read) | Produktname, Zutaten, Nährwerte, Nova-Score, Additiv-Liste | Kostenlos | Open Database License (ODbL) |
| Open Food Facts API (Write) | Neue Produkte zur DB beitragen (v3) | Kostenlos | Open Database License (ODbL) |
| On-Device OCR (ML Kit) | Zutatenliste & Nährwerte aus Foto extrahieren (v3) | Kostenlos, lokal | Apache 2.0 |
| Lokale SQLite-DB | Scan-Katalog, Favoriten, Filter-Konfiguration (v2) | – | – |

**API Read:** `https://world.openfoodfacts.org/api/v0/product/{EAN}.json`  
**API Write:** `https://world.openfoodfacts.org/cgi/product_jqm2.pl` (POST, benötigt OFF-Account)

---

## 6. Abnahmekriterien MVP

- [x] EAN-13 Barcode wird zuverlässig erkannt
- [x] API-Response wird korrekt geparst und dargestellt
- [x] Red Flags aus der hardcodierten Liste werden korrekt gefunden
- [x] Nova-Score wird angezeigt
- [x] App stürzt bei unbekanntem EAN (kein OFF-Eintrag) nicht ab, zeigt stattdessen Hinweis
- [x] App stürzt ohne Internetverbindung nicht ab sondern warnt user das funktion nicht möglich

---

## 7. Technische Rahmenbedingungen

- **Framework:** Expo (React Native) – managed workflow
- **Sprache:** TypeScript
- **Lokale DB:** expo-sqlite
- **Plattform:** Android primär, iOS sekundär
- **Mindest-OS:** Android 10+ / iOS 16+

---

## Status: Anforderungen & Abnahmekriterien

| ID | Anforderung | Status | Phase |
|---|---|---|---|
| F-01 | Barcode (EAN-8 / EAN-13) per Kamera scannen | ✅ Done | MVP |
| F-02 | Produktdaten von Open Food Facts API abrufen | ✅ Done | MVP |
| F-03 | Zutatenliste gegen hardcodierte Red-Flag-Liste matchen | ✅ Done | MVP |
| F-04 | Ergebnis-Screen anzeigen: Status, Red Flags, Nova-Score | ✅ Done | MVP |
| F-05 | Produkte im lokalen Katalog speichern | ✅ Done | v2 |
| F-06 | Katalog-Screen mit Sortierung | ✅ Done | v2 |
| F-07 | Favoriten-Liste | ✅ Done | v2 |
| F-08 | Offline-Ansicht gescannter Produkte | ✅ Done | v2 |
| F-09 | Benutzerdefinierte Filter-Regeln | ✅ Done | v2 |
| F-10 | Numerische Grenzwerte für Nährstoffe | ✅ Done | v2 |
| F-11 | Filter-Profile speichern | ⏳ Planned | v2 |
| F-12 | OCR Zutatenliste → editierbares Formular → OFF-Upload | ✅ Done | v3 |
| F-13 | OCR Nährwerttabelle (optional, zweites Foto) | ✅ Done | v3 |
| F-14 | OFF-Contribution-Flow (Name, Marke, Kategorie, Zutaten, Nährwerte) | ✅ Done | v3 |
| F-15 | Offline OFF-Datenbank Dump | ⏳ Planned | v3 |
| F-16 | Katalog als CSV exportieren | ⏳ Planned | v3 |
| NF-01 | Scan-to-Result < 10 Sekunden | ✅ Done | MVP |
| NF-02 | Vollständig lokal auf Gerät | ✅ Done | MVP |
| NF-03 | Keine Cloud-Sync | ✅ Done | MVP |
| NF-04 | Betriebskosten 0€ | ✅ Done | MVP |
| NF-05 | Modular & testbar (SOLID) | ✅ Done | MVP |
| NF-06 | Keine Werbung, kein Tracking | ✅ Done | MVP |
| AC-01 | EAN-13 wird zuverlässig erkannt | ✅ Done | MVP |
| AC-02 | API-Response korrekt geparst | ✅ Done | MVP |
| AC-03 | Red Flags korrekt gefunden | ✅ Done | MVP |
| AC-04 | Nova-Score angezeigt | ✅ Done | MVP |
| AC-05 | Keine Crashes bei unbekanntem EAN | ✅ Done | MVP |
| AC-06 | Warnung bei offline, kein Crash | ✅ Done | MVP |
