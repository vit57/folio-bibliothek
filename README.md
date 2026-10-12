# folio. – Deine Bibliothek

Eine eigenständige Lese- und Lern-App für Mac und iPad. PDFs und DRM-freie EPUBs werden auf dem jeweiligen Gerät gelesen und gespeichert. Die App benötigt keine ChatGPT-Mitgliedschaft und keine KI-API.

## Verwendung

Bücher importieren, lesen, markieren, eigene Fragen festhalten und Gedanken später wiederholen. Themes, Schriften, Zeilenlesen, PDF-Scrollen, Seitenvorschauen und die Galerie stehen direkt im Reader zur Verfügung.

Die App enthält nur eigene kurze Demo-Leseproben. Importierte Bücher, Sicherungen, Notizen und persönliche Bibliotheksdaten werden nicht auf GitHub hochgeladen.

## Private Bereitstellung auf GitHub

Dieses Repository und seine App-Pakete sind privat. GitHub Pages ist ausgeschaltet. Der Workflow `.github/workflows/private-build.yml` baut und prüft die App bei Änderungen an `main`; ein erfolgreicher Lauf stellt ein privates Download-Artefakt bereit.

Die aktuelle startfertige Mac-Ausgabe liegt außerdem bei den Releases. GitHub verlangt zum Öffnen des Repositorys und zum Herunterladen eine Anmeldung mit Zugriffsrecht. Eine private GitHub-Quelle stellt noch keinen privaten Webserver für das iPad bereit.

**Wechsel von einer anderen Adresse:** Dort zuerst unter Einstellungen eine `.folio`-Sicherung erstellen. Auf einer neuen App-Adresse die Sicherung einlesen. Bücher und Notizen bleiben in deinem Browser; die Quelle und die Download-Pakete enthalten keine persönliche Bibliothek.

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

## Version 1.10.1

- Apple-Dateipakete mit einem äußeren `.epub`-Ordner werden als EPUB erkannt, auch wenn der Dateidialog `.zip` ergänzt. Kapitel und Cover behalten ihre relativen Pfade. Mehrdeutige, beschädigte oder verschlüsselte Inhalte werden weiter geprüft.
- Kapitelname nur einmal in den Bedienelementen: die zweite Anzeige in der Werkzeugleiste entfällt.
- Keine verschwommene Titelzeile: opake Kopfzeile ohne Glaseffekt; ausgeblendete iPad-Kopfzeile entfernt ihre Darstellung vollständig. Menüs behalten ihre korrekte Breite beim erneuten Öffnen.
- GitHub-Unterpfade funktionieren auch für Updates, PDF-Schriften, Texturen, Manifest und den begrenzten Offline-Cache. Andere Apps auf derselben Domain werden nicht vom Worker übernommen.

Komponenten-Lizenzen: [NOTICE.md](NOTICE.md).
