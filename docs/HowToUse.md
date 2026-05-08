HowToUse — TrueFood-Scanner (Kurz)

Kurz & knapp: Wie benutze ich die App (Entwickler-Guide)

1) Voraussetzungen
- Node.js + npm installiert
- Expo CLI (optional) oder `npm`-Skripte

2) Projekt starten (lokal)

- Abhängigkeiten installieren:

```bash
cd App
npm install
```

- App im Entwicklungsmodus starten (Expo):

```bash
cd App
npm start
# oder für Android
npm run android
# für iOS (Mac):
npm run ios
```

3) Scanner benutzen
- Öffne die App im `Scanner`-Tab (öffnet Kamera automatisch).
- Erlaube Kamerazugriff, wenn die Systemabfrage erscheint.
- Richte den EAN-Barcode in den Scan-Rahmen; die App scannt automatisch.
- Bei erfolgreichem Scan: kurzes haptisches Feedback und Weiterleitung zum Result-Screen.

4) Result Screen (Kurz):
- Oben: Zurück-Button immer sichtbar.
- Große Ampel-Anzeige (Grün/Gelb/Rot) zeigt das Gesamturteil.
- Falls kein Internet: Meldung „Kein Internet – Produkt kann nicht abgerufen werden".
- Falls Produkt nicht in OFF: Toast-Message „Produkt nicht in der Datenbank".
- Details: Produktname, Marke, Nova-Score, gefundene Red Flags, aufklappbare Nährwerte.

5) Entwicklung & Tests
- TypeScript-Check:

```bash
cd App
npx tsc --noEmit
```

- Unit-Tests (Jest):

```bash
cd App
npm test
```

6) Häufige Probleme
- `expo-camera` oder natives Modul-Fehler: Prüfe, ob Expo SDK-Version mit installierten Paketen kompatibel ist.
- Peer-Dependency-Fehler bei `npm install`: nutze `--legacy-peer-deps` lokal, wenn nötig.
- Haptics nicht verfügbar (Simulator): teste auf echtem Gerät.

7) Hinweise für später (v2+)
- Offline-Caching von gescannten Produkten (SQLite) ist geplant.
- Favoriten/Katalog werden v2 hinzufügen.

Kontakt / Notizen
- Dieses Repo ist privat und für den Entwickler bestimmt. Bei Fragen siehe `docs/01_Lastenheft.md` und `docs/03_UX-Konzept.md`.
