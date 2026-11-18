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
"""
import json, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = "test-token"
GROUPS = {1: "A", 2: "B", 3: "C", 4: "D", 5: "X", 6: "Y", 7: "Z"}
GROUPS.update({100 + i: f"Füll{i:02d}" for i in range(40)})
HIERARCHIES = (
    [{"groupId": 1, "parents": [], "children": [2] + [100 + i for i in range(40)]}]
    + [{"groupId": 100 + i, "parents": [1], "children": []} for i in range(40)]
    + [
        {"groupId": 2, "parents": [1], "children": [5]},
        {"groupId": 3, "parents": [], "children": [5, 7]},
        {"groupId": 5, "parents": [2, 3], "children": [6]},
        {"groupId": 6, "parents": [5], "children": []},
        {"groupId": 7, "parents": [3, {"domainIdentifier": "99", "title": "Leitung geheim"}], "children": []},
    ]
)
REQUESTS = []


def page(data):
    return {"data": data, "meta": {"pagination": {"lastPage": 1}}}


ROUTES = {
    "/api/whoami": {"data": {"id": 1, "firstName": "Test", "lastName": "Nutzer"}},
    "/api/persons/1": {"data": {"firstName": "Test", "lastName": "Nutzer"}},
    "/api/masterdata/person": {"data": {"groupStatuses": [{"id": 1, "name": "aktiv"}]}},
    "/api/group/grouptypes": page([{"id": 1, "name": "Kleingruppe"}]),
    "/api/groups": page(
        [
            {
                "id": i,
                "name": n,
                "information": {"groupTypeId": 1, "groupStatusId": 1, "note": "Beschreibung von " + n},
                "settings": {"visibility": "intern"},
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
        if self.headers.get("Authorization") != "Login " + TOKEN:
            return self._send(401, {"message": "Unauthorized"})
        if path in ROUTES:
            return self._send(200, ROUTES[path])
        self._send(404, {"message": "Not found"})

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
