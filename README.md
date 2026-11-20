# CT Gruppenhierarchie

Eine kleine Anwendung, die die Gruppenstruktur einer CT-Instanz übersichtlich darstellt: als aufklappbaren Baum, als Visualisierung der Gruppenstämme und als Arbeitsliste für Gruppen mit mehreren Obergruppen.

Die Anwendung **liest nur** und verändert keine Daten in CT.

> Unabhängiges Community-Tool. Keine offizielle Anwendung von ChurchTools Innovations GmbH.

Projekt: https://github.com/tihohub/ctgruppenhierarchie

---

## Welche Variante passt?

| Variante | Wann | Was nötig ist |
|---|---|---|
| **CT-Extension** | Am bequemsten: läuft direkt in CT, ohne Token | Ein CT-Admin installiert sie einmal (Erweiterungen müssen im CT-Paket verfügbar sein) |
| **Webseite** | Wenn ein CT-Admin einmal mithilft | Browser, CORS-Freigabe durch den Admin, Login-Token |
| **Desktop-App** | Ohne Admin, unter Windows oder Linux | Programm herunterladen, Login-Token |
| **Python-Version** | Ohne Admin, auf dem Mac (oder überall, wo Python installiert ist) | Python, Login-Token |

### Webseite (ohne Installation)

Adresse: **https://tihohub.github.io/ctgruppenhierarchie/**

Der Browser fragt CT direkt. Damit CT das erlaubt, muss ein **CT-Admin einmalig** diese Webseite freigeben:

1. In CT: **System-Einstellungen → Integrationen → Cross-Origin-Ressource-Sharing**
2. Neuen Eintrag anlegen: `https://tihohub.github.io` (genau so, ohne Pfad und ohne Schrägstrich am Ende)
3. Speichern.

Danach die Webseite öffnen, CT-Adresse und Login-Token eingeben. Erscheint „Keine Verbindung zu CT …“, fehlt die Freigabe oder die Adresse ist falsch.

*Was ist CORS?* Eine Schutzregel im Browser: Eine Webseite darf Daten von einer anderen Adresse (hier: eurer CT-Instanz) nur abrufen, wenn diese es ausdrücklich erlaubt. Abgerufen werden kann dabei nur mit dem Login-Token, den der jeweilige Nutzer selbst eingibt.

**Gut zu wissen:** Die Freigabe gilt für alle Seiten unter `https://tihohub.github.io`, nicht nur für dieses Tool. Eine Freigabe nur für den Pfad `/ctgruppenhierarchie` ist technisch nicht möglich, weil der Browser CT nur die Adresse ohne Pfad mitteilt. Unter dieser Adresse kann nur der Inhaber dieses GitHub-Kontos Seiten veröffentlichen; derzeit liegt dort nur dieses Tool.

### CT-Extension (direkt in CT)

> **Beta-Hinweis:** CT kennzeichnet Erweiterungen derzeit als Beta-Funktion ohne Support durch CT. Änderungen an CT können die Extension jederzeit beeinträchtigen. In diesem Fall die Webseite, die Desktop-App oder die Python-Version nutzen.

Die App läuft als Erweiterung innerhalb von CT. Nutzer öffnen sie wie jeden anderen Menüpunkt; es gibt **keinen Login-Token**, keine Adresse zum Eintippen und keine CORS-Freigabe. Jeder sieht genau die Gruppen, die er in CT sehen darf.

**Einmalige Installation durch einen CT-Admin:**

1. Unter [Releases](https://github.com/tihohub/ctgruppenhierarchie/releases/latest) die Datei `ct-gruppenhierarchie-extension-….zip` herunterladen (nicht entpacken).
2. In CT: **Admin-Einstellungen → Erweiterungen** → **Erweiterung hinzufügen**.
3. Name: z. B. `Gruppenhierarchie`. **Kürzel: genau `gruppenhierarchie`** (sonst bleibt die Seite leer). Bei Bedarf „im Menü anzeigen“ anhaken.
4. Die ZIP-Datei hochladen und speichern.
5. Aufrufen über das Menü oder unter `https://eure-gemeinde.church.tools/ccm/gruppenhierarchie/`.

**Update:** Die Erweiterung in CT über den Stift öffnen, die ZIP-Datei der neuen Version hochladen und speichern. Danach die Seite mit **Strg+Shift+R** neu laden, damit der Browser keine alten Dateien verwendet. Die Extension aktualisiert sich nicht von selbst.

Hinweis: Erweiterungen sind nicht in jedem CT-Paket verfügbar. Fehlt der Menüpunkt „Erweiterungen“, eine der anderen Varianten nutzen.

### Desktop-App (Windows, Linux)

Unter [Releases](https://github.com/tihohub/ctgruppenhierarchie/releases/latest) herunterladen:

- **Windows:** `ct-gruppenhierarchie-windows-…-setup.exe` ausführen. Das Programm wird nur für den eigenen Benutzer installiert, Admin-Rechte sind nicht nötig.
- **Linux:** `….AppImage` (ausführbar machen und starten) oder `….deb` (unter Debian/Ubuntu installieren).

Eine CORS-Freigabe ist nicht nötig, das Programm fragt CT direkt.

**Hinweis zur Windows-Warnung:** Das Programm ist nicht digital signiert, denn eine Signatur kostet jährlich Geld. Beim ersten Start meldet Windows deshalb „Der Computer wurde durch Windows geschützt“. Auf **Weitere Informationen → Trotzdem ausführen** klicken. Das ist nur beim ersten Mal nötig.

**Updates:** Die Desktop-App sucht beim Start nach neuen Versionen und fragt, bevor sie etwas installiert. Updates sind mit einem eigenen Schlüssel unterschrieben; die App installiert nur Versionen mit gültiger Unterschrift. Abschalten lässt sich die Suche im Dialog **ⓘ Über** („Beim Start nach neuen Versionen suchen“); dort gibt es auch „Jetzt nach Updates suchen“. Automatisch aktualisiert werden der Windows-Installer und das Linux-AppImage, das `.deb`-Paket nicht.

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
- **Neue Version starten:** Läuft noch eine andere Version, wird sie beim Start der neuen automatisch beendet. Ein noch offener Tab der alten Version zeigt dann einen Hinweis und kann geschlossen werden.
- Bei einem Fehler bleibt das Konsolenfenster offen, damit die Meldung lesbar ist.

## Erste Verbindung

Gilt für Webseite, Desktop-App und Python-Version. Bei der CT-Extension entfällt dieser Schritt, sie nutzt die Anmeldung in CT.

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
- Statistik: Anzahl Gruppen, hierarchische und alleinstehende Gruppen, Gruppenstämme, Gruppen mit mehreren Obergruppen, Beziehungen. Alle Zahlen beziehen sich auf die aktuelle Suche und die Filter; ausgegraut eingeblendete Obergruppen zählen nicht mit.
- Jede Gruppe wird nur einmal gezählt, auch wenn sie unter mehreren Obergruppen erscheint.

**Weiteres**
- **↻** oben rechts neben ⚙ lädt die Daten neu aus CT (sichtbar, solange eine Verbindung besteht).
- Alles auf- und zuklappen, Drucken.
- Beschreibungen der Gruppen als Tooltip (💬).

## Datenschutz und Sicherheit

- Die Daten werden **auf dem eigenen Gerät** aufbereitet. Abgerufen wird ausschließlich von der eingetragenen CT-Instanz. Es gibt keinen Server des Entwicklers, kein Tracking und keine Telemetrie.
- **Webseite:** Die Seite selbst wird von GitHub Pages geladen; GitHub sieht dabei wie bei jedem Webseitenaufruf technische Verbindungsdaten. CT-Daten und Login-Token gehen nicht an GitHub, sondern direkt an CT.
- **Desktop-App:** Sucht beim Start bei GitHub nach neuen Versionen (abschaltbar unter ⓘ Über). GitHub sieht dabei technische Verbindungsdaten, aber keine CT-Daten und keinen Login-Token.
- **CT-Extension:** Läuft innerhalb von CT mit der bestehenden Anmeldung; es wird kein Login-Token eingegeben und keine Verbindung zu anderen Servern aufgebaut. Abmeldung und Sitzungsdauer regelt CT.
- **Nur lesend:** An CT werden ausschließlich Leseabfragen gesendet.
- Der **Login-Token wird nicht gespeichert.** Er existiert nur während der laufenden Sitzung.
- Im Browser gespeichert werden nur Oberflächeneinstellungen: CT-Adresse, Suche, Filter, aufgeklappte Gruppen und Darstellungsart.
- **„Trennen“** löscht alle geladenen Daten, den Token, Suche, Filter und aufgeklappte Gruppen. Eine neue Verbindung löscht zuerst alle Daten der vorherigen. Auf gemeinsam genutzten Rechnern nach dem Trennen zusätzlich den Browser-Tab schließen.
- **Sitzungs-Timeout** (nicht in der CT-Extension): Nach 58 Minuten ohne Benutzung (Maus, Tastatur, Scrollen) erscheint eine Warnung mit dem Knopf „Weiterarbeiten“. Nach 60 Minuten werden geladene Daten und Token automatisch gelöscht, wie bei „Trennen“.
- **Python-Version:** Der lokale Server ist nur vom eigenen Rechner aus erreichbar (`127.0.0.1`) und nimmt nur Anfragen der eigenen Seite an.

Details: `PRIVACY.txt`

## Fehlerbehebung

- **„Anmeldung fehlgeschlagen“:** Login-Token prüfen bzw. neu erzeugen.
- **„Zugriff verweigert“:** Dem Benutzer fehlen in CT Rechte.
- **„CT-Instanz nicht erreichbar“:** CT-Adresse und Internetverbindung prüfen.
- **Leere Seite (CT-Extension):** Das Kürzel der Erweiterung in CT muss genau `gruppenhierarchie` lauten. Nach einem Update die Seite mit Strg+Shift+R neu laden.
- **„Nicht angemeldet …“ (CT-Extension):** In CT neu anmelden und die Seite neu laden.
- **„Keine Verbindung zu CT …“ (Webseite):** Die CORS-Freigabe fehlt oder die CT-Adresse ist falsch, siehe [Webseite](#webseite-ohne-installation).
- **„Der Computer wurde durch Windows geschützt“ (Desktop-App):** Weitere Informationen → Trotzdem ausführen (Programm ist nicht signiert).
- **„Port 8765 ist bereits belegt“ (Python-Version):** Es läuft noch eine sehr alte Version oder ein anderes Programm auf diesem Port. Dessen Konsolenfenster schließen und neu starten. Neuere Versionen werden automatisch abgelöst.
- **„Programm beendet“ im Browser (Python-Version):** Das Programm läuft nicht mehr (Tab war geschlossen, neue Version gestartet oder Rechner im Ruhezustand). Programm neu starten.
- **„python“ wird nicht gefunden (Python-Version unter Windows):** Python installieren und dabei „Add python.exe to PATH“ anhaken.

## Dateien

- `web/`: die Oberfläche (`index.html`, `style.css`, `app.js`) und die Datenaufbereitung (`ct-daten.js`)
- `python/ct_gruppenhierarchie.py`: der lokale Server, der die Oberfläche ausliefert und Leseanfragen an CT weiterreicht
- `start_windows.bat`: Startdatei für Windows
- `desktop/`: die Desktop-App (Tauri); `desktop/THIRD_PARTY_RUST_LICENSES.txt`: Lizenztexte der eingebauten Bibliotheken
- `tools/`: Bauskripte für Python-Paket, Webseite, CT-Extension und die Update-Datei der Desktop-App (beim Release automatisch)
- `tests/`: automatische Tests mit einem Schein-CT-Server
- `AGENTS.md`, `CLAUDE.md`: Arbeitsregeln für KI-Agenten
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

**Neue Version veröffentlichen:** Auf GitHub unter *Actions → Release → Run workflow* die neue Versionsnummer eingeben (z. B. `v27`) und starten. GitHub führt dann die Tests aus, baut alle Pakete (Extension, Webseite, Desktop-App, Python-Version) und legt Tag und Release an. Für die Desktop-App muss das Repo-Secret `TAURI_SIGNING_PRIVATE_KEY` (Update-Schlüssel) hinterlegt sein. Alternativ einen Tag `v…` setzen. Direkt aus dem Repo starten (ohne Release) geht mit `python3 python/ct_gruppenhierarchie.py`; die App zeigt dann „Entwicklungsversion“.

## Lizenz

© 2026 Tim Hofmann. Lizenz: [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0) – vollständiger Text in `LICENSE.txt`.

- Nutzung, Weitergabe und Änderung für nicht-kommerzielle Zwecke sind erlaubt, ausdrücklich auch für gemeinnützige Organisationen wie Kirchengemeinden.
- Kommerzielle Nutzung ist nicht erlaubt; eine Erlaubnis kann auf Anfrage über das GitHub-Projekt gesondert erteilt werden.
- Bei Weitergabe den Lizenztext und die Zeile „Required Notice“ aus `LICENSE.txt` mitgeben.

Hinweise zu eingebauten Fremdbestandteilen: `THIRD_PARTY_LICENSES.txt`.
