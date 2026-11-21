// Tests der CT-Extension: Der Schein-CT bettet die gebaute index.html so ein wie CT
// (nur der Inhalt, <base href="/">, eigene Menüleiste); Anmeldung über ein Sitzungs-Cookie.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const CT_PORT = 8794;
const CT = `http://127.0.0.1:${CT_PORT}`;
const EXT = CT + "/ccm/gruppenhierarchie/";
let ct, browser;

before(async () => {
  execFileSync("python3", ["tools/build_extension.py", "v0.1"]);
  ct = spawn("python3", ["tests/fake_ct.py", String(CT_PORT)], {
    env: { ...process.env, CTG_EXT_DIR: "dist/extension" },
    stdio: "pipe",
  });
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(CT + "/_test/requests");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  ct?.kill();
});

async function openExtension(angemeldet = true) {
  const ctx = await browser.newContext();
  if (angemeldet) await ctx.addCookies([{ name: "ct_session", value: "angemeldet", url: CT }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) errors.push(m.text());
  });
  await page.goto(EXT);
  return { page, errors };
}

test("ZIP enthält index.html und assets/ direkt im Wurzelverzeichnis, mit absoluten Pfaden", () => {
  const names = execFileSync("python3", [
    "-c",
    "import zipfile,sys;print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))",
    "dist/ct-gruppenhierarchie-extension-v0.1.zip",
  ])
    .toString()
    .trim()
    .split("\n");
  assert.deepEqual(names.sort(), ["assets/app.js", "assets/style.css", "index.html"]);
  const index = readFileSync("dist/extension/index.html", "utf8");
  // Versionsnummer an den Verweisen: nach einem Update lädt der Browser die neuen Dateien
  assert.match(index, /href="\/ccm\/gruppenhierarchie\/assets\/style\.css\?v=v0\.1"/);
  assert.match(index, /src="\/ccm\/gruppenhierarchie\/assets\/app\.js\?v=v0\.1"/);
  assert.doesNotMatch(index, /<iframe|<style/);
  assert.match(readFileSync("dist/extension/assets/app.js", "utf8"), /v0\.1/);
});

test("Extension lädt sofort mit der CT-Anmeldung, ohne Token", async () => {
  const { page, errors } = await openExtension();
  await page.locator("#ctgh-app:not(.hidden)").waitFor();
  assert.match(await page.locator("#ctgh #stats").textContent(), /47 \/ 47 Gruppen/);
  assert.equal(await page.locator("#token").isVisible(), false);
  assert.equal(await page.locator("#settingsBtn").isVisible(), false);
  assert.equal(await page.locator("#welcome").isVisible(), false);
  // Gestaltung der App ist geladen (Knöpfe in der App sind blau hinterlegt)
  const appBtn = await page
    .locator("#ctgh #tabList")
    .evaluate((b) => getComputedStyle(b).backgroundColor);
  assert.equal(appBtn, "rgb(9, 105, 218)");
  assert.deepEqual(errors, []);
});

test("Über-Dialog zeigt in der Extension den Beta-Hinweis und den eigenen Datenschutz-Text", async () => {
  const { page } = await openExtension();
  await page.locator("#ctgh-app:not(.hidden)").waitFor();
  await page.click("#ctgh #aboutBtn");
  assert.equal(await page.locator("#betaNote").isVisible(), true);
  assert.match(await page.locator("#betaNote").textContent(), /Beta-Funktion ohne\s+Support/);
  assert.equal(await page.locator("#extPrivacy").isVisible(), true);
  const about = (await page.locator("#about").innerText()).replace(/\s+/g, " ");
  assert.match(about, /von eurer CT-Instanz ausgeliefert/);
  assert.doesNotMatch(about, /vom Nutzer angegebenen CT-Instanz|GitHub Pages/);
});

test("Gestaltung der App verändert die CT-Seite nicht", async () => {
  const { page } = await openExtension();
  await page.locator("#ctgh-app:not(.hidden)").waitFor();
  const ct = await page.evaluate(() => {
    const cs = (sel) => getComputedStyle(document.querySelector(sel));
    return {
      btn: cs("#ct-nav .ct-btn").backgroundColor,
      h1: cs("#ct-nav .ct-title").fontSize,
      body: cs("body").backgroundColor,
      bodyMargin: cs("body").margin,
    };
  });
  assert.notEqual(ct.btn, "rgb(9, 105, 218)", "CT-Knopf darf nicht unsere Farbe bekommen");
  assert.equal(ct.h1, "32px", "CT-Überschrift behält die Standardgröße");
  assert.equal(ct.body, "rgba(0, 0, 0, 0)", "CT-Seitenhintergrund unverändert");
  assert.equal(ct.bodyMargin, "8px", "CT-Seitenrand unverändert");
});

test("Ohne CT-Anmeldung (Anonymous) erscheint ein verständlicher Hinweis", async () => {
  const { page } = await openExtension(false);
  await page.locator("#msg.bad").waitFor();
  assert.match(await page.locator("#msg").textContent(), /in CT neu anmelden/);
  assert.equal(await page.locator("#modal").isVisible(), true);
});

test("Die Extension greift nur lesend auf CT zu", async () => {
  const reqs = await (await fetch(CT + "/_test/requests")).json();
  assert.ok(reqs.some((r) => r.path === "/api/whoami"));
  assert.deepEqual(
    reqs.filter((r) => !["GET", "OPTIONS"].includes(r.method)),
    [],
  );
});
