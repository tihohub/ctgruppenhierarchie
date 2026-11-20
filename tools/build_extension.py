#!/usr/bin/env python3
"""Baut die CT-Extension (ZIP zum Hochladen in CT unter „Erweiterungen“).

So bettet CT eine Extension ein (getestet von anderen Extension-Projekten):
- CT übernimmt nur den INHALT der index.html in die eigene Seite (kein iframe, keine
  eigene Seite) und setzt <base href> auf die Startseite der Instanz.
- Relative Pfade zeigen deshalb ins Leere: alle Dateien werden absolut unter
  /ccm/<Kürzel>/ eingebunden.
- <style>-Blöcke und eingebettete Skripte werden entfernt bzw. blockiert: Gestaltung und
  Programm liegen als Dateien in assets/.
- Unsere Gestaltung darf CT nicht verändern: alle CSS-Regeln werden auf den eigenen
  Bereich <div id="ctgh"> beschränkt (aus „body“ wird „#ctgh“, aus „button“ „#ctgh button“).

Aufruf: python3 tools/build_extension.py v26
Ergebnis: dist/extension/ (entpackt) und dist/ct-gruppenhierarchie-extension-v26.zip
"""
import re, shutil, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KUERZEL = "gruppenhierarchie"  # muss in CT beim Anlegen der Erweiterung genau so eingetragen werden
BASE = f"/ccm/{KUERZEL}/assets/"
SCOPE = "#ctgh"


def scope_selector(sel):
    """Beschränkt einen CSS-Selektor auf den Bereich #ctgh."""
    sel = sel.strip()
    if sel == "*":
        return f"{SCOPE}, {SCOPE} *"
    m = re.match(r"^(html|body|:root)\b(.*)$", sel)
    if m:
        return SCOPE + m.group(2)
    if sel.startswith(".extension"):  # Klasse sitzt in der Extension auf #ctgh selbst
        return SCOPE + sel
    return f"{SCOPE} {sel}"


def scope_css(css):
    """Schreibt alle Selektoren um; @media-Blöcke werden durchsucht, @keyframes nicht."""
    out, i, stack = [], 0, []  # stack: Art der offenen Blöcke ("at", "keyframes", "rule")
    while i < len(css):
        if css.startswith("/*", i):
            j = css.index("*/", i) + 2
            out.append(css[i:j])
            i = j
            continue
        j = i
        while j < len(css) and css[j] not in "{}" and not css.startswith("/*", j):
            j += 1
        if j >= len(css) or css.startswith("/*", j):
            out.append(css[i:j])
            i = j
            continue
        chunk = css[i:j]
        if css[j] == "}":
            out.append(chunk + "}")
            if stack:
                stack.pop()
            i = j + 1
            continue
        head = chunk.strip()
        inside_rule_or_kf = stack and stack[-1] in ("rule", "keyframes")
        if head.startswith("@keyframes"):
            out.append(chunk + "{")
            stack.append("keyframes")
        elif head.startswith("@"):
            out.append(chunk + "{")
            stack.append("at")
        elif inside_rule_or_kf:
            out.append(chunk + "{")
            stack.append("rule")
        else:
            lead = chunk[: len(chunk) - len(chunk.lstrip())]
            scoped = ", ".join(scope_selector(s) for s in head.split(","))
            out.append(f"{lead}{scoped} " + "{")
            stack.append("rule")
        i = j + 1
    return "".join(out)


def main(version):
    if not re.fullmatch(r"v\d+(\.\d+)*", version):
        sys.exit(f"Ungültige Version: {version!r} (erwartet z. B. v26)")
    web = {
        n: (ROOT / "web" / n).read_text(encoding="utf-8")
        for n in ("index.html", "style.css", "ct-daten.js", "app.js")
    }

    # Programm: beide Skripte in einer Datei; die Element-ID „app“ umbenennen, damit sie nicht
    # mit IDs von CT zusammenstößt
    js = (web["ct-daten.js"] + "\n" + web["app.js"]).replace("__CT_VERSION__", version)
    if js.count('$("app")') != 2:
        sys.exit('app.js hat nicht den erwarteten Aufbau ($("app"))')
    js = js.replace('$("app")', '$("ctgh-app")')

    css = scope_css(web["style.css"]).replace(f"{SCOPE} #app", f"{SCOPE} #ctgh-app")

    html = web["index.html"]
    body = html[html.index("<body>") + len("<body>") : html.index("</body>")]
    body = re.sub(r"\s*<script[^>]*></script>", "", body)
    if body.count('id="app"') != 1:
        sys.exit('index.html hat nicht den erwarteten Aufbau (id="app")')
    body = body.replace('id="app"', 'id="ctgh-app"')
    index = f"""<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>CT Gruppenhierarchie</title>
  </head>
  <body>
    <link rel="stylesheet" href="{BASE}style.css" />
    <div id="ctgh">{body}</div>
    <script type="module" src="{BASE}app.js"></script>
  </body>
</html>
"""

    out = ROOT / "dist" / "extension"
    shutil.rmtree(out, ignore_errors=True)
    (out / "assets").mkdir(parents=True)
    (out / "index.html").write_text(index, encoding="utf-8")
    (out / "assets" / "style.css").write_text(css, encoding="utf-8")
    (out / "assets" / "app.js").write_text(js, encoding="utf-8")
    zip_path = ROOT / "dist" / f"ct-gruppenhierarchie-extension-{version}.zip"
    # Dateien direkt im Wurzelverzeichnis des ZIP (kein Unterordner), Pfade mit „/“
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(out.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(out).as_posix())
    print(zip_path)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
