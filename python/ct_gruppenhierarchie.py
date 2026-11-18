#!/usr/bin/env python3
"""CT Gruppenhierarchie – lokaler Server.

Liefert die Weboberfläche aus dem Ordner web/ aus, ruft Gruppendaten nur lesend aus CT ab
und beendet sich automatisch, wenn kein Browser-Tab der App mehr offen ist.
Start: python3 python/ct_gruppenhierarchie.py
"""

import json, os, sys, threading, time, urllib.error, urllib.parse, urllib.request, webbrowser
from pathlib import Path
from collections import defaultdict
from datetime import datetime
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


def paged(base, path, token):
    out = []
    page = 1
    while True:
        sep = "&" if "?" in path else "?"
        j = req(base, path + sep + urllib.parse.urlencode({"limit": 100, "page": page}), token)
        d = j.get("data", [])
        if not isinstance(d, list):
            raise RuntimeError(path + ": data ist kein Array")
        out += d
        p = (j.get("meta") or {}).get("pagination") or {}
        last = int(p.get("lastPage", page) or page)
        if page >= last:
            return out
        page += 1


def name(x):
    return (x.get("name") or x.get("title") or "") if isinstance(x, dict) else ""


def ref(x, hn):
    # Gruppenverweis in der Hierarchie: entweder reine ID oder Objekt mit ID und ggf. Namen
    if isinstance(x, dict):
        i = x.get("domainIdentifier") or x.get("id")
        try:
            i = int(i)
        except:
            return None
        if name(x):
            hn[i] = name(x)
        return i
    try:
        return int(x)
    except:
        return None


def pname(p):
    if not isinstance(p, dict):
        return ""
    p = p.get("data", p) if isinstance(p.get("data"), dict) else p
    for k in ("displayName", "fullName", "name"):
        v = p.get(k)
        if isinstance(v, str) and v.strip() and not v.lower().startswith("benutzer-id"):
            return v.strip()
    return " ".join(
        str(p.get(k, "")).strip() for k in ("firstName", "lastName") if p.get(k)
    ).strip()


def normalize(base, token):
    who = req(base, "/whoami", token)
    wd = who.get("data") if isinstance(who.get("data"), dict) else who
    uid = wd.get("id", "") if isinstance(wd, dict) else ""
    un = pname(wd)
    if uid:
        try:
            un = pname(req(base, f"/persons/{uid}", token)) or un
        except:
            pass
    master = req(base, "/masterdata/person", token)
    md = master.get("data", master) if isinstance(master, dict) else {}
    statuses = md.get("groupStatuses", []) if isinstance(md, dict) else []
    sq = urllib.parse.urlencode(
        [("group_status_ids[]", str(x["id"])) for x in statuses if x.get("id") is not None]
    )
    suffix = ("?" + sq) if sq else ""
    groups = paged(base, "/groups" + suffix, token)
    hs = paged(base, "/groups/hierarchies" + suffix, token)
    types = paged(base, "/group/grouptypes", token)
    tn = {int(x["id"]): name(x) for x in types if x.get("id") is not None}
    sn = {
        int(x["id"]): x.get("nameTranslated") or x.get("name") or f"Status {x['id']}"
        for x in statuses
        if x.get("id") is not None
    }
    pa = defaultdict(set)
    ch = defaultdict(set)
    urls = {}
    hn = {}
    for h in hs:
        go = h.get("group") or {}
        gid = (
            h.get("id")
            or h.get("groupId")
            or (go.get("domainIdentifier") if isinstance(go, dict) else go)
        )
        try:
            gid = int(gid)
        except:
            continue
        if isinstance(go, dict) and go.get("frontendUrl"):
            urls[gid] = go["frontendUrl"]
        if isinstance(go, dict) and name(go):
            hn[gid] = name(go)
        for p in h.get("parents") or []:
            p = ref(p, hn)
            if p is not None:
                pa[gid].add(p)
                ch[p].add(gid)
        for c in h.get("children") or []:
            c = ref(c, hn)
            if c is not None:
                ch[gid].add(c)
                pa[c].add(gid)
    pn = set(pa)
    rel = pn | set(ch)
    base = base.strip().rstrip("/")
    base = base[:-4] if base.endswith("/api") else base
    data = []
    for g in groups:
        i = g.get("information") or {}
        s = g.get("settings") or {}
        gid = int(g["id"])
        tid = i.get("groupTypeId")
        st = i.get("groupStatusId")
        vis = s.get("visibility") or i.get("visibility") or ""
        t = tn.get(tid, "Unbekannt")
        ss = sn.get(st, f"Status {st}")
        description = i.get("note", "") or ""
        search_fields = {
            "name": g.get("name", ""),
            "description": description,
            "groupType": t,
            "status": ss,
            "visibility": vis,
            "homepage": i.get("groupHomepageUrl", "") or "",
            "category": str(i.get("groupCategoryId") or ""),
            "campus": str(i.get("campusId") or ""),
            "meetingTime": str(i.get("meetingTime") or ""),
        }
        search = " ".join(map(str, search_fields.values())).lower()
        data.append(
            {
                "id": gid,
                "name": g.get("name", ""),
                "description": description,
                "searchFields": search_fields,
                "groupTypeId": tid,
                "groupTypeName": t,
                "groupStatusId": st,
                "groupStatusName": ss,
                "visibility": vis,
                "parentIds": sorted(pa.get(gid, set())),
                "childIds": sorted(ch.get(gid, set())),
                "frontendUrl": urls.get(gid, f"{base}/groups/{gid}"),
                "search": search,
            }
        )
    ids = {g["id"] for g in data}
    hidden = set()
    st = list(ids)
    while st:
        for p in pa.get(st.pop(), ()):
            if p not in ids and p not in hidden:
                hidden.add(p)
                st.append(p)
    known = ids | hidden
    ph = [
        {
            "id": i,
            "name": hn.get(i) or f"Nicht sichtbare Gruppe (ID {i})",
            "placeholder": True,
            "description": "",
            "searchFields": {},
            "parentIds": sorted(pa.get(i, set()) & known),
            "childIds": sorted(ch.get(i, set()) & known),
            "frontendUrl": "",
        }
        for i in hidden
    ]
    by = {g["id"]: g for g in data + ph}
    key = lambda x: by[x]["name"].lower()
    ct = defaultdict(int)
    cv = defaultdict(int)
    cs = defaultdict(int)
    for g in data:
        ct[g["groupTypeId"]] += 1
        cv[g["visibility"]] += 1
        cs[str(g["groupStatusId"])] += 1
    return {
        "ok": True,
        "userId": uid,
        "userName": un,
        "updatedAt": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "groups": data,
        "byId": {str(k): g for k, g in by.items()},
        "roots": sorted((x for x in rel & known if not pa.get(x, set()) & known), key=key),
        "standalone": sorted(ids - rel, key=key),
        "hierarchieIds": sorted(rel & ids),
        "edges": sum(map(len, ch.values())),
        "groupTypes": [
            {"id": k, "name": tn.get(k, "Unbekannt"), "count": v}
            for k, v in sorted(ct.items(), key=lambda z: (z[0] is None, z[0] or 0))
        ],
        "counts": {"visibility": dict(sorted(cv.items())), "status": dict(sorted(cs.items()))},
        "statusNames": {str(k): v for k, v in sn.items()},
    }


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
        if self.path != "/data":
            self.send_error(404)
            return
        try:
            o = normalize(q.get("base", ""), q.get("token", ""))
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
