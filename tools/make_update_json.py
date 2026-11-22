#!/usr/bin/env python3
"""Erzeugt latest.json für den Auto-Updater der Desktop-App.

Die Desktop-App lädt beim Start https://github.com/…/releases/latest/download/latest.json und
vergleicht die Version. Die Datei enthält für Windows und Linux die Download-Adresse und die
Unterschrift (aus den .sig-Dateien, die der Bau mit dem Update-Schlüssel erzeugt).

Aufruf: python3 tools/make_update_json.py v1.0 dist
"""
import json, re, sys
from datetime import datetime, timezone
from pathlib import Path

REPO = "https://github.com/tihohub/ctgruppenhierarchie"
FILES = {
    "windows-x86_64": "ct-gruppenhierarchie-windows-{v}-setup.exe",
    "linux-x86_64": "ct-gruppenhierarchie-linux-{v}.AppImage",
}


def main(version, folder):
    m = re.fullmatch(r"v(\d+)(?:\.(\d+))?(?:\.(\d+))?", version)
    if not m:
        sys.exit(f"Ungültige Version: {version!r}")
    semver = ".".join(x or "0" for x in m.groups())
    d = Path(folder)
    platforms = {}
    for key, pattern in FILES.items():
        name = pattern.format(v=version.lstrip("v"))  # Dateinamen ohne „v“
        sig = d / (name + ".sig")
        if not sig.is_file():
            sys.exit(f"Unterschrift fehlt: {sig}")
        platforms[key] = {
            "signature": sig.read_text(encoding="utf-8").strip(),
            "url": f"{REPO}/releases/download/{version}/{name}",
        }
        sig.unlink()  # Unterschrift steckt jetzt in latest.json
    data = {
        "version": semver,
        "notes": f"CT Gruppenhierarchie {version.lstrip('v')}",
        "pub_date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "platforms": platforms,
    }
    (d / "latest.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(d / "latest.json")


if __name__ == "__main__":
    main(*sys.argv[1:3])
