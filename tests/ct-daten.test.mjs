// Tests der Datenaufbereitung (web/ct-daten.js) direkt gegen den Schein-CT-Server.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const CT_PORT = 8798;
const CT = `http://127.0.0.1:${CT_PORT}`;
let ct, loadGroupData;

before(async () => {
  ct = spawn("python3", ["tests/fake_ct.py", String(CT_PORT)], { stdio: "pipe" });
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(CT + "/_test/requests");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  // ct-daten.js laden; Anfragen gehen hier direkt an den Schein-CT statt über den lokalen Server
  const ctx = {
    fetch,
    URLSearchParams,
    console,
    location: { hostname: "test", port: "", origin: "", pathname: "/" },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync("web/ct-daten.js", "utf8"), ctx);
  vm.runInContext(
    `ctGet = async (base, token, path) => {
       const r = await fetch(base + "/api" + path, { headers: { Authorization: "Login " + token } });
       if (!r.ok) throw new Error("HTTP " + r.status);
       return r.json();
     }`,
    ctx,
  );
  // Ergebnis in normale Objekte umwandeln (Objekte aus dem vm-Kontext haben andere Prototypen)
  loadGroupData = async (...a) =>
    JSON.parse(JSON.stringify(await vm.runInContext("loadGroupData", ctx)(...a)));
});

after(() => ct?.kill());

test("Gruppenstämme, alleinstehende Gruppen und Beziehungen", async () => {
  const d = await loadGroupData(CT + "/", "test-token");
  assert.equal(d.groups.length, 48);
  assert.deepEqual(
    d.roots.map((id) => d.byId[id].name),
    ["A", "C", "Leitung geheim"],
  );
  assert.deepEqual(d.standalone, [8, 4]); // nach Name: „Alter Kreis“, „D“
  assert.equal(d.edges, 46);
  assert.equal(d.userName, "Test Nutzer");
});

test("Nicht sichtbare Obergruppe wird Platzhalter mit Namen", async () => {
  const d = await loadGroupData(CT, "test-token");
  const ph = d.byId[99];
  assert.equal(ph.placeholder, true);
  assert.equal(ph.name, "Leitung geheim");
  assert.deepEqual(ph.childIds, [7]);
  assert.equal(ph.frontendUrl, "");
  assert.ok(!d.groups.some((g) => g.id === 99), "Platzhalter zählt nicht als Gruppe");
});

test("Mehrere Obergruppen werden vollständig erfasst", async () => {
  const d = await loadGroupData(CT, "test-token");
  assert.deepEqual(d.byId[5].parentIds, [2, 3]);
  assert.deepEqual(d.byId[7].parentIds, [3, 99]);
  assert.equal(d.byId[5].frontendUrl, CT + "/groups/5");
  assert.equal(d.byId[5].groupTypeName, "Kleingruppe");
});

test("Falscher Token führt zu einem Fehler", async () => {
  await assert.rejects(loadGroupData(CT, "falsch"), /401/);
});
