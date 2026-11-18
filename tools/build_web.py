#!/usr/bin/env python3
"""Baut die Webseiten-Variante für GitHub Pages.

Kopiert die Oberfläche (web/) nach dist/webseite/ und setzt die Versionsnummer ein.
Aufruf: python3 tools/build_web.py v20
"""
import re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main(version):
    if not re.fullmatch(r"v\d+(\.\d+)*", version):
        sys.exit(f"Ungültige Version: {version!r} (erwartet z. B. v20)")
    out = ROOT / "dist" / "webseite"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    for f in (ROOT / "web").iterdir():
        if f.is_file():
            text = f.read_text(encoding="utf-8").replace("__CT_VERSION__", version)
            (out / f.name).write_text(text, encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
