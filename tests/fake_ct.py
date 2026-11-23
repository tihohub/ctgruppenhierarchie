#!/usr/bin/env python3
"""Schein-CT-Server für automatische Tests.

Beantwortet die wenigen API-Anfragen, die die App stellt, mit festen Testdaten.
Merkt sich die HTTP-Methoden aller Anfragen (abrufbar unter /_test/requests), damit die
Tests prüfen können, dass die App nur lesend zugreift.

Testdaten:
  A ─ B ─ X ─ Y          X hat zwei Obergruppen (B und C)
  │   └ Füll00 … Füll39
  C ─ X, Z               Z hat zwei Obergruppen (C und die nicht sichtbare Gruppe 99)
  99 „Leitung geheim“    nicht in /groups enthalten (keine Berechtigung)
  D                      alleinstehend
  8 „Alter Kreis“        alleinstehend, Status „beendet“ (beim Start ausgefiltert)
"""
import json, os, re, sys
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = "test-token"
# Simulierte CT-Anmeldung im Browser (für die Extension): dieses Cookie gilt als angemeldet
SESSION_COOKIE = "ct_session=angemeldet"
# Optional: Ordner einer gebauten Extension, ausgeliefert unter /ccm/gruppenhierarchie/
EXT_DIR = os.environ.get("CTG_EXT_DIR")
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css"}
GROUPS = {1: "A", 2: "B", 3: "C", 4: "D", 5: "X", 6: "Y", 7: "Z", 8: "Alter Kreis"}
STATUS = {8: 2}  # alle anderen Gruppen: 1 = aktiv
CATEGORY = {2: 1, 5: 1, 6: 2}  # B, X: Jugend; Y: Musik
GROUPS.update({100 + i: f"Füll{i:02d}" for i in range(40)})
HIERARCHIES = (
    [{"groupId": 1, "parents": [], "children": [2] + [100 + i for i in range(40)]}]
    + [{"groupId": 100 + i, "parents": [1], "children": []} for i in range(40)]
    + [
        {"groupId": 2, "parents": [1], "children": [5]},
        {"groupId": 3, "parents": [], "children": [5, 7]},
        {"groupId": 5, "parents": [2, 3], "children": [6]},
        {"groupId": 6, "parents": [5], "children": []},
        {
            "groupId": 7,
            "parents": [3, {"domainIdentifier": "99", "title": "Leitung geheim"}],
            "children": [],
        },
    ]
)
REQUESTS = []


def page(data):
    return {"data": data, "meta": {"pagination": {"lastPage": 1}}}


ROUTES = {
    "/api/whoami": {"data": {"id": 1, "firstName": "Test", "lastName": "Nutzer"}},
    "/api/persons/1": {"data": {"firstName": "Test", "lastName": "Nutzer"}},
    "/api/masterdata/person": {"data": {
            "groupStatuses": [{"id": 1, "name": "aktiv"}, {"id": 2, "name": "beendet"}],
            "groupCategories": [{"id": 1, "name": "Jugend"}, {"id": 2, "name": "Musik"}],
            "campuses": [{"id": 1, "name": "Mainz"}, {"id": 2, "name": "Wiesbaden"}],
        }},
    "/api/group/grouptypes": page([{"id": 1, "name": "Kleingruppe"}]),
    "/api/groups": page(
        [
            {
                "id": i,
                "name": n,
                "information": {
                    "groupTypeId": 1,
                    "groupStatusId": STATUS.get(i, 1),
                    "campusId": 2 if i in (5, 6) else 1,
                    **({"groupCategoryId": CATEGORY[i]} if i in CATEGORY else {}),
                    "note": "Beschreibung von " + n,
                },
                "settings": {"visibility": "intern"},
                # Anzahl Leiter: X und Y haben keine Leitung
                "memberStatistics": {"leaders": 0 if i in (5, 6) else 1, "active": 10 + i % 5},
                # eigenes Gruppenfeld der Instanz (nur bei A)
                **({"kostenstelle": "4711"} if i == 1 else {}),
            }
            for i, n in GROUPS.items()
        ]
    ),
    "/api/groups/hierarchies": page(HIERARCHIES),
}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin") or "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Accept")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _record(self):
        path = self.path.split("?")[0]
        if not path.startswith("/_test"):
            REQUESTS.append({"method": self.command, "path": path})
        return path

    def do_OPTIONS(self):  # CORS-Vorabanfrage des Browsers
        self._record()
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin") or "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Accept")
        self.send_header("Access-Control-Allow-Methods", "GET")
        self.end_headers()

    def do_GET(self):
        path = self._record()
        if path == "/_test/requests":
            return self._send(200, REQUESTS)
        if EXT_DIR and path.startswith("/ccm/gruppenhierarchie/assets/"):
            return self._file(path[len("/ccm/gruppenhierarchie/") :])
        if EXT_DIR and path.startswith("/ccm/gruppenhierarchie"):
            return self._ct_page()
        token_ok = self.headers.get("Authorization") == "Login " + TOKEN
        session_ok = SESSION_COOKIE in (self.headers.get("Cookie") or "")
        if path == "/api/whoami" and not self.headers.get("Authorization") and not session_ok:
            # wie CT: ohne Anmeldung kein Fehler, sondern ein anonymer Benutzer
            return self._send(200, {"data": {"id": -1, "lastName": "Anonymous"}})
        if not (token_ok or session_ok):
            return self._send(401, {"message": "Unauthorized"})
        if path in ROUTES:
            return self._send(200, ROUTES[path])
        self._send(404, {"message": "Not found"})

    def _ct_page(self):
        """Ahmt nach, wie CT eine Extension einbettet: eigene Seite mit CT-Menüleiste,
        <base href> auf die Startseite, nur der INHALT der index.html der Extension
        (ohne <style>-Blöcke) wird eingefügt."""
        html = (Path(EXT_DIR) / "index.html").read_text(encoding="utf-8")
        body = html[html.index("<body>") + 6 : html.index("</body>")]
        body = re.sub(r"<style.*?</style>", "", body, flags=re.S)
        page = (
            '<!doctype html><html lang="de"><head><meta charset="utf-8"><base href="/">'
            "<title>CT</title></head><body>"
            '<nav id="ct-nav"><h1 class="ct-title">Gemeinde</h1>'
            '<button class="ct-btn">Gruppen</button><input class="ct-input"></nav>'
            '<div id="app">' + body + "</div></body></html>"
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(page)))
        self.end_headers()
        self.wfile.write(page)

    def _file(self, rel):
        base = Path(EXT_DIR).resolve()
        f = (base / rel).resolve()
        if base not in f.parents or not f.is_file():
            return self._send(404, {"message": "Not found"})
        b = f.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(f.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        self._record()
        self._send(405, {"message": "nicht erlaubt"})

    do_PUT = do_PATCH = do_DELETE = do_POST

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8799
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Schein-CT läuft auf http://127.0.0.1:{port}", flush=True)
    srv.serve_forever()
