// CT Gruppenhierarchie – Datenabruf und Datenaufbereitung
//
// Holt die Gruppendaten nur lesend (GET) aus CT und bereitet sie für die Anzeige auf:
// Hierarchie, Gruppenstämme, alleinstehende Gruppen, Platzhalter für nicht sichtbare
// Obergruppen, Zähler für die Filter.
//
// Wie die Anfragen zu CT gelangen, entscheidet ctGet() anhand von CT_MODE:
// - "proxy":  Python-Version; der lokale Server reicht die Anfragen weiter
//             (Umweg um die CORS-Regel des Browsers)
// - "direct": Webseite; der Browser fragt CT direkt. Dafür muss ein CT-Admin die Adresse
//             dieser Seite unter CORS freigegeben haben.

const CT_MODE =
  ["127.0.0.1", "localhost"].includes(location.hostname) && location.port === "8765"
    ? "proxy"
    : "direct";

// ---- Anfragen an CT ----

// Eine GET-Anfrage an die CT-API. path beginnt mit "/", z. B. "/whoami".
// Liefert die Antwort als Objekt oder wirft einen Fehler mit verständlicher Ursache.
async function ctGet(base, token, path) {
  return CT_MODE === "proxy" ? ctGetProxy(base, token, path) : ctGetDirect(base, token, path);
}

// Direkt aus dem Browser (Webseite)
async function ctGetDirect(base, token, path) {
  let r;
  try {
    r = await fetch(base + "/api" + path, {
      headers: { Accept: "application/json", Authorization: "Login " + token },
      credentials: "omit",
      cache: "no-store",
    });
  } catch (e) {
    // Der Browser verrät aus Sicherheitsgründen nicht, ob die Adresse falsch ist oder die
    // CORS-Freigabe fehlt; beides sieht gleich aus.
    throw new Error("Verbindungsfehler (CORS): " + location.origin);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} ${r.statusText}: ${t.slice(0, 300)}`);
  }
  return r.json();
}

// Über den lokalen Python-Server
async function ctGetProxy(base, token, path) {
  let r;
  try {
    r = await fetch("/ct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base, token, path }),
      cache: "no-store",
    });
  } catch (e) {
    throw new Error("Verbindungsfehler: lokaler Server nicht erreichbar");
  }
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j.data;
}

// Ruft eine Liste seitenweise ab (CT liefert höchstens 100 Einträge pro Seite).
async function ctPaged(base, token, path) {
  let out = [];
  for (let page = 1; ; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const j = await ctGet(base, token, path + sep + new URLSearchParams({ limit: 100, page }));
    const d = j.data === undefined ? [] : j.data;
    if (!Array.isArray(d)) throw new Error(path + ": data ist kein Array");
    out = out.concat(d);
    const p = (j.meta || {}).pagination || {};
    const last = Number(p.lastPage || page) || page;
    if (page >= last) return out;
  }
}

// ---- Hilfsfunktionen ----

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

// Ganzzahl aus Zahl oder Zahl-Text, sonst null
function toInt(x) {
  if (typeof x === "number" && Number.isFinite(x)) return Math.trunc(x);
  if (typeof x === "string" && /^\s*-?\d+\s*$/.test(x)) return Number(x);
  return null;
}

const nameOf = (x) => (isObj(x) ? x.name || x.title || "" : "");

// Gruppenverweis in der Hierarchie: reine ID oder Objekt mit ID und ggf. Namen.
// Gefundene Namen werden in names gemerkt (für nicht sichtbare Gruppen).
function ref(x, names) {
  if (isObj(x)) {
    const i = toInt(x.domainIdentifier || x.id);
    if (i === null) return null;
    if (nameOf(x)) names.set(i, nameOf(x));
    return i;
  }
  return toInt(x);
}

// Anzeigename einer Person aus /whoami bzw. /persons/{id}
function personName(p) {
  if (!isObj(p)) return "";
  if (isObj(p.data)) p = p.data;
  for (const k of ["displayName", "fullName", "name"]) {
    const v = p[k];
    if (typeof v === "string" && v.trim() && !v.toLowerCase().startsWith("benutzer-id"))
      return v.trim();
  }
  return ["firstName", "lastName"]
    .filter((k) => p[k])
    .map((k) => String(p[k]).trim())
    .join(" ")
    .trim();
}

const byNum = (a, b) => a - b;
const sortedNums = (set) => [...set].sort(byNum);
const pad = (n) => String(n).padStart(2, "0");
function nowText() {
  const d = new Date();
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- Laden und Aufbereiten ----

async function loadGroupData(base, token) {
  base = base.trim().replace(/\/+$/, "");
  if (base.endsWith("/api")) base = base.slice(0, -4);

  // Angemeldeter Benutzer
  const who = await ctGet(base, token, "/whoami");
  const wd = isObj(who.data) ? who.data : who;
  const userId = isObj(wd) && wd.id !== undefined ? wd.id : "";
  let userName = personName(wd);
  if (userId) {
    try {
      userName = personName(await ctGet(base, token, `/persons/${userId}`)) || userName;
    } catch {
      // Personendaten sind optional; ohne sie bleibt der Name aus /whoami
    }
  }

  // Gruppenstatus (alle Status abfragen, damit auch z. B. archivierte Gruppen erscheinen)
  const master = await ctGet(base, token, "/masterdata/person");
  const md = isObj(master) && master.data !== undefined ? master.data : master;
  const statuses = isObj(md) && Array.isArray(md.groupStatuses) ? md.groupStatuses : [];
  const sq = new URLSearchParams(
    statuses.filter((x) => x.id != null).map((x) => ["group_status_ids[]", String(x.id)]),
  ).toString();
  const suffix = sq ? "?" + sq : "";

  const [groups, hierarchies, types] = await Promise.all([
    ctPaged(base, token, "/groups" + suffix),
    ctPaged(base, token, "/groups/hierarchies" + suffix),
    ctPaged(base, token, "/group/grouptypes"),
  ]);

  const typeNames = new Map(types.filter((x) => x.id != null).map((x) => [toInt(x.id), nameOf(x)]));
  const statusNames = new Map(
    statuses
      .filter((x) => x.id != null)
      .map((x) => [toInt(x.id), x.nameTranslated || x.name || `Status ${x.id}`]),
  );

  // Ober- und Untergruppen aus den Hierarchie-Daten
  const parents = new Map(),
    children = new Map(),
    urls = new Map(),
    names = new Map();
  const add = (m, k, v) => (m.get(k) || m.set(k, new Set()).get(k)).add(v);
  for (const h of hierarchies) {
    const go = h.group || {};
    const gid = toInt(h.id || h.groupId || (isObj(go) ? go.domainIdentifier : go));
    if (gid === null) continue;
    if (isObj(go) && go.frontendUrl) urls.set(gid, go.frontendUrl);
    if (isObj(go) && nameOf(go)) names.set(gid, nameOf(go));
    for (let p of h.parents || []) {
      p = ref(p, names);
      if (p !== null) {
        add(parents, gid, p);
        add(children, p, gid);
      }
    }
    for (let c of h.children || []) {
      c = ref(c, names);
      if (c !== null) {
        add(children, gid, c);
        add(parents, c, gid);
      }
    }
  }
  const related = new Set([...parents.keys(), ...children.keys()]);
  const setOf = (m, k) => m.get(k) || new Set();

  // Sichtbare Gruppen
  const data = groups.map((g) => {
    const i = g.information || {};
    const s = g.settings || {};
    const gid = toInt(g.id);
    const tid = i.groupTypeId;
    const st = i.groupStatusId;
    const vis = s.visibility || i.visibility || "";
    const typeName = typeNames.has(tid) ? typeNames.get(tid) : "Unbekannt";
    const statusName = statusNames.has(st) ? statusNames.get(st) : `Status ${st}`;
    const description = i.note || "";
    const searchFields = {
      name: g.name || "",
      description,
      groupType: typeName,
      status: statusName,
      visibility: vis,
      homepage: i.groupHomepageUrl || "",
      category: String(i.groupCategoryId || ""),
      campus: String(i.campusId || ""),
      meetingTime: String(i.meetingTime || ""),
    };
    return {
      id: gid,
      name: g.name || "",
      description,
      searchFields,
      groupTypeId: tid,
      groupTypeName: typeName,
      groupStatusId: st,
      groupStatusName: statusName,
      visibility: vis,
      parentIds: sortedNums(setOf(parents, gid)),
      childIds: sortedNums(setOf(children, gid)),
      frontendUrl: urls.get(gid) || `${base}/groups/${gid}`,
      search: Object.values(searchFields).map(String).join(" ").toLowerCase(),
    };
  });
  const ids = new Set(data.map((g) => g.id));

  // Nicht sichtbare Obergruppen (alle Vorfahren sichtbarer Gruppen, die CT nicht liefert)
  const hidden = new Set();
  const stack = [...ids];
  while (stack.length) {
    for (const p of setOf(parents, stack.pop())) {
      if (!ids.has(p) && !hidden.has(p)) {
        hidden.add(p);
        stack.push(p);
      }
    }
  }
  const known = new Set([...ids, ...hidden]);
  const onlyKnown = (set) => sortedNums([...set].filter((x) => known.has(x)));
  const placeholders = [...hidden].map((i) => ({
    id: i,
    name: names.get(i) || `Nicht sichtbare Gruppe (ID ${i})`,
    placeholder: true,
    description: "",
    searchFields: {},
    parentIds: onlyKnown(setOf(parents, i)),
    childIds: onlyKnown(setOf(children, i)),
    frontendUrl: "",
  }));

  const byId = {};
  for (const g of [...data, ...placeholders]) byId[g.id] = g;
  const byName = (a, b) => {
    const x = byId[a].name.toLowerCase(),
      y = byId[b].name.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  };

  // Zähler für die Filter
  const countTypes = new Map(),
    countVis = {},
    countStatus = {};
  for (const g of data) {
    countTypes.set(g.groupTypeId, (countTypes.get(g.groupTypeId) || 0) + 1);
    countVis[g.visibility] = (countVis[g.visibility] || 0) + 1;
    countStatus[String(g.groupStatusId)] = (countStatus[String(g.groupStatusId)] || 0) + 1;
  }
  const sortedObj = (o) =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

  return {
    ok: true,
    userId,
    userName,
    updatedAt: nowText(),
    groups: data,
    byId,
    roots: [...related]
      .filter((x) => known.has(x) && ![...setOf(parents, x)].some((p) => known.has(p)))
      .sort(byName),
    standalone: [...ids].filter((x) => !related.has(x)).sort(byName),
    hierarchieIds: sortedNums([...related].filter((x) => ids.has(x))),
    edges: [...children.values()].reduce((n, s) => n + s.size, 0),
    groupTypes: [...countTypes.entries()]
      .sort(([a], [b]) => (a == null) - (b == null) || (a || 0) - (b || 0))
      .map(([id, count]) => ({
        id,
        name: typeNames.has(id) ? typeNames.get(id) : "Unbekannt",
        count,
      })),
    counts: { visibility: sortedObj(countVis), status: sortedObj(countStatus) },
    statusNames: Object.fromEntries([...statusNames].map(([k, v]) => [String(k), v])),
  };
}
