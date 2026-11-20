#!/usr/bin/env python3
"""Baut die CT-Extension (ZIP zum Hochladen in CT unter „Erweiterungen“).

CT liefert eine Extension unter <CT-Adresse>/ccm/<Kürzel>/ aus. Damit sich die Gestaltung
von CT und der App nicht gegenseitig beeinflussen, enthält die index.html nur einen
Rahmen (iframe), der die eigentliche Oberfläche aus dem Unterordner app/ lädt.

Aufruf: python3 tools/build_extension.py v23
Ergebnis: dist/extension/ (entpackt) und dist/ct-gruppenhierarchie-extension-v23.zip
"""
import re, shutil, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KUERZEL = "gruppenhierarchie"  # muss in CT beim Anlegen der Erweiterung genau so eingetragen werden

RAHMEN = f"""<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>CT Gruppenhierarchie</title>
  </head>
  <body>
    <div id="app">
      <iframe
        src="/ccm/{KUERZEL}/app/index.html"
        title="CT Gruppenhierarchie"
        style="display:block;width:100%;height:calc(100vh - 110px);min-height:600px;border:0"
      ></iframe>
    </div>
  </body>
</html>
"""


def main(version):
    if not re.fullmatch(r"v\d+(\.\d+)*", version):
        sys.exit(f"Ungültige Version: {version!r} (erwartet z. B. v23)")
    out = ROOT / "dist" / "extension"
    shutil.rmtree(out, ignore_errors=True)
    (out / "app").mkdir(parents=True)
    (out / "index.html").write_text(RAHMEN, encoding="utf-8")
    for f in (ROOT / "web").iterdir():
        if f.is_file():
            text = f.read_text(encoding="utf-8").replace("__CT_VERSION__", version)
            (out / "app" / f.name).write_text(text, encoding="utf-8")
    zip_path = ROOT / "dist" / f"ct-gruppenhierarchie-extension-{version}.zip"
    # Dateien direkt im Wurzelverzeichnis des ZIP (kein Unterordner), Pfade mit „/“
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(out.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(out).as_posix())
    print(zip_path)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
