#!/usr/bin/env python3
"""Baut das Download-Paket der Python-Version.

Fügt Oberfläche (web/) und Server (python/) zu einer einzigen Datei
ct_gruppenhierarchie.py zusammen, setzt die Versionsnummer ein und packt alles mit
Startdatei, README und Lizenztexten in ein ZIP.

Aufruf: python3 tools/build_python.py v1.0
Ergebnis: dist/ct-gruppenhierarchie-python-1.0.zip
"""
import re, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLACEHOLDER = "__CT_VERSION__"


def main(version):
    if not re.fullmatch(r"v\d+(\.\d+)*", version):
        sys.exit(f"Ungültige Version: {version!r} (erwartet z. B. v1.0)")
    web = {
        name: (ROOT / "web" / name).read_text(encoding="utf-8").replace(PLACEHOLDER, version)
        for name in ("index.html", "style.css", "ct-daten.js", "app.js")
    }
    server = (ROOT / "python" / "ct_gruppenhierarchie.py").read_text(encoding="utf-8")
    if server.count("EMBEDDED = {}") != 1 or PLACEHOLDER not in server:
        sys.exit("Server-Datei hat nicht den erwarteten Aufbau")
    server = server.replace(PLACEHOLDER, version).replace("EMBEDDED = {}", "EMBEDDED = " + repr(web))
    bat = (ROOT / "start_windows.bat").read_text(encoding="utf-8").replace(
        "python\\ct_gruppenhierarchie.py", "ct_gruppenhierarchie.py"
    )
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    nummer = version.lstrip("v")  # Dateinamen ohne „v“: ct-gruppenhierarchie-python-1.0.zip
    folder = f"ct-gruppenhierarchie-{nummer}"
    out = dist / f"ct-gruppenhierarchie-python-{nummer}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{folder}/ct_gruppenhierarchie.py", server)
        z.writestr(f"{folder}/start_windows.bat", bat.replace("\n", "\r\n"))
        for name in ("README.md", "LICENSE.txt", "PRIVACY.txt", "THIRD_PARTY_LICENSES.txt"):
            z.write(ROOT / name, f"{folder}/{name}")
    print(out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
