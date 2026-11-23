#!/usr/bin/env python3
"""Sicherung vor jedem Release: Veröffentlicht wird nur Version 1.x aus dem Stand von main.

Hintergrund: Version 2.0 (schreibender Zugriff auf CT) wird im Branch v2 entwickelt und darf
noch nicht an Nutzer gehen. Ein normaler Release würde sie sonst als „neueste Version“
anbieten, und die Desktop-App würde sie automatisch installieren.

Prüft:
- Die Versionsnummer hat die Form v1.<Zahl> (z. B. v1.1).
- Der Stand, aus dem gebaut wird, ist in main enthalten (nicht nur in v2 oder einem anderen
  Branch).

Aufruf: python3 tools/release_check.py v1.1 [<commit>]   (Commit-Prüfung nur mit Angabe)
"""
import re, subprocess, sys

ERLAUBT = r"v1\.\d+"


def version_ok(version):
    return re.fullmatch(ERLAUBT, version) is not None


def main(version, commit=None):
    if not version_ok(version):
        sys.exit(
            f"Release abgelehnt: {version!r}. Erlaubt sind nur Versionen 1.x (z. B. v1.1). "
            "Version 2.0 wird noch nicht veröffentlicht."
        )
    if commit:
        r = subprocess.run(["git", "merge-base", "--is-ancestor", commit, "origin/main"])
        if r.returncode != 0:
            sys.exit(
                "Release abgelehnt: Dieser Stand ist nicht in main enthalten. "
                "Releases kommen nur von main."
            )
    print(f"Release {version} ist erlaubt.")


if __name__ == "__main__":
    a = sys.argv[1:]
    main(a[0] if a else "", a[1] if len(a) > 1 else None)
