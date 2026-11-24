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
- Versionen werden **nur** über Git-Tags und GitHub Releases verwaltet, **nicht** über
  Dateinamen. Dateinamen bleiben über Versionen gleich.
- Schema `vX.Y` mit einer Nachkommastelle (`v1.0`, `v1.1`, …, `v2.0`): X = Generation
  (1 = nur lesend, 2 = schreibend), Y = jeder Release dieser Generation, ob Fehlerbehebung
  oder kleine Verbesserung. Keine dritte Stelle. Intern macht das Bauskript daraus `X.Y.0`.
- Bis v28 wurde einfach hochgezählt (`v19` … `v28`); v1.0 entspricht inhaltlich v28. Die
  Desktop-App hält 1.0 für älter als 28: Installationen bis v28 müssen v1.0 einmal von Hand
  installieren.
- Alle Varianten werden immer gemeinsam mit derselben Versionsnummer gebaut. Der Release-Text
  sagt, wen ein Update betrifft und ob es optional ist.

### Zwei Entwicklungslinien
- `main` = Version 1.x (nur lesend, stabil): Fehlerbehebungen und kleine Verbesserungen.
  Releases `v1.Y` kommen von `main`.
- Branch `v2` = Version 2.0 (schreibend): große neue Funktionen, Pull Requests gegen `v2`.
  Änderungen aus `main` werden regelmäßig nach `v2` übernommen.
- Testversionen der 2.0 sollen als Vorab-Release erscheinen (z. B. `v2.0-beta1`), die die
  Desktop-App nicht automatisch holt. Der Release-Ablauf kann das noch nicht; er wird vor
  der ersten Testversion angepasst.
- Die Grundsätze für das Schreiben sind mit dem Inhaber besprochen (Abschnitt „Schreiben in CT
  (nur Branch v2)“ unten). Funktionen und Reihenfolge der 2.0 stehen in `PLAN_V2.md` (nur im
  Branch `v2`). In `main` gilt weiter ausschließlich „nur lesend“.
- Ist 2.0 fertig, wird `v2` nach `main` übernommen; `main` ist ab dann 2.x.
- Die Versionsnummer steht nicht fest im Code. Sie wird beim Release-Build aus dem
  Tag eingesetzt. Ohne Release zeigt die App „Entwicklungsversion“.
- Fertige Programme (EXE, ZIP usw.) werden **nie** ins Repo eingecheckt. Sie werden
  per GitHub Actions gebaut und an das Release gehängt.

## Feste Grundsätze der App
- Die App greift **nur lesend** auf die CT-API zu (ausschließlich GET-Anfragen an CT).
  Einzige Ausnahme: Version 2.0 im Branch `v2`, siehe „Schreiben in CT“.
- Login-Tokens werden **nicht dauerhaft gespeichert**, nur im Arbeitsspeicher der
  laufenden Sitzung.
- Es werden **keine Daten an Dritte** gesendet: keine Telemetrie, kein Tracking,
  keine fremden Server. Kommuniziert wird nur mit der vom Nutzer angegebenen
  CT-Instanz.
- Keine kostenpflichtigen Bestandteile (z. B. keine bezahlten Code-Signaturen).
- Einzige Verbindung außer zu CT: die Update-Suche der Desktop-App bei GitHub (abschaltbar,
  im Datenschutzhinweis genannt).
- Die App muss ohne Anpassung auf beliebigen Rechnern laufen.

## Schreiben in CT (nur Branch `v2`)
Ausnahme vom Grundsatz „nur lesend“, gilt nur für Version 2.0 im Branch `v2`:
- Geschrieben wird zunächst **nur in der CT-Extension** (mit der CT-Anmeldung des Nutzers).
  Webseite, Desktop-App und Python-Version bleiben nur lesend, bis der Inhaber das
  ausdrücklich ändert.
- Erlaubt sind nur die in `PLAN_V2.md` festgelegten Änderungen: Obergruppen einer Gruppe
  ändern (verschieben, zusätzlich einordnen, lösen). Keine anderen Daten verändern, nichts
  löschen. Gespeicherte Filter liegen nur auf dem eigenen Gerät, nicht in CT.
- Geschrieben wird nur im eingeschalteten Bearbeiten-Modus und erst nach einer Rückfrage.
- Vor jedem Schreiben den aktuellen Stand in CT prüfen; weicht er von der Anzeige ab, nichts
  schreiben.
- Jede Änderung ist mit dem Zurück-Knopf umkehrbar.
- CT prüft die Rechte; die App umgeht sie nicht.
- Tests: Schreib-Anfragen zuerst nur gegen den Schein-CT, dann gegen Testgruppen; der Test
  „nur lesend“ gilt weiter für Webseite, Desktop-App und Python-Version.

## Auto-Updater der Desktop-App
- Updates werden mit einem eigenen Schlüssel signiert. Der öffentliche Teil steht in
  `desktop/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`), der private Teil nur als
  Repo-Secret `TAURI_SIGNING_PRIVATE_KEY` (ohne Passwort). Der private Schlüssel darf nie ins
  Repo, in Logs oder in den Chat.
- Ohne dieses Secret schlägt der Bau der Desktop-App fehl.
- Der Release-Ablauf erzeugt `latest.json` (`tools/make_update_json.py`); die App fragt
  `releases/latest/download/latest.json` ab.
- Wird der Schlüssel ersetzt, können bestehende Installationen nicht mehr automatisch
  aktualisieren (neue Version einmal von Hand installieren).

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
  `webseite.test.mjs` (Webseiten-Variante ohne lokalen Server), `extension.test.mjs` (CT-Extension), `release.test.mjs` (Dateinamen und Update-Datei der Release-Pakete), `schreiben.test.mjs` (nur `v2`: Obergruppen ändern, Stand-Prüfung, Rechte, Sperre der Testversion). Ausführen mit `npm install` und `npm test`.
- `.github/workflows/` – GitHub Actions: `tests.yml` (bei jedem Pull Request),
  `release.yml` (per „Run workflow“ mit Versionsnummer oder bei Tag `v*`: Tests, Pakete
  bauen, Tag und Release anlegen)
- `.github/workflows/testversion.yml` (nur im Branch `v2`) – baut bei jeder Änderung an `v2`
  eine Testversion der Extension (Kürzel `gruppenhierarchietest`, Version `v2.0-test.<Commit>`)
  als Download unter Actions. Kein Release; in CT als zweite Erweiterung hochladen.
- `tools/release_check.py` – Sicherung im Release-Ablauf: nur Versionen `v1.x` aus dem Stand
  von `main` werden veröffentlicht (2.0 noch nicht)
- `tools/build_python.py` – baut das Python-Paket (eine Datei mit eingebetteter Oberfläche)
- `tools/build_web.py` – baut die Webseite für GitHub Pages (Job `webseite` in `release.yml`)
- `tools/build_extension.py` – baut das ZIP der CT-Extension. CT übernimmt nur den INHALT der
  `index.html` in die eigene Seite und setzt `<base href>` auf die Startseite: deshalb
  absolute Pfade `/ccm/gruppenhierarchie/assets/…`, kein `<style>`/Inline-Skript, alle
  CSS-Regeln auf den Bereich `#ctgh` beschränkt (sonst ändern sie das CT-Menü), Element-ID
  `app` → `ctgh-app`. Das Kürzel `gruppenhierarchie` ist fest eingebaut. Der Schein-CT
  (`tests/fake_ct.py`) ahmt diese Einbettung nach.
- `desktop/src-tauri/` – Desktop-App (Tauri v2, Rust-Gerüst, wird kaum angefasst). Zeigt
  `dist/webseite` an; Anfragen an CT über das HTTP-Plugin. Gebaut für Windows und Linux in
  `.github/workflows/desktop.yml` (bei jedem Release und bei Änderungen an `desktop/`).
  Lokal: `python3 tools/build_web.py v0.1 && cd desktop && npx @tauri-apps/cli@2 build`
- `ct-daten.js` erkennt die Variante selbst (`CT_MODE`): `proxy` (Python-Version, Port 8765),
  `direct` (Webseite, CORS-Freigabe nötig), `tauri` (Desktop-App) oder `extension` (Adresse `/ccm/…`)
- Platzhalter `__CT_VERSION__` in `app.js` und im Python-Server wird beim Release durch
  den Tag ersetzt.

## Varianten
Oberfläche und Datenaufbereitung gibt es nur einmal (HTML/CSS/JavaScript). Vier
Varianten unterscheiden sich nur darin, wie die Anfragen zu CT gelangen:

| Variante | Weg zu CT |
|---|---|
| Webseite (GitHub Pages) | Browser fragt CT direkt; ein CT-Admin hat die Adresse unter CORS freigegeben |
| Desktop-App (Tauri, Windows/Linux) | Programm fragt CT direkt |
| Python-Version (macOS und alle mit Python) | kleiner lokaler Server reicht Anfragen weiter |
| CT-Extension (Kürzel `gruppenhierarchie`) | läuft in CT unter `/ccm/gruppenhierarchie/`, nutzt die CT-Sitzung (kein Token) |

Entfallen: CSV-Import. Keine native Mac-App: ohne kostenpflichtiges Apple Developer Program
(Developer ID, Notarisierung) blockiert macOS weitergegebene Apps; Mac-Nutzer verwenden
Extension, Webseite oder Python-Version.

**CT-Extension ist Beta:** CT kennzeichnet Erweiterungen als Beta-Funktion ohne Support. Die
Einbettung (nur Inhalt der index.html, `<base href>`, Entfernen von `<style>`) ist nicht
offiziell dokumentiert, sondern beobachtet. Funktioniert die Extension nach einem CT-Update
nicht mehr, zuerst prüfen, ob CT die Einbettung geändert hat. Der Beta-Hinweis steht im
README, im Release-Text und im Über-Dialog der Extension.
