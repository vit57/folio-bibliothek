# Komponenten und Lizenzen

- **PDF.js / pdfjs-dist 4.10.38** — Mozilla and contributors, Apache License 2.0. `src/pdf-text.css` übernimmt ausschließlich die Text-Layer-Stile dieser Version. PDF-Worker, CMaps und Standard-Fonts stammen aus demselben Paket. Die Paket-Lizenzen werden in das App-Paket kopiert.
- **JSZip 3.10.1** — Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso and contributors; MIT or GPLv3. Nutzung unter MIT. Enthält die im Paket genannten Drittkomponenten, darunter pako.
- **Lucide 0.468.0** — Lucide Contributors, ISC License. `src/icons.js` enthält die benötigten Icon-Nodes aus diesem Paket.
- **Vite** — MIT License; nur Build-Werkzeug.
- **@napi-rs/canvas** — MIT License; nur für Entwicklungs-Testgrafiken.
- **Playwright** — Microsoft Corporation, Apache License 2.0; nur zur Entwicklung und Prüfung.

Die eigenen Cover-Grafiken, kurzen Leseproben und SVG-Papier-, Holz-, Marmor- und Sternenkarten-Grafiken wurden für dieses Projekt erstellt. Keine Cover oder Volltexte aus Apple Books und keine privaten Inhalte aus den Bible-Projekten wurden kopiert.

- **jsPDF 4.2.1** — James Hall, yWorks GmbH and contributors; MIT License. Nur bei PDF-Export geladen. Textausgabe mit eingebetteten Liberation-Sans-Schriften; keine HTML- oder URL-Umwandlung. Enthält die Drittkomponenten des npm-Pakets. Die Paketlizenz wird mitgeliefert.
- **Liberation Sans** — Copyright Red Hat, Inc. and contributors; SIL Open Font License 1.1. Stammt aus den mitgelieferten PDF.js-Schriften; `dist/pdf/fonts/LICENSE_LIBERATION` enthält die Lizenz. Die Schriften werden in Journal-PDFs eingebettet und als lokale Reader-Schrift bereitgestellt.
