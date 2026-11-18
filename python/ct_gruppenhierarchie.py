#!/usr/bin/env python3
"""CT Gruppenhierarchie – lokaler Server.

Liefert die Weboberfläche aus dem Ordner web/ aus und reicht deren Leseanfragen an CT
weiter (Umweg um die CORS-Regel des Browsers). Die Datenaufbereitung steckt in
web/ct-daten.js. Beendet sich automatisch, wenn kein Browser-Tab der App mehr offen ist.
Start: python3 python/ct_gruppenhierarchie.py
"""

import json, os, re, sys, threading, time, urllib.error, urllib.request, webbrowser
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 8765
VERSION = "__CT_VERSION__"
APP_ID = "ct-gruppenhierarchie"
VERSION_LABEL = "Entwicklungsversion" if VERSION.startswith("__") else VERSION
# Weboberfläche: beim Release-Build hier eingebettet, sonst aus dem Ordner web/ gelesen
EMBEDDED = {}
WEB_DIR = Path(__file__).resolve().parent.parent / "web"
WEB_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
    "/ct-daten.js": ("ct-daten.js", "text/javascript; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
}


def web_file(name):
    if name in EMBEDDED:
        return EMBEDDED[name].encode("utf-8")
    return (WEB_DIR / name).read_bytes()


GRACE = 10  # Sekunden nach Schließen des letzten Tabs bis zum Beenden (erlaubt Neuladen mit F5)
STALE = 180  # Sekunden ohne Lebenszeichen einer Seite, bis sie als geschlossen gilt


def req(base, path, token):
    base = base.strip().rstrip("/")
    base = base[:-4] if base.endswith("/api") else base
    r = urllib.request.Request(
        base + "/api" + path,
        headers={
            "Accept": "application/json",
            "Authorization": "Login " + token,
            "User-Agent": "CT-Gruppenhierarchie-" + VERSION_LABEL,
        },
    )
    try:
        with urllib.request.urlopen(r, timeout=35) as x:
            return json.loads(x.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(
            f"HTTP {e.code} {e.reason}: " + e.read().decode("utf-8", "replace")[:300]
        )
    except urllib.error.URLError as e:
        raise RuntimeError(f"Verbindungsfehler: {e.reason}")


def ct_get(base, path, token):
    """Leitet eine Leseanfrage der Oberfläche an CT weiter (nur GET)."""
    if not re.match(r"^https?://[^/\s]+", base.strip()):
        raise RuntimeError("Ungültige CT-Adresse. Bitte mit https:// angeben.")
    if not path.startswith("/") or ".." in path:
        raise RuntimeError("Ungültiger Pfad")
    return req(base, path, token)


ALLOWED_HOSTS = {f"{HOST}:{PORT}", f"localhost:{PORT}"}
ALLOWED_ORIGINS = {"http://" + h for h in ALLOWED_HOSTS}
CLIENTS = {}
LOCK = threading.Lock()
STATE = {"seen": False, "empty_since": time.monotonic(), "stopping": False}
SERVER = None


def stop(msg):
    # Server beenden (aus einem anderen Thread als serve_forever aufrufen)
    if STATE["stopping"]:
        return
    STATE["stopping"] = True
    print(msg)
    threading.Thread(target=SERVER.shutdown, daemon=True).start()


def watchdog():
    # Beendet den Server, wenn keine Seite der App mehr offen ist
    while not STATE["stopping"]:
        time.sleep(2)
        now = time.monotonic()
        with LOCK:
            for k, t in list(CLIENTS.items()):
                if now - t > STALE:
                    del CLIENTS[k]
                    if not CLIENTS:
                        STATE["empty_since"] = now - GRACE
            wait = GRACE if STATE["seen"] else STALE
            if not CLIENTS and now - STATE["empty_since"] >= wait:
                stop(
                    "Keine Seite der App mehr geöffnet. Das Programm wird beendet."
                    if STATE["seen"]
                    else "Die App wurde nicht im Browser geöffnet. Das Programm wird beendet."
                )
                return


class H(BaseHTTPRequestHandler):
    def local_only(self, post=False):
        # Schutz gegen DNS-Rebinding (Host) und Cross-Site-Anfragen fremder Webseiten (Origin/Content-Type)
        ok = (self.headers.get("Host") or "").lower() in ALLOWED_HOSTS
        if ok and post:
            o = self.headers.get("Origin")
            ok = (o is None or o.lower() in ALLOWED_ORIGINS) and (
                self.headers.get("Content-Type") or ""
            ).split(";")[0].strip().lower() == "application/json"
        if not ok:
            self.send_error(403, "Nur lokale Anfragen erlaubt")
        return ok

    def send_json(self, o):
        b = json.dumps(o, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if not self.local_only():
            return
        if self.path == "/version":
            self.send_json({"app": APP_ID, "version": VERSION})
            return
        f = WEB_FILES.get(self.path.split("?")[0])
        if not f:
            self.send_error(404)
            return
        b = web_file(f[0])
        self.send_response(200)
        self.send_header("Content-Type", f[1])
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        if not self.local_only(True):
            return
        try:
            n = int(self.headers.get("Content-Length", "0"))
            q = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            q = {}
        if not isinstance(q, dict):
            q = {}
        cid = str(q.get("id", ""))[:64]
        now = time.monotonic()
        if self.path == "/ping":
            # Lebenszeichen einer offenen Seite
            with LOCK:
                CLIENTS[cid] = now
                STATE["seen"] = True
            self.send_json({"ok": True, "version": VERSION})
            return
        if self.path == "/bye":
            # Seite wurde geschlossen oder neu geladen
            with LOCK:
                CLIENTS.pop(cid, None)
                if not CLIENTS:
                    STATE["empty_since"] = now
            self.send_json({"ok": True})
            return
        if self.path == "/shutdown":
            # Eine neu gestartete Version übernimmt den Port
            self.send_json({"ok": True})
            stop("Eine neue Version wurde gestartet. Dieses Programm wird beendet.")
            return
        if self.path != "/ct":
            self.send_error(404)
            return
        try:
            o = {
                "ok": True,
                "data": ct_get(
                    str(q.get("base", "")), str(q.get("path", "")), str(q.get("token", ""))
                ),
            }
        except Exception as e:
            o = {"ok": False, "error": str(e)}
        self.send_json(o)

    def log_message(self, *a):
        pass


class Server(ThreadingHTTPServer):
    daemon_threads = True
    # Unter Windows würde SO_REUSEADDR einem zweiten Programm erlauben, denselben Port zu belegen
    allow_reuse_address = os.name != "nt"


LOCAL = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def local_req(path, data=None):
    r = urllib.request.Request(
        f"http://{HOST}:{PORT}{path}",
        data=data,
        headers={"Content-Type": "application/json"} if data is not None else {},
    )
    with LOCAL.open(r, timeout=3) as x:
        return json.loads(x.read().decode() or "{}")


def running_instance():
    # Läuft auf dem Port schon etwas? None = frei, dict = diese App (ab v17), 'other' = ältere Version oder anderes Programm
    try:
        o = local_req("/version")
    except urllib.error.HTTPError:
        return "other"
    except Exception:
        return None
    return o if isinstance(o, dict) and o.get("app") == APP_ID else "other"


def start():
    o = running_instance()
    if isinstance(o, dict):
        v = o.get("version", "?")
        v = "Entwicklungsversion" if str(v).startswith("__") else v
        print(f"Laufende Version {v} wird beendet …")
        try:
            local_req("/shutdown", b"{}")
        except Exception:
            pass
        for _ in range(50):
            time.sleep(0.1)
            if running_instance() is None:
                break
        print(f"Laufende Version {v} wurde beendet.")
    elif o == "other":
        print(
            f"Port {PORT} ist bereits belegt, vermutlich durch eine ältere Version dieses Programms (v16 oder älter)."
        )
        print("Bitte deren Konsolenfenster schließen und dieses Programm erneut starten.")
        sys.exit(1)
    for _ in range(30):
        try:
            return Server((HOST, PORT), H)
        except OSError:
            time.sleep(0.2)
    print(f"Port {PORT} ist belegt und konnte nicht übernommen werden.")
    print("Bitte andere Fenster dieses Programms schließen und erneut starten.")
    sys.exit(1)


if __name__ == "__main__":
    SERVER = start()
    u = f"http://{HOST}:{PORT}/"
    print(f"CT Gruppenhierarchie {VERSION_LABEL} läuft auf {u}")
    print("Das Programm beendet sich automatisch, wenn der Browser-Tab geschlossen wird.")
    print("Sofort beenden: Strg+C oder dieses Fenster schließen.")
    threading.Thread(target=watchdog, daemon=True).start()
    if not os.environ.get("CTG_NO_BROWSER"):  # für automatische Tests
        threading.Timer(0.7, lambda: webbrowser.open(u)).start()
    try:
        SERVER.serve_forever()
    except KeyboardInterrupt:
        pass
    SERVER.server_close()
    print("Beendet.")
