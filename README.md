# CT Gruppenhierarchie v14 - Release Candidate

Projekt: https://github.com/tihohub/ctgruppenhierarchie

## Aenderungen in v14
- Die Visualisierung zeigt alleinstehende Gruppen (ohne Ober- und Untergruppen) in einem eigenen Bereich unter den Gruppenstaemmen, im gleichen Kartenstil.

## Aenderungen in v13
- Neue Verbindung ("Verbindung testen und laden") loescht zuerst alle bisher geladenen Daten; schlaegt sie fehl, bleibt nichts von der alten Verbindung sichtbar.
- "Trennen" loescht Gruppendaten, Nutzeranzeige, Token, Suche, Filter und aufgeklappte Gruppen.
- "Daten aktualisieren" loescht ebenfalls vorher alles, wenn Token oder Adresse geaendert wurden.
- Beim Wechsel der CT-Adresse werden Suche, Filter und aufgeklappte Gruppen zurueckgesetzt.
- Es wird nur das Ergebnis der zuletzt gestarteten Abfrage angezeigt.
- Aktualisieren behaelt die aktuell aufgeklappten Gruppen und die Suche bei.

## Aenderungen in v12
- Gruppen, deren Obergruppe der Nutzer nicht sehen darf, verschwinden nicht mehr. Die nicht sichtbare Obergruppe wird ausgegraut mit 🔒 angezeigt (mit Namen, falls CT ihn liefert, sonst mit ID).
- Ausgegraute Kontextgruppen dunkeln nur noch ihre eigene Zeile ab, nicht ihren ganzen Unterbaum.
- Der lokale Server nimmt nur noch Anfragen von der eigenen Seite an (`127.0.0.1` / `localhost`).
- "Daten aktualisieren" zeigt Fehler (z. B. abgelaufener Token) verstaendlich an.
- Einheitliche Bezeichnung "CT", Projekt-Links auf https://github.com/tihohub/ctgruppenhierarchie.
- Dateinamen ohne "API": `ct_gruppenhierarchie_v14.py`, `START_CT_GRUPPENHIERARCHIE_V14.bat`.
- CT-Adresse ist nicht mehr mit einer bestimmten Gemeinde vorbelegt, sondern zeigt einen Platzhalter.

## Release-Ergaenzungen v10
- Erster-Start-Hinweis mit Read-only-, Datenschutz- und Unabhaengigkeits-Hinweis.
- Bereich **Ueber / Rechtliches** mit Version, Copyright, Lizenz, Datenschutz und GitHub-Link.
- Copyright: © 2026 Tim Hofmann.
- Klarstellung: unabhaengiges Community-Tool, keine offizielle Anwendung von ChurchTools Innovations GmbH.
- Sicherheitshinweis direkt beim Login-Token.
- Verstaendlichere Meldungen fuer ungueltigen Token, fehlende Berechtigung und nicht erreichbare CT-Instanz.
- Kein Tracking und keine Telemetrie durch den Entwickler.
- Alle Fachfunktionen der eigenstaendigen v9 bleiben erhalten.

## Dateien fuer die Quellversion
- `ct_gruppenhierarchie_v14.py`
- `START_CT_GRUPPENHIERARCHIE_V14.bat`
- `LICENSE.txt`
- `PRIVACY.txt`
- `THIRD_PARTY_LICENSES.txt`

Vor einem Desktop-EXE-Release muessen die tatsaechlich eingebetteten Runtime-/Packaging-Abhaengigkeiten erneut lizenzseitig geprueft werden.
