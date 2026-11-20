# Arbeitsregeln für KI-Agenten

Diese Datei gilt für alle Agenten und Werkzeuge, die an diesem Repo arbeiten
(Claude Code, GitHub Copilot, Cursor usw.). `CLAUDE.md` verweist nur hierher.

Der Projektinhaber ist kein Entwickler. Entscheidungen und Fachbegriffe kurz und
verständlich erklären. Sprache in Oberfläche, Doku und Kommunikation: Deutsch.

## Arbeitsweise

### Erst besprechen, dann nur nach ausdrücklichem „Go“ schreiben
- Vor jeder Änderung (Code, Dateien, Umbenennungen, Commits, Pushes, Tags, Releases)
  zuerst analysieren, Rückfragen stellen und einen konkreten Vorschlag machen.
- Rückfragen einzeln stellen, nicht als großen Block.
- Erst schreiben, wenn der Nutzer ausdrücklich „Go“ gegeben hat. Zustimmung zu einem
  Vorschlag („gut“, „ja“, Auswahl von Optionen) ist noch kein Go, außer der Nutzer
  fordert ausdrücklich zur Umsetzung auf.
- Folgeänderungen, die bei der Umsetzung auffallen, nicht eigenmächtig mitändern,
  sondern als Vorschlag melden.

### Jede Änderung als Pull Request
- Jeder Arbeitsschritt ist ein eigener, für sich funktionierender Pull Request
  gegen `main`.
- Die PR-Beschreibung erklärt in einfachen Worten, was sich ändert und wie es
  getestet wurde.
- Die automatischen Tests müssen grün sein, bevor ein PR übernommen wird.
- Wer Verhalten ändert oder ergänzt, passt die Tests in `tests/` mit an.
- Übernommen wird als ein zusammengefasster Commit („Squash“).

### Versionen und Releases
- Versionen werden **nur** über Git-Tags (`v19`, `v20`, …) und GitHub Releases
  verwaltet, **nicht** über Dateinamen. Dateinamen bleiben über Versionen gleich.
- Die Versionsnummer steht nicht fest im Code. Sie wird beim Release-Build aus dem
  Tag eingesetzt. Ohne Release zeigt die App „Entwicklungsversion“.
- Fertige Programme (EXE, ZIP usw.) werden **nie** ins Repo eingecheckt. Sie werden
  per GitHub Actions gebaut und an das Release gehängt.

## Feste Grundsätze der App
- Die App greift **nur lesend** auf die CT-API zu (ausschließlich GET-Anfragen an CT).
- Login-Tokens werden **nicht dauerhaft gespeichert**, nur im Arbeitsspeicher der
  laufenden Sitzung.
- Es werden **keine Daten an Dritte** gesendet: keine Telemetrie, kein Tracking,
  keine fremden Server. Kommuniziert wird nur mit der vom Nutzer angegebenen
  CT-Instanz.
- Keine kostenpflichtigen Bestandteile (z. B. keine bezahlten Code-Signaturen).
- Die App muss ohne Anpassung auf beliebigen Rechnern laufen.

## Bezeichnungen
- Produktname immer „CT“, nie „ChurchTools“ (auch nicht in Dateinamen).
  Ausnahme: der Firmenname „ChurchTools Innovations GmbH“ im Unabhängigkeitshinweis.
- Kein „API“ im Programmnamen oder in Dateinamen.
- Projekt-Link: https://github.com/tihohub/ctgruppenhierarchie

## Lizenz
- PolyForm Noncommercial 1.0.0 (siehe `LICENSE.txt`, Text dort unverändert lassen).
  Kommerzielle Nutzung nur mit gesonderter Zustimmung des Inhabers. Keine Abhängigkeiten aufnehmen, deren Lizenz das verbietet; neue
  Abhängigkeiten in `THIRD_PARTY_LICENSES.txt` eintragen. Ändert sich
  `desktop/src-tauri/Cargo.lock`, die Lizenztexte `desktop/THIRD_PARTY_RUST_LICENSES.txt` neu
  erzeugen: `cargo install cargo-about` (einmalig), dann in `desktop/src-tauri`:
  `cargo about generate about.hbs -o ../THIRD_PARTY_RUST_LICENSES.txt`.

## Aufbau des Repos
- `web/` – Oberfläche: `index.html`, `style.css`, `app.js` (Anzeige und Bedienung),
  `ct-daten.js` (Abruf aus CT und Datenaufbereitung – einzige Stelle dafür)
- `python/ct_gruppenhierarchie.py` – schlanker lokaler Server: liefert `web/` aus, reicht
  Leseanfragen an CT weiter (Endpunkt `/ct`, nur GET), beendet sich automatisch, wenn
  kein Tab mehr offen ist
- `start_windows.bat` – Startdatei für Windows
- `tests/` – automatische Tests: `fake_ct.py` (Schein-CT-Server mit Testdaten) und
  `app.test.mjs` (Browser-Tests), `ct-daten.test.mjs` (Datenaufbereitung),
  `webseite.test.mjs` (Webseiten-Variante ohne lokalen Server), `extension.test.mjs` (CT-Extension). Ausführen mit `npm install` und `npm test`.
- `.github/workflows/` – GitHub Actions: `tests.yml` (bei jedem Pull Request),
  `release.yml` (per „Run workflow“ mit Versionsnummer oder bei Tag `v*`: Tests, Pakete
  bauen, Tag und Release anlegen)
- `tools/build_python.py` – baut das Python-Paket (eine Datei mit eingebetteter Oberfläche)
- `tools/build_web.py` – baut die Webseite für GitHub Pages (Job `webseite` in `release.yml`)
- `tools/build_extension.py` – baut das ZIP der CT-Extension: `index.html` mit Rahmen (iframe),
  Oberfläche im Unterordner `app/`. Das Kürzel `gruppenhierarchie` ist fest eingebaut.
- `desktop/src-tauri/` – Desktop-App (Tauri v2, Rust-Gerüst, wird kaum angefasst). Zeigt
  `dist/webseite` an; Anfragen an CT über das HTTP-Plugin. Gebaut für Windows und Linux in
  `.github/workflows/desktop.yml` (bei jedem Release und bei Änderungen an `desktop/`).
  Lokal: `python3 tools/build_web.py v0.1 && cd desktop && npx @tauri-apps/cli@2 build`
- `ct-daten.js` erkennt die Variante selbst (`CT_MODE`): `proxy` (Python-Version, Port 8765),
  `direct` (Webseite, CORS-Freigabe nötig), `tauri` (Desktop-App) oder `extension` (Adresse `/ccm/…`)
- Platzhalter `__CT_VERSION__` in `app.js` und im Python-Server wird beim Release durch
  den Tag ersetzt.

## Zielbild (wird schrittweise umgesetzt)
Oberfläche und Datenaufbereitung gibt es nur einmal (HTML/CSS/JavaScript). Vier
Varianten unterscheiden sich nur darin, wie die Anfragen zu CT gelangen:

| Variante | Weg zu CT |
|---|---|
| Webseite (GitHub Pages) | Browser fragt CT direkt; ein CT-Admin hat die Adresse unter CORS freigegeben |
| Desktop-App (Tauri, Windows/Linux) | Programm fragt CT direkt |
| Python-Version (macOS und alle mit Python) | kleiner lokaler Server reicht Anfragen weiter |
| CT-Extension (Kürzel `gruppenhierarchie`) | läuft in CT unter `/ccm/gruppenhierarchie/`, nutzt die CT-Sitzung (kein Token) |

Entfallen: CSV-Import.
