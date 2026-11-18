// Tests der Webseiten-Variante: Oberfläche ohne lokalen Python-Server, der Browser
// fragt den Schein-CT direkt (wie später auf GitHub Pages mit CORS-Freigabe).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const WEB = "http://127.0.0.1:8790/";
const CT_PORT = 8796;
const CT = `http://127.0.0.1:${CT_PORT}`;
const procs = [];
let browser;

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

async function openPage() {
  const page = await browser.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(WEB);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("ctg_welcome_v10", "1");
  });
  await page.reload();
  return page;
}

before(async () => {
  procs.push(spawn("python3", ["tests/fake_ct.py", String(CT_PORT)], { stdio: "pipe" }));
  procs.push(
    spawn("python3", ["-m", "http.server", "8790", "--bind", "127.0.0.1", "-d", "web"], {
      stdio: "pipe",
    }),
  );
  await waitFor(CT + "/_test/requests");
  await waitFor(WEB);
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  for (const p of procs) p.kill();
});

test("Webseite lädt die Daten direkt aus CT", async () => {
  const page = await openPage();
  assert.equal(await page.evaluate(() => CT_MODE), "direct");
  await page.fill("#base", CT);
  await page.fill("#token", "test-token");
  await page.click("#connect");
  await page.waitForSelector("#app:not(.hidden)");
  assert.match(await page.textContent("#stats"), /47/);
  // Ohne lokalen Server darf keine Meldung „Programm beendet“ erscheinen
  await page.waitForTimeout(500);
  assert.equal(await page.isVisible("#ended"), false);
  assert.deepEqual(page.errors, []);
});

test("Fehlende CORS-Freigabe ergibt einen verständlichen Hinweis", async () => {
  const page = await openPage();
  await page.fill("#base", "http://127.0.0.1:9"); // hier läuft nichts
  await page.fill("#token", "test-token");
  await page.click("#connect");
  await page.waitForFunction(() => document.getElementById("msg").textContent.startsWith("✗"));
  const msg = await page.textContent("#msg");
  assert.match(msg, /Cross-Origin-Ressource-Sharing/);
  assert.match(msg, /http:\/\/127\.0\.0\.1:8790/);
});

test("Token-Hinweis zu den Rechten ist sichtbar", async () => {
  const page = await openPage();
  assert.match(await page.textContent("#modal"), /alle Rechte des CT-Benutzers/);
});

test("Auch die Webseite greift nur lesend auf CT zu", async () => {
  const reqs = await (await fetch(CT + "/_test/requests")).json();
  assert.ok(reqs.some((r) => r.method === "GET"));
  assert.deepEqual(
    reqs.filter((r) => !["GET", "OPTIONS"].includes(r.method)),
    [],
  );
});
