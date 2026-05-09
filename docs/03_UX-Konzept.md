# UX-Konzept – FoodScanner App

**Version:** 1.0  
**Stand:** 2025  
**Leitsatz:** Eine Sekunde, eine Antwort. Keine Ablenkung.

**MVP-Abgrenzung:** Der MVP umfasst Scanner und Result Screen. Katalog, Favoriten und Offline-Ansichten sind Soll/v2.

---

## 1. Design-Prinzipien

1. **Radikale Einfachheit** – Der Nutzer hat das Handy in der Hand, das Produkt in der anderen. Keine langen Texte, keine Menüs, kein Nachdenken.
2. **Ampel-Logik** – Rot / Gelb / Grün. Universell verständlich, sofort erkennbar.
3. **Tiefe nur auf Wunsch** – Details sind vorhanden, aber nicht aufgezwungen.
4. **Dark Mode first** – Sieht im Supermarkt besser aus, schont den Akku.

---

## 2. Navigation (Tab-Struktur)

```
┌──────────────────────────────────┐
│          App (Tab-Bar)           │
├──────────┬───────────┬───────────┤
│  Scanner │  Katalog  │ Favoriten │
│   (Cam)  │  (Liste)  │  (Liste)  │
└──────────┴───────────┴───────────┘
```

Der **Scanner-Tab** ist immer der erste Tab und öffnet direkt die Kamera. Kein Splash, kein Onboarding. Katalog und Favoriten sind für v2 vorgesehen.

---

## 3. Screens im Detail

### 3.1 Scanner Screen

**Ziel:** Kamera sofort aktiv, EAN scannen, weiterleiten.

```
┌─────────────────────────────┐
│                             │
│      [Kamera-Viewfinder]    │
│                             │
│    ┌───────────────────┐    │
│    │  Scan-Rahmen      │    │   ← animierter Rahmen zentriert
│    └───────────────────┘    │
│                             │
│  Halte den Barcode rein     │   ← dezenter Hinweistext
└─────────────────────────────┘
```

- Kein Button nötig – Scan passiert automatisch bei Erkennung
- Nach erfolgreichem Scan: haptisches Feedback + sofortige Navigation zum Result-Screen
- Fehlerzustand: Toast "Produkt nicht gefunden" wenn OFF-API nichts zurückgibt
- Favoriten-Toggle und Katalog-Ablage sind erst in v2 relevant

---

### 3.2 Result Screen

**Ziel:** Sofortiger visueller Eindruck, dann optionale Details.

```
┌─────────────────────────────┐
│  ← Zurück        [★ Fav]   │
├─────────────────────────────┤
│                             │
│   ██████████████████████   │
│   █  KRITISCH / WARNUNG  █  │   ← Großes Ampel-Banner (rot/gelb/grün)
│   ██████████████████████   │
│                             │
│   Produktname               │
│   Marke                     │
│                             │
├─────────────────────────────┤
│  🚩 Red Flags               │
│  ─────────────────────────  │
│  • Palmöl           [Öle]   │
│  • Glukose-Sirup   [Zucker] │
│  • E621        [Zusatzstoff]│
├─────────────────────────────┤
│  Verarbeitung               │
│  Nova 4 – Hochverarbeitet   │   ← farblich kodiert
├─────────────────────────────┤
│  Nährwerte (aufklappbar ▼)  │   ← Accordion, nicht sofort sichtbar
└─────────────────────────────┘
```

**Status-Farben:**

| Status | Farbe | Bedingung |
|---|---|---|
| OK | Grün `#4CAF50` | Keine Red Flags, Nova 1–2 |
| Warnung | Gelb `#FFC107` | 1–2 Red Flags oder Nova 3 |
| Kritisch | Rot `#F44336` | 3+ Red Flags oder Nova 4 |

---

### 3.3 Katalog Screen *(v2)*

**Ziel:** Alle gescannten Produkte schnell durchsuchen und wiederfinden.

```
┌─────────────────────────────┐
│  Mein Katalog        🔍    │
├─────────────────────────────┤
│  [Alle] [OK] [Warnung] [⚠️] │   ← Filter-Chips
├─────────────────────────────┤
│  ┌─────────────────────┐   │
│  │ Produktname         │   │
│  │ Marke · 12.05.2025  │   │
│  │ ●●○○ Nova 2    ★   │   │   ← Ampel-Punkt, Favorit-Icon
│  └─────────────────────┘   │
│  ┌─────────────────────┐   │
│  │ ...                 │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
```

- Tap auf Eintrag → Result Screen (aus dem Cache, kein erneuter API-Call)
- Swipe left → Aus Katalog löschen (mit Bestätigung)
- Sternchen direkt in der Liste togglen

---

### 3.4 Favoriten Screen *(v2)*

**Ziel:** Die persönliche "Safe List" – Produkte die der Nutzer regelmäßig kauft und vertraut.

Identische Listenstruktur wie Katalog, aber nur Favoriten. Kein Filter nötig. Hinweistext wenn leer: "Noch keine Favoriten – tippe im Scan-Ergebnis auf ★"

---

### 3.5 Contribute Screen *(v3)*

**Ziel:** Produkte die nicht in Open Food Facts sind selbst erfassen, lokal analysieren und zur DB beitragen.

**Einstieg:** Button "Zu Open Food Facts beitragen" auf dem Result Screen bei "Produkt nicht gefunden".

#### Schritt 1 – Zutatenliste fotografieren

```
┌─────────────────────────────┐
│  ← Abbrechen                │
│                             │
│  Schritt 1 von 2            │
│  Zutatenliste fotografieren │
│                             │
│  ┌─────────────────────┐   │
│  │                     │   │
│  │   [Kamera-Preview]  │   │
│  │                     │   │
│  └─────────────────────┘   │
│                             │
│  Halte die Zutatenliste     │
│  gut lesbar ins Bild        │
│                             │
│  [ Foto aufnehmen ]         │
│  [ Überspringen →  ]        │
└─────────────────────────────┘
```

#### Schritt 2 – Nährwerte fotografieren

```
┌─────────────────────────────┐
│  ← Zurück                   │
│                             │
│  Schritt 2 von 2            │
│  Nährwerttabelle (optional) │
│                             │
│  ┌─────────────────────┐   │
│  │   [Kamera-Preview]  │   │
│  └─────────────────────┘   │
│                             │
│  [ Foto aufnehmen ]         │
│  [ Überspringen →  ]        │
└─────────────────────────────┘
```

#### Schritt 3 – Formular prüfen & bestätigen

```
┌─────────────────────────────┐
│  ← Zurück     Produkt       │
│               erfassen      │
├─────────────────────────────┤
│  Produktname *              │
│  ┌─────────────────────┐   │
│  │ [Textfeld]          │   │
│  └─────────────────────┘   │
│                             │
│  Marke / Hersteller         │
│  ┌─────────────────────┐   │
│  └─────────────────────┘   │
│                             │
│  Kategorie                  │
│  ┌─────────────────────┐   │
│  │ [Dropdown]          │   │
│  └─────────────────────┘   │
│                             │
│  Zutatenliste               │
│  ┌─────────────────────┐   │
│  │ [Multiline, OCR     │   │
│  │  vorausgefüllt]     │   │
│  └─────────────────────┘   │
│                             │
│  Nährwerte pro 100g ▼       │  ← Accordion, OCR-vorausgefüllt
│  (Energie, Fett, KH, …)     │
│                             │
│  ℹ️ Wird öffentlich auf     │
│  Open Food Facts gespeichert│
│                             │
│  [ ✓ Bestätigen & hochladen]│
└─────────────────────────────┘
```

**UX-Regeln:**
- OCR-Ergebnisse immer editierbar – der User hat das letzte Wort
- Nur Produktname ist Pflichtfeld, alles andere optional
- Vor dem Upload: kurze Bestätigungsmeldung „Wird öffentlich gespeichert – bist du sicher?"
- Nach Upload: sofortige lokale Analyse und Navigation zu ResultScreen
- Bei Upload-Fehler (offline, Auth): Toast + lokale Analyse trotzdem durchführen

---

## 4. Micro-Interactions & Feedback

| Aktion | Feedback |
|---|---|
| Barcode erkannt | Haptisch (kurze Vibration) + Klick-Sound (optional) |
| Produkt zu Favoriten | Stern-Animation, haptisch |
| API lädt | Skeleton-Screen (keine Spinner) |
| Produkt nicht gefunden | Toast unten: "Produkt nicht in der Datenbank" |
| Offline + bekanntes Produkt | Normal anzeigen, kleines Offline-Icon |
| Offline + unbekanntes Produkt | Toast: "Kein Internet – Produkt kann nicht abgerufen werden" |

---

## Status: Screens & Features

| Screen | Feature | Status |
|---|---|---|
| **Scanner** | Kamera-Viewfinder | ✅ Done |
| | Animierter Scan-Rahmen | ✅ Done |
| | Permission-Flow | ✅ Done |
| | Automatische EAN-Erkennung | ✅ Done |
| | Haptisches Feedback | ✅ Done |
| | Hinweistext | ✅ Done |
| **Result** | Ampel-Banner (Rot/Gelb/Grün) | ✅ Done |
| | Produktname & Marke | ✅ Done |
| | Red Flags Liste | ✅ Done |
| | Nova-Score Badge | ✅ Done |
| | Zutatenliste-Accordion | ✅ Done |
| | Zurück-Button | ✅ Done |
| | Fehler-States (offline, not-found) | ✅ Done |
| | Skeleton Loading | ✅ Done |
| **Catalog** | Produktliste | ✅ Done |
| | Filter-Chips | ✅ Done |
| | Tap-to-Detail | ✅ Done |
| | Swipe-to-Delete | ✅ Done |
| **Favorites** | Favoriten-Liste | ✅ Done |
| | Leerzustand | ✅ Done |
| | Toggle Favorit | ✅ Done |

## Status: Micro-Interactions

| Aktion | Feedback | Status |
|---|---|---|
| Barcode erkannt | Haptisch (Vibration/Haptics) | ✅ Done |
| Produkt zu Favoriten | Stern-Animation (v2) | ✅ Done |
| API lädt | Skeleton-Screen | ✅ Done |
| Produkt nicht gefunden | Toast-Meldung | ✅ Done |
| Offline + bekanntes Produkt | Offline-Icon (v2) | ✅ Done |
| Offline + unbekanntes Produkt | Toast-Warnung | ✅ Done |

---

## 5. Typografie & Farben (Dark Mode)

```
Background:   #121212
Surface:      #1E1E1E
Text Primary: #FFFFFF
Text Muted:   #9E9E9E
Accent:       #00BFA5   (Teal – neutral, nicht Markenfarbe)

Status Grün:  #4CAF50
Status Gelb:  #FFC107
Status Rot:   #F44336
Nova 1:       #4CAF50
Nova 2:       #8BC34A
Nova 3:       #FFC107
Nova 4:       #F44336
```

Schriftart: System Default (SF Pro auf iOS, Roboto auf Android) – kein Custom Font-Import nötig.

---

## 6. Fehler-Zustände (vollständige Liste)

| Fehler | UI-Verhalten |
|---|---|
| EAN nicht in OFF-DB | Toast + Option "Manuell erfassen" (v3) |
| Kein Internet | Bekannte Produkte aus Cache laden; sonst Toast |
| Kamera-Permission verweigert | Erklärender Screen mit "Einstellungen öffnen"-Button |
| API-Timeout (> 5 Sek.) | Toast "Zeitüberschreitung – bitte erneut versuchen" |
| Unvollständige Zutatenliste | Ergebnis anzeigen mit Hinweis "Unvollständige Daten" |
