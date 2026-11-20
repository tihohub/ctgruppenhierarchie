// Tests der CT-Extension: gebautes ZIP-Verzeichnis, ausgeliefert vom Schein-CT unter
// /ccm/gruppenhierarchie/, Anmeldung über ein Sitzungs-Cookie statt Login-Token.
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
  const frame = page.frameLocator("iframe");
  return { page, frame, errors };
}

test("ZIP enthält Rahmen und Oberfläche direkt im Wurzelverzeichnis", () => {
  const names = execFileSync("python3", [
    "-c",
    "import zipfile,sys;print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))",
    "dist/ct-gruppenhierarchie-extension-v0.1.zip",
  ])
    .toString()
    .trim()
    .split("\n");
  assert.ok(names.includes("index.html"));
  assert.ok(names.includes("app/index.html"));
  assert.ok(names.includes("app/ct-daten.js"));
  assert.ok(!names.some((n) => n.startsWith("dist/") || n.includes("\\")));
  assert.match(readFileSync("dist/extension/app/app.js", "utf8"), /v0\.1/);
});

test("Extension lädt sofort mit der CT-Anmeldung, ohne Token", async () => {
  const { frame, errors } = await openExtension();
  await frame.locator("#app:not(.hidden)").waitFor();
  assert.match(await frame.locator("#stats").textContent(), /47 \/ 47 Gruppen/);
  assert.equal(await frame.locator("#token").isVisible(), false);
  assert.equal(await frame.locator("#settingsBtn").isVisible(), false);
  assert.equal(await frame.locator("#welcome").isVisible(), false);
  assert.deepEqual(errors, []);
});

test("Ohne CT-Anmeldung erscheint ein verständlicher Hinweis", async () => {
  const { frame } = await openExtension(false);
  await frame.locator("#msg.bad").waitFor();
  assert.match(await frame.locator("#msg").textContent(), /in CT neu anmelden/);
});

test("Die Extension greift nur lesend auf CT zu", async () => {
  const reqs = await (await fetch(CT + "/_test/requests")).json();
  assert.ok(reqs.some((r) => r.path === "/api/whoami"));
  assert.deepEqual(
    reqs.filter((r) => !["GET", "OPTIONS"].includes(r.method)),
    [],
  );
});
