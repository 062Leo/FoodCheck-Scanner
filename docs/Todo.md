## Neue Features:

**Feature 1 — Instant Scan Result Overlay**

Nach erfolgreichem Scan färbt sich der gesamte Kamera-Hintergrund in der bereits implementierten Grün/Gelb/Rot-Logik — dieselbe Bestimmung die auch im Product Screen genutzt wird, nichts Neues.

Sobald das Overlay aktiv ist, wird der Barcode-Scanner pausiert und nimmt keine weiteren Scans entgegen. Er wird erst wieder aktiviert wenn der Nutzer explizit auf "Nächstes Produkt" tippt.

Auf dem Overlay erscheint eine flache Liste aller gefundenen Red Flags.

Zwei Buttons, daumenerreichbar unten:
- **"Nächstes Produkt"** — Overlay schließt, Scanner wird reaktiviert, Kamera sofort wieder aktiv
- **"Details"** — öffnet den bestehenden Product Screen, Scanner bleibt bis zur Rückkehr pausiert

Fallback wenn Produkt unbekannt oder Zutaten fehlen: kein Overlay, bestehende Popups/CTAs greifen wie bisher, Scanner pausiert bis der Nutzer den Dialog bestätigt.

---

**Feature 2 — Backup & Wiederherstellung ✓ Erledigt**

~~iCloud / Google Drive Backup / andere KOSTENLOSE alternative~~

Erledigt über `BackupService`: JSON-Export/Import der gesamten SQLite-Datenbank (Produkte, Filter-Regeln, Favoriten). Wiederherstellung bei Neuinstallation. Keine eigene Server-Infrastruktur nötig. Export-Datei wird über native Share-Funktion geteilt.

---

**Feature 3 — CSV / JSON Export**

Katalog als CSV oder JSON exportieren. Nützlich für eigene Auswertungen, Tabellen oder das Teilen mit Ernährungsberatern.
