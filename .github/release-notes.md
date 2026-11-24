## Download

| Variante | Datei | Voraussetzung |
|---|---|---|
| **CT-Extension** (läuft direkt in CT) | `ct-gruppenhierarchie-extension-….zip` | Ein CT-Admin lädt sie einmal hoch (Kürzel `gruppenhierarchie`) |
| **Webseite** (alle Systeme) | https://tihohub.github.io/ctgruppenhierarchie/ | CORS-Freigabe durch einen CT-Admin |
| **Desktop-App Windows** | `ct-gruppenhierarchie-windows-…-setup.exe` | – |
| **Desktop-App Linux** | `….AppImage` oder `….deb` | – |
| **Python-Version** (macOS und alle mit Python) | `ct-gruppenhierarchie-python-….zip` | Python 3.7 oder neuer |

**Desktop-App Windows:** Das Programm ist nicht digital signiert (das würde Geld kosten). Beim ersten Start meldet Windows deshalb „Der Computer wurde durch Windows geschützt“. Auf **Weitere Informationen → Trotzdem ausführen** klicken. Die Desktop-App sucht selbst nach neuen Versionen und bietet sie zur Installation an (abschaltbar unter ⓘ Über). **Wechsel auf v1.0:** Wer v28 oder älter installiert hat, installiert v1.0 einmal von Hand (ggf. Hinweis auf „neuere Version“ bestätigen); danach laufen automatische Updates wieder.

**CT-Extension:** In CT unter Admin-Einstellungen → Erweiterungen → „Erweiterung hinzufügen“ (bzw. Stift bei vorhandener Erweiterung), Kürzel genau `gruppenhierarchie`, alle Formularfelder ausfüllen, ZIP hochladen (nicht entpacken). Anleitung im README.
*Beta-Hinweis:* CT kennzeichnet Erweiterungen derzeit als Beta-Funktion ohne Support durch CT. Änderungen an CT können die Extension jederzeit beeinträchtigen; dann eine der anderen Varianten nutzen.

**Python-Version:** ZIP entpacken, dann unter Windows Doppelklick auf `start_windows.bat`, unter macOS/Linux im Terminal `python3 ct_gruppenhierarchie.py`.

Ausführliche Anleitung: siehe `README.md` im Paket.

Webseite, Desktop-App und Python-Version greifen nur lesend auf CT zu. Die CT-Extension ändert ab Version 2.0 im Bearbeiten-Modus nach Rückfrage ausschließlich die Zuordnung von Gruppen zu Obergruppen. Die App speichert keine Login-Tokens und sendet keine Daten an Dritte.
