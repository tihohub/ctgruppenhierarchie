# Plan für Version 2.0

Stand: 23. November 2026. Festgelegt mit dem Inhaber im Gespräch. Diese Datei gilt nur im
Branch `v2`. Version 2.0 wird hier entwickelt und **noch nicht veröffentlicht** (siehe
`AGENTS.md`, „Zwei Entwicklungslinien“). Alle Neuerungen unten kommen in 2.0, nicht in 1.x.

## Entscheidungen

### Ansicht
1. **Startansicht** ist die Visualisierung, horizontal.
2. **Reiter-Reihenfolge:** „Visualisierung“ links, „Übersicht“ rechts daneben.
3. **Zoom in der Visualisierung:** Beim Start so weit herausgezoomt, dass der ganze Stamm zu
   sehen ist. Bedienung:
   - Knöpfe ＋, − und „Ganzer Stamm“
   - Strg + Mausrad zoomt (Mausrad allein scrollt normal)
   - Ziehen auf freier Fläche verschiebt die Ansicht (außerhalb des Bearbeiten-Modus überall)
   - Zwei Finger auf Touchpad/Handy zoomen
4. **Gruppenstatus** startet mit „aktiv“: Beim Öffnen werden nur aktive Gruppen angezeigt.

### Filter
5. **Filterbereich zusammenklappbar:** Links „Filter ▸“, erst nach Klick sieht man die Filter.
   Startet so, wie man ihn zuletzt verlassen hat (auf dem Gerät gemerkt), beim allerersten
   Start zugeklappt. Zugeklappt zeigt die Leiste, welche Filter wirken
   (z. B. „Filter ▸ (2 aktiv: Status aktiv, Suche „Jugend“)“).
6. **Zeile mit Ein/Aus-Filtern** (Hakenkästchen): als Erstes „Nur Gruppen mit
   Mehrfachzuordnung“ – ersetzt die bisherige Auswahlliste. Weitere Ein/Aus-Filter später.
7. **Zusatzinfos ein-/ausblenden:** Hakenkästchen für Gruppentyp, Gruppenstatus und
   Sichtbarkeit an jeder Gruppe.
8. **Auswahllisten** für Gruppentyp, Sichtbarkeit und Status bleiben als schnelle Standardfilter.
9. **Eigene Filter:**
   - Aufbau „Eigenschaft – Bedingung – Wert“ (z. B. „ist“, „ist nicht“, „enthält“, „ist leer“).
   - UND/ODER, beliebig verschachtelbar.
   - Eigenschaften: automatisch alle Felder, die CT zu einer Gruppe liefert, auch eigene
     Gruppenfelder der Instanz.
   - Zusätzlich „Anzahl Leiter“ und „Anzahl Mitglieder“, ohne Namen. Diese Zahlen werden
     nur geladen, wenn ein Filter sie benutzt.
   - Mit Namen speichern und per Klick auswählen.
   - Webseite, Desktop-App, Python-Version: gespeichert auf dem eigenen Gerät.
   - Extension: wenn CT es hergibt, gespeichert in CT. Jeder hat eigene Filter und kann
     einzelne für alle freigeben. Sonst auf dem eigenen Gerät.

### Schreiben in CT
10. **Varianten:** zuerst nur die Extension (CT-Anmeldung, CT prüft die Rechte). Webseite,
    Desktop-App und Python-Version später, wenn es sich bewährt hat.
11. **Bearbeiten-Modus:** Schalter „✎ Bearbeiten“. Beim Öffnen nur Ansehen.
12. **Drag-and-drop** in Übersicht und Visualisierung: Die gezogene Gruppe wird Untergruppe
    der Zielgruppe; alles darunter zieht mit. Eine Gruppe kann nicht unter eine eigene
    Untergruppe gezogen werden (Hinweis statt Änderung).
13. **Rückfrage vor jeder Änderung** mit Auswahl:
    - „Verschieben: von <alte Obergruppe> nach <Ziel>“ (vorausgewählt)
    - „Zusätzlich unter <Ziel> einordnen“ (alte Obergruppe bleibt)
    - „Abbrechen“
    Danach wird sofort geschrieben (kein Speichern-Knopf), mit kurzer Bestätigung.
14. **Von Obergruppe lösen:** Ablagefläche „Hier ablegen: keine Obergruppe“ und ✂-Knopf an
    jeder Untergruppe, beides mit Rückfrage.
15. **Zurück-Knopf** über viele Schritte, mit Ausklapp-Liste der letzten Änderungen (je kurz
    zusammengefasst, wie in Word/Excel). Gilt bis zum Schließen oder Neuladen der Seite.
16. **Gleichzeitige Änderungen:** Vor jedem Schreiben und Zurücknehmen den aktuellen Stand
    in CT prüfen. Weicht er von der Anzeige ab, wird nichts geschrieben, sondern ein Hinweis
    gezeigt und die Ansicht aktualisiert.
17. **Rechte:** CT prüft bei jeder Änderung selbst. Fehlende Rechte ergeben eine
    verständliche Meldung; es wird nichts geändert.
18. **Kein eigenes Änderungsprotokoll:** Für „wer hat was geändert“ auf das Protokoll von CT
    verweisen.

## Reihenfolge (je ein Pull Request gegen `v2`)
1. Vorbereitung: Release-Sicherung (in `main`), Branch `v2`, diese Datei, Grundsätze zum
   Schreiben in `AGENTS.md`.
2. Prüfen, was CT technisch anbietet (Obergruppen ändern, Datenablage für Erweiterungen,
   Mitgliederzahl). Ergebnis dem Inhaber berichten, bevor gebaut wird.
3. Ansicht: Reiter tauschen, Visualisierung horizontal als Start, Zoom, Status-Standard „aktiv“.
4. Filterbereich: zusammenklappbar, Ein/Aus-Zeile, Zusatzinfos ein-/ausblenden.
5. Eigene Filter mit UND/ODER und Speichern auf dem Gerät.
6. Bearbeiten-Modus, Drag-and-drop, Rückfrage, Lösen, Prüfen des aktuellen Stands.
7. Zurück-Knopf mit Liste.
8. Filter in CT speichern (abhängig von Schritt 2).

## Testen
- Schritte 3–5 schreiben nichts in CT.
- Ab Schritt 6: zuerst mit dem Schein-CT (`tests/fake_ct.py`, um Schreib-Anfragen erweitern),
  dann mit Testgruppen bzw. einer Test-Instanz, nie zuerst mit echten Gruppen. Vorher mit dem
  Inhaber klären, welche Test-Möglichkeit es gibt.

## Offen
- Release-Ablauf für Vorab-Releases (z. B. `v2.0-beta1`), die die Desktop-App nicht
  automatisch holt – erst einrichten, wenn eine Testversion verteilt werden soll.
