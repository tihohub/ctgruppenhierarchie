# CT Gruppenhierarchie

Eine kleine lokale Anwendung, die die Gruppenstruktur einer CT-Instanz übersichtlich darstellt: als aufklappbaren Baum, als Visualisierung der Gruppenstämme und als Arbeitsliste für Gruppen mit mehreren Obergruppen.

Die Anwendung **liest nur** und verändert keine Daten in CT.

> Unabhängiges Community-Tool. Keine offizielle Anwendung von ChurchTools Innovations GmbH.

Projekt: https://github.com/tihohub/ctgruppenhierarchie

---

## Voraussetzungen

- **Python 3.7 oder neuer.** Download: https://www.python.org/downloads/
  Unter Windows bei der Installation „Add python.exe to PATH“ anhaken.
- Ein aktueller Webbrowser (Edge, Chrome, Firefox, Safari).
- Ein CT-Benutzerkonto und dessen **Login-Token** (siehe unten).

Weitere Pakete oder eine Installation sind nicht nötig. Das Programm verwendet nur die Standardbibliothek von Python.

## Starten

Den ganzen Projektordner herunterladen (auf GitHub „Code → Download ZIP“) und entpacken.

**Windows:** Doppelklick auf `start_windows.bat`.

**macOS / Linux:** Im Terminal in den entpackten Ordner wechseln und starten:

```bash
python3 python/ct_gruppenhierarchie.py
```

Der Browser öffnet sich automatisch mit `http://127.0.0.1:8765/`. Falls nicht, diese Adresse innerhalb von 3 Minuten von Hand im Browser öffnen.

## Beenden

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

In CT im eigenen Personenprofil unter den Berechtigungen bzw. Sicherheitseinstellungen („Login-Token“). Je nach CT-Version und Einstellungen der Gemeinde kann die Stelle abweichen. Im Zweifel hilft der CT-Administrator der Gemeinde.

Der Login-Token gewährt Zugriff mit den Rechten des Benutzers. **Nicht an andere Personen weitergeben.**

### Welche Rechte werden benötigt?

Die Anwendung sieht genau das, was der Benutzer in CT sehen darf. Gruppen ohne Berechtigung erscheinen nicht. Ist eine Obergruppe nicht sichtbar, wird sie ausgegraut mit 🔒 angezeigt (mit Namen, falls CT ihn liefert, sonst mit ID), damit die sichtbaren Untergruppen an ihrem ursprünglichen Stamm bleiben.

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

- Die Anwendung läuft **lokal** auf dem eigenen Rechner. Sie kommuniziert ausschließlich mit der eingetragenen CT-Instanz. Es gibt keinen Server des Entwicklers, kein Tracking und keine Telemetrie.
- **Nur lesend:** An CT werden ausschließlich Leseabfragen gesendet.
- Der **Login-Token wird nicht gespeichert.** Er existiert nur während der laufenden Sitzung.
- Im Browser gespeichert werden nur Oberflächeneinstellungen: CT-Adresse, Suche, Filter, aufgeklappte Gruppen und Darstellungsart.
- **„Trennen“** löscht alle geladenen Daten, den Token, Suche, Filter und aufgeklappte Gruppen. Eine neue Verbindung löscht zuerst alle Daten der vorherigen. Auf gemeinsam genutzten Rechnern nach dem Trennen zusätzlich den Browser-Tab schließen.
- **Sitzungs-Timeout:** Nach 58 Minuten ohne Benutzung (Maus, Tastatur, Scrollen) erscheint eine Warnung mit dem Knopf „Weiterarbeiten“. Nach 60 Minuten werden geladene Daten und Token automatisch gelöscht, wie bei „Trennen“.
- Der lokale Server ist nur vom eigenen Rechner aus erreichbar (`127.0.0.1`) und nimmt nur Anfragen der eigenen Seite an.

Details: `PRIVACY.txt`

## Fehlerbehebung

- **„Anmeldung fehlgeschlagen“:** Login-Token prüfen bzw. neu erzeugen.
- **„Zugriff verweigert“:** Dem Benutzer fehlen in CT Rechte.
- **„CT-Instanz nicht erreichbar“:** CT-Adresse und Internetverbindung prüfen.
- **„Port 8765 ist bereits belegt“:** Es läuft noch eine ältere Version (v16 oder älter) oder ein anderes Programm auf diesem Port. Dessen Konsolenfenster schließen und neu starten. Versionen ab v17 werden automatisch abgelöst.
- **„Programm beendet“ im Browser:** Das Programm läuft nicht mehr (Tab war geschlossen, neue Version gestartet oder Rechner im Ruhezustand). Programm neu starten.
- **„python“ wird nicht gefunden (Windows):** Python installieren und dabei „Add python.exe to PATH“ anhaken.

## Dateien

- `web/`: die Oberfläche (`index.html`, `style.css`, `app.js`)
- `python/ct_gruppenhierarchie.py`: der lokale Server, der die Oberfläche ausliefert und die Daten aus CT abruft
- `start_windows.bat`: Startdatei für Windows
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

## Lizenz

© 2026 Tim Hofmann. Kostenlose Nutzung für nicht-kommerzielle Zwecke. Kommerzielle Nutzung nur mit vorheriger schriftlicher Zustimmung. Vollständiger Text: `LICENSE.txt`.

Vor einem späteren Desktop-EXE-Release müssen die tatsächlich eingebetteten Laufzeit- und Packaging-Abhängigkeiten erneut lizenzrechtlich geprüft werden.
