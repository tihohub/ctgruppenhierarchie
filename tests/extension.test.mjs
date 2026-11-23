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

async function openExtension(angemeldet = true, viewport) {
  const ctx = await browser.newContext(viewport ? { viewport } : {});
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
    "dist/ct-gruppenhierarchie-extension-0.1.zip",
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

test("Testversion: eigenes Kürzel, Zusatz in der Version, echte Kürzel-Pfade unberührt", () => {
  execFileSync("python3", ["tools/build_extension.py", "v2.0-test.abc1234", "--kuerzel", "gruppenhierarchietest"]);
  const index = readFileSync("dist/extension/index.html", "utf8");
  assert.match(index, /src="\/ccm\/gruppenhierarchietest\/assets\/app\.js\?v=v2\.0-test\.abc1234"/);
  assert.doesNotMatch(index, /\/ccm\/gruppenhierarchie\//);
  assert.match(readFileSync("dist/extension/assets/app.js", "utf8"), /v2\.0-test\.abc1234/);
  // Zusatz nur für die Testversion, andere Kürzel gar nicht
  const geht = (...a) => {
    try {
      execFileSync("python3", ["tools/build_extension.py", ...a], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  };
  assert.equal(geht("v2.0-test.abc1234"), false);
  assert.equal(geht("v2.0", "--kuerzel", "irgendwas"), false);
  // für die folgenden Tests wieder die normale Extension bauen
  execFileSync("python3", ["tools/build_extension.py", "v0.1"]);
});

test("Extension lädt sofort mit der CT-Anmeldung, ohne Token", async () => {
  const { page, errors } = await openExtension();
  await page.locator("#ctgh-app:not(.hidden)").waitFor();
  assert.match(await page.locator("#ctgh #stats").textContent(), /47 \/ 48 Gruppen/);
  assert.equal(await page.locator("#token").isVisible(), false);
  assert.equal(await page.locator("#settingsBtn").isVisible(), false);
  assert.equal(await page.locator("#welcome").isVisible(), false);
  // Gestaltung der App ist geladen (Knöpfe in der App sind blau hinterlegt)
  const appBtn = await page
    .locator("#ctgh #tabVis")
    .evaluate((b) => getComputedStyle(b).backgroundColor);
  assert.equal(appBtn, "rgb(9, 105, 218)");
  assert.deepEqual(errors, []);
});

test("Versionsanzeige lautet „Version 0.1“ (ohne „v“)", async () => {
  const { page } = await openExtension();
  await page.locator("#ctgh-app:not(.hidden)").waitFor();
  assert.equal((await page.locator("#ctgh h1 .app-version").textContent()).trim(), "Version 0.1");
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

test("Ohne Bearbeiten greift die Extension nur lesend auf CT zu", async () => {
  const reqs = await (await fetch(CT + "/_test/requests")).json();
  assert.ok(reqs.some((r) => r.path === "/api/whoami"));
  assert.deepEqual(
    reqs.filter((r) => !["GET", "OPTIONS"].includes(r.method)),
    [],
  );
});

// ---- Version 2.0: Bearbeiten (schreibt in den Schein-CT) ----
async function bearbeiten() {
  // großes Fenster, damit Ausgangs- und Zielgruppe beim Ziehen gleichzeitig sichtbar sind
  const { page, errors } = await openExtension(true, { width: 1250, height: 2400 });
  await page.locator("#ctgh-app:not(.hidden)").waitFor();
  await page.click("#tabList");
  await page.click("#editBtn");
  return { page, errors };
}
const toastText = async (page) => {
  await page.locator("#toast:not(.hidden)").waitFor();
  return (await page.locator("#toast").textContent()).trim();
};
const neuGeladen = (page) => page.waitForFunction(() => !document.getElementById("refresh").disabled);

test("Bearbeiten: Knopf nur in der Extension, Ziehen verschiebt nach Rückfrage", async () => {
  const { page, errors } = await openExtension();
  await page.locator("#ctgh-app:not(.hidden)").waitFor();
  await page.click("#tabList");
  // ohne Bearbeiten-Modus: Ziehen bewirkt nichts
  await page.locator('#tree li[data-gid="6"] > a').first().dragTo(page.locator('#tree li[data-gid="2"] > a'));
  assert.equal(await page.isVisible("#editDlg"), false);
  await page.click("#editBtn");
  assert.ok(await page.isVisible("#editBar"));
  // Y (unter X) auf B ziehen → Rückfrage mit „Verschieben“ vorausgewählt
  await page.locator('#tree li[data-gid="6"] > a').first().dragTo(page.locator('#tree li[data-gid="2"] > a'));
  assert.ok(await page.isVisible("#editDlg"));
  assert.equal(await page.textContent("#editTitle"), "Y unter B einordnen?");
  assert.equal(await page.locator('input[name="editChoice"]:checked').getAttribute("value"), "move");
  assert.match(await page.textContent("#editDlg"), /Rechte aus Obergruppen/);
  await page.click("#editGo");
  assert.equal(await toastText(page), "✓ „Y“ wurde in CT verschoben.");
  await neuGeladen(page);
  await page.locator('#tree li[data-gid="6"][data-pid="2"]').waitFor();
  assert.equal(await page.locator('#tree li[data-gid="6"][data-pid="5"]').count(), 0);
  assert.deepEqual(errors, []);
});

test("Bearbeiten: ✂ löst von der Obergruppe, Ziehen ordnet wieder ein", async () => {
  const { page } = await bearbeiten();
  await page.locator('#tree li[data-gid="6"][data-pid="2"] > .cut').click();
  assert.equal(await page.textContent("#editTitle"), "Y von B lösen?");
  assert.match(await page.textContent("#editChoices"), /keine Obergruppe mehr/);
  await page.click("#editGo");
  assert.equal(await toastText(page), "✓ „Y“ wurde in CT gelöst.");
  await neuGeladen(page);
  // Y ist jetzt alleinstehend; aus der Liste der alleinstehenden Gruppen wieder unter X ziehen
  await page.locator('#stand .node[data-gid="6"] a').dragTo(page.locator('#tree li[data-gid="5"] > a').first());
  assert.equal(await page.locator('input[name="editChoice"]').count(), 1, "ohne alte Obergruppe nur „einordnen“");
  await page.click("#editGo");
  assert.equal(await toastText(page), "✓ „Y“ wurde in CT eingeordnet.");
  await neuGeladen(page);
  await page.locator('#tree li[data-gid="6"][data-pid="5"]').first().waitFor({ state: "visible" });
});

test("Bearbeiten in der Visualisierung: Karte auf Karte ziehen", async () => {
  const { page } = await bearbeiten();
  await page.click("#tabVis");
  for (let i = 0; i < 8; i++) await page.click("#zoomIn"); // auf etwa 100 %
  // Y (unter X) auf den Stamm C ziehen → Rückfrage, dann abbrechen. Beide liegen sichtbar
  // nebeneinander (beim Ziehen über weite Strecken scrollt der Testbrowser sonst mitten im Zug).
  await page.locator('#forest .vcard[data-gid="6"] a').first().dragTo(page.locator('#forest .stem-title[data-gid="3"] a'));
  assert.equal(await page.textContent("#editTitle"), "Y unter C einordnen?");
  await page.click("#editCancel");
});

test("Bearbeiten: Kreise werden verhindert, fehlende Rechte verständlich gemeldet", async () => {
  const { page } = await bearbeiten();
  // B unter X (eine Untergruppe von B) → kein Ablegen möglich
  await page.locator('#tree li[data-gid="2"] > a').dragTo(page.locator('#tree li[data-gid="5"] > a').first());
  assert.equal(await page.isVisible("#editDlg"), false);
  // Y unter C (keine Rechte in CT) → Meldung, nichts geändert
  await page.locator('#tree li[data-gid="6"] > a').first().dragTo(page.locator('#tree li[data-gid="3"] > a'));
  await page.click('input[name="editChoice"][value="add"]');
  await page.click("#editGo");
  assert.match(await toastText(page), /nicht so ändern\. Es wurde nichts geändert/);
  await neuGeladen(page);
  assert.equal(await page.locator('#tree li[data-gid="6"][data-pid="3"]').count(), 0);
});

test("Bearbeiten: Abbrechen schreibt nichts", async () => {
  const { page } = await bearbeiten();
  const vorher = (await (await fetch(CT + "/_test/requests")).json()).filter((r) => r.method !== "GET").length;
  await page.locator('#tree li[data-gid="6"] > a').first().dragTo(page.locator('#tree li[data-gid="1"] > a'));
  await page.click("#editCancel");
  assert.equal(await page.isVisible("#editDlg"), false);
  const nachher = (await (await fetch(CT + "/_test/requests")).json()).filter((r) => r.method !== "GET").length;
  assert.equal(nachher, vorher);
});

test("Zurück: letzte Änderung zurücknehmen, mehrere über die Liste, Prüfung des Stands", async () => {
  const { page, errors } = await bearbeiten();
  assert.ok(await page.isVisible("#undoBtn"));
  assert.ok(await page.isDisabled("#undoBtn"), "noch nichts zum Zurücknehmen");
  const ziehen = async (gid, ziel) => {
    await page.locator(`#tree li[data-gid="${gid}"] > a`).first().dragTo(page.locator(`#tree li[data-gid="${ziel}"] > a`).first());
    await page.click("#editGo");
    await toastText(page);
    await neuGeladen(page);
  };
  // 1) Y von X nach B, 2) Y von B nach A
  await ziehen(6, 2);
  await ziehen(6, 1);
  await page.locator('#tree li[data-gid="6"][data-pid="1"]').waitFor({ state: "attached" });
  // Liste: neueste oben
  await page.click("#undoMenuBtn");
  assert.deepEqual(await page.locator("#undoMenu .undo-item").allTextContents(), [
    "„Y“ von „B“ nach „A“ verschoben",
    "„Y“ von „X“ nach „B“ verschoben",
  ]);
  await page.click("#undoMenuBtn");
  // ↶ nimmt nur die letzte zurück → Y wieder unter B
  await page.click("#undoBtn");
  assert.equal(await toastText(page), "↶ Zurückgenommen.");
  await neuGeladen(page);
  await page.locator('#tree li[data-gid="6"][data-pid="2"]').waitFor({ state: "attached" });
  // wieder nach A, dann über die Liste bis zur ersten Änderung → Y wieder unter X
  await ziehen(6, 1);
  await page.click("#undoMenuBtn");
  await page.locator("#undoMenu .undo-item").last().click();
  assert.equal(await toastText(page), "↶ 2 Änderungen zurückgenommen.");
  await neuGeladen(page);
  await page.locator('#tree li[data-gid="6"][data-pid="5"]').first().waitFor({ state: "attached" });
  assert.ok(await page.isDisabled("#undoBtn"));
  // jemand anderes ändert inzwischen in CT → Zurücknehmen schreibt nichts
  await ziehen(6, 2);
  await fetch(CT + "/_test/parents", { method: "POST", body: JSON.stringify({ group: 6, parents: [1] }) });
  await page.click("#undoBtn");
  assert.match(await toastText(page), /inzwischen in CT geändert/);
  await neuGeladen(page);
  assert.equal(await page.isDisabled("#undoBtn"), false, "Eintrag bleibt in der Liste");
  // Ausgangszustand wiederherstellen
  await fetch(CT + "/_test/parents", { method: "POST", body: JSON.stringify({ group: 6, parents: [5] }) });
  assert.deepEqual(errors, []);
});

test("Gemeinsame Filter: für alle freigeben, andere sehen und nutzen ihn, löschen", async () => {
  const { page, errors } = await openExtension();
  await page.locator("#ctgh-app:not(.hidden)").waitFor();
  if ((await page.getAttribute("#filterToggle", "aria-expanded")) !== "true") await page.click("#filterToggle");
  assert.ok(await page.isVisible("#cfShare"));
  await page.click('#cfBox [data-cf="addc"]');
  const c = page.locator("#cfBox .cf-cond").first();
  await c.locator('[data-cf="field"]').selectOption({ label: "Anzahl Leiter" });
  await c.locator('[data-cf="value"]').fill("0");
  await page.fill("#cfName", "Ohne Leitung");
  await page.click("#cfShare");
  await page.waitForFunction(() => /für alle freigegeben/.test(document.getElementById("cfMsg").textContent));
  // eine andere Person öffnet die Extension: der Filter steht unter „Für alle freigegeben“
  const { page: p2 } = await openExtension();
  await p2.locator("#ctgh-app:not(.hidden)").waitFor();
  if ((await p2.getAttribute("#filterToggle", "aria-expanded")) !== "true") await p2.click("#filterToggle");
  const opt = p2.locator('#cfSaved optgroup[label="👥 Für alle freigegeben"] option');
  await opt.first().waitFor({ state: "attached" });
  assert.deepEqual(await opt.allTextContents(), ["Ohne Leitung"]);
  await p2.selectOption("#cfSaved", { label: "Ohne Leitung" });
  assert.equal((await p2.locator("#stats span").first().textContent()).trim(), "2* / 48 Gruppen");
  // nicht mehr freigeben
  await p2.click("#cfDelete");
  await p2.waitForFunction(() => /nicht mehr für alle freigegeben/.test(document.getElementById("cfMsg").textContent));
  assert.equal(await p2.locator('#cfSaved optgroup[label="👥 Für alle freigegeben"]').count(), 0);
  assert.deepEqual(errors, []);
});
