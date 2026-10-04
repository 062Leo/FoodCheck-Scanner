# FoodCheck — Features & Capabilities

## Screens & Navigation

| Route | Screen | Beschreibung |
|-------|--------|-------------|
| `(tabs)/` | **Scanner** | Live-Kamera mit Barcode-Erkennung (EAN-8/13, UPC-A), Ergebniskarte über der Kamera, manuelle Eingabe, Eiercode prüfen, Offline-Badge |
| `(tabs)/catalog` | **Catalog** | Alle gescannten Produkte durchsuchen, filtern (OK/Warning/Critical/Unknown/Ohne Zutaten), sortieren |
| `(tabs)/favorites` | **Favorites** | Favorisierte Produkte anzeigen, entfavorisieren, bearbeiten, löschen |
| `(tabs)/settings` | **Settings** | Filter-Regeln, Allergene, Übersetzung, USDA-Schlüssel, Sprache, Open-Food-Facts-Konto, Backup, Eiercode, Anleitung |
| `/result` | **Product** | Vollständige Produktanalyse: Ampel mit Begründung, Red Flags und Produkt-Prüfungen, gemiedene Marken/Konzerne, Kennzeichnungen (Bio, Gentechnik, Haltungsform, MSC/ASC, Rohmilch), Verarbeitungs-/Verpackungsbetrieb, NOVA, Nährwerte, Allergene, Zutaten (mehrsprachig), KI-Erkenntnisse, Bildergalerie |
| `/egg-code` | **Eiercode prüfen** | Haltungsform und Herkunft aus dem Erzeugercode auf dem Ei (offline) |
| `/settings/filters` | **Filter Rules** | Vordefinierte + eigene Zutaten-/Nährwert-Regeln, Produkt-Prüfungen und gemiedene Marken/Konzerne verwalten |
| `/settings/allergens` | **Meine Allergene** | Auswahl aus den 14 EU-Allergenen (nur bei eingeschalteter Allergen-Warnung) |
| `/settings/api-key` | **Übersetzung** | DeepL/MyMemory auswählen und API-Key verwalten |
| `/settings/usda-key` | **USDA FoodData Central** | Eigenen kostenlosen api.data.gov-Schlüssel speichern/löschen |
| `/settings/about` | **Über FoodCheck** | Anleitung, Erklärung der Ampel-Bewertung, Datenschutz, Datenquellen (Open Food Facts, USDA FoodData Central, Wikidata, jeweils mit Lizenz), Version |
| `/edit/[ean]` | **Edit Product** | Produktdaten bearbeiten + an Open Food Facts beitragen: Zutaten (8 Sprachen), Nährwerte, Allergene, Herkunft — lokal + Upload an OFF |

---

## Scanner

- **Live-Kamera** mit Barcode-Erkennung (EAN-8, EAN-13, UPC-A wird als EAN-13 gespeichert)
- **Prüfziffer-Validierung**: Fehllesungen bei schlechtem Licht werden verworfen, bevor ein Lookup startet
- **Scannen in Folge**: Ein Treffer wird als Karte über der Kamera angezeigt (Status-Icon, Name, Hauptgrund); die Kamera läuft weiter, das nächste Produkt kann sofort gescannt werden. Tippen auf die Karte öffnet die Details aus den frisch gespeicherten Daten (kein zweiter Netzwerkaufruf)
- **Ein Lookup gleichzeitig** (`ScanGate`): derselbe Code wird nicht erneut ausgelöst, solange er im Bild bleibt; eine während eines Lookups manuell eingegebene Nummer wird nachgeholt statt verworfen
- **Cache-first**: Produkt wird zuerst in der lokalen SQLite-Datenbank gesucht
- **Online-Fallback**: Bei Netzwerkfehler oder Timeout (8 s) wird, falls vorhanden, das zwischengespeicherte Produkt gezeigt
- **USDA-Fallback**: Kennt Open Food Facts einen Barcode nicht und ist das Produkt nicht gespeichert, fragt die App USDA FoodData Central – nur mit dem eigenen Schlüssel des Nutzers (siehe [USDA FoodData Central](#usda-fooddata-central-settingsusda-key)); schlägt die USDA-Abfrage fehl (Schlüssel ungültig, Limit erreicht, keine Antwort, keine Verbindung), nennt die Nicht-gefunden-Meldung den Grund
- **Manuelle Eingabe**: Barcode über Ziffernblock eingeben, auch ohne Kamerazugriff nutzbar
- **Eiercode prüfen**: Button neben „Barcode eingeben“ öffnet den [Eiercode-Leser](#eiercode-prüfen-egg-code)
- **Haptisches Feedback**: unterschiedlich für Erfolg / Warnung / Fehler
- **Taschenlampe** (nur Rückkamera); der Frontkamera-Wechsel und die pulsierende Rahmenanimation wurden entfernt
- **Offline-Badge** bei Netzwerkausfall
- **Kamera-Berechtigungen**: Anfrage-Flow mit Hinweis bei Verweigerung, Link zu den Systemeinstellungen bei dauerhafter Verweigerung

---

## Produkt-Analyse

### Red Flag System
- **777 vordefinierte Regeln**: 768 Zutaten-Regeln in 24 belegten Kategorien plus 9 Produkt-Prüfungen (25 Kategorie-Presets stehen beim Anlegen einer neuen Zutaten-Regel zur Auswahl)
- **Neu in der Filterliste (Datenbank-Version 9)**: 86 Zutaten-Regeln – 31 E-Nummern (u. a. E120, E200, E203, E214/E215/E219, Cellulosen E460–E466, E476, Sorbitanester E492–E495, E952, modifizierte Stärken E1404–E1452, E1520), Zusatzstoff-Namen (Carmin, Cyclamat, Sorbinsäure, PHB-Ester, Propylenglycol, Citronensäure …), Gentechnik, Insekten, Samenöle (zählen auch kaltgepresst), Fleischersatz-Proteine (Erbsen-, Weizen-, Ackerbohnenprotein, Seitan, Mycoprotein), Zuchtfisch, Alkohol, erhitzte Milch (pasteurisiert, UHT, H-Milch) und versteckte Pökelung über Sellerieextrakt/Selleriesaftpulver. Entfernt wurden 11 Verpackungs- und Treibgase (u. a. Kohlendioxid, Distickstoffmonoxid, E290, E938–E949)
- **Neu in der Filterliste (Datenbank-Version 10)**: 15 Zutaten-Regeln in der Kategorie Alkohol – Wein (auch Rot-, Weiß- und Glühwein), Portwein, Sherry, Marsala, Sake, Bier, Brandy, Weinbrand, Cognac, Kirschwasser, Rum (auch Rumaroma), Whisky, Whiskey, Wodka und Likör. Alkoholfreies Bier und alkoholfreier Wein zählen weiterhin (bis 0,5 % vol.)
- **Eigene Filter-Regeln**: Benutzer kann Zutaten- und Nährwert-Regeln sowie gemiedene Marken/Konzerne hinzufügen/ändern/löschen; Severity `Red Flag` oder `Erlaubt` (whitelistet eine Zutat oder — solange die Bedingung zutrifft — eine Nährwert-Regel; bei einer Produkt-Prüfung schaltet `Erlaubt` die Prüfung aus)
- **Vier Typen**:
  - **Zutaten-Regel**: Keyword-Matching in der Zutatenliste, span-basiert (ein Treffer innerhalb eines längeren Treffers einer anderen Regel zählt nicht); mehrsprachig (de/en/fr/it/es/nl/pt/pl)
  - **Nährwert-Regel**: Schwellwert-Vergleich (gt/lt/eq) gegen die Produkt-Nährwerte (sugars_100g, fat_100g, saturated-fat_100g, salt_100g, energy-kcal_100g)
  - **Produkt-Prüfung**: schaut auf das ganze Produkt (Kategorien, Verpackung, Siegel, Nährwerte), siehe unten; kann weder neu angelegt noch gelöscht, aber über die Severity „Erlaubt“ ausgeschaltet und (Zutatenzahl) eingestellt werden
  - **Marke / Konzern**: gemiedene Marke oder gemiedener Konzern, siehe unten
- **Verneinungen zählen nicht**: „nicht pasteurisiert“, „unpasteurisiert“, „ohne Gentechnik“, „aus nicht gentechnisch veränderten Sojabohnen“, „alkoholfrei“, „entalkoholisiert“, „Zuckeralkohole“ oder Alkoholessig lösen die Regeln für Gentechnik, erhitzte Milch und Alkohol nicht aus
- **Kein Getränk**: Essig und Hefe aus einem Getränk (Branntwein-, Wein-, Sherryessig, „wine vinegar“, „vinaigre de vin“, Bierhefe, „levure de bière“, „lievito di birra“) sowie Weinsäure, Weinstein, Weintrauben, Weinbeeren, Weinblätter, Weinbergschnecken, Weinraute, Schweinefleisch, Erdbeeren, Bierschinken, Bierwurst, Biertreber, Portobello, Lakritz („licorice“) oder Rumpsteak lösen die Regeln für Wein, Bier und Spirituosen nicht aus; Rum zählt nur am Wortanfang („Rumaroma“ ja, „Krume“ nein), Sake nur als eigenes Wort, Port nur als Portwein/„port wine“/„porto“ (nicht „Portion“, „Portugal“)
- **Additiv-Taxonomie**: rund 160 E-Nummern mit Risikostufen (none/low/medium/high) und Funktionsklassen; ergänzt Treffer, die keine Zutaten-Regel bereits erfasst hat
- **Ein Fund pro Substanz**: dieselbe E-Nummer zählt nur einmal; ein Schlüssel ohne Suffix und seine Suffix-Variante (E500/E500ii) sowie austauschbare Familienmitglieder (E150a–d) werden zusammengefasst
- **Auto-Translation**: Neue Zutaten-Keywords werden beim Speichern parallel in 7 Sprachen übersetzt; das Bearbeiten eines Keywords löscht vorhandene Übersetzungen nur, wenn sich das Keyword ändert

### Produkt-Prüfungen
Jede Prüfung ist eine Regel vom Typ „Prüfung“ in der Filterliste und zählt wie eine Zutaten-Red-Flag (ab 3 Red Flags „Kritisch“):

| Prüfung | Schlägt an bei | Kategorie |
|---------|----------------|-----------|
| **Mehr als 5 Zutaten** | mehr Zutaten als das Limit (Standard 5, in der Filterliste änderbar); zusammengesetzte Zutaten zählen mit ihren Bestandteilen, nicht zusätzlich | Verarbeitung |
| **Konserve oder Dose** | Verpackungsangabe Dose, oder Kategorie Konserve mit Metallverpackung (Bisphenole aus Dosenbeschichtungen) | Verpackung |
| **Großer Raubfisch** | Thunfisch, Schwertfisch, Hai, Marlin in Kategorie oder Zutaten (Quecksilber) | Schadstoffe |
| **Reis oder Reisprodukt** | Kategorie Reis, oder Reis als erste Zutat (anorganisches Arsen) | Schadstoffe |
| **Pestizid-Risiko-Kultur ohne Bio** | Mango, Pfeffer, Reis, Tee, Erdnüsse, grüne Bohnen, Kirschen ohne Bio-Siegel (Kulturen mit den meisten Rückstandsüberschreitungen laut BVL-Bericht 2023) | Schadstoffe |
| **Milchprodukt ohne Rohmilch-Angabe** | Milchprodukt ohne Hinweis auf Rohmilch; eine verneinte Angabe („nicht aus Rohmilch“) gilt als erhitzte Milch | Erhitzte Milch |
| **Enthält Alkohol** | alkoholisches Getränk oder angegebener Alkoholgehalt > 0 | Alkohol |
| **Fleischersatz** | Kategorie Fleischersatz/Fleischalternative | Proteine & Fleischersatz |
| **Zuchtfisch** | Aquakultur-Siegel (z. B. ASC) oder Kategorie „farmed“ | Zuchtfisch |

Die Prüfungen lesen Kategorien, Verpackung, Siegel und Nährwerte so, wie Open Food Facts sie liefert. Fehlen diese Angaben, schlägt die Prüfung nicht an. Produkte, die mit einer älteren App-Version gespeichert wurden, werden nach dem App-Start im Hintergrund neu geladen (höchstens 10 Anfragen pro Minute, siehe [Datenbank-Schema](#datenbank-schema)) und bekommen die neuen Angaben so auch ohne erneuten Scan.

### Marken & Konzerne meiden
- **Regeltyp „Marke / Konzern“** in der Filterliste: ein Treffer bewertet das Produkt sofort als **Kritisch**, unabhängig von der Zahl der Red Flags; die Begründung nennt den Konzern
- **Abgleich** gegen Marke(n) und Markeninhaber (`brand_owner`) des Produkts; Rechtsformen und Zusätze (GmbH, AG, Deutschland …) und Schreibweisen ohne Leerzeichen oder Bindestrich („Kit Kat“/„KitKat“, „Coca-Cola“/„CocaCola“) werden ausgeglichen
- **Markenanfang**: Der Name der Regel darf irgendwo in der Marke stehen („Nestlé Deutschland AG“); bei Wikidata gesammelte Namen müssen der ganzen Marke oder ihren ersten ganzen Wörtern entsprechen („Maggi“ trifft „Maggi Fix“, „Lion“ trifft nicht „Golden Lion Foods“)
- **Optionale Wikidata-Abfrage**: Konzern bei Wikidata suchen, passenden Eintrag wählen; die App sammelt Marken und Tochterfirmen (bis zu 3 Ebenen, höchstens 1.000 Namen) und speichert sie mit der Regel, sodass der Abgleich offline funktioniert; „Erneut abfragen“ aktualisiert die Liste. Daten: Wikidata (CC0)
- **Einzelne Marken abwählen**: Unter „Namen anzeigen“ ist jeder gesammelte Name ein Eintrag zum An- und Ausschalten (Zähler „N von M Marken aktiv“, Filterfeld und seitenweise je 50 Namen bei langen Listen); abgewählte Namen treffen keine Produkte mehr (normalisierter Vergleich). Der Name der Regel selbst bleibt immer aktiv. „Erneut abfragen“ behält die Abwahl für Namen, die weiterhin gefunden werden
- **Ohne Abfrage** (oder wenn Wikidata nicht erreichbar ist) wird nur der Name selbst erkannt, nicht die Marken des Konzerns
- Eine Marke bzw. ein Konzern kann nur einmal in der Liste stehen

### NOVA-Bewertung
- NOVA-Score 1–4 (unverarbeitet → ultra-verarbeitet); ein fehlender oder ungültiger Wert gilt als unbekannt, nicht als NOVA 1
- Farbcodierte Anzeige

### Nutri-Score
- Anzeige Nutri-Score A–E mit farbiger Kennzeichnung, sofern von Open Food Facts geliefert

### Robotoff KI-Erkenntnisse
- Abruf von AI-Vorhersagen (Kategorie, Label, Zutat) von der Robotoff API, nur wenn das Produkt nicht aus dem Offline-Cache angezeigt wird
- 15-minütiger In-Memory-Cache
- Anzeige mit Konfidenzbalken

---

## Product Screen (Detailansicht)

- **Ampel-Banner**: OK / Warning / Critical / Unknown, mit Text-Begründung (nicht nur Farbe) — z. B. NOVA-Stufe, Anzahl Red Flags, fehlende Zutatenliste
- **Red Flags**: Liste gefundener Zutaten, Nährwert-Überschreitungen und Produkt-Prüfungen mit Schweregrad (critical/warning), Kategorie und kurzer Erklärung; gemiedene Marken/Konzerne stehen oben, mit dem Namen, über den sie erkannt wurden
- **Kennzeichnungen (Badges)**: Bio (mit Demeter/Bioland/Naturland, auch über Öko-Kontrollstellen-Codes), Ohne Gentechnik, Enthält Gentechnik, Haltungsform 1–5, Freiland, MSC, ASC, Rohmilch – aus den Siegeln und Kategorien bei Open Food Facts
- **Verarbeitet/verpackt in**: Land (bei deutschen Codes mit Bundesland) und Identitätskennzeichen; nennt den Betrieb, der das Produkt zuletzt verarbeitet oder verpackt hat – nicht die Herkunft der Rohstoffe
- **Hintergrund Mandeln**: Bei Produkten mit Mandeln aus den USA oder unbekannter Herkunft ein Hinweis zur Bestäubung in Kalifornien; nur zur Information, fließt nicht in die Bewertung ein
- **Datenquelle USDA**: Bei Produkten aus USDA FoodData Central ein Hinweis unter der EAN
- **KI-Erkenntnisse**: Robotoff-Vorhersagen mit Konfidenz
- **Nährwerte**: vollständige Nährwerttabelle; Werte werden in der UI-Sprache formatiert, nur tatsächlich vorhandene Zeilen werden gestreift dargestellt
- **Zutatenliste**: mehrsprachig (Sprach-Chips für alle vorhandenen Texte) mit Übersetzen-Button pro Sprache (DeepL/MyMemory)
- **Allergene**: die 14 EU-Allergene in der App-Sprache (Deutsch/Englisch), dazu Spuren
- **Bildergalerie**: Swipeable (Vorderseite, Zutaten, Nährwerte, Verpackung)
- **Zusatzinfos**: Herkunft, Herstellungsort, Geschäfte
- **Datenquellen-Hinweis**: Fußnote statt Umschalter — zeigt an, wenn die Daten aus dem Offline-Cache stammen oder älter als 7 Tage sind
- **Favoriten**: Stern-Toggle im Header
- **Bearbeiten**: Stift-Icon → EditProductScreen
- **Fehler-Behandlung**: Offline (Cache oder "noch nicht gespeichert"), Nicht gefunden (Beitragen-CTA), genereller Fehler mit Retry
- **Disclaimer**: Daten stammen von OFF-Beitragenden

---

## Catalog (Produktkatalog)

- **Volltextsuche**: Name, Marke, EAN — alle Suchwörter müssen treffen, gefiltert wird die bereits geladene Liste (keine SQL-Anfrage pro Tastenanschlag)
- **Zusammenfassungszeile**: Anzahl Produkte, Scans, Anteil NOVA 4
- **Filter-Chips mit Zählern**: Alle / Critical / Warning / OK / Unknown / Ohne Zutaten
- **Sortierung**: zuletzt gesehen, Bewertung (kritisch zuerst), Name, NOVA (am stärksten verarbeitet zuerst), Scan-Häufigkeit
- **Produktkarte**: Thumbnail, Status als Icon + Text, ein Favoriten-Button; Bearbeiten und Löschen über ein Long-Press-Menü
- **Löschen mit Undo**: Ein gelöschtes Produkt kann per Toast-Aktion vollständig wiederhergestellt werden (inkl. ID, Scan-Historie, Bearbeitungsmarkierungen und Favoritenstatus)
- **Kein Vollbild-Spinner** bei jedem Tab-Besuch; die Liste aktualisiert sich im Hintergrund
- **Leerzustände** mit passendem nächsten Schritt (scannen, Filter zurücksetzen)

---

## Favorites

- **Lokale Favoriten-Tabelle** (SQLite JOIN products), pro Produkt höchstens ein Eintrag
- **Toggle** vom ProductScreen oder CatalogScreen aus; Entfernen kann per Toast rückgängig gemacht werden
- **Dieselbe Produktkarte** wie im Katalog (Long-Press-Menü für Bearbeiten/Löschen; der Stern entfernt nur den Favoriten, nicht mehr das ganze Produkt)
- **Leerzustand** mit Hinweis

---

## Edit Product (Produkt bearbeiten)

- **Produktidentität**: Name, Marke, Menge, Kategorien
- **Bewertung**: NOVA-Score (1–4)
- **Zutaten (8 Sprachen)**: de, en, fr, it, es, nl, pt, pl
  - Pro Sprache: OCR-Scan (Kamera), Übersetzen (DeepL/MyMemory), Entfernen
  - Sprache hinzufügen: Auswahl aus verfügbaren Sprachen
- **OCR-Kamera (Kamera → Zuschneiden → Prüfen)**:
  - Erkennung standardmäßig auf dem Gerät (ML Kit) — das Foto verlässt das Telefon nicht
  - Zuschneide-Werkzeug optional (auch „ganzes Foto“ möglich), mit korrekter Umrechnung auf das Kamerabild
  - Erkennung durch Open Food Facts (Google Cloud Vision) nur nach ausdrücklicher Zustimmung in einem Dialog, der den Zielserver nennt; lädt das Foto öffentlich unter dem eigenen Konto hoch
  - Erkannten Text bearbeiten, neu zuschneiden, neu aufnehmen
- **Nährwerte**: Energie, Fett, gesättigte Fettsäuren, Kohlenhydrate, Zucker, Ballaststoffe, Eiweiß, Salz
  - OCR-Scan für Nährwerttabellen mit Sprachautomatik (DE/EN/FR/IT); Komma-Dezimalzahlen und „<0,5“ werden erkannt
  - Werte werden validiert (keine „NaN“-Werte mehr lokal gespeichert oder an Open Food Facts gesendet)
- **Allergene**: Enthält (kommagetrennt), Spuren
- **Zusatzinfos**: Herkunft, Herstellungsort, Geschäfte, Portionsgröße
- **Speichern**: lokal in SQLite; merkt sich, welche Felder verändert wurden, damit ein späteres Update von Open Food Facts nur die nicht bearbeiteten Felder überschreibt
- **Upload an OFF**: fragt vor dem Senden nach Bestätigung, nennt Zielserver und zu sendende Felder; speichert zuerst lokal, sendet dann nur die Felder, die du auf diesem Gerät geändert hast, bei Zutaten nur die geänderten Sprachen (bei Produkten, die Open Food Facts noch nicht kennt: alle ausgefüllten) – unveränderte, evtl. veraltete Werte überschreiben keine neueren Korrekturen anderer; ohne Änderung meldet die App „nichts zu senden“; gelöschte Angaben bleiben lokal (die App sagt das); Entwicklungs-Builds senden an den Staging-, Release-Builds an den Produktivserver
- **USDA-Produkte**: Angaben aus USDA FoodData Central werden nicht an Open Food Facts gesendet; der Upload-Button fehlt, Änderungen bleiben auf dem Gerät
- **Ungespeicherte-Änderungen-Warnung**: Navigation-Guard mit Bestätigungsdialog
- **Auto-Erstellung**: Legt einen Produkt-Stub an, falls für den Barcode noch kein lokaler Eintrag existiert

---

## Filter Rules Management

- **777 vordefinierte Regeln** (768 Zutaten-Regeln + 9 Produkt-Prüfungen) — automatisch bei erster DB-Erstellung, ergänzt durch spätere App-Updates; die Migrationen 9 und 10 fügen bei bestehenden Installationen nur Regeln hinzu, die es mit gleichem Typ und Schlüssel noch nicht gibt (eigene Regeln werden weder doppelt angelegt noch überschrieben)
- **Kategorie-Gruppierung**: nur Kategorien mit Regeln werden angezeigt, sortiert nach angezeigtem Namen; bei Suche werden alle Kategorien mit Treffer aufgeklappt
- **Suche**: filtert nach Zutat/Kategorie (auch übersetzte Namen)
- **Regel-Editor als Sheet**: Chips statt Rohschlüssel und gt/lt/eq, Komma-Schwellwerte, Validierungsmeldungen, Speicher-Fortschritt und Fehler-Feedback, Löschen direkt im Editor (nicht bei Produkt-Prüfungen)
- **Regel hinzufügen/bearbeiten**:
  - **Zutaten-Regel**: Keyword + Kategorie (25 Presets)
  - **Nährwert-Regel**: Nährwert (5 Optionen) + Operator (gt/lt/eq) + Grenzwert + feste Kategorie „Nährwerte“
  - **Marke / Konzern**: Name + optionale Wikidata-Abfrage (Eintrag wählen, zugehörige Marken ansehen und einzeln abwählen) + feste Kategorie „Marken & Konzerne“
  - **Produkt-Prüfung** (nur bearbeiten): Erklärung, wann die Prüfung anschlägt; Severity; bei der Zutatenzahl das Limit (ganze Zahl ab 1); kein Löschen-Button, stattdessen der Hinweis, die Prüfung mit „Erlaubt“ auszuschalten (eine gelöschte Prüfung ließe sich nicht wiederherstellen)
  - **Severity**: RED FLAG / Erlaubt (mit Erklärung der jeweiligen Wirkung)
- **Bearbeiten ohne Datenverlust**: eine gespeicherte Übersetzung bleibt erhalten, solange sich das Keyword nicht ändert
- **Auto-Translation**: Neue Zutaten werden parallel in 7 Sprachen übersetzt
- **Löschen** mit Bestätigungsdialog (Zutaten-, Nährwert- und Marken-/Konzern-Regeln; Produkt-Prüfungen nicht)
- **25 Kategorie-Presets**: Süßungsmittel, Farbstoffe, Konservierungsstoffe, Geschmacksverstärker & Aromen, Emulgatoren & Stabilisatoren, Verdickungs- & Geliermittel, Säuren & Säureregulatoren, Antioxidationsmittel, Gehärtete Fette & raffinierte Öle, Zucker & Sirupe, Modifizierte Stärken, Phosphate & Mineralstoffe, Füll- & Trägerstoffe, Proteine & Fleischersatz, Trenn- & Überzugsmittel, Treib- & Schutzgase, Metalle, E-Nummern, Sonstige Zusatzstoffe, Gentechnik, Insekten, Samenöle, Zuchtfisch, Alkohol, Erhitzte Milch
- **Kategorien der Prüfungen und Marken**: Verarbeitung, Verpackung, Schadstoffe sowie Marken & Konzerne erscheinen in der Liste, sind aber keine Presets für Zutaten-Regeln

---

## Settings

Die Einstellungen sind als gruppierte Liste aufgebaut:

| Gruppe | Beschreibung |
|-------------|-------------|
| **Bewertung** | Filter-Regeln mit Anzahl der aktiven Regeln; Schalter **Allergen-Warnung** (standardmäßig aus), darunter **Meine Allergene**, solange sie an ist |
| **Datenquellen & Schlüssel** | Übersetzung (Anbieter und API-Key) und **USDA FoodData Central** (eigener Schlüssel) |
| **Sprache** | DE ↔ EN (App-UI umschaltbar) |
| **Open Food Facts Konto** | Login/Logout für Produktbeiträge, zeigt den Zielserver |
| **Datenbank-Backup** | Speicherort wählen (Android), Backup erstellen, automatisches Backup, Wiederherstellen |
| **Hilfe & Info** | Eiercode prüfen, Anleitung & Über FoodCheck |

### Meine Allergene (`/settings/allergens`)
- Optional: nur aktiv, wenn der Schalter „Allergen-Warnung“ in den Einstellungen an ist (standardmäßig aus); aus = keine Warnungen, keine Hinweise
- Auswahl aus den 14 EU-Allergenen, gespeichert in der Datenbank (Teil jedes Backups)
- Scan-Karte (inkl. Screenreader-Ansage) und Produktseite warnen bei „Enthält …“ und „Kann Spuren enthalten …“ laut Open Food Facts
- Hinweis: Grundlage sind die OFF-Angaben (`allergens_tags`, `traces`); keine Warnung heißt nicht unbedenklich
- Die Ampel-Bewertung bleibt davon unberührt

### Übersetzungs-Einstellung (`/settings/api-key`)
- **Provider-Wahl**: DeepL vs MyMemory
- **Status-Anzeige**: Key konfiguriert / Anonym (5.000 Wörter/Tag) / Kein Key
- **Key speichern/löschen** (SecureStore), vollständig übersetzt (nicht mehr fest auf Deutsch)

### USDA FoodData Central (`/settings/usda-key`)
- Fallback für Barcodes, die Open Food Facts nicht kennt: USDA FoodData Central, die Lebensmitteldatenbank des US-Landwirtschaftsministeriums (vor allem Produkte aus den USA; Daten gemeinfrei, CC0)
- **Jeder Nutzer braucht einen eigenen, kostenlosen Schlüssel** von api.data.gov (Link „Kostenlosen Schlüssel anfordern“); die App enthält keinen Schlüssel. Ohne Schlüssel wird USDA nie abgefragt
- **Key speichern/löschen** (SecureStore); der Schlüssel wird im Header gesendet, nie in der URL
- Ein einmal gespeichertes USDA-Produkt wird nicht erneut bei USDA abgefragt; kennt Open Food Facts den Barcode später, gelten dessen Daten – was dort fehlt (z. B. Zutaten oder Nährwerte bei einem Eintrag nur mit Foto), kommt weiter aus den gespeicherten USDA-Daten, und solange Zutaten oder Nährwerte von USDA stammen, bleibt der USDA-Quellenhinweis sichtbar
- USDA-Produkte können nicht an Open Food Facts gesendet werden

---

## Eiercode prüfen (`/egg-code`)

- Erreichbar über den Button im Scanner und über **Einstellungen → Hilfe & Info**
- Eingabe des auf das Ei gedruckten Erzeugercodes, z. B. `0-DE-0312345`; funktioniert offline
- **Haltungsform** aus der ersten Ziffer: 0 Bio, 1 Freiland, 2 Bodenhaltung, 3 Käfighaltung (Kleingruppe/ausgestalteter Käfig), mit Einordnung und kurzer Erklärung
- **Herkunft**: Land aus dem Ländercode; bei deutschen Codes zusätzlich Bundesland, Betriebs- und Stallnummer
- Verständliche Fehlermeldungen (fehlende/ungültige Haltungsziffer, unbekannter Ländercode, zu kurz/zu lang, unbekanntes Bundesland)

---

## Mehrsprachigkeit

- **UI-Sprachen**: Deutsch, Englisch (`i18n/translations.ts`)
- **Runtime-Switch**: `useTranslation()` Hook + `languageStore` (Zustand, persistiert in SecureStore); die Sprache wechselt sofort, das Speichern erfolgt im Hintergrund
- **Zutaten-Suche**: 7 Sprachen (de, fr, it, es, nl, pt, pl) zusätzlich zum englischen Schlüssel
- **Zutaten-Bearbeitung**: 8 Sprachen (de, en, fr, it, es, nl, pt, pl)
- **Produkt-Zutaten**: mehrsprachige Anzeige mit Sprach-Chips
- **Nährwert-OCR**: automatische Spracherkennung (DE/EN/FR/IT)
- **Übersetzungsdienste**: DeepL (Free API) und MyMemory (anonym oder mit Key); MyMemory-Fehlermeldungen (HTTP 200 mit Fehlertext) werden nicht mehr als Übersetzung übernommen, Anfragen haben ein Timeout

---

## OCR (Texterkennung)

- **On-Device (Standard)**: ML Kit Text Recognition (lateinische Schrift)
  - Texterkennung mit Konfidenzwerten (`OcrService`)
  - Vorverarbeitung durch `OcrPreprocessor` (Größenanpassung, Qualitätsschätzung)
  - Nährwert-Parsing zeilenweise mit Sprachautomatik: erkennt Tausendertrennzeichen, Komma-Dezimalzahlen, „<0,5“, „Spuren“, sowie kJ/kcal- und „Brennwert“-Angaben
- **Cloud (nur nach ausdrücklicher Zustimmung)**: Open Food Facts Google Cloud Vision Pipeline (`OffOcrClient`)
  - Zustimmungsdialog nennt den Zielserver, bevor irgendetwas hochgeladen wird
  - Bild-Upload → Polling auf OCR-Ergebnis (max. 10 Versuche, 2 s Intervall)
  - Verwendet sprachspezifische Bildfelder (`ingredients_de`, `nutrition_de`, …) und den aktuellen Schreib-Server (Staging in Entwicklungs-Builds, Produktiv in Release-Builds)
  - Zuschneide-Auswahl wird korrekt auf das tatsächliche Kamerabild umgerechnet

---

## Daten-Persistenz

| Speicher | Was | Technologie |
|----------|-----|-------------|
| **SQLite** | Produkte, Favoriten, Filter-Regeln, Meta (Migrationsstand, Backup-Einstellungen) | expo-sqlite |
| **SecureStore** | OFF-Zugangsdaten, Übersetzungs-API-Keys, USDA-Schlüssel, Sprache, Provider | expo-secure-store |
| **FileSystem** | Backup-Datei (Kopie der SQLite-Datenbank) | expo-file-system |
| **Zustand** | In-Memory State (5 Stores: filter, catalog, language, settings, allergen) | zustand |

### Datenbank-Schema
- **`meta`**: key (PK), value — Migrations-Tracking, Rating-Fingerprint, Backup-Einstellungen
- **`products`**: id, ean (UNIQUE), name, brands, ingredients, nova_score, nutriscore, raw_json, scanned_at, rating, data_version, last_api_fetch, image_url, image_ingredients_url, image_nutrition_url, image_packaging_url, visit_count, last_seen_at, edited_at, edited_fields — Kategorien, Verpackung, Siegel, Markeninhaber, Identitätskennzeichen, Alkoholgehalt und die Quelle (USDA) stehen in `raw_json`
- **`favorites`**: id, product_id (FK → products.id CASCADE, UNIQUE-Index), added_at
- **`filter_rules`**: id, type (`ingredient`/`nutrient`/`check`/`company`), key, category, threshold, operator, severity, translations (JSON; bei Marken/Konzernen die Wikidata-ID, die zugehörigen Marken und die abgewählten Namen), created_at
- **10 Migrationen** (Datenbank-Version 10): initiales Schema → Seed Rules → Produkt-Spalten → Visit-Tracking → Kategorie-Spalte → Translations-Spalte → Favoriten-Eindeutigkeit + edited_at → edited_fields → Filterliste aktualisiert (11 Gase entfernt, 86 Zutaten-Regeln und 9 Prüfungen ergänzt) → Alkohol-Regeln ergänzt (15 Zutaten-Regeln)
- **Neu-Bewertung**: `RATING_LOGIC_VERSION` 5 – gespeicherte Produkte werden nach dem Update einmal neu bewertet
- **Daten nachladen**: `PRODUCT_DATA_VERSION` 2 – Produkte, die vor den neuen Open-Food-Facts-Feldern (Kategorien, Verpackung, Markeninhaber, Identitätskennzeichen, Alkoholgehalt) gespeichert wurden, werden nach dem App-Start im Hintergrund neu geladen und bewertet: höchstens 10 Anfragen pro Minute, nacheinander; offline oder bei einem Fehler geht es beim nächsten Start weiter. Eigene Änderungen und USDA-Daten bleiben erhalten.

### Backup & Wiederherstellung
- **Backup**: Kopiert die SQLite-Datenbankdatei selbst (kein JSON-Export) in einen vom Nutzer gewählten Ordner (Android: Storage Access Framework); der Dateiname trägt Zeitstempel
- **Automatisches Backup**: höchstens einmal täglich beim App-Start, wenn aktiviert und ein Ordner gewählt ist
- **Wiederherstellen**: Die gewählte Datei wird zuerst geprüft (SQLite-Kopfzeile + enthält die FoodCheck-Tabellen); erst danach wird die aktuelle Datenbank ersetzt
- **Sicherheitskopie**: Die bisherige Datenbank wird vor dem Ersetzen kopiert und bei einem Fehler automatisch zurückgespielt, sodass nichts verloren geht
- **Geräteeinstellungen bleiben erhalten**: Backup-Ordner, Automatik-Schalter und Zeitpunkt des letzten Backups dieses Geräts werden von einer wiederhergestellten Datei nicht überschrieben
- **iOS**: Ordner-Backups sind derzeit nur unter Android möglich (Hinweis in den Einstellungen)
- **Keine Cloud-Abhängigkeit**: Backup ist komplett lokal, keine Server-Infrastruktur

---

## Externe APIs

| API | Nutzung |
|-----|---------|
| **Open Food Facts v2 (Read)** | Produktsuche nach EAN, 8-Sekunden-Timeout mit Cache-Fallback |
| **Open Food Facts Write** | Produkt-Upload (mehrsprachig, mit Authentifizierung); Staging in Entwicklungs-, Produktiv in Release-Builds |
| **Open Food Facts OCR (Google Cloud Vision)** | Bild-zu-Text, nur nach expliziter Zustimmung |
| **USDA FoodData Central** | Fallback-Suche nach Barcode für Produkte, die Open Food Facts nicht kennt; nur mit eigenem api.data.gov-Schlüssel, 8-Sekunden-Timeout |
| **Wikidata** | Suche nach einem Konzern und Sammeln seiner Marken/Tochterfirmen (SPARQL), nur auf Knopfdruck in einer Marken-/Konzern-Regel |
| **Robotoff** | KI-Vorhersagen für Kategorien, Labels, Inhaltsstoffe |
| **DeepL Free API** | Übersetzung (API-Key benötigt) |
| **MyMemory** | Übersetzung (anonym 5k Wörter/Tag, mit Key 10k/Tag) |

---

## Datenquellen & Lizenzen

| Quelle | Wofür | Lizenz |
|--------|-------|--------|
| **Open Food Facts** | Produktdaten (Zutaten, Nährwerte, Kategorien, Verpackung, Siegel, Identitätskennzeichen) | Open Database License (ODbL) |
| **Wikidata** | Marken und Tochterfirmen gemiedener Konzerne | CC0 |
| **USDA FoodData Central** | Produkte, die Open Food Facts nicht kennt (eigener Schlüssel nötig) | CC0 (gemeinfrei) |
| **BVL, Nationale Berichterstattung Pflanzenschutzmittelrückstände 2023** | Auswahl der Pestizid-Risiko-Kulturen | – (übernommen ist nur die Auswahl der Kulturen, keine Messwerte) |

## Grenzen – was die App nicht wissen kann

- **Keine Pestizidwerte pro Produkt**: Die Pestizid-Prüfung markiert nur Kulturen, die im Bericht 2023 auffallen, wenn das Produkt kein Bio-Siegel hat. Ob ein bestimmtes Produkt belastet ist, weiß die App nicht.
- **Vertical Farming** lässt sich nicht erkennen; dafür gibt es kein Feld in den Produktdaten.
- **PFAS** (z. B. Teflon-Beschichtungen) in Verpackung oder Geschirr sind nicht erkennbar.
- **Identitätskennzeichen** nennen den letzten Verarbeitungs- oder Verpackungsbetrieb, nicht die Herkunft der Rohstoffe.
- **Alle Prüfungen hängen an den Angaben bei Open Food Facts bzw. USDA**: Fehlen Kategorie, Verpackung oder Siegel, schlägt eine Prüfung nicht an; keine Warnung heißt nicht unbedenklich.
- **Marken/Konzerne**: Ohne Wikidata-Abfrage wird nur der Name selbst erkannt; die Konzernstruktur bei Wikidata kann unvollständig oder veraltet sein.

---

## Testing

- **65 Test-Suiten**, **746 Tests**, alle erfolgreich (`npx jest`)
- Datenbank- und Repository-Tests laufen gegen echtes SQLite (`node:sqlite`-Testdouble), nicht gegen String-Vergleichs-Mocks
- **Golden-Ratings**: 32 Referenzprodukte mit fest hinterlegtem Bewertungsergebnis, damit Änderungen an der Bewertungslogik als bewusster, überprüfbarer Diff sichtbar werden
- Getestete Module: Analyse (RedFlagAnalyzer, IngredientParser, IngredientTaxonomy, NovaScoreEvaluator, ProductRating, Produkt-Prüfungen, Marken/Konzerne), Produkt (Badges, Identitätskennzeichen, Mandel-Hinweis), Eiercode, Services (Lookup inkl. USDA-Fallback, Edit, Re-Rating, Hintergrund-Aktualisierung gespeicherter Produkte, Wikidata-Abfrage), API-Clients (inkl. USDA), Repositories/Migrationen (inkl. Migration 9 und 10 ab einer Datenbank mit Nutzerdaten), Backup, OCR, Übersetzungen, Über-Texte (alle Datenquellen genannt), Allergen-Store, Screens/Features
- Integrationstests gegen die echte Open Food Facts API sind opt-in (`npm run test:integration`) und laufen ausschließlich gegen den Staging-Server

---

## Technische Details

- **Expo SDK 54** mit New Architecture (`newArchEnabled: true`)
- **TypeScript strict mode**
- **Schichtenarchitektur**: `app/` (Routen) → `src/screens/` → `src/features/` (Screen-Hooks/-Komponenten) → `src/services/` → `src/domain/` → `src/infrastructure/`; Design-System in `src/ui/`
- **Navigation**: Expo Router (file-based), 4 Tabs + Stack-Screens (Product, Edit, Eiercode) + 5 Settings-Unterseiten
- **State Management**: Zustand (5 Stores: filter, catalog, language, settings, allergen)
- **DI-Pattern**: Constructor Injection für Domain-Klassen und Services, Module-Level-Singletons für Repositories
- **ESLint 10** (Flat Config, `.mjs`) + Prettier (`endOfLine: auto`, damit CRLF-Arbeitskopien unter Windows lintfrei bleiben)
