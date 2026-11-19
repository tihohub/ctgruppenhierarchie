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
mode = P.mode || "horizontal";
function save() {
  localStorage.setItem(
    "ctv10",
    JSON.stringify({
      base: $("base").value,
      type: $("type").value,
      visibility: $("visibility").value,
      status: $("status").value,
      multi: $("multiF").value,
      search: $("search").value,
      expanded: [...expanded],
      mode,
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
  let base = $("base").value.trim(),
    token = $("token").value.trim();
  if (!base) throw Error("Bitte CT-Adresse eingeben, z. B. https://deine-gemeinde.church.tools");
  if (!token) throw Error("Bitte Login-Token eingeben.");
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
  let mm = $("multiF").value;
  if (except !== "multi" && mm && !isMulti(g)) return false;
  return true;
}
function facets(
  t = $("type").value,
  v = $("visibility").value,
  s = $("status").value,
  mm = $("multiF").value,
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
  $("multiF").innerHTML =
    opt("", `Alle (${M.groups.filter((g) => match(g, "multi")).length})`) +
    opt(
      "multi",
      `Nur mit mehreren Obergruppen (${M.groups.filter((g) => match(g, "multi") && isMulti(g)).length})`,
    );
  $("type").value = t;
  $("visibility").value = v;
  $("status").value = s;
  $("multiF").value = mm;
}
function setup(first) {
  P = prefs();
  $("search").value = P.search || "";
  expanded = new Set((P.expanded || []).map(Number));
  facets(P.type || "", P.visibility || "", P.status || "", P.multi || "");
  render();
  if (first && (!P.expanded || !P.expanded.length)) {
    expandAllBoth();
  }
}

// ---- Anzeige: Übersicht (Baum) und Statistik ----
function render() {
  let sel = [$("type").value, $("visibility").value, $("status").value, $("multiF").value];
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
  return `<div class="node ${searchHits(g).length ? "search-row" : ""}"${tipAttrs(g)}><span class="sp"></span><a class="link" href="${esc(g.frontendUrl)}" target="_blank">${shownName(g)}</a>${descIcon(g)}${badge(g)}${hitInfo(g)}</div>`;
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
    multiF: $("multiF").value,
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
    ["search", "type", "visibility", "status", "multiF"].forEach((x) => ($(x).value = ""));
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
  return `<li class="node ${MATCH.has(id) ? "" : "context"} ${searchHits(g).length ? "search-row" : ""}" data-gid="${id}" data-pid="${parent ?? ""}"${tipAttrs(g)}>${kids.length ? `<button class="tog" data-tree="${id}">${open ? "−" : "+"}</button>` : '<span class="sp"></span>'}${nameEl(g, "link")}${descIcon(g)}${badge(g)}${multiHint(g, parent)}${dupHint(g, via)}${hitInfo(g)}${kids.length ? `<ul class="${open ? "" : "hidden"}">${kids.map((x) => tnode(x, np, id, nv)).join("")}</ul>` : ""}</li>`;
}
function chips() {
  let a = [];
  if ($("search").value) a.push(["search", "Suche: " + $("search").value]);
  for (let id of ["type", "visibility", "status", "multiF"])
    if ($(id).value) a.push([id, $(id).selectedOptions[0].textContent.replace(/ \(\d+\)$/, "")]);
  $("chips").innerHTML = a.length
    ? a
        .map((x) => `<span class="chip">${esc(x[1])}<button data-clear="${x[0]}">×</button></span>`)
        .join("") + '<button id="reset" class="reset">Alle Filter zurücksetzen</button>'
    : "";
}

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
}
function stem(id) {
  let g = M.byId[id],
    kids = g.childIds.filter((x) => DISPLAY.has(x)),
    open = vExpanded.has(id);
  return `<section class="stem"><div class="stem-title ${MATCH.has(id) ? "" : "context"} ${searchHits(g).length ? "search-row" : ""}" data-gid="${id}" data-pid=""${tipAttrs(g)}>${kids.length ? `<button class="vtoggle" data-v="${id}">${open ? "−" : "+"}</button>` : ""}${nameEl(g)}${descIcon(g)}${hitInfo(g)}${metaLine(g)}</div><div class="stem-body">${open && kids.length ? `<div class="vchildren">${kids.map((x) => vitem(x, new Set([id]), id, 0)).join("")}</div>` : ""}</div></section>`;
}
// Zeile mit Gruppentyp, Status und Sichtbarkeit (bzw. Hinweis bei 🔒-Platzhaltern)
function metaLine(g) {
  return `<div class="vmeta">${g.placeholder ? `Keine Berechtigung · ID ${esc(g.id)}` : `${mark(g.groupTypeName)} · ${mark(g.groupStatusName)} · ${mark(lv(g.visibility))}`}</div>`;
}
function vitem(id, path, parent, via) {
  let g = M.byId[id];
  if (!g || path.has(id)) return "";
  let np = new Set(path),
    nv = isMulti(g) ? id : via;
  np.add(id);
  let kids = g.childIds.filter((x) => DISPLAY.has(x)),
    open = vExpanded.has(id);
  return `<div class="vitem"><div class="vcard ${MATCH.has(id) ? "" : "context"} ${searchHits(g).length ? "search-row" : ""}" data-gid="${id}" data-pid="${parent ?? ""}"${tipAttrs(g)}>${kids.length ? `<button class="vtoggle" data-v="${id}">${open ? "−" : "+"}</button>` : ""}${nameEl(g, "vname")}${descIcon(g)}${hitInfo(g)}${metaLine(g)}${isMulti(g) || (via && !isMulti(g)) ? `<div class="vmeta">${multiHint(g, parent)}${dupHint(g, via)}</div>` : ""}</div>${open && kids.length ? `<div class="vchildren">${kids.map((x) => vitem(x, np, id, nv)).join("")}</div>` : ""}</div>`;
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
  renderForest();
  save();
};
$("modeV").onclick = () => {
  mode = "vertical";
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
    $(c.dataset.clear).value = "";
    render();
    return;
  }
  if (e.target.id === "reset") {
    BACK = [];
    $("search").value = "";
    $("type").value = "";
    $("visibility").value = "";
    $("status").value = "";
    $("multiF").value = "";
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
  VER_LABEL = VER.startsWith("__") ? "Entwicklungsversion" : VER;
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
  if (!M || ENDED) return;
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
