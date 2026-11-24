// CT Gruppenhierarchie – Oberfläche
// Liest Gruppendaten (über den lokalen Server) und stellt sie als Baum, Visualisierung
// und Liste der Mehrfachzuordnungen dar. Greift nur lesend auf CT zu.

// ---- Grundlagen, gespeicherte Einstellungen ----
const $ = (x) => document.getElementById(x),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
let CUR = null,
  REQ = 0,
  M = null,
  expanded = new Set(),
  vExpanded = new Set(),
  DISPLAY = new Set(),
  MATCH = new Set(),
  mode = "horizontal";
function prefs() {
  try {
    return JSON.parse(localStorage.getItem("ctv10") || "{}");
  } catch {
    return {};
  }
}
let P = prefs();
if (P.base) $("base").value = P.base;
// Die Visualisierung startet immer horizontal (umschaltbar, gilt dann bis zum Neuladen)
function save() {
  localStorage.setItem(
    "ctv10",
    JSON.stringify({
      base: $("base").value,
      type: $("type").value,
      visibility: $("visibility").value,
      status: $("status").value,
      multi: multiV(),
      search: $("search").value,
      expanded: [...expanded],
      mode,
      cf: CF,
      cfName: CF_NAME,
      cfBase: CF_BASE,
    }),
  );
}
function opt(v, t) {
  return `<option value="${esc(v)}">${esc(t)}</option>`;
}
function lv(v) {
  return (
    { hidden: "Versteckt", intern: "Intern", public: "Öffentlich", restricted: "Eingeschränkt" }[
      v
    ] || v
  );
}

// ---- Verbindung: Laden, Löschen, Trennen ----
function clearData() {
  M = null;
  CUR = null;
  BACK = [];
  UNDO = []; // Zurück-Liste gehört zur Verbindung
  undoRender();
  $("refresh").classList.add("hidden");
  expanded = new Set();
  vExpanded = new Set();
  DISPLAY = new Set();
  MATCH = new Set();
  [
    "tree",
    "stand",
    "forest",
    "stats",
    "chips",
    "user",
    "conn",
    "treeCount",
    "soloCount",
    "visCount",
    "soloForest",
    "visSoloCount",
    "multiList",
    "multiCount",
    "multiF",
    "type",
    "visibility",
    "status",
    "tooltip",
  ].forEach((id) => ($(id).innerHTML = ""));
  $("tooltip").classList.add("hidden");
  $("app").classList.add("hidden");
}
function resetPrefs(base) {
  $("search").value = "";
  P = { base, mode };
  try {
    localStorage.setItem("ctv10", JSON.stringify(P));
  } catch {
    // Speichern nicht möglich (z. B. privates Fenster): Einstellungen gelten dann nur bis zum
    // Schließen, die App funktioniert trotzdem
  }
}
async function load(fresh) {
  // Extension: CT-Adresse ist die eigene, angemeldet wird über die CT-Sitzung (kein Token)
  const ext = CT_MODE === "extension";
  let base = ext ? location.origin : $("base").value.trim(),
    token = ext ? "" : $("token").value.trim();
  if (!base) throw Error("Bitte CT-Adresse eingeben, z. B. https://deine-gemeinde.church.tools");
  if (!ext && !token) throw Error("Bitte Login-Token eingeben.");
  let prevBase = CUR ? CUR.base : prefs().base || "";
  let isNew = fresh || !CUR || CUR.base !== base || CUR.token !== token;
  if (isNew) {
    clearData();
    if (prevBase && prevBase !== base) resetPrefs(base);
  }
  let my = ++REQ,
    j;
  $("msg").textContent = "Daten werden geladen …";
  $("msg").className = "note";
  try {
    j = await loadGroupData(base, token);
  } catch (e) {
    if (my !== REQ) return;
    throw e;
  }
  if (my !== REQ) return;
  if (!j.ok) throw Error(j.error);
  M = j;
  CUR = { base, token };
  setup(isNew);
  if (isNew) {
    vExpanded = new Set(
      Object.values(M.byId)
        .filter((g) => g.childIds.length)
        .map((g) => g.id),
    );
    NEEDFIT = true; // neu geladen: so weit herauszoomen, dass alles zu sehen ist
    renderForest();
  }
  $("refresh").classList.remove("hidden");
  $("app").classList.remove("hidden");
  $("msg").textContent = "✓ Verbindung erfolgreich";
  $("msg").className = "ok";
  $("conn").className = "ok";
  $("conn").textContent = `● CT verbunden · ${j.groups.length} Gruppen · Stand ${j.updatedAt}`;
  $("user").innerHTML =
    `Nutzer-ID: <b>${esc(j.userId)}</b><br>Nutzername: <b>${esc(j.userName || "Nicht verfügbar")}</b>`;
  $("modal").classList.add("hidden");
  fitIfNeeded(); // erst jetzt ist die Ansicht sichtbar und messbar
}

// ---- Suche und Filter ----
function searchHits(g) {
  let q = $("search").value.trim().toLowerCase();
  if (!q) return [];
  return Object.entries(g.searchFields || {})
    .filter(([k, v]) =>
      String(v || "")
        .toLowerCase()
        .includes(q),
    )
    .map(([k]) => k);
}
function match(g, except = "") {
  let hits = searchHits(g),
    q = $("search").value.trim(),
    t = $("type").value,
    v = $("visibility").value,
    s = $("status").value;
  if (q && !hits.length) return false;
  if (except !== "type" && t && String(g.groupTypeId) !== t) return false;
  if (except !== "visibility" && v && g.visibility !== v) return false;
  if (except !== "status" && s && String(g.groupStatusId) !== s) return false;
  if (except !== "multi" && multiV() && !isMulti(g)) return false;
  if (except !== "custom" && !cfMatch(g)) return false;
  return true;
}
// Ein/Aus-Filter „Nur Gruppen mit Mehrfachzuordnung“ (Hakenkästchen): "multi" oder ""
const multiV = () => ($("multiF").checked ? "multi" : "");
const setMulti = (v) => ($("multiF").checked = v === "multi");
function facets(
  t = $("type").value,
  v = $("visibility").value,
  s = $("status").value,
  mm = multiV(),
) {
  let C = (ex, k) => {
      let o = {};
      M.groups.filter((g) => match(g, ex)).forEach((g) => (o[g[k]] = (o[g[k]] || 0) + 1));
      return o;
    },
    tc = C("type", "groupTypeId"),
    vc = C("visibility", "visibility"),
    sc = C("status", "groupStatusId");
  $("type").innerHTML =
    opt("", `Alle Gruppentypen (${M.groups.filter((g) => match(g, "type")).length})`) +
    M.groupTypes.map((x) => opt(x.id, `${x.name} (${tc[x.id] || 0})`)).join("");
  $("visibility").innerHTML =
    opt("", `Alle Sichtbarkeiten (${M.groups.filter((g) => match(g, "visibility")).length})`) +
    Object.keys(M.counts.visibility)
      .map((x) => opt(x, `${lv(x)} (${vc[x] || 0})`))
      .join("");
  $("status").innerHTML =
    opt("", `Alle Gruppenstatus (${M.groups.filter((g) => match(g, "status")).length})`) +
    Object.keys(M.counts.status)
      .map((x) => opt(x, `${M.statusNames[x] || "Status " + x} (${sc[x] || 0})`))
      .join("");
  $("multiCount2").textContent = `(${M.groups.filter((g) => match(g, "multi") && isMulti(g)).length})`;
  $("type").value = t;
  $("visibility").value = v;
  $("status").value = s;
  setMulti(mm);
}
// Status „aktiv“: Beim Start werden nur aktive Gruppen angezeigt
function activeStatus() {
  return (
    Object.keys(M.statusNames).find((k) => M.statusNames[k].trim().toLowerCase() === "aktiv") ||
    ""
  );
}
function setup(first) {
  P = prefs();
  $("search").value = P.search || "";
  CF = cfValid(P.cf) ? P.cf : cfNew("and");
  CF_NAME = P.cfName || "";
  CF_BASE = P.cfBase || "";
  cfRender();
  expanded = new Set((P.expanded || []).map(Number));
  facets(P.type || "", P.visibility || "", first ? activeStatus() : P.status || "", P.multi || "");
  render();
  if (first && (!P.expanded || !P.expanded.length)) {
    expandAllBoth();
  }
}

// ---- Anzeige: Übersicht (Baum) und Statistik ----
function render() {
  let sel = [$("type").value, $("visibility").value, $("status").value, multiV()];
  facets(...sel);
  MATCH = new Set(M.groups.filter((g) => match(g)).map((g) => g.id));
  DISPLAY = new Set(MATCH);
  for (let id of MATCH) {
    let st = [...(M.byId[id]?.parentIds || [])],
      seen = new Set();
    while (st.length) {
      let p = st.pop();
      if (seen.has(p)) continue;
      seen.add(p);
      DISPLAY.add(p);
      st.push(...(M.byId[p]?.parentIds || []));
    }
  }
  let roots = M.roots.filter((x) => DISPLAY.has(x));
  $("tree").innerHTML =
    roots.map((x) => tnode(x, new Set())).join("") ||
    '<li class="empty">Keine passenden Hierarchiegruppen.</li>';
  let solos = M.standalone.filter((x) => MATCH.has(x));
  $("stand").innerHTML =
    solos.map((x) => line(M.byId[x])).join("") ||
    '<p class="empty">Keine passenden alleinstehenden Gruppen.</p>';
  $("treeCount").textContent =
    `${[...DISPLAY].filter((x) => M.hierarchieIds.includes(x)).length} dargestellt`;
  $("soloCount").textContent = `${solos.length} dargestellt`;
  let ctx = [...DISPLAY].filter((x) => !MATCH.has(x) && !M.byId[x]?.placeholder).length;
  // Statistik: zählt nur die Treffer von Filter und Suche, nicht die ausgegraut
  // eingeblendeten Obergruppen. Gruppenstämme = angezeigte Stämme mit mindestens einem Treffer.
  const hits = [...MATCH],
    inHier = new Set(M.hierarchieIds),
    alone = new Set(M.standalone),
    st = {
      hier: hits.filter((x) => inHier.has(x)).length,
      solo: hits.filter((x) => alone.has(x)).length,
      stems: M.roots.filter((x) => DISPLAY.has(x)).length,
      multi: hits.filter((x) => isMulti(M.byId[x])).length,
      links: hits.reduce((n, x) => n + (M.byId[x].parentIds || []).length, 0),
    };
  $("stats").innerHTML =
    `<span><b>${MATCH.size}${ctx ? "*" : ""} / ${M.groups.length}</b> Gruppen</span><span><b>${st.hier}</b> hierarchisch</span><span><b>${st.solo}</b> alleinstehend</span><span><b>${st.stems}</b> Gruppenstämme</span><span><b>${st.multi}</b> mit mehreren Obergruppen</span><span><b>${st.links}</b> Beziehungen</span>`;
  chips();
  renderForest();
  renderMulti();
  placeBack();
  save();
}
function mark(text) {
  let q = $("search").value.trim();
  text = String(text ?? "");
  if (!q) return esc(text);
  let low = text.toLowerCase(),
    needle = q.toLowerCase(),
    out = "",
    p = 0,
    i;
  while ((i = low.indexOf(needle, p)) >= 0) {
    out +=
      esc(text.slice(p, i)) +
      '<mark class="search-hit">' +
      esc(text.slice(i, i + q.length)) +
      "</mark>";
    p = i + q.length;
  }
  return out + esc(text.slice(p));
}
function hitInfo(g) {
  let h = searchHits(g),
    shown = new Set(["name", "groupType", "status", "visibility"]),
    hidden = h.filter((x) => !shown.has(x));
  if (!hidden.length) return "";
  let labels = {
    description: "Beschreibung",
    homepage: "Homepage",
    category: "Kategorie",
    campus: "Campus",
    meetingTime: "Treffzeit",
  };
  return hidden.length === 1
    ? `<span class="match-note">🔎 Treffer in ${labels[hidden[0]] || "Metadaten"}</span>`
    : `<span class="match-note">🔎 ${hidden.length} Metadaten-Treffer</span>`;
}
function tipAttrs(g) {
  return g.description ? ` data-tip="${encodeURIComponent(g.description)}"` : "";
}
function shownName(g) {
  return mark(g.name);
}
function nameEl(g, cls = "") {
  return g.placeholder
    ? `<span class="${cls} locked" title="Keine Berechtigung für diese Gruppe">🔒 ${esc(g.name)}</span>`
    : `<a class="${cls}" href="${esc(g.frontendUrl)}" target="_blank">${shownName(g)}</a>`;
}
function descIcon(g) {
  return g.description
    ? '<span class="desc-icon" aria-label="Beschreibung vorhanden">💬</span>'
    : "";
}
function badge(g) {
  if (g.placeholder) return `<span class="badge">Keine Berechtigung · ID ${esc(g.id)}</span>`;
  return `<span class="badge">${mark(g.groupTypeName)}</span><span class="badge status">${mark(g.groupStatusName)}</span><span class="badge">${mark(lv(g.visibility))}</span>`;
}
function line(g) {
  return `<div class="node ${searchHits(g).length ? "search-row" : ""}" data-gid="${g.id}" data-pid=""${tipAttrs(g)}><span class="sp"></span><a class="link" href="${esc(g.frontendUrl)}" target="_blank">${shownName(g)}</a>${descIcon(g)}${badge(g)}${hitInfo(g)}</div>`;
}

// ---- Mehrfachzuordnungen ----
function isMulti(g) {
  return (g?.parentIds || []).length > 1;
}
function gname(id) {
  let g = M.byId[id];
  return g ? (g.placeholder ? "🔒 " + g.name : g.name) : "ID " + id;
}
function multiHint(g, parent) {
  if (!isMulti(g)) return "";
  let others = g.parentIds.filter((p) => p !== parent);
  return `<span class="multi" title="${esc("Obergruppen: " + g.parentIds.map(gname).join(", "))}">🔗 auch unter: ${others.map((p) => jumpEl(p)).join(", ")}</span>`;
}
function jumpEl(id, tab = "", bold = false) {
  let t = esc(gname(id));
  return `<button class="jump" data-jump="${id}"${tab ? ` data-tab="${tab}"` : ""} title="In der App zu dieser Gruppe springen">${bold ? "<b>" + t + "</b>" : t}</button>`;
}
function dupHint(g, via) {
  return via && !isMulti(g)
    ? `<span class="dup" title="${esc("Wird mehrfach angezeigt, weil " + gname(via) + " mehrere Obergruppen hat")}">↻ mehrfach über ${esc(gname(via))}</span>`
    : "";
}
function paths(id, seen = new Set()) {
  let g = M.byId[id];
  if (!g || seen.has(id)) return [[id]];
  let ps = (g.parentIds || []).filter((p) => M.byId[p]);
  if (!ps.length) return [[id]];
  let ns = new Set(seen);
  ns.add(id);
  let out = [];
  for (let p of ps)
    for (let pt of paths(p, ns)) {
      out.push([...pt, id]);
      if (out.length >= 20) return out;
    }
  return out;
}
function renderMulti() {
  let L = M.groups
    .filter((g) => MATCH.has(g.id) && isMulti(g))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  $("multiCount").textContent = `${L.length} ${L.length === 1 ? "Gruppe" : "Gruppen"}`;
  $("multiList").innerHTML =
    L.map(
      (g) =>
        `<div class="mrow" data-gid="${g.id}"><div>${nameEl(g, "link")}${badge(g)}<span class="multi">🔗 ${g.parentIds.length} Obergruppen</span></div><ul class="mpaths">${g.parentIds
          .map(
            (p) =>
              `<li>${paths(p)
                .map(
                  (pt) =>
                    pt.map((x) => jumpEl(x, "tabList")).join(" › ") +
                    " › " +
                    jumpEl(g.id, "tabList", true),
                )
                .join("<br>")}</li>`,
          )
          .join("")}</ul></div>`,
    ).join("") || '<p class="empty">Keine passenden Gruppen mit mehreren Obergruppen.</p>';
}

// ---- Sprung zu Gruppen und Zurück ----
let BACK = [];
function curTab() {
  return ["tabList", "tabVis", "tabMulti"].find((t) => $(t).classList.contains("active"));
}
function openTab(t) {
  showTab(t);
  if (t === "tabVis") renderForest();
  if (t === "tabMulti") renderMulti();
  placeBack();
}
function filterState() {
  return {
    search: $("search").value,
    type: $("type").value,
    visibility: $("visibility").value,
    status: $("status").value,
    multiF: multiV(),
    cf: JSON.stringify(CF),
  };
}
function ancestors(id) {
  let out = new Set(),
    st = [...(M.byId[id]?.parentIds || [])];
  while (st.length) {
    let p = st.pop();
    if (out.has(p) || !M.byId[p]) continue;
    out.add(p);
    st.push(...(M.byId[p].parentIds || []));
  }
  return out;
}
function paneSel(t) {
  return t === "tabVis" ? "#forest" : t === "tabMulti" ? "#multiList" : "#tree";
}
function nameAnchor(el) {
  return el.querySelector(":scope>a,:scope>.link,:scope>.vname,:scope>.locked") || el;
}
function focusEl(el) {
  if (!el) return;
  (el.tagName === "LI" ? nameAnchor(el) : el).scrollIntoView({
    block: "center",
    inline: "center",
    behavior: "smooth",
  });
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 2200);
}
function targetEl(b) {
  return document.querySelector(`${paneSel(b.toTab)} [data-gid="${b.to}"]`);
}
function placeBack() {
  document.querySelectorAll(".backinline").forEach((x) => x.remove());
  let b = BACK[BACK.length - 1];
  if (!b || !M || curTab() !== b.toTab) return;
  let el = targetEl(b);
  if (!el) return;
  let btn = document.createElement("button");
  btn.className = "backinline";
  btn.dataset.back = "1";
  btn.title = "Zur Stelle vor dem Sprung zurück";
  btn.textContent = "↩ zurück zu " + gname(b.from.gid);
  nameAnchor(el).after(btn);
}
function jump(id, tab, from) {
  if (!M || !M.byId[id]) return;
  let cur = curTab(),
    t = tab || cur;
  if (t === "tabMulti") t = "tabList";
  BACK.push({ tab: cur, f: filterState(), from, to: id, toTab: t });
  if (!DISPLAY.has(id)) {
    ["search", "type", "visibility", "status"].forEach((x) => ($(x).value = ""));
    setMulti("");
    cfClear();
    render();
  }
  ancestors(id).forEach((x) => {
    expanded.add(x);
    vExpanded.add(x);
  });
  render();
  openTab(t);
  focusEl(targetEl(BACK[BACK.length - 1]));
}
function goBack() {
  let b = BACK.pop();
  if (!b || !M) {
    placeBack();
    return;
  }
  let f = b.f,
    fr = b.from;
  CF = JSON.parse(f.cf);
  cfRender();
  facets(f.type, f.visibility, f.status, f.multiF);
  $("search").value = f.search;
  if (fr.ctx !== "multi")
    ancestors(fr.gid).forEach((x) => {
      expanded.add(x);
      vExpanded.add(x);
    });
  render();
  openTab(b.tab);
  let sel =
    fr.ctx === "multi"
      ? `#multiList [data-gid="${fr.gid}"]`
      : `${fr.ctx === "forest" ? "#forest" : "#tree"} [data-gid="${fr.gid}"][data-pid="${fr.pid}"]`;
  focusEl(
    document.querySelector(sel) ||
      document.querySelector(`${paneSel(b.tab)} [data-gid="${fr.gid}"]`),
  );
}
function tnode(id, path, parent, via) {
  let g = M.byId[id];
  if (!g || path.has(id)) return "";
  let kids = g.childIds.filter((x) => DISPLAY.has(x)),
    open = expanded.has(id),
    np = new Set(path),
    nv = isMulti(g) ? id : via;
  np.add(id);
  return `<li class="node ${MATCH.has(id) ? "" : "context"} ${searchHits(g).length ? "search-row" : ""}" data-gid="${id}" data-pid="${parent ?? ""}"${tipAttrs(g)}>${kids.length ? `<button class="tog" data-tree="${id}">${open ? "−" : "+"}</button>` : '<span class="sp"></span>'}${nameEl(g, "link")}${cutBtn(g, parent)}${descIcon(g)}${badge(g)}${multiHint(g, parent)}${dupHint(g, via)}${hitInfo(g)}${kids.length ? `<ul class="${open ? "" : "hidden"}">${kids.map((x) => tnode(x, np, id, nv)).join("")}</ul>` : ""}</li>`;
}
// Wirksame Filter als [Feld, Beschriftung]
function activeFilters() {
  let a = [];
  if ($("search").value) a.push(["search", "Suche: " + $("search").value]);
  for (let [id, l] of [
    ["type", "Typ"],
    ["visibility", "Sichtbarkeit"],
    ["status", "Status"],
  ])
    if ($(id).value)
      a.push([id, l + ": " + $(id).selectedOptions[0].textContent.replace(/ \(\d+\)$/, "")]);
  if (multiV()) a.push(["multiF", "Nur Mehrfachzuordnung"]);
  let n = cfCount();
  if (n)
    a.push([
      "custom",
      CF_NAME
        ? CF_NAME + (cfKey(CF) === CF_BASE ? "" : " (geändert)")
        : `Eigener Filter (${n} ${n === 1 ? "Bedingung" : "Bedingungen"})`,
    ]);
  return a;
}
function chips() {
  let a = activeFilters();
  // zugeklappt: in der Kopfzeile zeigen, welche Filter wirken
  $("filterSummary").textContent =
    !filterOpen() && a.length ? `(${a.length} aktiv: ${a.map((x) => x[1]).join(", ")})` : "";
  $("chips").innerHTML = a.length
    ? a
        .map((x) => `<span class="chip">${esc(x[1])}<button data-clear="${x[0]}">×</button></span>`)
        .join("") + '<button id="reset" class="reset">Alle Filter zurücksetzen</button>'
    : "";
}

// ---- Eigene Filter: Eigenschaft – Bedingung – Wert, mit UND/ODER verschachtelbar ----
// Aufbau: { op: "and" | "or", items: [ { field, cmp, value } | { op, items } ] }
let CF = cfNew("and"),
  CF_NAME = "", // Name des geladenen bzw. zuletzt gespeicherten Filters
  CF_BASE = ""; // sein Inhalt, um Änderungen zu erkennen
// Inhalt ohne unvollständige Bedingungen – zum Erkennen echter Änderungen
function cfKey(grp) {
  let strip = (g) => ({
    op: g.op,
    items: g.items
      .map((x) => (x.items ? strip(x) : cfComplete(x) ? { field: x.field, cmp: x.cmp, value: cfNoValue(x) ? "" : String(x.value).trim() } : null))
      .filter((x) => x && (!x.items || x.items.length)),
  });
  return JSON.stringify(strip(grp));
}
function cfClear() {
  CF = cfNew("and");
  CF_NAME = CF_BASE = "";
  if ($("cfSaved")) $("cfSaved").value = "";
  cfRender();
}
function cfNew(op) {
  return { op, items: [] };
}
function cfValid(x) {
  return (
    x &&
    (x.op === "and" || x.op === "or") &&
    Array.isArray(x.items) &&
    x.items.every((i) => (i && i.items ? cfValid(i) : i && typeof i === "object"))
  );
}
const CF_CMPS = [
  ["is", "ist"],
  ["not", "ist nicht"],
  ["has", "enthält"],
  ["hasnot", "enthält nicht"],
  ["empty", "ist leer"],
  ["filled", "ist nicht leer"],
  ["gt", "größer als"],
  ["lt", "kleiner als"],
];
const cfNoValue = (c) => c.cmp === "empty" || c.cmp === "filled";
const cfComplete = (c) => !!c.field && (cfNoValue(c) || String(c.value ?? "").trim() !== "");
// Anzahl vollständiger Bedingungen (nur die wirken)
function cfCount(grp = CF) {
  return grp.items.reduce((n, x) => n + (x.items ? cfCount(x) : cfComplete(x) ? 1 : 0), 0);
}
function cfTest(g, c) {
  let v = g.fields ? g.fields[c.field] : undefined,
    s = v == null ? "" : String(v).toLowerCase(),
    w = String(c.value ?? "")
      .trim()
      .toLowerCase();
  switch (c.cmp) {
    case "empty":
      return s === "";
    case "filled":
      return s !== "";
    case "is":
      return s === w;
    case "not":
      return s !== w;
    case "has":
      return s.includes(w);
    case "hasnot":
      return !s.includes(w);
    case "gt":
    case "lt": {
      let a = parseFloat(s.replace(",", ".")),
        b = parseFloat(w.replace(",", "."));
      if (isNaN(a) || isNaN(b)) return false;
      return c.cmp === "gt" ? a > b : a < b;
    }
  }
  return true;
}
function cfMatch(g, grp = CF) {
  let items = grp.items.filter((x) => (x.items ? cfCount(x) > 0 : cfComplete(x)));
  if (!items.length) return true;
  let ok = (x) => (x.items ? cfMatch(g, x) : cfTest(g, x));
  return grp.op === "and" ? items.every(ok) : items.some(ok);
}
// Knoten über den Pfad (z. B. "0.2") finden; liefert [Knoten, Elterngruppe, Index]
function cfAt(path) {
  if (path === "") return [CF, null, -1];
  let parts = path.split(".").map(Number),
    node = CF,
    parent = null;
  for (let i of parts) {
    parent = node;
    node = node.items[i];
  }
  return [node, parent, parts[parts.length - 1]];
}
const cfSel = (val, list) =>
  list
    .map(([v, t]) => `<option value="${esc(v)}"${v === val ? " selected" : ""}>${esc(t)}</option>`)
    .join("");
function cfGroupHtml(grp, path) {
  let root = path === "";
  return `<div class="cf-group" data-cfpath="${path}">${
    grp.items.length || !root
      ? `<div class="cf-head"><select data-cf="op" aria-label="Verknüpfung">${cfSel(grp.op, [
          ["and", "Alle (UND)"],
          ["or", "Mindestens eine (ODER)"],
        ])}</select><span>${root ? "der folgenden Bedingungen müssen zutreffen" : "dieser Bedingungen"}</span>${
          root ? "" : '<button class="cf-del" data-cf="del" title="Untergruppe entfernen">✕</button>'
        }</div>`
      : ""
  }${grp.items
    .map((x, i) => {
      let p = root ? String(i) : path + "." + i;
      return x.items ? cfGroupHtml(x, p) : cfCondHtml(x, p);
    })
    .join(
      "",
    )}<div class="cf-add"><button class="light" data-cf="addc">＋ Bedingung</button><button class="light" data-cf="addg" title="Bedingungen, die mit eigener UND/ODER-Verknüpfung zusammengefasst werden">＋ Untergruppe</button></div></div>`;
}
// Vorhandene Werte einer Eigenschaft als Vorschläge für das Wertfeld
function cfValueOptions(key) {
  if (!M || !key) return "";
  let set = new Set();
  for (let g of M.groups) if (g.fields && g.fields[key] !== undefined) set.add(String(g.fields[key]));
  return [...set]
    .sort((a, b) => a.localeCompare(b, "de", { numeric: true }))
    .slice(0, 300)
    .map((v) => `<option value="${esc(v)}"></option>`)
    .join("");
}
const cfLabel = (key) => ((M ? M.fieldList : []).find((f) => f.key === key) || {}).label || "";
// Eigenschaft zum eingetippten bzw. ausgewählten Namen (Groß-/Kleinschreibung egal)
const cfKeyOf = (label) =>
  ((M ? M.fieldList : []).find((f) => f.label.toLowerCase() === label.trim().toLowerCase()) || {})
    .key || "";
function cfCondHtml(c, path) {
  let lid = "cfl-" + path.replace(/\./g, "-");
  return `<div class="cf-cond" data-cfpath="${path}"><input data-cf="field" class="cf-field" list="cfFields" aria-label="Eigenschaft" placeholder="Filter eingeben oder auswählen" value="${esc(cfLabel(c.field))}" /><select data-cf="cmp" aria-label="Bedingung">${cfSel(c.cmp, CF_CMPS)}</select>${
    cfNoValue(c)
      ? ""
      : `<input data-cf="value" aria-label="Wert" placeholder="Wert" list="${lid}" value="${esc(c.value ?? "")}" /><datalist id="${lid}">${cfValueOptions(c.field)}</datalist>`
  }<button class="cf-del" data-cf="del" title="Bedingung entfernen">✕</button></div>`;
}
function cfRender() {
  $("cfFields").innerHTML = (M ? M.fieldList : [])
    .map((f) => `<option value="${esc(f.label)}"></option>`)
    .join("");
  $("cfBox").innerHTML = cfGroupHtml(CF, "");
}
// Änderungen im Baukasten: Auswahl → neu aufbauen; Werteingabe → nur Ergebnis neu berechnen
$("cfBox").addEventListener("input", (e) => {
  let el = e.target.closest("[data-cf]"),
    box = e.target.closest("[data-cfpath]");
  if (!el || !box) return;
  let [node] = cfAt(box.dataset.cfpath),
    k = el.dataset.cf;
  if (k === "value") node.value = el.value;
  else if (k === "field") {
    // Eingabefeld zum Tippen oder Auswählen: erst ein vollständiger Name wählt die Eigenschaft
    let key = cfKeyOf(el.value);
    if (key === node.field) return;
    node.field = key;
    let dl = box.querySelector("datalist");
    if (dl) dl.innerHTML = cfValueOptions(key);
  } else if (k === "cmp" || k === "op") {
    node[k] = el.value;
    cfRender();
  } else return;
  BACK = [];
  if (M) render();
});
$("cfBox").addEventListener("click", (e) => {
  let el = e.target.closest("button[data-cf]"),
    box = e.target.closest("[data-cfpath]");
  if (!el || !box) return;
  let [node, parent, i] = cfAt(box.dataset.cfpath),
    k = el.dataset.cf;
  if (k === "addc") node.items.push({ field: "", cmp: "is", value: "" });
  else if (k === "addg") node.items.push({ op: node.op === "and" ? "or" : "and", items: [{ field: "", cmp: "is", value: "" }] });
  else if (k === "del" && parent) parent.items.splice(i, 1);
  else return;
  cfRender();
  BACK = [];
  if (M) render();
});

cfRender();

// ---- Eigene Filter mit Namen speichern (nur auf diesem Gerät) ----
const CF_STORE = "ctg_saved_filters";
function cfSavedList() {
  try {
    let l = JSON.parse(localStorage.getItem(CF_STORE) || "[]");
    return Array.isArray(l) ? l.filter((x) => x && typeof x.name === "string" && cfValid(x.cf)) : [];
  } catch {
    return [];
  }
}
function cfSavedWrite(l) {
  try {
    localStorage.setItem(CF_STORE, JSON.stringify(l));
    return true;
  } catch {
    return false;
  }
}
function cfSavedRender(sel = "") {
  let l = cfSavedList();
  $("cfSaved").innerHTML =
    `<option value="">${l.length ? "Gespeicherten Filter wählen …" : "Noch keine gespeicherten Filter"}</option>` +
    l.map((x) => `<option value="${esc(x.name)}"${x.name === sel ? " selected" : ""}>${esc(x.name)}</option>`).join("");
  $("cfDelete").disabled = !sel;
}
const cfMsg = (t) => ($("cfMsg").textContent = t);
$("cfSaved").onchange = () => {
  let name = $("cfSaved").value,
    f = cfSavedList().find((x) => x.name === name);
  $("cfDelete").disabled = !f;
  if (!f) {
    // „Gespeicherten Filter wählen …“: eigenen Filter leeren
    cfClear();
    $("cfName").value = "";
    cfMsg("");
    BACK = [];
    if (M) render();
    return;
  }
  CF = JSON.parse(JSON.stringify(f.cf));
  CF_NAME = f.name;
  CF_BASE = cfKey(CF);
  $("cfName").value = f.name;
  cfMsg("");
  cfRender();
  BACK = [];
  if (M) render();
};
$("cfSave").onclick = () => {
  let name = $("cfName").value.trim();
  if (!name) return cfMsg("Bitte einen Namen eingeben.");
  if (!cfCount()) return cfMsg("Der Filter hat noch keine vollständige Bedingung.");
  let l = cfSavedList(),
    i = l.findIndex((x) => x.name === name),
    e = { name, cf: JSON.parse(JSON.stringify(CF)) };
  if (i >= 0) l[i] = e;
  else l.push(e);
  l.sort((a, b) => a.name.localeCompare(b.name, "de"));
  if (!cfSavedWrite(l)) return cfMsg("Speichern ist in diesem Browser nicht möglich.");
  CF_NAME = name;
  CF_BASE = cfKey(CF);
  cfSavedRender(name);
  cfMsg(i >= 0 ? `„${name}“ aktualisiert.` : `„${name}“ gespeichert.`);
  if (M) chips();
};
$("cfDelete").onclick = () => {
  let name = $("cfSaved").value;
  if (!name) return;
  cfSavedWrite(cfSavedList().filter((x) => x.name !== name));
  cfSavedRender();
  cfMsg(`„${name}“ gelöscht. Der Filter selbst bleibt aktiv, bis du ihn leerst.`);
};
cfSavedRender();

// ---- Visualisierung ----
function renderForest() {
  let roots = M.roots.filter((x) => DISPLAY.has(x));
  $("forest").className = "forest " + mode;
  $("modeH").classList.toggle("active", mode === "horizontal");
  $("modeV").classList.toggle("active", mode === "vertical");
  $("forest").innerHTML =
    roots.map((id) => stem(id)).join("") || '<p class="empty">Keine passenden Gruppenstämme.</p>';
  let solos = M.standalone.filter((x) => MATCH.has(x));
  $("soloForest").innerHTML =
    solos.map((id) => stem(id)).join("") ||
    '<p class="empty">Keine passenden alleinstehenden Gruppen.</p>';
  $("visSoloCount").textContent = `${solos.length} ${solos.length === 1 ? "Gruppe" : "Gruppen"}`;
  $("visCount").textContent = `${roots.length} Gruppenstämme`;
  placeBack();
  fitIfNeeded();
  editAttrs();
}

// ---- Visualisierung: Zoomen und Verschieben ----
let ZOOM = 1,
  NEEDFIT = false;
const ZMIN = 0.1,
  ZMAX = 2,
  ZSTEP = 1.25;
const vArea = () => $("forest").parentElement;
// Zoomt auf z; der Punkt (cx, cy) im Fenster bleibt dabei an seiner Stelle (sonst die Mitte)
function setZoom(z, cx, cy) {
  let a = vArea(),
    r = a.getBoundingClientRect();
  z = Math.min(ZMAX, Math.max(ZMIN, z));
  let mx = cx == null ? a.clientWidth / 2 : cx - r.left,
    my = cy == null ? a.clientHeight / 2 : cy - r.top,
    px = (a.scrollLeft + mx) / ZOOM,
    py = (a.scrollTop + my) / ZOOM;
  ZOOM = z;
  $("forest").style.zoom = z;
  a.scrollLeft = px * z - mx;
  a.scrollTop = py * z - my;
  $("zoomVal").textContent = Math.round(z * 100) + " %";
}
// Nach dem Laden bzw. Umschalten einmal einpassen, sobald die Visualisierung sichtbar ist
function fitIfNeeded() {
  if (NEEDFIT && vArea().clientWidth) {
    NEEDFIT = false;
    zoomFit();
  }
}
// So weit herauszoomen, dass alle Gruppenstämme ganz zu sehen sind (höchstens 100 %)
function zoomFit() {
  let a = vArea(),
    f = $("forest"),
    cs = getComputedStyle(a);
  if (!a.clientWidth) return;
  f.style.zoom = 1;
  let w = f.scrollWidth,
    h = f.scrollHeight,
    aw = a.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    ah = a.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  ZOOM = 1;
  setZoom(Math.min(1, w ? aw / w : 1, h ? ah / h : 1));
  // Schrift wird beim Verkleinern nicht exakt mitskaliert: so lange nachregeln, bis alles passt
  for (let i = 0; i < 5; i++) {
    let r = Math.min(a.clientWidth / a.scrollWidth, a.clientHeight / a.scrollHeight);
    if (r >= 1) break;
    setZoom(ZOOM * r * 0.98);
  }
  a.scrollLeft = 0;
  a.scrollTop = 0;
}
$("zoomIn").onclick = () => setZoom(ZOOM * ZSTEP);
$("zoomOut").onclick = () => setZoom(ZOOM / ZSTEP);
$("zoomFit").onclick = () => zoomFit();
// Strg + Mausrad (auch Zwei-Finger-Geste auf dem Touchpad) zoomt; Mausrad allein scrollt
vArea().addEventListener(
  "wheel",
  (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(ZOOM * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
  },
  { passive: false },
);
// Ziehen mit gedrückter Maustaste verschiebt die Ansicht. Wer dabei auf einem Gruppennamen
// losgelassen hat, öffnet die Gruppe nicht versehentlich.
let PAN = null;
vArea().addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse" || e.button !== 0 || e.target.closest("button, input, select"))
    return;
  // im Bearbeiten-Modus verschiebt Ziehen auf einer Gruppe die Gruppe, nicht die Ansicht
  if (EDIT && e.target.closest("[draggable='true']")) return;
  let a = vArea();
  // nicht auf den Bildlaufleisten
  if (e.target === a && (e.offsetX >= a.clientWidth || e.offsetY >= a.clientHeight)) return;
  PAN = { x: e.clientX, y: e.clientY, l: a.scrollLeft, t: a.scrollTop, moved: false };
});
window.addEventListener("pointermove", (e) => {
  if (!PAN) return;
  let dx = e.clientX - PAN.x,
    dy = e.clientY - PAN.y;
  if (!PAN.moved && Math.hypot(dx, dy) < 5) return;
  PAN.moved = true;
  let a = vArea();
  a.classList.add("panning");
  a.scrollLeft = PAN.l - dx;
  a.scrollTop = PAN.t - dy;
  e.preventDefault();
});
window.addEventListener("pointerup", () => {
  if (!PAN) return;
  vArea().classList.remove("panning");
  if (PAN.moved) {
    // den Klick, der auf das Loslassen folgt, nicht als Klick auf eine Gruppe werten
    const eat = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("click", eat, { capture: true, once: true });
    setTimeout(() => {
      window.removeEventListener("click", eat, { capture: true });
      PAN = null;
    }, 0);
  } else PAN = null;
});
// Zwei Finger auseinander/zusammen (Handy, Tablet, Touchscreen) zoomen
let PINCH = null;
const fingers = (t) => ({
  d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY),
  x: (t[0].clientX + t[1].clientX) / 2,
  y: (t[0].clientY + t[1].clientY) / 2,
});
vArea().addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length === 2) PINCH = { ...fingers(e.touches), z: ZOOM };
  },
  { passive: true },
);
vArea().addEventListener(
  "touchmove",
  (e) => {
    if (!PINCH || e.touches.length !== 2) return;
    e.preventDefault();
    let f = fingers(e.touches);
    if (PINCH.d) setZoom((PINCH.z * f.d) / PINCH.d, f.x, f.y);
  },
  { passive: false },
);
vArea().addEventListener("touchend", (e) => {
  if (e.touches.length < 2) PINCH = null;
});
function stem(id) {
  let g = M.byId[id],
    kids = g.childIds.filter((x) => DISPLAY.has(x)),
    open = vExpanded.has(id);
  return `<section class="stem"><div class="stem-title ${MATCH.has(id) ? "" : "context"} ${searchHits(g).length ? "search-row" : ""}" data-gid="${id}" data-pid=""${tipAttrs(g)}>${kids.length ? `<button class="vtoggle" data-v="${id}">${open ? "−" : "+"}</button>` : ""}${nameEl(g)}${descIcon(g)}${hitInfo(g)}${metaLine(g)}</div><div class="stem-body">${open && kids.length ? `<div class="vchildren">${kids.map((x) => vitem(x, new Set([id]), id, 0)).join("")}</div>` : ""}</div></section>`;
}
// Zeile mit Gruppentyp, Status und Sichtbarkeit (bzw. Hinweis bei 🔒-Platzhaltern)
function metaLine(g) {
  return `<div class="vmeta info">${g.placeholder ? `Keine Berechtigung · ID ${esc(g.id)}` : `${mark(g.groupTypeName)} · ${mark(g.groupStatusName)} · ${mark(lv(g.visibility))}`}</div>`;
}
function vitem(id, path, parent, via) {
  let g = M.byId[id];
  if (!g || path.has(id)) return "";
  let np = new Set(path),
    nv = isMulti(g) ? id : via;
  np.add(id);
  let kids = g.childIds.filter((x) => DISPLAY.has(x)),
    open = vExpanded.has(id);
  return `<div class="vitem"><div class="vcard ${MATCH.has(id) ? "" : "context"} ${searchHits(g).length ? "search-row" : ""}" data-gid="${id}" data-pid="${parent ?? ""}"${tipAttrs(g)}>${kids.length ? `<button class="vtoggle" data-v="${id}">${open ? "−" : "+"}</button>` : ""}${nameEl(g, "vname")}${cutBtn(g, parent)}${descIcon(g)}${hitInfo(g)}${metaLine(g)}${isMulti(g) || (via && !isMulti(g)) ? `<div class="vmeta">${multiHint(g, parent)}${dupHint(g, via)}</div>` : ""}</div>${open && kids.length ? `<div class="vchildren">${kids.map((x) => vitem(x, np, id, nv)).join("")}</div>` : ""}</div>`;
}

// ---- Bedienelemente und Ereignisse ----
function closeModal() {
  if (M) $("modal").classList.add("hidden");
}
function friendly(e) {
  let m = e.message || String(e);
  if (/Verbindungsfehler \(CORS\)/.test(m))
    m =
      "Keine Verbindung zu CT. Entweder ist die CT-Adresse falsch, oder ein CT-Admin muss diese " +
      "Webseite erst freigeben: System-Einstellungen → Integrationen → Cross-Origin-Ressource-" +
      "Sharing, Eintrag „" +
      location.origin +
      "“.";
  else if (CT_MODE === "extension" && /401|unauthor/i.test(m))
    m = "Nicht angemeldet. Bitte in CT neu anmelden und die Seite neu laden.";
  else if (/401|unauthor/i.test(m))
    m = "Anmeldung fehlgeschlagen. Bitte prüfe deinen CT Login-Token.";
  else if (/403|forbidden/i.test(m))
    m = "Zugriff verweigert. Bitte prüfe die Berechtigungen des verwendeten CT-Benutzers.";
  else if (
    /Verbindungsfehler|timed out|refused|name or service|temporary failure|Failed to fetch|NetworkError/i.test(
      m,
    )
  )
    m = "CT-Instanz nicht erreichbar. Bitte prüfe die CT-Adresse und deine Netzwerkverbindung.";
  return m;
}
async function runLoad(btn, fresh) {
  try {
    btn.disabled = true;
    await load(fresh);
  } catch (e) {
    let m = friendly(e);
    $("msg").textContent = "✗ " + m;
    $("msg").className = "bad";
    if (!M) $("modal").classList.remove("hidden");
    if (M) {
      $("conn").textContent = "✗ Aktualisierung fehlgeschlagen: " + m;
      $("conn").className = "bad";
    }
  } finally {
    btn.disabled = false;
  }
}
$("connect").onclick = () => runLoad($("connect"), true);
$("refresh").onclick = () => runLoad($("refresh"));
$("disconnect").onclick = () => {
  REQ++;
  clearData();
  $("token").value = "";
  resetPrefs($("base").value.trim());
  $("msg").textContent = "Getrennt. Alle geladenen Daten wurden gelöscht.";
  $("msg").className = "note";
};
function closeNamed(id) {
  $(id).classList.add("hidden");
}
function openAbout() {
  $("about").classList.remove("hidden");
}
$("aboutBtn").onclick = openAbout;
$("aboutClose").onclick = () => closeNamed("about");
$("about").addEventListener("click", (e) => {
  if (e.target === $("about")) closeNamed("about");
});
document.querySelectorAll("[data-legal]").forEach((b) => (b.onclick = openAbout));
$("welcomeGo").onclick = () => {
  localStorage.setItem("ctg_welcome_v10", "1");
  closeNamed("welcome");
  $("modal").classList.remove("hidden");
};
if (!localStorage.getItem("ctg_welcome_v10")) {
  $("modal").classList.add("hidden");
  $("welcome").classList.remove("hidden");
}
$("settingsBtn").onclick = () => $("modal").classList.remove("hidden");
$("close").onclick = closeModal;
$("modal").onclick = (e) => {
  if (e.target === $("modal")) closeModal();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeNamed("about");
  }
});
function expandableVisible() {
  return [...DISPLAY].filter((id) => (M.byId[id]?.childIds || []).some((c) => DISPLAY.has(c)));
}
function expandAllBoth() {
  let ids = expandableVisible();
  ids.forEach((x) => expanded.add(x));
  vExpanded = new Set(ids);
  render();
}
function collapseAllBoth() {
  expanded.clear();
  vExpanded.clear();
  render();
}
$("expand").onclick = () => {
  BACK = [];
  expandAllBoth();
};
$("collapse").onclick = () => {
  BACK = [];
  collapseAllBoth();
};
$("print").onclick = () => print();
["search", "type", "visibility", "status", "multiF"].forEach((x) =>
  $(x).addEventListener(x === "search" ? "input" : "change", () => {
    BACK = [];
    render();
  }),
);
// Filterbereich auf-/zuklappen; der Zustand wird auf dem Gerät gemerkt (Start: zugeklappt)
const filterOpen = () => $("filterToggle").getAttribute("aria-expanded") === "true";
function setFilterOpen(open) {
  $("filterToggle").setAttribute("aria-expanded", String(open));
  $("filterBody").classList.toggle("hidden", !open);
  try {
    localStorage.setItem("ctg_filter_open", open ? "1" : "0");
  } catch {
    // ohne Speicher gilt der Zustand nur bis zum Schließen
  }
  if (M) chips();
}
$("filterToggle").onclick = () => setFilterOpen(!filterOpen());
// Zusatzinfos (Gruppentyp, Status, Sichtbarkeit) ein-/ausblenden; ebenfalls gemerkt
function setShowMeta(on) {
  $("showMeta").checked = on;
  document.querySelector("main").classList.toggle("no-meta", !on);
  try {
    localStorage.setItem("ctg_show_meta", on ? "1" : "0");
  } catch {
    // s. o.
  }
}
$("showMeta").onchange = () => setShowMeta($("showMeta").checked);
{
  let o = null,
    m = null;
  try {
    o = localStorage.getItem("ctg_filter_open");
    m = localStorage.getItem("ctg_show_meta");
  } catch {
    // s. o.
  }
  setFilterOpen(o === "1");
  setShowMeta(m !== "0");
}
function showTab(t) {
  [
    ["tabList", "listPane"],
    ["tabVis", "visPane"],
    ["tabMulti", "multiPane"],
  ].forEach(([b, p]) => {
    $(b).classList.toggle("active", b === t);
    $(p).classList.toggle("hidden", b !== t);
  });
}
$("tabList").onclick = () => showTab("tabList");
$("tabVis").onclick = () => {
  showTab("tabVis");
  renderForest();
};
$("tabMulti").onclick = () => {
  showTab("tabMulti");
  renderMulti();
};
$("modeH").onclick = () => {
  mode = "horizontal";
  NEEDFIT = true;
  renderForest();
  save();
};
$("modeV").onclick = () => {
  mode = "vertical";
  NEEDFIT = true;
  renderForest();
  save();
};
let tipTimer = null;
document.addEventListener("mouseover", (e) => {
  let el = e.target.closest("[data-tip]");
  if (!el) return;
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => {
    let text = decodeURIComponent(el.dataset.tip || "");
    if (!text) return;
    let t = $("tooltip");
    t.innerHTML = mark(text);
    t.classList.remove("hidden");
    let r = el.getBoundingClientRect(),
      x = Math.min(window.innerWidth - 450, r.left),
      y = Math.min(window.innerHeight - 140, r.bottom + 8);
    t.style.left = Math.max(8, x) + "px";
    t.style.top = Math.max(8, y) + "px";
  }, 300);
});
document.addEventListener("mouseout", (e) => {
  let el = e.target.closest("[data-tip]");
  if (el) {
    clearTimeout(tipTimer);
    $("tooltip").classList.add("hidden");
  }
});
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-back]")) {
    goBack();
    return;
  }
  let j = e.target.closest("[data-jump]");
  if (j) {
    e.preventDefault();
    let o = j.closest("[data-gid]"),
      ctx = j.closest("#multiList") ? "multi" : j.closest("#forest") ? "forest" : "tree";
    jump(+j.dataset.jump, j.dataset.tab, {
      gid: o ? +o.dataset.gid : +j.dataset.jump,
      pid: o ? o.dataset.pid || "" : "",
      ctx,
    });
    return;
  }
  let c = e.target.closest("[data-clear]");
  if (c) {
    BACK = [];
    if (c.dataset.clear === "multiF") setMulti("");
    else if (c.dataset.clear === "custom") {
      cfClear();
    } else $(c.dataset.clear).value = "";
    render();
    return;
  }
  if (e.target.id === "reset") {
    BACK = [];
    $("search").value = "";
    $("type").value = "";
    $("visibility").value = "";
    $("status").value = ""; // wirklich alle Gruppen (beim Start gilt weiter „aktiv“)
    setMulti("");
    cfClear();
    render();
    return;
  }
  let t = e.target.closest("[data-tree]");
  if (t) {
    BACK = [];
    let id = +t.dataset.tree;
    expanded.has(id) ? expanded.delete(id) : expanded.add(id);
    render();
    return;
  }
  let v = e.target.closest("[data-v]");
  if (v) {
    BACK = [];
    let id = +v.dataset.v;
    vExpanded.has(id) ? vExpanded.delete(id) : vExpanded.add(id);
    renderForest();
  }
});

// ---- Version, Verbindung zum lokalen Server (Lebenszeichen), Programmende ----
const VER = "__CT_VERSION__",
  // Anzeige „Version 1.0“; der Tag heißt intern „v1.0“
  VER_LABEL = VER.startsWith("__") ? "Entwicklungsversion" : "Version " + VER.replace(/^v/, "");
document.title = "CT Gruppenhierarchie " + VER_LABEL;
document.querySelectorAll(".app-version").forEach((e) => (e.textContent = VER_LABEL));
const CID = Math.random().toString(36).slice(2) + Date.now().toString(36);
let ENDED = false,
  HB = null;
function srv(path, keep) {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: CID }),
    keepalive: !!keep,
    cache: "no-store",
  });
}
function ended(text) {
  if (ENDED) return;
  ENDED = true;
  clearInterval(HB);
  REQ++;
  clearData();
  $("token").value = "";
  ["modal", "about", "welcome", "idleWarn"].forEach((x) => $(x).classList.add("hidden"));
  $("endedText").textContent = text;
  $("ended").classList.remove("hidden");
}
async function beat() {
  if (ENDED) return;
  try {
    let j = await (await srv("/ping")).json();
    if (j.version && j.version !== VER) {
      srv("/bye", true);
      ended(
        `Es wurde eine neue Version (${j.version}) gestartet. Dieser Tab kann geschlossen werden.`,
      );
    }
  } catch (e) {
    ended(
      "Das Programm läuft nicht mehr. Bitte das Programm neu starten. Dieser Tab kann geschlossen werden.",
    );
  }
}
// Desktop-App: Links (z. B. zu Gruppen in CT) im normalen Browser öffnen
if (CT_MODE === "tauri") {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='http']");
    if (!a) return;
    e.preventDefault();
    globalThis.__TAURI__.opener.openUrl(a.href);
  });
}

// Nur die Python-Version hat einen lokalen Server, der Lebenszeichen braucht
if (CT_MODE === "proxy") {
  HB = setInterval(beat, 20000);
  beat();
  addEventListener("pagehide", () => {
    if (!ENDED) srv("/bye", true);
  });
  addEventListener("pageshow", (e) => {
    if (e.persisted) beat();
  });
}

// ---- Sitzungs-Timeout bei Inaktivität ----
const IDLE_WARN = 58 * 60e3,
  IDLE_END = 60 * 60e3;
let lastAct = Date.now();
function act(e) {
  let w = !$("idleWarn").classList.contains("hidden");
  if (w && e && ["mousemove", "scroll", "wheel"].includes(e.type)) return;
  lastAct = Date.now();
  if (w) $("idleWarn").classList.add("hidden");
}
["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart"].forEach((ev) =>
  addEventListener(ev, act, { passive: true, capture: true }),
);
$("idleGo").onclick = act;
function idleCheck() {
  // In der Extension regelt CT selbst die Anmeldung
  if (!M || ENDED || CT_MODE === "extension") return;
  let idle = Date.now() - lastAct;
  if (idle >= IDLE_END) {
    REQ++;
    clearData();
    $("token").value = "";
    resetPrefs($("base").value.trim());
    $("idleWarn").classList.add("hidden");
    $("msg").textContent = "Sitzung wegen Inaktivität beendet. Bitte erneut verbinden.";
    $("msg").className = "bad";
    $("modal").classList.remove("hidden");
  } else if (idle >= IDLE_WARN) $("idleWarn").classList.remove("hidden");
}
setInterval(idleCheck, 5000);

// ---- Bearbeiten: Gruppen in CT umhängen (Version 2.0, nur in der CT-Extension) ----
// Ziehen auf eine Gruppe = dort einordnen; ✂ bzw. Ablagefläche = von der Obergruppe lösen.
// Geschrieben wird nur über ctChangeParents (ct-daten.js), immer erst nach der Rückfrage.
let EDIT = false,
  DRAG = null,
  PENDING = null;
// Ziehbare Gruppen und Ablageziele: Übersicht (Baum, alleinstehende) und Visualisierung
const EDIT_SEL =
  "#tree li[data-gid], #stand .node[data-gid], #forest .vcard, #forest .stem-title, #soloForest .stem-title";
function cutBtn(g, parent) {
  let p = parent != null && parent !== "" && M.byId[parent];
  if (!CT_WRITE || g.placeholder || !p || p.placeholder) return "";
  return `<button class="cut" data-cut="${g.id}" data-from="${parent}" title="Von „${esc(p.name)}“ lösen" aria-label="Von Obergruppe lösen">✂</button>`;
}
function setEdit(on) {
  EDIT = on && CT_WRITE;
  $("editBtn").setAttribute("aria-pressed", String(EDIT));
  $("editBtn").textContent = EDIT ? "✓ Bearbeiten beenden" : "✎ Bearbeiten";
  $("editBar").classList.toggle("hidden", !EDIT);
  undoRender();
  document.querySelector("main").classList.toggle("editing", EDIT);
  if (M) editAttrs();
}
$("editBtn").onclick = () => setEdit(!EDIT);
// Ziehbare Gruppen markieren (nach jedem Neuaufbau der Anzeige)
function editAttrs() {
  document
    .querySelectorAll(EDIT_SEL)
    .forEach((el) => {
      let g = M && M.byId[el.dataset.gid];
      if (EDIT && g && !g.placeholder) el.setAttribute("draggable", "true");
      else el.removeAttribute("draggable");
    });
}
// Liegt b unterhalb von a (oder ist b = a)?
function isBelow(a, b) {
  let seen = new Set(),
    st = [a];
  while (st.length) {
    let x = st.pop();
    if (x === b) return true;
    if (seen.has(x)) continue;
    seen.add(x);
    st.push(...((M.byId[x] || {}).childIds || []));
  }
  return false;
}
const dropTarget = (e) => {
  let el = e.target.closest(EDIT_SEL);
  return el && M.byId[el.dataset.gid] && !M.byId[el.dataset.gid].placeholder ? el : null;
};
// Warum ein Ablegen nicht geht (sonst "")
function dropProblem(target) {
  if (!DRAG) return "nichts gezogen";
  if (target === DRAG.gid) return "Eine Gruppe kann nicht unter sich selbst eingeordnet werden.";
  if (isBelow(DRAG.gid, target))
    return `„${gname(target)}“ ist eine Untergruppe von „${gname(DRAG.gid)}“ – das ergäbe einen Kreis.`;
  if ((M.byId[DRAG.gid].parentIds || []).includes(target))
    return `„${gname(target)}“ ist bereits Obergruppe von „${gname(DRAG.gid)}“.`;
  return "";
}
document.addEventListener("dragstart", (e) => {
  if (!EDIT) return;
  let el = e.target.closest && e.target.closest("[draggable='true'][data-gid]");
  if (!el) return;
  DRAG = { gid: +el.dataset.gid, from: el.dataset.pid ? +el.dataset.pid : null, el };
  el.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", gname(DRAG.gid));
});
document.addEventListener("dragend", () => {
  if (DRAG) DRAG.el.classList.remove("dragging");
  DRAG = null;
  document.querySelectorAll(".drop-ok, .drop-no").forEach((x) => x.classList.remove("drop-ok", "drop-no"));
});
document.addEventListener("dragover", (e) => {
  if (!EDIT || !DRAG) return;
  document.querySelectorAll(".drop-ok, .drop-no").forEach((x) => x.classList.remove("drop-ok", "drop-no"));
  if (e.target.closest("#dropRoot")) {
    e.preventDefault();
    $("dropRoot").classList.add("drop-ok");
    return;
  }
  let el = dropTarget(e);
  if (!el) return;
  if (dropProblem(+el.dataset.gid)) el.classList.add("drop-no");
  else {
    el.classList.add("drop-ok");
    e.preventDefault(); // Ablegen erlauben
  }
});
document.addEventListener("drop", (e) => {
  if (!EDIT || !DRAG) return;
  e.preventDefault();
  let d = DRAG;
  if (e.target.closest("#dropRoot")) return askCut(d.gid, d.from);
  let el = dropTarget(e);
  if (!el) return;
  let t = +el.dataset.gid,
    p = dropProblem(t);
  if (p) return toast(p, true);
  askMove(d.gid, d.from, t);
});
function choice(v, text, checked) {
  return `<label><input type="radio" name="editChoice" value="${v}"${checked ? " checked" : ""} /><span>${text}</span></label>`;
}
function openEdit(title, choicesHtml, action) {
  PENDING = action;
  $("editTitle").textContent = title;
  $("editChoices").innerHTML = choicesHtml;
  $("editDlg").classList.remove("hidden");
  $("editGo").focus();
}
function askMove(gid, from, to) {
  let n = `„${esc(gname(gid))}“`,
    z = `„${esc(gname(to))}“`;
  openEdit(
    `${gname(gid)} unter ${gname(to)} einordnen?`,
    (from != null
      ? choice("move", `<b>Verschieben:</b> von „${esc(gname(from))}“ nach ${z}`, true) +
        choice("add", `<b>Zusätzlich</b> unter ${z} einordnen („${esc(gname(from))}“ bleibt Obergruppe)`)
      : choice("add", `${n} unter ${z} einordnen`, true)) +
      `<p class="note">Alle Untergruppen von ${n} ziehen mit.</p>`,
    (c) => ({
      gid,
      add: [to],
      remove: c === "move" && from != null ? [from] : [],
      what: c === "move" ? "verschoben" : "eingeordnet",
      label:
        c === "move" && from != null
          ? `„${gname(gid)}“ von „${gname(from)}“ nach „${gname(to)}“ verschoben`
          : `„${gname(gid)}“ ${from != null ? "zusätzlich " : ""}unter „${gname(to)}“ eingeordnet`,
    }),
  );
}
function askCut(gid, from) {
  if (from == null) return toast(`„${gname(gid)}“ hat an dieser Stelle keine Obergruppe.`, true);
  let rest = (M.byId[gid].parentIds || []).filter((p) => p !== from);
  openEdit(
    `${gname(gid)} von ${gname(from)} lösen?`,
    `<p>„${esc(gname(gid))}“ wird von „${esc(gname(from))}“ gelöst.${
      rest.length
        ? ` Weitere Obergruppen bleiben: ${rest.map((p) => "„" + esc(gname(p)) + "“").join(", ")}.`
        : " Sie hat danach keine Obergruppe mehr und wird zum Gruppenstamm bzw. zur alleinstehenden Gruppe."
    }</p>`,
    () => ({ gid, add: [], remove: [from], what: "gelöst", label: `„${gname(gid)}“ von „${gname(from)}“ gelöst` }),
  );
}
$("editCancel").onclick = () => {
  $("editDlg").classList.add("hidden");
  PENDING = null;
};
$("editGo").onclick = async () => {
  if (!PENDING) return;
  let c = (document.querySelector('input[name="editChoice"]:checked') || {}).value,
    op = PENDING(c);
  PENDING = null;
  $("editDlg").classList.add("hidden");
  $("toast").classList.add("hidden");
  $("editGo").disabled = true;
  let before = M.byId[op.gid].parentIds || [];
  try {
    remember(op, before, await ctChangeParents(M, op.gid, op.add, op.remove, before));
    // neue Obergruppe aufklappen, damit man das Ergebnis gleich sieht
    op.add.forEach((p) => {
      expanded.add(p);
      vExpanded.add(p);
    });
    save();
    toast(`✓ „${gname(op.gid)}“ wurde in CT ${op.what}.`);
  } catch (e) {
    if (e.parents) remember(op, before, e.parents); // teilweise übernommen: das Geschehene merken
    toast("✗ " + e.message, true);
  } finally {
    $("editGo").disabled = false;
  }
  await runLoad($("refresh")); // Anzeige mit dem neuen Stand aus CT
};

// ---- Zurück: Änderungen dieser Sitzung zurücknehmen (wie in Word/Excel) ----
// Jeder Eintrag merkt sich, welche Obergruppen tatsächlich hinzugekommen bzw. weggefallen
// sind. Zurücknehmen = genau das Gegenteil, mit derselben Prüfung des aktuellen Stands.
// Die Liste gilt bis zum Schließen oder Neuladen der Seite.
let UNDO = [];
function remember(op, before, after) {
  let add = after.filter((p) => !before.includes(p)),
    remove = before.filter((p) => !after.includes(p));
  if (add.length || remove.length) UNDO.push({ gid: op.gid, add, remove, label: op.label });
  undoRender();
}
function undoRender() {
  $("undoWrap").classList.toggle("hidden", !CT_WRITE || (!EDIT && !UNDO.length));
  $("undoBtn").disabled = $("undoMenuBtn").disabled = !UNDO.length;
  $("undoBtn").title = UNDO.length
    ? "Zurücknehmen: " + UNDO[UNDO.length - 1].label
    : "Keine Änderung zum Zurücknehmen";
  $("undoMenu").innerHTML = UNDO.length
    ? '<div class="undo-head">Zurücknehmen bis einschließlich:</div>' +
      UNDO.map((u, i) => `<button class="undo-item" data-undo="${i}">${esc(u.label)}</button>`)
        .reverse()
        .join("")
    : "";
  if (!UNDO.length) $("undoMenu").classList.add("hidden");
}
// Nimmt alle Änderungen ab Index i (bis zur neuesten) zurück, die neueste zuerst
async function undoTo(i) {
  $("undoMenu").classList.add("hidden");
  $("toast").classList.add("hidden");
  $("undoBtn").disabled = $("undoMenuBtn").disabled = true;
  let done = 0,
    err = null;
  while (UNDO.length > i) {
    let u = UNDO[UNDO.length - 1];
    try {
      await ctChangeParents(M, u.gid, u.remove, u.add, M.byId[u.gid].parentIds || []);
      UNDO.pop();
      done++;
      await load(); // neuer Stand aus CT als Grundlage für den nächsten Schritt
    } catch (e) {
      err = e;
      break;
    }
  }
  if (err) toast(`✗ ${done ? done + " Änderung(en) zurückgenommen, dann: " : ""}${err.message}`, true);
  else toast(done === 1 ? "↶ Zurückgenommen." : `↶ ${done} Änderungen zurückgenommen.`);
  await runLoad($("refresh"));
  undoRender();
}
$("undoBtn").onclick = () => UNDO.length && undoTo(UNDO.length - 1);
$("undoMenuBtn").onclick = (e) => {
  e.stopPropagation();
  $("undoMenu").classList.toggle("hidden");
};
$("undoMenu").addEventListener("click", (e) => {
  let b = e.target.closest("[data-undo]");
  if (b) undoTo(+b.dataset.undo);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#undoWrap")) $("undoMenu").classList.add("hidden");
});
document.addEventListener("click", (e) => {
  let b = e.target.closest("[data-cut]");
  if (!b || !EDIT) return;
  e.preventDefault();
  e.stopPropagation();
  askCut(+b.dataset.cut, +b.dataset.from);
});
let toastTimer = null;
function toast(text, bad) {
  let t = $("toast");
  t.textContent = text;
  t.classList.toggle("bad", !!bad);
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), bad ? 9000 : 4000);
}

// ---- CT-Extension: sofort mit der Anmeldung des Nutzers in CT laden ----
if (CT_MODE === "extension") {
  // In CT sitzt die App in einem eigenen Bereich (#ctgh); dort die Kennzeichnung setzen
  (document.getElementById("ctgh") || document.body).classList.add("extension");
  $("betaNote").classList.remove("hidden"); // Beta-Hinweis im Über-Dialog
  $("extPrivacy").classList.remove("hidden"); // eigener Datenschutz-Text für die Extension
  if (CT_WRITE) $("editBtn").classList.remove("hidden"); // Version 2.0: Bearbeiten
  $("welcome").classList.add("hidden");
  $("modal").classList.add("hidden");
  runLoad($("refresh"), true);
}

// ---- Desktop-App: Auto-Updater (abschaltbar im Über-Dialog) ----
// Die Updates sind signiert; die App installiert nur Versionen mit gültiger Unterschrift.
function updAutoOn() {
  try {
    return localStorage.getItem("ctg_update_auto") !== "aus";
  } catch {
    return true;
  }
}
async function checkUpdate(manual) {
  const set = (t) => ($("updStatus").textContent = t);
  if (manual) set("Suche …");
  let upd;
  try {
    upd = await globalThis.__TAURI__.updater.check();
  } catch (e) {
    if (manual) set("Suche fehlgeschlagen: " + e);
    return;
  }
  if (!upd) {
    if (manual) set("Die App ist aktuell.");
    return;
  }
  if (manual) set("");
  $("updateText").textContent =
    `Version ${upd.version} ist verfügbar (installiert: ${VER_LABEL}). ` +
    "Die App wird dafür kurz beendet und neu gestartet.";
  $("updateDlg").classList.remove("hidden");
  $("updateLater").onclick = () => $("updateDlg").classList.add("hidden");
  $("updateGo").onclick = async () => {
    $("updateGo").disabled = true;
    $("updateText").textContent = "Update wird geladen und installiert …";
    try {
      await upd.downloadAndInstall();
      await globalThis.__TAURI__.process.relaunch();
    } catch (e) {
      $("updateText").textContent = "Update fehlgeschlagen: " + e;
      $("updateGo").disabled = false;
    }
  };
}
if (CT_MODE === "tauri") {
  $("updBox").classList.remove("hidden");
  $("updAuto").checked = updAutoOn();
  $("updAuto").onchange = () => {
    try {
      localStorage.setItem("ctg_update_auto", $("updAuto").checked ? "an" : "aus");
    } catch {
      // ohne Speicher gilt die Einstellung nur bis zum Schließen
    }
  };
  $("updNow").onclick = () => checkUpdate(true);
  if (updAutoOn() && !VER.startsWith("__")) setTimeout(() => checkUpdate(false), 2000);
}
