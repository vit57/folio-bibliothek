# folio. – Deine Bibliothek

Eine eigenständige Lese- und Lern-App für Mac und iPad. PDFs und DRM-freie EPUBs werden auf dem jeweiligen Gerät gelesen und gespeichert. Die App benötigt keine ChatGPT-Mitgliedschaft und keine KI-API.

## Verwendung

Bücher importieren, lesen, markieren, eigene Fragen festhalten und Gedanken später wiederholen. Themes, Schriften, Zeilenlesen, PDF-Scrollen, Seitenvorschauen und die Galerie stehen direkt im Reader zur Verfügung.

Die App enthält nur eigene kurze Demo-Leseproben. Importierte Bücher, Sicherungen, Notizen und persönliche Bibliotheksdaten werden nicht auf GitHub hochgeladen.

## Dauerhafte App auf Mac und iPad

**[folio. öffnen](https://vit57.github.io/folio-bibliothek/)**

App und Quellcode sind öffentlich. Importierte Bücher, Notizen, Markierungen, Lerndaten und Sicherungen bleiben im lokalen Browser-Speicher. Die App hat keinen gemeinsamen Server-Bücherbestand und lädt deine Bibliothek nicht auf GitHub hoch. Andere Personen starten mit ihren eigenen Demo-Büchern und ihrem eigenen Datenbestand.

Der Mac muss für die GitHub-Adresse nicht eingeschaltet sein. Die App benötigt keine ChatGPT-Mitgliedschaft. Auf dem iPad in Safari öffnen → Teilen → Zum Home-Bildschirm. Nach dem ersten vollständigen Laden liegen die Programmdateien auch für die Offline-Nutzung auf dem Gerät.

**Wechsel von der bisherigen Adresse:** Dort unter „Sicherung & Geräte“ → „Sicherung herunterladen“ eine `.folio`-Datei speichern. Danach unter der neuen GitHub-Adresse „Sicherung einlesen“ verwenden. Jeder Browser und jede App-Adresse hat einen eigenen Speicher; es gibt keinen automatischen Cloud-Abgleich. Sicherungen privat aufbewahren, sie enthalten deine Bücher und Notizen.

`.github/workflows/pages.yml` prüft neue Änderungen an `main` und veröffentlicht erst nach erfolgreichem Build und Browserprüfung die statische App mit GitHub Pages.

## Lokal starten

```sh
npm ci
npm run build
python3 scripts/serve.py
```

Dann `http://localhost:5188` öffnen. Der Mac muss für diesen lokalen Server eingeschaltet bleiben. Eine GitHub-Pages-Veröffentlichung ist davon unabhängig.

## Entwicklung und Prüfung

Node.js 24 oder neuer. `npm test` prüft Importgrenzen, Buchstruktur, Speicherformate und Exporte. `npm run test:browser` prüft die Lese- und Lernabläufe in Chromium und iPad-WebKit. Browser vorher mit `npx playwright install chromium webkit` installieren.

```sh
FOLIO_BASE_PATH=/folio-bibliothek/ npm run build
FOLIO_BASE_PATH=/folio-bibliothek/ npm run test:pages
```

`test:pages` prüft den tatsächlichen Unterpfad, EPUB/PDF, Schriften/Bilder, PWA-Scope, Offline-Dateien und die klare Titelzeile in mehreren Designs. Die iPad-Prüfung ist eine WebKit-Simulation.

## Version 1.10.2

Die Titelzeile im kompakten Reader hat eine eigene feste Zeile außerhalb der Buchfläche. In der installierten iPad-App sitzt sie zusätzlich unterhalb des oberen Systembereichs. Solider Seitenhintergrund und größere, kräftigere Schrift ersetzen die kleine schwebende Anzeige. Die Lesefläche bleibt beim Öffnen und Schließen der Bedienelemente stabil.

## Version 1.10.1

- Apple-Dateipakete mit einem äußeren `.epub`-Ordner werden als EPUB erkannt, auch wenn der Dateidialog `.zip` ergänzt. Kapitel und Cover behalten ihre relativen Pfade. Mehrdeutige, beschädigte oder verschlüsselte Inhalte werden weiter geprüft.
- Kapitelname nur einmal in den Bedienelementen: die zweite Anzeige in der Werkzeugleiste entfällt.
- Keine verschwommene Titelzeile: opake Kopfzeile ohne Glaseffekt; ausgeblendete iPad-Kopfzeile entfernt ihre Darstellung vollständig. Menüs behalten ihre korrekte Breite beim erneuten Öffnen.
- GitHub-Unterpfade funktionieren auch für Updates, PDF-Schriften, Texturen, Manifest und den begrenzten Offline-Cache. Andere Apps auf derselben Domain werden nicht vom Worker übernommen.

Komponenten-Lizenzen: [NOTICE.md](NOTICE.md).
