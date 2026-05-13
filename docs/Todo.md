## Neue Features:

**Feature 1 — Instant Scan Result Overlay**

Nach erfolgreichem Scan färbt sich der gesamte Kamera-Hintergrund in der bereits implementierten Grün/Gelb/Rot-Logik — dieselbe Bestimmung die auch im Product Screen genutzt wird, nichts Neues.

Sobald das Overlay aktiv ist, wird der Barcode-Scanner pausiert und nimmt keine weiteren Scans entgegen. Er wird erst wieder aktiviert wenn der Nutzer explizit auf "Nächstes Produkt" tippt.

Auf dem Overlay erscheint, abhängig davon ob du Favoriten-Red-Flags markiert hast:

**Wenn Favoriten-Red-Flags vorhanden und getroffen:** Zwei Sektionen — ⭐ Favoriten oben (größer/prominent), alle weiteren Red Flags darunter gedimmter.

**Wenn Favoriten-Red-Flags vorhanden aber keine getroffen:** Nur die Sektion "Weitere Red Flags" — kein leerer Favoriten-Bereich.

**Wenn keine Favoriten-Red-Flags definiert:** Nur eine einzige flache Liste aller gefundenen Red Flags, voller Platz genutzt.

**Wenn grün (keine Red Flags):** Nur der grüne Hintergrund, kurze Bestätigung "Keine Treffer", kein leerer Listenbereich. Scanner pausiert bis "Nächstes Produkt" gedrückt wird.

Zwei Buttons, daumenerreichbar unten:
- **"Nächstes Produkt"** — Overlay schließt, Scanner wird reaktiviert, Kamera sofort wieder aktiv
- **"Details"** — öffnet den bestehenden Product Screen, Scanner bleibt bis zur Rückkehr pausiert

Fallback wenn Produkt unbekannt oder Zutaten fehlen: kein Overlay, bestehende Popups/CTAs greifen wie bisher, Scanner pausiert bis der Nutzer den Dialog bestätigt.

---

**Feature 2 — Red Flag Favoriten (Stern-Markierung) ✓ DB-Spalte existiert, UI-Fehlende Integration**

In der Filter Rules Verwaltung bekommt jede Regel einen Stern-Toggle (`is_favorite`-Spalte existiert in filter_rules). Markierte Regeln:
- Sollen im Overlay (Feature 1) prominent ganz oben erscheinen
- Sollen in der Filter Rules Liste einen eigenen Abschnitt "Meine wichtigsten" ganz oben bekommen, vor den 19 Kategorien

Aktueller Stand: `is_favorite`-Spalte und DB-Migration sind implementiert. Die UI zum Markieren und die Overlay-Integration fehlen noch.

---

**Feature 3 — Backup & Wiederherstellung ✓ Erledigt**

~~iCloud / Google Drive Backup / andere KOSTENLOSE alternative~~

Erledigt über `BackupService`: JSON-Export/Import der gesamten SQLite-Datenbank (Produkte, Filter-Regeln, Favoriten). Wiederherstellung bei Neuinstallation. Keine eigene Server-Infrastruktur nötig. Export-Datei wird über native Share-Funktion geteilt.

---

**Feature 4 — CSV / JSON Export**

Katalog als CSV oder JSON exportieren. Nützlich für eigene Auswertungen, Tabellen oder das Teilen mit Ernährungsberatern.
