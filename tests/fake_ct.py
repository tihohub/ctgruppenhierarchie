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
import json, os, re, sys, urllib.parse
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = "test-token"
# Simulierte CT-Anmeldung im Browser (für die Extension): dieses Cookie gilt als angemeldet
SESSION_COOKIE = "ct_session=angemeldet"
# Optional: Ordner einer gebauten Extension, ausgeliefert unter /ccm/gruppenhierarchie/
EXT_DIR = os.environ.get("CTG_EXT_DIR")
# Kürzel, unter dem die Extension ausgeliefert wird (Testversion: gruppenhierarchietest)
EXT = "/ccm/" + os.environ.get("CTG_EXT_KUERZEL", "gruppenhierarchie")
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css"}
GROUPS = {1: "A", 2: "B", 3: "C", 4: "D", 5: "X", 6: "Y", 7: "Z", 8: "Alter Kreis"}
STATUS = {8: 2}  # alle anderen Gruppen: 1 = aktiv
CATEGORY = {2: 1, 5: 1, 6: 2}  # B, X: Jugend; Y: Musik
GROUPS.update({100 + i: f"Füll{i:02d}" for i in range(40)})
# Obergruppen je Gruppe (veränderbar: die App kann in der Extension Obergruppen ändern)
PARENTS = {100 + i: [1] for i in range(40)}
PARENTS.update(
    {
        2: [1],
        5: [2, 3],
        6: [5],
        7: [3, {"domainIdentifier": "99", "title": "Leitung geheim"}],
    }
)
# Optional (CTG_TESTSTAMM=1): Teststamm für die Testversion der Extension
if os.environ.get("CTG_TESTSTAMM"):
    GROUPS.update({200: "Test Gruppenhierarchie", 201: "Test A", 202: "Test B", 203: "Test C", 204: "Test D"})
    PARENTS.update({201: [200], 202: [200], 203: [201], 204: [200]})
# Schreiben in diese Gruppe verweigert CT (fehlende Rechte), z. B. Lösen von X aus C
NO_RIGHTS = {3}
CSRF = "csrf-123"
# Datenablage der Extension (Custom Module): Bereiche und Einträge
MODULE_ID = 7
CATEGORIES = []  # [{id, shorty, name, ...}]
VALUES = []  # [{id, dataCategoryId, value}]
NEXT = {"id": 100}
# ohne Schreibrechte für die Datenablage (CTG_KEINE_FILTERRECHTE=1)
NO_CUSTOM_WRITE = bool(os.environ.get("CTG_KEINE_FILTERRECHTE"))


def pid(p):
    return int(p["domainIdentifier"]) if isinstance(p, dict) else p


def hierarchies():
    """Hierarchie-Daten wie /groups/hierarchies sie liefert, aus PARENTS berechnet."""
    out = []
    for g in GROUPS:
        kids = [c for c, ps in PARENTS.items() if g in [pid(p) for p in ps]]
        out.append({"groupId": g, "parents": PARENTS.get(g, []), "children": kids})
    return out


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
                "settings": {
                    "visibility": "intern",
                    "isOpenForMembers": i in (1, 2),
                    "signUpHeadline": "Jetzt anmelden",  # ausgeblendet
                    "imageAiGenerated": False,  # ausgeblendet
                },
                # wie CT: Anzahlen nur, wenn ausdrücklich angefordert (include[]=memberStatistics);
                # Anzahl Leiter: X und Y haben keine Leitung
                "memberStatistics": {"leaders": 0 if i in (5, 6) else 1, "active": 10 + i % 5},
                # eigenes Gruppenfeld der Instanz (nur bei A)
                **({"kostenstelle": "4711"} if i == 1 else {}),
            }
            for i, n in GROUPS.items()
        ]
    ),
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
        self.send_header("Access-Control-Allow-Methods", "GET")  # Webseite: nur lesen
        self.end_headers()

    def do_GET(self):
        path = self._record()
        if path == "/_test/requests":
            return self._send(200, REQUESTS)
        if EXT_DIR and path.startswith(EXT + "/assets/"):
            return self._file(path[len(EXT + "/") :])
        if EXT_DIR and (path == EXT or path.startswith(EXT + "/")):
            return self._ct_page()
        token_ok = self.headers.get("Authorization") == "Login " + TOKEN
        session_ok = SESSION_COOKIE in (self.headers.get("Cookie") or "")
        if path == "/api/whoami" and not self.headers.get("Authorization") and not session_ok:
            # wie CT: ohne Anmeldung kein Fehler, sondern ein anonymer Benutzer
            return self._send(200, {"data": {"id": -1, "lastName": "Anonymous"}})
        if not (token_ok or session_ok):
            return self._send(401, {"message": "Unauthorized"})
        mit_zahlen = "memberStatistics" in urllib.parse.unquote(self.path)
        if path == "/api/groups" and mit_zahlen and os.environ.get("CTG_OHNE_ZAHLEN"):
            # Instanz, die das Mitanfordern nicht kennt
            return self._send(400, {"message": "unbekannter Parameter include"})
        if path == "/api/groups" and not mit_zahlen:
            data = [{k: v for k, v in g.items() if k != "memberStatistics"} for g in ROUTES[path]["data"]]
            return self._send(200, page(data))
        if path in ROUTES:
            return self._send(200, ROUTES[path])
        if path == "/api/groups/hierarchies":
            return self._send(200, page(hierarchies()))
        if path == "/api/csrftoken":
            return self._send(200, {"data": CSRF})
        if path == "/api/custommodules":
            return self._send(200, {"data": [{"id": MODULE_ID, "shorty": EXT[len("/ccm/") :], "name": "Gruppenhierarchie"}]})
        if path == f"/api/custommodules/{MODULE_ID}/customdatacategories":
            return self._send(200, {"data": CATEGORIES})
        m = re.fullmatch(rf"/api/custommodules/{MODULE_ID}/customdatacategories/(\d+)/customdatavalues", path)
        if m:
            return self._send(200, {"data": [v for v in VALUES if v["dataCategoryId"] == int(m.group(1))]})
        m = re.fullmatch(r"/api/groups/(\d+)/parents", path)
        if m:
            ps = PARENTS.get(int(m.group(1)), [])
            data = [
                {"domainType": "group", "domainIdentifier": str(pid(p)), "title": GROUPS.get(pid(p), "")}
                for p in ps
            ]
            return self._send(200, {"data": data})
        self._send(404, {"message": "Not found"})

    def _write(self):
        """Obergruppe hinzufügen (PUT) oder entfernen (DELETE) – wie CT, mit Anmeldung,
        CSRF-Merkmal und Rechteprüfung."""
        path = self._record()
        if path == "/_test/parents":  # Test-Hilfe: Obergruppen „von außen“ ändern
            n = int(self.headers.get("Content-Length") or 0)
            j = json.loads(self.rfile.read(n) or b"{}")
            PARENTS[int(j["group"])] = j["parents"]
            return self._send(200, {})
        if path.startswith("/api/custommodules/"):
            return self._custom(path)
        m = re.fullmatch(r"/api/groups/(\d+)/parents/(\d+)", path)
        if not m or self.command not in ("PUT", "DELETE"):
            return self._send(405, {"message": "nicht erlaubt"})
        if SESSION_COOKIE not in (self.headers.get("Cookie") or ""):
            return self._send(401, {"message": "Session abgelaufen"})
        if self.headers.get("CSRF-Token") != CSRF:
            return self._send(401, {"message": "CSRF-Token ungültig"})
        g, p = int(m.group(1)), int(m.group(2))
        if g not in GROUPS or p not in GROUPS:
            return self._send(404, {"message": "Gruppe nicht gefunden"})
        if g in NO_RIGHTS or p in NO_RIGHTS:
            return self._send(403, {"message": "Keine Berechtigung"})
        ps = PARENTS.setdefault(g, [])
        ids = [pid(x) for x in ps]
        if self.command == "PUT":
            if p in ids:
                return self._send(400, {"messageKey": "group.parent.already.exists"})
            ps.append(p)
            return self._send(200, {"data": {}})
        if p not in ids:
            return self._send(404, {"message": "keine Obergruppe"})
        ps.pop(ids.index(p))
        self.send_response(204)
        self.end_headers()

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

    def _custom(self, path):
        """Datenablage der Extension: Bereich anlegen, Einträge anlegen/ändern/löschen."""
        if SESSION_COOKIE not in (self.headers.get("Cookie") or ""):
            return self._send(401, {"message": "Session abgelaufen"})
        if self.headers.get("CSRF-Token") != CSRF:
            return self._send(401, {"message": "CSRF-Token ungültig"})
        if NO_CUSTOM_WRITE:  # wie CT bei fehlendem Recht
            return self._send(401, {"message": "Die Session ist abgelaufen"})
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n) or b"{}")
        pre = f"/api/custommodules/{MODULE_ID}/customdatacategories"
        if path == pre and self.command == "POST":
            NEXT["id"] += 1
            c = {"id": NEXT["id"], "customModuleId": MODULE_ID, **{k: body[k] for k in ("name", "shorty", "description") if k in body}}
            CATEGORIES.append(c)
            return self._send(201, {"data": c})
        m = re.fullmatch(rf"{pre}/(\d+)/customdatavalues(?:/(\d+))?", path)
        if not m or not any(c["id"] == int(m.group(1)) for c in CATEGORIES):
            return self._send(404, {"message": "Not found"})
        cid, vid = int(m.group(1)), m.group(2)
        if self.command == "POST" and not vid:
            if len(body.get("value", "")) > 10000:
                return self._send(400, {"messageKey": "validation.length"})
            NEXT["id"] += 1
            VALUES.append({"id": NEXT["id"], "dataCategoryId": cid, "value": body.get("value", "")})
            return self._send(201, {"data": {"id": NEXT["id"]}})
        v = next((x for x in VALUES if vid and x["id"] == int(vid)), None)
        if not v:
            return self._send(404, {"message": "Not found"})
        if self.command == "PUT":
            v["value"] = body.get("value", "")
            return self._send(200, {"data": v})
        if self.command == "DELETE":
            VALUES.remove(v)
            self.send_response(204)
            self.end_headers()
            return
        return self._send(405, {"message": "nicht erlaubt"})

    def do_POST(self):
        if self.path.split("?")[0] == "/_test/parents" or self.path.startswith("/api/custommodules/"):
            return self._write()
        self._record()
        self._send(405, {"message": "nicht erlaubt"})

    do_PATCH = do_POST
    do_PUT = do_DELETE = _write

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8799
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Schein-CT läuft auf http://127.0.0.1:{port}", flush=True)
    srv.serve_forever()
