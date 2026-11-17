# CT Gruppenhierarchie API v11 - Release Candidate

Projekt: https://github.com/tihohub/ctgruppenhierarchie

## Aenderungen in v11
- Gruppen, deren Obergruppe der Nutzer nicht sehen darf, verschwinden nicht mehr. Die nicht sichtbare Obergruppe wird ausgegraut mit 🔒 angezeigt (mit Namen, falls CT ihn liefert, sonst mit ID).
- Ausgegraute Kontextgruppen dunkeln nur noch ihre eigene Zeile ab, nicht ihren ganzen Unterbaum.
- Der lokale Server nimmt nur noch Anfragen von der eigenen Seite an (`127.0.0.1` / `localhost`).
- "Daten aktualisieren" zeigt Fehler (z. B. abgelaufener Token) verstaendlich an.
- Einheitliche Bezeichnung "CT", Projekt-Links auf https://github.com/tihohub/ctgruppenhierarchie.

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
- `ct_gruppenhierarchie_api_v11.py`
- `START_CT_GRUPPENHIERARCHIE_API_V11.bat`
- `LICENSE.txt`
- `PRIVACY.txt`
- `THIRD_PARTY_LICENSES.txt`

Vor einem Desktop-EXE-Release muessen die tatsaechlich eingebetteten Runtime-/Packaging-Abhaengigkeiten erneut lizenzseitig geprueft werden.
