# CT Gruppenhierarchie

Eine kleine Anwendung, die die Gruppenstruktur einer CT-Instanz übersichtlich darstellt: als aufklappbaren Baum, als Visualisierung der Gruppenstämme und als Arbeitsliste für Gruppen mit mehreren Obergruppen.

Die Anwendung **liest nur** und verändert keine Daten in CT.

> Unabhängiges Community-Tool. Keine offizielle Anwendung von ChurchTools Innovations GmbH.

Projekt: https://github.com/tihohub/ctgruppenhierarchie

---

## Welche Variante passt?

| Variante | Wann | Was nötig ist |
|---|---|---|
| **Webseite** | Empfohlen, wenn ein CT-Admin einmal mithilft | Browser, CORS-Freigabe durch den Admin, Login-Token |
| **Desktop-App** | Ohne Admin, unter Windows oder Linux | Programm herunterladen, Login-Token |
| **Python-Version** | Ohne Admin, auf dem Mac (oder überall, wo Python installiert ist) | Python, Login-Token |

### Webseite (ohne Installation)

Adresse: **https://tihohub.github.io/ctgruppenhierarchie/**

Der Browser fragt CT direkt. Damit CT das erlaubt, muss ein **CT-Admin einmalig** diese Webseite freigeben:

1. In CT: **System-Einstellungen → Integrationen → Cross-Origin-Ressource-Sharing**
2. Neuen Eintrag anlegen: `https://tihohub.github.io` (genau so, ohne Pfad und ohne Schrägstrich am Ende)
3. Speichern.

Danach die Webseite öffnen, CT-Adresse und Login-Token eingeben. Erscheint „Keine Verbindung zu CT …“, fehlt die Freigabe oder die Adresse ist falsch.

*Was ist CORS?* Eine Schutzregel im Browser: Eine Webseite darf Daten von einer anderen Adresse (hier: eurer CT-Instanz) nur abrufen, wenn diese es ausdrücklich erlaubt. Die Freigabe erlaubt nur dieser Webseite den Zugriff, und nur mit dem Login-Token des jeweiligen Nutzers.

### Desktop-App (Windows, Linux)

Unter [Releases](https://github.com/tihohub/ctgruppenhierarchie/releases/latest) herunterladen:

- **Windows:** `ct-gruppenhierarchie-windows-…-setup.exe` ausführen. Das Programm wird nur für den eigenen Benutzer installiert, Admin-Rechte sind nicht nötig.
- **Linux:** `….AppImage` (ausführbar machen und starten) oder `….deb` (unter Debian/Ubuntu installieren).

Eine CORS-Freigabe ist nicht nötig, das Programm fragt CT direkt.

**Hinweis zur Windows-Warnung:** Das Programm ist nicht digital signiert, denn eine Signatur kostet jährlich Geld. Beim ersten Start meldet Windows deshalb „Der Computer wurde durch Windows geschützt“. Auf **Weitere Informationen → Trotzdem ausführen** klicken. Das ist nur beim ersten Mal nötig.

Eine Mac-Version gibt es nicht: Ohne kostenpflichtige Apple-Signatur meldet macOS solche Programme als „beschädigt“. Mac-Nutzer verwenden die Webseite oder die Python-Version.

---

## Python-Version

### Voraussetzungen

- **Python 3.7 oder neuer.** Download: https://www.python.org/downloads/
  Unter Windows bei der Installation „Add python.exe to PATH“ anhaken.
- Ein aktueller Webbrowser (Edge, Chrome, Firefox, Safari).
- Ein CT-Benutzerkonto und dessen **Login-Token** (siehe unten).

Weitere Pakete oder eine Installation sind nicht nötig. Das Programm verwendet nur die Standardbibliothek von Python.

### Starten

Die aktuelle Version unter [Releases](https://github.com/tihohub/ctgruppenhierarchie/releases/latest) herunterladen: `ct-gruppenhierarchie-python-….zip`. Die ZIP-Datei entpacken.

**Windows:** Doppelklick auf `start_windows.bat`.

**macOS / Linux:** Im Terminal in den entpackten Ordner wechseln und starten:

```bash
python3 ct_gruppenhierarchie.py
```

Der Browser öffnet sich automatisch mit `http://127.0.0.1:8765/`. Falls nicht, diese Adresse innerhalb von 3 Minuten von Hand im Browser öffnen.

### Beenden

- **Automatisch:** Wird der letzte Browser-Tab der App geschlossen, beendet sich das Programm nach etwa 10 Sekunden von selbst, und das Konsolenfenster schließt sich. Neuladen mit F5 beendet das Programm nicht.
- Stürzt der Browser ab, beendet sich das Programm spätestens nach 3 Minuten.
- **Sofort:** im Konsolenfenster `Strg+C` drücken oder das Fenster schließen.
- **Neue Version starten:** Läuft noch eine andere Version (ab v17), wird sie beim Start der neuen automatisch beendet. Ein noch offener Tab der alten Version zeigt dann einen Hinweis und kann geschlossen werden.
- Bei einem Fehler bleibt das Konsolenfenster offen, damit die Meldung lesbar ist.

## Erste Verbindung

1. Im Einstellungsdialog (⚙) die **CT-Adresse** eintragen, z. B. `https://deine-gemeinde.church.tools`.
2. Den **Login-Token** eintragen.
3. Auf **„Verbindung testen und laden“** klicken.

### Wo finde ich den Login-Token?

1. In CT anmelden.
2. Oben rechts auf das eigene **Nutzerbild** klicken.
3. **Mein Profil** wählen.
4. **Login-Token anzeigen** anklicken.
5. Den langen Token-Text kopieren und in der App im Feld „Login-Token“ einfügen.

Tipp: Für die App am besten mit einem eigenen CT-Benutzer anmelden, der Gruppen nur sehen darf, und dessen Login-Token verwenden (siehe unten).

Der Login-Token gewährt Zugriff mit den Rechten des Benutzers. **Nicht an andere Personen weitergeben.**

### Welche Rechte werden benötigt?

Die Anwendung sieht genau das, was der Benutzer in CT sehen darf. Empfehlung: einen eigenen CT-Benutzer anlegen, der Gruppen nur **sehen** darf, und dessen Login-Token verwenden. Der Token hat nämlich alle Rechte seines Benutzers, nicht nur Leserechte – auch wenn die App selbst nur liest. Gruppen ohne Berechtigung erscheinen nicht. Ist eine Obergruppe nicht sichtbar, wird sie ausgegraut mit 🔒 angezeigt (mit Namen, falls CT ihn liefert, sonst mit ID), damit die sichtbaren Untergruppen an ihrem ursprünglichen Stamm bleiben.

## Funktionen

**Übersicht**
- Aufklappbarer Baum aller Gruppenstämme mit Gruppentyp, Status und Sichtbarkeit.
- Eigener Bereich für alleinstehende Gruppen (ohne Ober- und Untergruppen).
- Klick auf einen Gruppennamen öffnet die Gruppe in CT.

**Visualisierung**
- Gruppenstämme als Karten, wahlweise horizontal (Stämme nebeneinander) oder vertikal (Stämme untereinander). Nach dem Verbinden ist alles aufgeklappt.
- Alleinstehende Gruppen in einem eigenen Bereich im gleichen Kartenstil.

**Mehrfachzuordnungen**
- Gruppen mit mehreren Obergruppen sind in Übersicht und Visualisierung mit „🔗 auch unter: …“ gekennzeichnet.
- Die Namen in „auch unter“ sind Sprung-Links: Ein Klick springt in der App zu dieser Obergruppe, klappt den Weg dorthin auf und hebt sie kurz hervor.
- Gruppen, die nur wegen einer mehrfach zugeordneten Obergruppe doppelt erscheinen, tragen „↻ mehrfach über …“.
- Eigener Reiter „🔗 Mehrfachzuordnungen“ als Arbeitsliste: pro Gruppe alle Wege vom Gruppenstamm. Jeder Name im Weg springt in die Übersicht, der Gruppenname in der Kopfzeile öffnet die Gruppe zum Bereinigen in CT.
- Nach einem Sprung steht direkt an der angesprungenen Gruppe der Knopf **„↩ zurück zu …“**. Er führt genau an die Stelle zurück, von der aus gesprungen wurde (Reiter, Suche und Filter werden wiederhergestellt, die Gruppe wird hervorgehoben). Mehrere Sprünge lassen sich schrittweise zurückgehen. Der Knopf verschwindet, sobald man selbst sucht, filtert oder auf- und zuklappt.
- Nicht sichtbare Obergruppen (🔒) zählen bei der Mehrfachzuordnung mit.

**Suche, Filter, Statistik**
- Volltextsuche über Name, Beschreibung, Typ, Status, Sichtbarkeit, Homepage, Kategorie, Campus und Treffzeit, mit Hervorhebung der Treffer.
- Filter nach Gruppentyp, Sichtbarkeit, Gruppenstatus und Mehrfachzuordnung, jeweils mit Anzahl.
- Obergruppen eines Treffers werden ausgegraut als Kontext eingeblendet.
- Statistik: Anzahl Gruppen, hierarchische und alleinstehende Gruppen, Gruppenstämme, Gruppen mit mehreren Obergruppen, Beziehungen.
- Jede Gruppe wird nur einmal gezählt, auch wenn sie unter mehreren Obergruppen erscheint.

**Weiteres**
- **↻** oben rechts neben ⚙ lädt die Daten neu aus CT (sichtbar, solange eine Verbindung besteht).
- Alles auf- und zuklappen, Drucken.
- Beschreibungen der Gruppen als Tooltip (💬).

## Datenschutz und Sicherheit

- Die Daten werden **auf dem eigenen Gerät** aufbereitet. Abgerufen wird ausschließlich von der eingetragenen CT-Instanz. Es gibt keinen Server des Entwicklers, kein Tracking und keine Telemetrie.
- **Webseite:** Die Seite selbst wird von GitHub Pages geladen; GitHub sieht dabei wie bei jedem Webseitenaufruf technische Verbindungsdaten. CT-Daten und Login-Token gehen nicht an GitHub, sondern direkt an CT.
- **Nur lesend:** An CT werden ausschließlich Leseabfragen gesendet.
- Der **Login-Token wird nicht gespeichert.** Er existiert nur während der laufenden Sitzung.
- Im Browser gespeichert werden nur Oberflächeneinstellungen: CT-Adresse, Suche, Filter, aufgeklappte Gruppen und Darstellungsart.
- **„Trennen“** löscht alle geladenen Daten, den Token, Suche, Filter und aufgeklappte Gruppen. Eine neue Verbindung löscht zuerst alle Daten der vorherigen. Auf gemeinsam genutzten Rechnern nach dem Trennen zusätzlich den Browser-Tab schließen.
- **Sitzungs-Timeout:** Nach 58 Minuten ohne Benutzung (Maus, Tastatur, Scrollen) erscheint eine Warnung mit dem Knopf „Weiterarbeiten“. Nach 60 Minuten werden geladene Daten und Token automatisch gelöscht, wie bei „Trennen“.
- **Python-Version:** Der lokale Server ist nur vom eigenen Rechner aus erreichbar (`127.0.0.1`) und nimmt nur Anfragen der eigenen Seite an.

Details: `PRIVACY.txt`

## Fehlerbehebung

- **„Anmeldung fehlgeschlagen“:** Login-Token prüfen bzw. neu erzeugen.
- **„Zugriff verweigert“:** Dem Benutzer fehlen in CT Rechte.
- **„CT-Instanz nicht erreichbar“:** CT-Adresse und Internetverbindung prüfen.
- **„Keine Verbindung zu CT …“ (Webseite):** Die CORS-Freigabe fehlt oder die CT-Adresse ist falsch, siehe [Webseite](#webseite-ohne-installation).
- **„Der Computer wurde durch Windows geschützt“ (Desktop-App):** Weitere Informationen → Trotzdem ausführen (Programm ist nicht signiert).
- **„Port 8765 ist bereits belegt“:** Es läuft noch eine ältere Version (v16 oder älter) oder ein anderes Programm auf diesem Port. Dessen Konsolenfenster schließen und neu starten. Versionen ab v17 werden automatisch abgelöst.
- **„Programm beendet“ im Browser (Python-Version):** Das Programm läuft nicht mehr (Tab war geschlossen, neue Version gestartet oder Rechner im Ruhezustand). Programm neu starten.
- **„python“ wird nicht gefunden (Python-Version unter Windows):** Python installieren und dabei „Add python.exe to PATH“ anhaken.

## Dateien

- `web/`: die Oberfläche (`index.html`, `style.css`, `app.js`) und die Datenaufbereitung (`ct-daten.js`)
- `python/ct_gruppenhierarchie.py`: der lokale Server, der die Oberfläche ausliefert und Leseanfragen an CT weiterreicht
- `start_windows.bat`: Startdatei für Windows
- `desktop/`: die Desktop-App (Tauri)
- `tools/build_python.py`, `tools/build_web.py`: bauen Download-Paket und Webseite (beim Release automatisch)
- `AGENTS.md`: Arbeitsregeln für KI-Agenten
- `LICENSE.txt`: Lizenz
- `PRIVACY.txt`: Datenschutzhinweis
- `THIRD_PARTY_LICENSES.txt`: Hinweise zu Drittkomponenten

## Entwicklung

Für die Nutzung der App nicht nötig. Die automatischen Tests prüfen die Oberfläche gegen einen Schein-CT-Server mit Testdaten:

```bash
npm install
npx playwright install chromium
npm test
```

Auf GitHub laufen die Tests bei jedem Pull Request automatisch.

**Neue Version veröffentlichen:** Auf GitHub unter *Actions → Release → Run workflow* die neue Versionsnummer eingeben (z. B. `v20`) und starten. GitHub führt dann die Tests aus, baut die Download-Pakete und legt Tag und Release an. Alternativ einen Tag `v…` setzen. Direkt aus dem Repo starten (ohne Release) geht mit `python3 python/ct_gruppenhierarchie.py`; die App zeigt dann „Entwicklungsversion“.

## Lizenz

© 2026 Tim Hofmann. Kostenlose Nutzung für nicht-kommerzielle Zwecke. Kommerzielle Nutzung nur mit vorheriger schriftlicher Zustimmung. Vollständiger Text: `LICENSE.txt`.

Vor einem späteren Desktop-EXE-Release müssen die tatsächlich eingebetteten Laufzeit- und Packaging-Abhängigkeiten erneut lizenzrechtlich geprüft werden.
