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
| Geräte | Eigenes Android-Gerät, iOS optional |
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
| F-12 | Unbekannte Produkte manuell erfassen: Foto der Zutatenliste → OCR → Analyse |
| F-13 | Offline-Datenbank: Open Food Facts Dump lokal speichern für schnellere Suche |
| F-14 | Export: Katalog als CSV exportieren |

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
| Open Food Facts API | Produktname, Zutaten, Nährwerte, Nova-Score, Additiv-Liste | Kostenlos | Open Database License (ODbL) |
| Lokale SQLite-DB | Scan-Katalog, Favoriten, Filter-Konfiguration (v2) | – | – |

**API-Endpunkt:** `https://world.openfoodfacts.org/api/v0/product/{EAN}.json`

---

## 6. Abnahmekriterien MVP

- [ ] EAN-13 Barcode wird zuverlässig erkannt
- [ ] API-Response wird korrekt geparst und dargestellt
- [ ] Red Flags aus der hardcodierten Liste werden korrekt gefunden
- [ ] Nova-Score wird angezeigt
- [ ] App stürzt bei unbekanntem EAN (kein OFF-Eintrag) nicht ab, zeigt stattdessen Hinweis
- [ ] App stürzt ohne Internetverbindung nicht ab sondern warnt user das funktion nicht möglich

---

## 7. Technische Rahmenbedingungen

- **Framework:** Expo (React Native) – managed workflow
- **Sprache:** TypeScript
- **Lokale DB:** expo-sqlite
- **Plattform:** Android primär, iOS sekundär
- **Mindest-OS:** Android 10+ / iOS 16+
