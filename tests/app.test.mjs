// Automatische Tests der Oberfläche gegen einen Schein-CT-Server (tests/fake_ct.py).
// Start: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const APP = "http://127.0.0.1:8765/";
const CT_PORT = 8799;
const CT = `http://127.0.0.1:${CT_PORT}`;
const procs = [];
let browser;

function start(args) {
  const p = spawn("python3", args, { env: { ...process.env, CTG_NO_BROWSER: "1" }, stdio: "pipe" });
  procs.push(p);
  return p;
}

async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("Nicht erreichbar: " + url);
}

async function openApp() {
  const page = await browser.newPage({ viewport: { width: 1250, height: 800 } });
  page.errors = [];
  // Verstöße gegen die Content-Security-Policy erscheinen als Konsolenmeldung
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) page.errors.push(m.text());
  });
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(APP);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("ctg_welcome_v10", "1");
  });
  await page.reload();
  return page;
}

async function connect(page, token = "test-token") {
  await page.fill("#base", CT);
  await page.fill("#token", token);
  await page.click("#connect");
}

async function connected(page) {
  await connect(page);
  await page.waitForSelector("#app:not(.hidden)");
}

// Filterbereich aufklappen (startet zugeklappt)
async function openFilters(page) {
  if ((await page.getAttribute("#filterToggle", "aria-expanded")) !== "true") await page.click("#filterToggle");
}

const text = async (page, sel) => ((await page.textContent(sel)) || "").replace(/\s+/g, " ").trim();

before(async () => {
  start(["tests/fake_ct.py", String(CT_PORT)]);
  start(["python/ct_gruppenhierarchie.py"]);
  await waitFor(CT + "/_test/requests");
  await waitFor(APP + "version");
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  for (const p of procs) p.kill();
});

test("Verbindung lädt alle Gruppen und zeigt die Statistik", async () => {
  const page = await openApp();
  await connected(page);
  const stats = await text(page, "#stats");
  assert.match(stats, /47 \/ 48 Gruppen/); // beim Start nur aktive Gruppen
  assert.match(stats, /3 Gruppenstämme/);
  assert.match(stats, /2 mit mehreren Obergruppen/);
  assert.match(await text(page, "#user"), /Test Nutzer/);
  assert.ok(await page.isVisible("#refresh"), "↻ sichtbar");
  assert.deepEqual(page.errors, []);
});

test("Anmeldefenster zeigt die Anleitung zum Login-Token", async () => {
  const page = await openApp();
  assert.ok(await page.isVisible("#tokenHelp"));
  const t = await text(page, "#tokenHelp");
  assert.match(t, /Mein Profil/);
  assert.match(t, /Login-Token anzeigen/);
  assert.doesNotMatch(t, /ChurchTools/);
});

test("Falscher Token zeigt eine verständliche Meldung und keine Daten", async () => {
  const page = await openApp();
  await connect(page, "falsch");
  await page.waitForFunction(() => document.getElementById("msg").textContent.startsWith("✗"));
  assert.match(await text(page, "#msg"), /Anmeldung fehlgeschlagen/);
  assert.equal(await page.isVisible("#app"), false);
});

test("Statistik richtet sich nach Filter und Suche", async () => {
  const page = await openApp();
  await connected(page);
  const stats = () =>
    page.evaluate(() => [...document.querySelectorAll("#stats span")].map((s) => s.textContent));
  assert.deepEqual(await stats(), [
    "47 / 48 Gruppen",
    "46 hierarchisch",
    "1 alleinstehend",
    "3 Gruppenstämme",
    "2 mit mehreren Obergruppen",
    "46 Beziehungen",
  ]);
  await openFilters(page);
  await page.fill("#search", "Füll01");
  assert.deepEqual(await stats(), [
    "1* / 48 Gruppen",
    "1 hierarchisch",
    "0 alleinstehend",
    "1 Gruppenstämme",
    "0 mit mehreren Obergruppen",
    "1 Beziehungen",
  ]);
  await page.fill("#search", "");
  await page.check("#multiF");
  assert.deepEqual(await stats(), [
    "2* / 48 Gruppen",
    "2 hierarchisch",
    "0 alleinstehend",
    "3 Gruppenstämme",
    "2 mit mehreren Obergruppen",
    "4 Beziehungen",
  ]);
});

test("Content-Security-Policy ist gesetzt und blockiert nichts im normalen Ablauf", async () => {
  const page = await openApp();
  const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', "content");
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  await connected(page);
  await page.click("#tabVis");
  await page.click("#tabMulti");
  await page.click("#tabList");
  await page.locator('#tree li[data-gid="5"][data-pid="2"] > .multi .jump').click();
  assert.deepEqual(page.errors, []);
});

test("Außerhalb der Extension erscheint kein Beta-Hinweis", async () => {
  const page = await openApp();
  await page.evaluate(() => document.getElementById("aboutBtn").click());
  assert.equal(await page.locator("#about").isVisible(), true);
  assert.equal(await page.locator("#betaNote").isVisible(), false);
  assert.equal(await page.locator("#editBtn").isVisible(), false, "Bearbeiten nur in der Extension");
  assert.equal(await page.locator("#undoBtn").isVisible(), false, "Zurück nur in der Extension");
  assert.equal(await page.locator("#extPrivacy").isVisible(), false);
  assert.match(await text(page, "#about"), /vom Nutzer angegebenen CT-Instanz/);
});

test("Unverschlüsselte Adressen (http://) werden abgelehnt", async () => {
  const page = await openApp();
  await page.fill("#base", "http://example.org");
  await page.fill("#token", "test-token");
  await page.click("#connect");
  await page.waitForFunction(() => document.getElementById("msg").textContent.startsWith("✗"));
  assert.match(await text(page, "#msg"), /mit https:\/\/ angeben/);
  assert.equal(await page.isVisible("#app"), false);
  // auch der lokale Server lehnt sie ab
  const r = await fetch(APP + "ct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base: "http://example.org", path: "/whoami", token: "x" }),
  });
  assert.match((await r.json()).error, /https/);
});

test("Nicht sichtbare Obergruppe erscheint als ausgegrauter 🔒-Platzhalter ohne Link", async () => {
  const page = await openApp();
  await connected(page);
  const ph = page.locator('#tree li[data-gid="99"] > .locked');
  assert.match(await ph.textContent(), /🔒 Leitung geheim/);
  assert.equal(await page.locator('#tree li[data-gid="99"] > a').count(), 0);
});

test("Mehrfachzuordnungen: Hinweis, Filter und Arbeitsliste", async () => {
  const page = await openApp();
  await connected(page);
  assert.match(await text(page, '#tree li[data-gid="5"][data-pid="2"] > .multi'), /auch unter: C/);
  assert.match(await text(page, '#tree li[data-gid="6"][data-pid="5"] > .dup'), /mehrfach über X/);
  await openFilters(page);
  await page.check("#multiF");
  assert.match(await text(page, "#stats"), /^2\* \/ 48 Gruppen/);
  await page.click("#tabMulti");
  assert.equal(await text(page, "#multiCount"), "2 Gruppen");
  assert.match(await text(page, "#multiList"), /A › B › X/);
});

test("Sprung zur Obergruppe und schrittweise zurück", async () => {
  const page = await openApp();
  await connected(page);
  await page.click("#tabList");
  await page.locator('#tree li[data-gid="5"][data-pid="2"] > .multi .jump').click();
  assert.match(await text(page, '#tree li[data-gid="3"] .backinline'), /zurück zu X/);
  await page.locator('#tree li[data-gid="7"][data-pid="3"] > .multi .jump').click();
  assert.match(await text(page, '#tree li[data-gid="99"] .backinline'), /zurück zu Z/);
  await page.click(".backinline");
  assert.match(await text(page, '#tree li[data-gid="3"] .backinline'), /zurück zu X/);
  await page.click(".backinline");
  assert.equal(await page.locator(".backinline").count(), 0);
  await page.waitForSelector('#tree li[data-gid="5"][data-pid="2"].flash');
});

test("Startansicht: Visualisierung horizontal, Reiter links, Status „aktiv“", async () => {
  const page = await openApp();
  await page.evaluate(() => localStorage.setItem("ctv10", JSON.stringify({ mode: "vertical", status: "" })));
  await page.reload();
  await connected(page);
  const tabs = await page.evaluate(() => [...document.querySelectorAll(".tabs .tab")].map((b) => b.id));
  assert.deepEqual(tabs, ["tabVis", "tabList", "tabMulti"]);
  assert.ok(await page.isVisible("#visPane"));
  assert.equal(await page.isVisible("#listPane"), false);
  assert.match(await page.getAttribute("#forest", "class"), /horizontal/);
  assert.match(await page.locator("#status option:checked").textContent(), /^aktiv/);
  assert.equal(await page.locator('#soloForest [data-gid="8"]').count(), 0, "beendete Gruppe ausgefiltert");
  // „Alle Gruppenstatus“ zeigt auch die beendete Gruppe; Zurücksetzen stellt „aktiv“ wieder her
  await openFilters(page);
  await page.selectOption("#status", "");
  assert.equal(await page.locator('#soloForest [data-gid="8"]').count(), 1);
});

test("Zoom: Start auf ganze Breite, Knöpfe, Strg+Mausrad, Ziehen, zwei Finger, Filter passt neu ein", async () => {
  const page = await openApp();
  await page.setViewportSize({ width: 900, height: 800 }); // schmal, damit eingepasst werden muss (unter 800 px stapeln sich die Stämme)
  await connected(page);
  const zoom = () => page.evaluate(() => ZOOM);
  const area = page.locator("#visPane .visual-area").first();
  const masse = () =>
    page.evaluate(() => {
      const a = document.getElementById("forest").parentElement;
      return { breitePasst: a.scrollWidth <= a.clientWidth + 1, hoehePasst: a.scrollHeight <= a.clientHeight + 1 };
    });
  // beim Start auf die Breite eingepasst; nach unten wird gescrollt
  assert.deepEqual(await masse(), { breitePasst: true, hoehePasst: false });
  const start = await zoom();
  assert.ok(start < 1, "herausgezoomt");
  assert.match(await text(page, "#zoomVal"), /^\d+ %$/);
  await page.click("#zoomIn");
  assert.ok((await zoom()) > start);
  await page.click("#zoomIn");
  await page.click("#zoomIn");
  await page.click("#zoomOut");
  const z = await zoom();
  // Strg + Mausrad zoomt, Mausrad allein nicht
  const box = await area.boundingBox();
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.wheel(0, 100);
  assert.equal(await zoom(), z);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -200);
  await page.keyboard.up("Control");
  assert.ok((await zoom()) > z, "Strg+Mausrad zoomt hinein");
  // Ziehen verschiebt die Ansicht (bei 100 %, damit es etwas zu verschieben gibt)
  await page.evaluate(() => {
    setZoom(1);
    const a = document.getElementById("forest").parentElement;
    a.scrollLeft = 300;
    a.scrollTop = 300;
  });
  const vorher = await page.evaluate(() => document.getElementById("forest").parentElement.scrollTop);
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 250, { steps: 5 });
  await page.mouse.up();
  const nachher = await page.evaluate(() => document.getElementById("forest").parentElement.scrollTop);
  assert.equal(nachher, vorher + 50, "nach oben ziehen zeigt weiter unten liegende Gruppen");
  // „Ganzer Stamm“ zoomt wieder auf alles
  await page.click("#zoomFit");
  assert.equal(await zoom(), start);
  // zwei Finger auseinander zoomen hinein
  await page.evaluate(() => {
    const a = document.getElementById("forest").parentElement,
      r = a.getBoundingClientRect(),
      t = (id, x) => new Touch({ identifier: id, target: a, clientX: r.left + x, clientY: r.top + 100 });
    a.dispatchEvent(new TouchEvent("touchstart", { touches: [t(1, 100), t(2, 200)], bubbles: true }));
    a.dispatchEvent(new TouchEvent("touchmove", { touches: [t(1, 50), t(2, 250)], bubbles: true, cancelable: true }));
    a.dispatchEvent(new TouchEvent("touchend", { touches: [], bubbles: true }));
  });
  assert.ok((await zoom()) > start * 1.5, "zwei Finger zoomen hinein");
  // Filter ändern → Zoom wird für das neue Ergebnis wieder auf die Breite eingepasst
  await openFilters(page);
  await page.check("#multiF");
  assert.ok((await zoom()) <= 1);
  assert.equal((await masse()).breitePasst, true);
  assert.notEqual(await zoom(), 2, "nicht mehr hineingezoomt");
  assert.deepEqual(page.errors, []);
});

test("Filterbereich: zugeklappt mit Anzeige der wirksamen Filter, Zustand wird gemerkt", async () => {
  const page = await openApp();
  await connected(page);
  assert.equal(await page.isVisible("#filterBody"), false, "beim ersten Start zugeklappt");
  assert.equal(await text(page, "#filterSummary"), "(1 aktiv: Status: aktiv)");
  await page.click("#filterToggle");
  assert.ok(await page.isVisible("#search"));
  assert.equal(await text(page, "#filterSummary"), "", "aufgeklappt: Filter stehen als Chips da");
  await page.fill("#search", "Füll");
  await page.check("#multiF");
  await page.click("#filterToggle");
  assert.match(await text(page, "#filterSummary"), /^\(3 aktiv: Suche: Füll, Status: aktiv, Nur Mehrfachzuordnung\)$/);
  // aufgeklappt verlassen → beim nächsten Start aufgeklappt
  await page.click("#filterToggle");
  await page.reload();
  await connected(page);
  assert.ok(await page.isVisible("#filterBody"));
});

test("Ein/Aus-Filter Mehrfachzuordnung und Zusatzinfos ausblenden", async () => {
  const page = await openApp();
  await connected(page);
  await openFilters(page);
  assert.equal(await page.getAttribute("#multiF", "type"), "checkbox");
  assert.equal(await text(page, "#multiCount2"), "(2)");
  await page.check("#multiF");
  assert.match(await text(page, "#stats"), /^2\* \/ 48 Gruppen/);
  await page.uncheck("#multiF");
  assert.match(await text(page, "#stats"), /^47 \/ 48 Gruppen/);
  // Zusatzinfos: standardmäßig sichtbar, ausblendbar, Einstellung bleibt nach Neuladen
  const meta = page.locator('#forest .stem-title[data-gid="1"] .vmeta.info');
  assert.ok(await meta.isVisible());
  await page.uncheck("#showMeta");
  assert.equal(await meta.isVisible(), false);
  await page.click("#tabList");
  assert.equal(await page.locator("#tree .badge").first().isVisible(), false);
  await page.reload();
  await connected(page);
  assert.equal(await page.isChecked("#showMeta"), false);
  assert.equal(await page.locator('#forest .stem-title[data-gid="1"] .vmeta.info').isVisible(), false);
});

test("Eigene Filter: Eigenschaft – Bedingung – Wert mit UND/ODER", async () => {
  const page = await openApp();
  await connected(page);
  await openFilters(page);
  const gruppen = async () => (await page.locator("#stats span").first().textContent()).trim();
  const cond = (i) => page.locator("#cfBox .cf-cond").nth(i);
  // Feldliste: alle Gruppenfelder aus CT inkl. eigener Felder und Anzahlen
  await page.click('#cfBox [data-cf="addc"]');
  assert.equal(await cond(0).locator('[data-cf="field"]').getAttribute("placeholder"), "Filter eingeben oder auswählen");
  const felder = await page.$$eval("#cfFields option", (o) => o.map((x) => x.value));
  for (const f of ["Anzahl Leiter", "Gruppenkategorie", "Standort", "Notiz", "kostenstelle"])
    assert.ok(felder.includes(f), f);
  // Anzahl Leiter ist 0 → X und Y
  await cond(0).locator('[data-cf="field"]').fill("Anzahl Leiter");
  await cond(0).locator('[data-cf="value"]').fill("0");
  assert.equal(await gruppen(), "2* / 48 Gruppen");
  // Standort ist Wiesbaden UND (Kategorie ist Jugend ODER Notiz enthält „Füll“) → nur X
  await cond(0).locator('[data-cf="field"]').fill("Standort");
  await cond(0).locator('[data-cf="value"]').fill("wiesbaden");
  assert.equal(await gruppen(), "2* / 48 Gruppen");
  await page.locator('#cfBox > .cf-group > .cf-add [data-cf="addg"]').click();
  const sub = page.locator("#cfBox .cf-group .cf-group");
  assert.equal(await sub.locator('[data-cf="op"]').inputValue(), "or", "Untergruppe startet mit ODER");
  await cond(1).locator('[data-cf="field"]').fill("Gruppenkategorie");
  await cond(1).locator('[data-cf="value"]').fill("Jugend");
  await sub.locator('[data-cf="addc"]').click();
  await cond(2).locator('[data-cf="field"]').fill("Notiz");
  await cond(2).locator('[data-cf="cmp"]').selectOption("has");
  await cond(2).locator('[data-cf="value"]').fill("Füll");
  assert.equal(await gruppen(), "1* / 48 Gruppen");
  assert.ok(await page.locator('#forest [data-gid="5"]').count(), "X wird angezeigt");
  // Untergruppe auf UND: Jugend und Notiz mit „Füll“ gibt es nicht zusammen → 0
  await sub.locator('[data-cf="op"]').selectOption("and");
  assert.equal(await gruppen(), "0 / 48 Gruppen");
  // Chip zeigt den eigenen Filter; der Filter bleibt nach dem Neuladen erhalten
  assert.match(await text(page, "#chips"), /Eigener Filter \(3 Bedingungen\)/);
  await page.reload();
  await connected(page);
  assert.equal(await gruppen(), "0 / 48 Gruppen");
  assert.equal(await page.locator("#cfBox .cf-cond").count(), 3);
  // Chip entfernen löscht den eigenen Filter
  await page.click('#chips [data-clear="custom"]');
  assert.equal(await page.locator("#cfBox .cf-cond").count(), 0);
  assert.equal(await gruppen(), "47 / 48 Gruppen");
  // „ist leer“ braucht keinen Wert: Gruppen ohne Kategorie (aktiv: 47 − 3)
  await page.click('#cfBox [data-cf="addc"]');
  await cond(0).locator('[data-cf="field"]').fill("Gruppenkategorie");
  await cond(0).locator('[data-cf="cmp"]').selectOption("empty");
  assert.equal(await cond(0).locator('[data-cf="value"]').count(), 0);
  assert.equal(await gruppen(), "44 / 48 Gruppen");
  assert.deepEqual(page.errors, []);
});

test("Eigene Filter mit Namen speichern, laden, aktualisieren und löschen", async () => {
  const page = await openApp();
  await connected(page);
  await openFilters(page);
  const gruppen = async () => (await page.locator("#stats span").first().textContent()).trim();
  const cond = (i) => page.locator("#cfBox .cf-cond").nth(i);
  // ohne Bedingung wird nicht gespeichert
  await page.fill("#cfName", "Ohne Leitung");
  await page.click("#cfSave");
  assert.match(await text(page, "#cfMsg"), /keine vollständige Bedingung/);
  await page.click('#cfBox [data-cf="addc"]');
  await cond(0).locator('[data-cf="field"]').fill("Anzahl Leiter");
  await cond(0).locator('[data-cf="value"]').fill("0");
  await page.click("#cfSave");
  assert.match(await text(page, "#cfMsg"), /„Ohne Leitung“ gespeichert/);
  // Filter leeren, dann gespeicherten Filter wählen
  await page.click('#chips [data-clear="custom"]');
  assert.equal(await gruppen(), "47 / 48 Gruppen");
  await page.selectOption("#cfSaved", "Ohne Leitung");
  assert.equal(await gruppen(), "2* / 48 Gruppen");
  // bleibt nach Neuladen erhalten; gleicher Name aktualisiert
  await page.reload();
  await connected(page);
  assert.deepEqual(await page.locator("#cfSaved option").allTextContents(), [
    "Gespeicherten Filter wählen …",
    "Ohne Leitung",
  ]);
  await page.selectOption("#cfSaved", "Ohne Leitung");
  await cond(0).locator('[data-cf="value"]').fill("1");
  await page.click("#cfSave");
  assert.match(await text(page, "#cfMsg"), /aktualisiert/);
  assert.equal(await page.locator("#cfSaved option").count(), 2);
  // löschen
  await page.click("#cfDelete");
  assert.match(await text(page, "#cfMsg"), /gelöscht/);
  assert.equal(await text(page, "#cfSaved"), "Noch keine gespeicherten Filter");
  assert.deepEqual(page.errors, []);
});

test("Filterbereich: Schnellfilter und eigene Filter getrennt, Name des gespeicherten Filters, Zurücksetzen", async () => {
  const page = await openApp();
  await connected(page);
  await openFilters(page);
  assert.deepEqual(await page.locator("#filterBody .fsec-title").allTextContents(), ["Schnellfilter", "Eigene Filter"]);
  // „Zusatzinfos anzeigen“ sitzt bei den Gruppenstämmen, nicht mehr im Filter
  assert.equal(await page.locator("#filterBody #showMeta").count(), 0);
  assert.equal(await page.locator("#visPane .visual-tools #showMeta").count(), 1);
  const gruppen = async () => (await page.locator("#stats span").first().textContent()).trim();
  const cond = (i) => page.locator("#cfBox .cf-cond").nth(i);
  // Tippen statt Auswählen; Groß-/Kleinschreibung egal
  await page.click('#cfBox [data-cf="addc"]');
  await cond(0).locator('[data-cf="field"]').fill("anzahl leiter");
  await cond(0).locator('[data-cf="value"]').fill("0");
  assert.equal(await gruppen(), "2* / 48 Gruppen");
  await page.fill("#cfName", "Ohne Leitung");
  await page.click("#cfSave");
  assert.match(await text(page, "#chips"), /Ohne Leitung×/);
  await cond(0).locator('[data-cf="value"]').fill("1");
  assert.match(await text(page, "#chips"), /Ohne Leitung \(geändert\)/);
  // leere Auswahl leert den eigenen Filter
  await page.selectOption("#cfSaved", "Ohne Leitung");
  assert.equal(await gruppen(), "2* / 48 Gruppen");
  await page.selectOption("#cfSaved", "");
  assert.equal(await page.locator("#cfBox .cf-cond").count(), 0);
  assert.equal(await gruppen(), "47 / 48 Gruppen");
  // „Alle Filter zurücksetzen“ entfernt auch „aktiv“ → alle 48
  await page.click("#reset");
  assert.equal(await gruppen(), "48 / 48 Gruppen");
  assert.equal(await text(page, "#chips"), "");
});

test("Visualisierung ist aufgeklappt und zeigt alleinstehende Gruppen", async () => {
  const page = await openApp();
  await connected(page);
  await page.click("#tabVis");
  const closed = await page.locator('#forest [data-v]:text-is("+")').count();
  assert.equal(closed, 0);
  assert.equal(await text(page, "#visSoloCount"), "1 Gruppe");
});

test("Gruppenstämme und alleinstehende Gruppen zeigen Typ, Status und Sichtbarkeit", async () => {
  const page = await openApp();
  await connected(page);
  await page.click("#tabVis");
  assert.match(
    await text(page, '#forest .stem-title[data-gid="1"] .vmeta'),
    /Kleingruppe · aktiv · Intern/,
  );
  assert.match(
    await text(page, '#forest .stem-title[data-gid="99"] .vmeta'),
    /Keine Berechtigung · ID 99/,
  );
  assert.match(
    await text(page, '#soloForest .stem-title[data-gid="4"] .vmeta'),
    /Kleingruppe · aktiv · Intern/,
  );
});

test("Trennen löscht alle geladenen Daten und den Token", async () => {
  const page = await openApp();
  await connected(page);
  await page.click("#settingsBtn");
  await page.click("#disconnect");
  assert.equal(await page.inputValue("#token"), "");
  const leer = await page.evaluate(() =>
    ["tree", "forest", "multiList", "user", "stats"].every(
      (id) => document.getElementById(id).innerHTML === "",
    ),
  );
  assert.ok(leer, "Anzeigen geleert");
  assert.equal(await page.isVisible("#refresh"), false);
});

test("Sitzungs-Timeout: Warnung nach 58 Minuten, Löschen nach 60 Minuten", async () => {
  const page = await openApp();
  await connected(page);
  await page.evaluate(() => {
    lastAct = Date.now() - 58.5 * 60e3;
    idleCheck();
  });
  assert.ok(await page.isVisible("#idleWarn"));
  await page.evaluate(() => {
    lastAct = Date.now() - 61 * 60e3;
    idleCheck();
  });
  assert.equal(await page.isVisible("#app"), false);
  assert.match(await text(page, "#msg"), /Inaktivität/);
});

test("Lokaler Server lehnt Anfragen fremder Webseiten ab", async () => {
  const r = await fetch(APP + "ct", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: "{}",
  });
  assert.equal(r.status, 403);
  const r2 = await fetch(APP + "ct", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "{}",
  });
  assert.equal(r2.status, 403);
});

test("Die App greift nur lesend auf CT zu", async () => {
  const reqs = await (await fetch(CT + "/_test/requests")).json();
  assert.ok(reqs.length > 0, "es gab Anfragen an CT");
  const nichtLesend = reqs.filter((r) => !["GET", "OPTIONS"].includes(r.method));
  assert.deepEqual(nichtLesend, []);
});
