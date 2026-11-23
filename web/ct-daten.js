// CT Gruppenhierarchie – Datenabruf und Datenaufbereitung
//
// Holt die Gruppendaten lesend (GET) aus CT und bereitet sie für die Anzeige auf.
// Version 2.0: Am Ende stehen die einzigen Schreibfunktionen (Obergruppen ändern), die nur
// in der CT-Extension arbeiten (siehe „Schreiben in CT“ in AGENTS.md).
// Die Datenaufbereitung umfasst:
// Hierarchie, Gruppenstämme, alleinstehende Gruppen, Platzhalter für nicht sichtbare
// Obergruppen, Zähler für die Filter.
//
// Wie die Anfragen zu CT gelangen, entscheidet ctGet() anhand von CT_MODE:
// - "proxy":  Python-Version; der lokale Server reicht die Anfragen weiter
//             (Umweg um die CORS-Regel des Browsers)
// - "direct": Webseite; der Browser fragt CT direkt. Dafür muss ein CT-Admin die Adresse
//             dieser Seite unter CORS freigegeben haben.
// - "tauri":  Desktop-App; Anfragen laufen über das HTTP-Plugin von Tauri, für das die
//             CORS-Regel nicht gilt.
// - "extension": CT-Extension; die App läuft innerhalb von CT (Adresse /ccm/…) und nutzt die
//             Anmeldung des Nutzers in CT. Kein Login-Token nötig.

const CT_MODE = globalThis.__TAURI__
  ? "tauri"
  : location.pathname.startsWith("/ccm/")
    ? "extension"
    : ["127.0.0.1", "localhost"].includes(location.hostname) && location.port === "8765"
      ? "proxy"
      : "direct";

// ---- Anfragen an CT ----

// Eine GET-Anfrage an die CT-API. path beginnt mit "/", z. B. "/whoami".
// Liefert die Antwort als Objekt oder wirft einen Fehler mit verständlicher Ursache.
async function ctGet(base, token, path) {
  if (CT_MODE === "extension") return ctGetSession(path);
  return CT_MODE === "proxy" ? ctGetProxy(base, token, path) : ctGetDirect(base, token, path);
}

// Antwort von CT prüfen und auswerten
async function ctResult(r) {
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} ${r.statusText}: ${t.slice(0, 300)}`);
  }
  return r.json();
}

// Innerhalb von CT (Extension): gleiche Adresse, Anmeldung über die bestehende CT-Sitzung
async function ctGetSession(path) {
  let r;
  try {
    r = await fetch("/api" + path, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (e) {
    throw new Error("Verbindungsfehler: CT nicht erreichbar");
  }
  return ctResult(r);
}

// Direkt aus dem Browser (Webseite) bzw. über Tauri (Desktop-App)
async function ctGetDirect(base, token, path) {
  const tauri = CT_MODE === "tauri";
  const get = tauri ? globalThis.__TAURI__.http.fetch : fetch;
  const opts = { headers: { Accept: "application/json", Authorization: "Login " + token } };
  if (!tauri) Object.assign(opts, { credentials: "omit", cache: "no-store" });
  // Desktop-App: als Absender die CT-Adresse selbst angeben, damit CT die Anfrage nicht als
  // fremde Webseite behandelt (sonst stünde dort z. B. „tauri://localhost“)
  else opts.headers.Origin = new URL(base).origin;
  let r;
  try {
    r = await get(base + "/api" + path, opts);
  } catch (e) {
    if (tauri) throw new Error("Verbindungsfehler: " + e);
    // Der Browser verrät aus Sicherheitsgründen nicht, ob die Adresse falsch ist oder die
    // CORS-Freigabe fehlt; beides sieht gleich aus.
    throw new Error("Verbindungsfehler (CORS): " + location.origin);
  }
  return ctResult(r);
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

// Nur verschlüsselte Verbindungen erlauben, damit der Login-Token nie unverschlüsselt durchs
// Netz geht. Ausnahme: der eigene Rechner (localhost), z. B. für die automatischen Tests.
const SAFE_BASE = /^(https:\/\/[^/\s]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)(\/|$)/i;

async function loadGroupData(base, token) {
  base = base.trim().replace(/\/+$/, "");
  if (base.endsWith("/api")) base = base.slice(0, -4);
  if (!SAFE_BASE.test(base))
    throw new Error(
      "Bitte die CT-Adresse mit https:// angeben, z. B. https://deine-gemeinde.church.tools",
    );

  // Angemeldeter Benutzer
  const who = await ctGet(base, token, "/whoami");
  const wd = isObj(who.data) ? who.data : who;
  const userId = isObj(wd) && wd.id !== undefined ? wd.id : "";
  // In CT ohne Anmeldung meldet /whoami keinen Fehler, sondern „Anonymous“ (id -1)
  if (CT_MODE === "extension" && !(Number(userId) > 0))
    throw new Error("HTTP 401 Nicht angemeldet");
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
    groupsWithStats(base, token, sq),
    ctPaged(base, token, "/groups/hierarchies" + suffix),
    ctPaged(base, token, "/group/grouptypes"),
  ]);

  const typeNames = new Map(types.filter((x) => x.id != null).map((x) => [toInt(x.id), nameOf(x)]));
  const statusNames = new Map(
    statuses
      .filter((x) => x.id != null)
      .map((x) => [toInt(x.id), x.nameTranslated || x.name || `Status ${x.id}`]),
  );

  // Namen für ID-Felder aus den Stammdaten (soweit CT sie liefert)
  const lookup = (k) =>
    new Map(
      (isObj(md) && Array.isArray(md[k]) ? md[k] : [])
        .filter((x) => x && x.id != null)
        .map((x) => [toInt(x.id), x.nameTranslated || x.name || String(x.id)]),
    );
  const lookups = {
    groupTypeId: typeNames,
    groupStatusId: statusNames,
    groupCategoryId: lookup("groupCategories"),
    campusId: lookup("campuses"),
    targetGroupId: lookup("targetGroups"),
    ageGroupIds: lookup("ageGroups"),
  };

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
      fields: groupFields(g, lookups),
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
    fieldList: fieldList(data),
  };
}

// Gruppen mit Mitglieder- und Leiterzahlen (memberStatistics) anfordern. Unterstützt eine
// CT-Instanz das nicht, ohne diesen Zusatz erneut laden.
async function groupsWithStats(base, token, sq) {
  const q = (extra) => "/groups" + ([sq, extra].filter(Boolean).length ? "?" + [sq, extra].filter(Boolean).join("&") : "");
  try {
    return await ctPaged(base, token, q("include%5B%5D=memberStatistics"));
  } catch (e) {
    if (/HTTP 40[13]/.test(String(e.message))) throw e; // Anmeldung/Rechte: nicht verschleiern
    return ctPaged(base, token, q(""));
  }
}

// ---- Gruppenfelder für eigene Filter ----
// Alle Felder, die CT zu einer Gruppe liefert, als flache Liste „Schlüssel → Anzeigewert“.
// Neue Felder in CT (auch eigene Gruppenfelder der Instanz) erscheinen ohne Programmänderung.
const FIELD_LABELS = {
  name: "Name",
  note: "Notiz",
  groupTypeId: "Gruppentyp",
  groupStatusId: "Gruppenstatus",
  visibility: "Sichtbarkeit",
  groupCategoryId: "Gruppenkategorie",
  campusId: "Standort",
  targetGroupId: "Zielgruppe",
  ageGroupIds: "Altersgruppen",
  dateOfFoundation: "Gründungsdatum",
  endDate: "Enddatum",
  meetingTime: "Treffzeit",
  weekday: "Wochentag",
  groupHomepageUrl: "Homepage der Gruppe",
  modifiedDate: "Zuletzt geändert",
  isOpenForMembers: "Offen für Anmeldungen",
  isPublic: "Öffentlich",
  isHidden: "Versteckt",
  inStatistic: "In Statistik berücksichtigen",
  autoAccept: "Anmeldungen automatisch annehmen",
  allowWaitinglist: "Warteliste erlaubt",
  waitinglistMaxPersons: "Warteliste: max. Personen",
  automaticMoveUp: "Automatisch von Warteliste nachrücken",
  allowChildRegistration: "Anmeldung von Kindern erlaubt",
  allowSpouseRegistration: "Anmeldung des Ehepartners erlaubt",
  allowOtherRegistration: "Anmeldung weiterer Personen erlaubt",
  allowSameEmailRegistration: "Anmeldung mit gleicher E-Mail erlaubt",
  signUpOpeningDate: "Anmeldung geöffnet ab",
  signUpClosingDate: "Anmeldeschluss",
  emailVerificationMode: "E-Mail-Bestätigung bei Anmeldung",
  informLeader: "Gruppenleitung bei Anmeldung informieren",
  postsEnabled: "Beiträge aktiviert",
  chatHistoryVisible: "Chatverlauf sichtbar",
  qrCodeCheckin: "QR-Code-Check-in",
  dynamicGroupStatus: "Automatische Mitgliedschaft",
  securityLevelForGroup: "Sicherheitsstufe",
  appointmentStartDate: "Termin: Beginn",
  "memberStatistics.leaders": "Anzahl Leiter",
  "memberStatistics.active": "Anzahl Mitglieder (aktiv)",
  "memberStatistics.participants": "Anzahl Teilnehmer",
  "memberStatistics.requested": "Anzahl Anfragen",
  "memberStatistics.waiting": "Anzahl Warteliste",
};
// Technische Felder ohne Nutzen für Filter
const FIELD_SKIP = new Set([
  "id",
  "guid",
  "imageUrl",
  "chatStatus",
  "color",
  "signUpOverrideRoleId",
  "maxMembers",
  "frontendUrl",
  "domainIdentifier",
  "apiUrl",
  "domainType",
  // rein technisch bzw. zum Filtern ungeeignet (mit dem Inhaber abgestimmt)
  "appointmentId",
  "defaultPostCommentsActive",
  "defaultPostNotificationScope",
  "defaultPostVisibility",
  "dynamicGroupUpdateStarted",
  "dynamicGroupUpdateFinished",
  "externalPostSubscriptionsEnabled",
  "imageAiGenerated",
  "qrCodeCheckinAutomaticEmail",
  "sendDefaultSignUpMail",
  "showStreet",
  "signUpEmailRequiredForAll",
  "signUpNotificationSentDate",
  "statusesCountedTowardsSeats",
  "signUpHeadline",
]);
function fieldValue(v, names) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean") return v ? "ja" : "nein";
  if (Array.isArray(v)) {
    return v
      .filter((x) => !isObj(x) && !Array.isArray(x))
      .map((x) => fieldValue(x, names))
      .filter((x) => x !== "")
      .join(", ");
  }
  if (isObj(v)) return "";
  if (names && names.has(toInt(v))) return names.get(toInt(v));
  return typeof v === "number" ? v : String(v);
}
function groupFields(g, lookups) {
  const out = {},
    put = (k, v) => {
      if (FIELD_SKIP.has(k.split(".").pop())) return;
      const val = fieldValue(v, lookups[k]);
      if (val !== "") out[k] = val;
    };
  for (const [k, v] of Object.entries(g)) {
    if (k === "information" || k === "settings" || k === "memberStatistics") continue;
    if (!isObj(v)) put(k, v);
  }
  for (const [k, v] of Object.entries(g.information || {})) put(k, v);
  for (const [k, v] of Object.entries(g.settings || {})) if (!isObj(v)) put(k, v);
  for (const [k, v] of Object.entries(g.memberStatistics || {}))
    if (typeof v === "number") put("memberStatistics." + k, v);
  return out;
}
function fieldList(groups) {
  const keys = new Map();
  for (const g of groups)
    for (const [k, v] of Object.entries(g.fields)) {
      const e = keys.get(k) || { key: k, num: true };
      if (typeof v !== "number") e.num = false;
      keys.set(k, e);
    }
  return [...keys.values()]
    .map((e) => ({ ...e, label: FIELD_LABELS[e.key] || e.key }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
}

// ---- Schreiben in CT (Version 2.0, nur in der CT-Extension) ----
// Erlaubt ist ausschließlich: eine Obergruppe einer Gruppe hinzufügen (PUT) oder entfernen
// (DELETE). Webseite, Desktop-App und Python-Version schreiben nicht.
const CT_WRITE = CT_MODE === "extension";
// Testversion der Extension (Kürzel „gruppenhierarchietest“): Änderungen nur an Gruppen
// unterhalb der Gruppe „Test Gruppenhierarchie“ – Schutz echter Gruppen beim Ausprobieren
const CT_TEST = /^\/ccm\/gruppenhierarchietest(\/|$)/.test(location.pathname);
const TEST_ROOT = "Test Gruppenhierarchie";

// Fehler beim Schreiben mit Art: "lock", "conflict", "rights", "partial", "error"
function writeError(kind, msg, parents) {
  const e = new Error(msg);
  e.kind = kind;
  if (parents) e.parents = parents;
  return e;
}

// Sicherheits-Merkmal (CSRF-Token), das CT bei Schreibzugriffen aus dem Browser verlangt
let CSRF_TOKEN = null;
async function ctCsrf(fresh) {
  if (!CSRF_TOKEN || fresh) {
    const j = await ctGetSession("/csrftoken");
    CSRF_TOKEN = isObj(j) && j.data !== undefined ? j.data : j;
  }
  return CSRF_TOKEN;
}

// Die einzigen erlaubten Schreibanfragen: Obergruppen ändern und die gemeinsamen Filter in der
// eigenen Datenablage der Extension pflegen
const WRITE_ALLOWED = [
  [/^\/groups\/\d+\/parents\/\d+$/, ["PUT", "DELETE"]],
  [/^\/custommodules\/\d+\/customdatacategories$/, ["POST"]],
  [/^\/custommodules\/\d+\/customdatacategories\/\d+\/customdatavalues$/, ["POST"]],
  [/^\/custommodules\/\d+\/customdatacategories\/\d+\/customdatavalues\/\d+$/, ["PUT", "DELETE"]],
];
async function ctSend(method, path, body) {
  if (!CT_WRITE) throw writeError("error", "Schreiben ist nur in der CT-Extension möglich.");
  if (!WRITE_ALLOWED.some(([re, m]) => re.test(path) && m.includes(method)))
    throw writeError("error", "Nicht erlaubte Änderung: " + method + " " + path);
  const send = async (fresh) =>
    fetch("/api" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "CSRF-Token": await ctCsrf(fresh),
      },
      body: body !== undefined ? JSON.stringify(body) : method === "PUT" ? "{}" : undefined,
    });
  try {
    let r = await send(false);
    // abgelaufenes Sicherheits-Merkmal: einmal mit frischem versuchen
    if (r.status === 401) r = await send(true);
    return r;
  } catch {
    throw writeError("error", "Verbindungsfehler: CT nicht erreichbar");
  }
}

// Aktuelle Obergruppen einer Gruppe, direkt aus CT
async function ctParents(gid) {
  const j = await ctGetSession(`/groups/${gid}/parents`);
  const d = isObj(j) && j.data !== undefined ? j.data : j;
  return sortedNums((Array.isArray(d) ? d : []).map((p) => ref(p, new Map())).filter((x) => x !== null));
}

// Testversion: Liegt die Gruppe unterhalb (oder ist sie selbst, wenn self erlaubt) der Gruppe
// „Test Gruppenhierarchie“?
function belowTestRoot(model, id, self) {
  const roots = new Set(model.groups.filter((g) => g.name.trim() === TEST_ROOT).map((g) => g.id));
  if (roots.has(id)) return self;
  const seen = new Set(),
    stack = [...((model.byId[id] || {}).parentIds || [])];
  while (stack.length) {
    const p = stack.pop();
    if (roots.has(p)) return true;
    if (seen.has(p)) continue;
    seen.add(p);
    stack.push(...((model.byId[p] || {}).parentIds || []));
  }
  return false;
}

const sameNums = (a, b) => a.length === b.length && sortedNums(a).every((x, i) => x === sortedNums(b)[i]);

// Ändert die Obergruppen einer Gruppe: add/remove sind Listen von Gruppen-IDs.
// expected sind die Obergruppen, wie sie gerade angezeigt werden: Weicht CT davon ab, wird
// nichts geschrieben (jemand anderes hat inzwischen geändert). Liefert die neuen Obergruppen.
async function ctChangeParents(model, gid, add, remove, expected) {
  if (CT_TEST && !(belowTestRoot(model, gid, false) && [...add, ...remove].every((p) => belowTestRoot(model, p, true))))
    throw writeError("lock", `Die Testversion ändert nur Gruppen unterhalb von „${TEST_ROOT}“.`);
  const before = await ctParents(gid);
  if (!sameNums(before, expected))
    throw writeError(
      "conflict",
      "Diese Gruppe wurde inzwischen in CT geändert. Die Ansicht wird aktualisiert – bitte noch einmal versuchen.",
      before,
    );
  let fail = null;
  for (const [method, list] of [
    ["PUT", add],
    ["DELETE", remove],
  ]) {
    for (const p of list) {
      const r = await ctSend(method, `/groups/${gid}/parents/${p}`);
      if (r.ok) continue;
      const t = await r.text().catch(() => "");
      if (method === "PUT" && r.status === 400 && /already/i.test(t)) continue; // schon gesetzt
      if (method === "DELETE" && r.status === 404) continue; // schon entfernt
      fail = r.status === 401 || r.status === 403 ? "rights" : "error";
      break;
    }
    if (fail) break;
  }
  const after = await ctParents(gid);
  const want = sortedNums(new Set([...expected, ...add].filter((p) => !remove.includes(p))));
  if (sameNums(after, want)) return after;
  if (sameNums(after, before))
    throw writeError(
      fail || "error",
      fail === "rights"
        ? "Du darfst diese Gruppen in CT nicht so ändern. Es wurde nichts geändert."
        : "Die Änderung wurde von CT nicht übernommen. Es wurde nichts geändert.",
      after,
    );
  throw writeError(
    "partial",
    "Die Änderung wurde nur teilweise übernommen" +
      (fail === "rights" ? " (fehlende Rechte in CT)" : "") +
      ". Die Ansicht wird aktualisiert.",
    after,
  );
}

// ---- Gemeinsame Filter (Version 2.0, nur Extension) ----
// Liegen in der Datenablage der Extension in CT („Custom Module“ mit dem Kürzel der Extension),
// im Bereich „filter“. Jeder Filter ist ein Eintrag mit JSON {name, cf}. Rechte vergibt ein
// CT-Admin pro Bereich (sehen, anlegen, bearbeiten, löschen); einen Schutz pro Eintrag gibt es
// in CT nicht. Ein Eintrag fasst höchstens 10.000 Zeichen.
const EXT_KEY = (location.pathname.match(/^\/ccm\/([^/]+)/) || [])[1] || "";
const SHARED_CAT = "filter";
const dataOf = (j) => (isObj(j) && j.data !== undefined ? j.data : j);
async function sharedPlace(create) {
  const mods = dataOf(await ctGetSession("/custommodules"));
  const mod = (Array.isArray(mods) ? mods : []).find((m) => m && m.shorty === EXT_KEY);
  if (!mod) throw writeError("rights", "Die Datenablage der Erweiterung ist in CT nicht verfügbar.");
  const cats = dataOf(await ctGetSession(`/custommodules/${mod.id}/customdatacategories`));
  let cat = (Array.isArray(cats) ? cats : []).find((c) => c && c.shorty === SHARED_CAT);
  if (!cat && create) {
    const r = await ctSend("POST", `/custommodules/${mod.id}/customdatacategories`, {
      customModuleId: mod.id,
      name: "Gemeinsame Filter",
      shorty: SHARED_CAT,
      description: "Für alle freigegebene Filter der Gruppenhierarchie",
    });
    if (!r.ok) throw sharedError(r);
    cat = dataOf(await r.json().catch(() => ({})));
    if (!cat || cat.id == null) return sharedPlace(false);
  }
  return { mid: mod.id, cid: cat ? cat.id : null };
}
function sharedError(r) {
  return r.status === 401 || r.status === 403
    ? writeError(
        "rights",
        "Dafür fehlen dir in CT die Rechte für die gemeinsamen Filter. Ein CT-Admin kann sie bei den Berechtigungen der Erweiterung vergeben.",
      )
    : writeError("error", `CT hat die Änderung abgelehnt (HTTP ${r.status}).`);
}
// Alle gemeinsamen Filter: [{id, name, cf}]
async function sharedList() {
  const { mid, cid } = await sharedPlace(false);
  if (cid == null) return [];
  const vals = dataOf(
    await ctGetSession(`/custommodules/${mid}/customdatacategories/${cid}/customdatavalues`),
  );
  const out = [];
  for (const v of Array.isArray(vals) ? vals : []) {
    try {
      const j = JSON.parse(v.value);
      if (j && typeof j.name === "string" && j.cf) out.push({ id: v.id, name: j.name, cf: j.cf });
    } catch {
      // fremder oder beschädigter Eintrag: überspringen
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "de"));
}
// Speichert (bzw. aktualisiert bei gleichem Namen) einen gemeinsamen Filter
async function sharedSave(name, cf) {
  const value = JSON.stringify({ name, cf });
  if (value.length > 10000) throw writeError("error", "Der Filter ist zu groß zum Freigeben.");
  const { mid, cid } = await sharedPlace(true);
  const base = `/custommodules/${mid}/customdatacategories/${cid}/customdatavalues`;
  const old = (await sharedList()).find((x) => x.name === name);
  const r = old
    ? await ctSend("PUT", `${base}/${old.id}`, { id: old.id, dataCategoryId: cid, value })
    : await ctSend("POST", base, { dataCategoryId: cid, value });
  if (!r.ok) throw sharedError(r);
  // nachlesen: ein „erfolgreich“ von CT allein ist kein Beleg
  const now = (await sharedList()).find((x) => x.name === name);
  if (!now || JSON.stringify(now.cf) !== JSON.stringify(cf))
    throw writeError("error", "Der Filter wurde von CT nicht gespeichert.");
  return old ? "updated" : "created";
}
async function sharedDelete(id) {
  const { mid, cid } = await sharedPlace(false);
  if (cid == null) return;
  const r = await ctSend("DELETE", `/custommodules/${mid}/customdatacategories/${cid}/customdatavalues/${id}`);
  if (!r.ok && r.status !== 404) throw sharedError(r);
}
