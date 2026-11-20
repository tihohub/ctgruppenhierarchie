## Download

| Variante | Datei | Voraussetzung |
|---|---|---|
| **CT-Extension** (läuft direkt in CT) | `ct-gruppenhierarchie-extension-….zip` | Ein CT-Admin lädt sie einmal hoch (Kürzel `gruppenhierarchie`) |
| **Webseite** (alle Systeme) | https://tihohub.github.io/ctgruppenhierarchie/ | CORS-Freigabe durch einen CT-Admin |
| **Desktop-App Windows** | `ct-gruppenhierarchie-windows-…-setup.exe` | – |
| **Desktop-App Linux** | `….AppImage` oder `….deb` | – |
| **Python-Version** (macOS und alle mit Python) | `ct-gruppenhierarchie-python-….zip` | Python 3.7 oder neuer |

**Desktop-App Windows:** Das Programm ist nicht digital signiert (das würde Geld kosten). Beim ersten Start meldet Windows deshalb „Der Computer wurde durch Windows geschützt“. Auf **Weitere Informationen → Trotzdem ausführen** klicken. Ab v25 sucht die Desktop-App selbst nach neuen Versionen und bietet sie zur Installation an (abschaltbar unter ⓘ Über).

**CT-Extension:** In CT unter Admin-Einstellungen → Erweiterungen → „Erweiterung hinzufügen“ (bzw. Stift bei vorhandener Erweiterung), Kürzel genau `gruppenhierarchie`, ZIP hochladen (nicht entpacken), danach die Seite mit Strg+Shift+R neu laden. Anleitung im README.
*Beta-Hinweis:* CT kennzeichnet Erweiterungen derzeit als Beta-Funktion ohne Support durch CT. Änderungen an CT können die Extension jederzeit beeinträchtigen; dann eine der anderen Varianten nutzen.

**Python-Version:** ZIP entpacken, dann unter Windows Doppelklick auf `start_windows.bat`, unter macOS/Linux im Terminal `python3 ct_gruppenhierarchie.py`.

Ausführliche Anleitung: siehe `README.md` im Paket.

Die App greift nur lesend auf CT zu, speichert keine Login-Tokens und sendet keine Daten an Dritte.
