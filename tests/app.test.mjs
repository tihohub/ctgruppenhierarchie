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
  assert.match(stats, /47 \/ 47 Gruppen/);
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
  await page.selectOption("#multiF", "multi");
  assert.match(await text(page, "#stats"), /^2\* \/ 47 Gruppen/);
  await page.click("#tabMulti");
  assert.equal(await text(page, "#multiCount"), "2 Gruppen");
  assert.match(await text(page, "#multiList"), /A › B › X/);
});

test("Sprung zur Obergruppe und schrittweise zurück", async () => {
  const page = await openApp();
  await connected(page);
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
