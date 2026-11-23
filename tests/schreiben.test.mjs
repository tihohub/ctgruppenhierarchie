// Tests der Schreibfunktionen (Version 2.0) in web/ct-daten.js gegen den Schein-CT:
// Obergruppen ändern, Prüfung des aktuellen Stands, fehlende Rechte, Sperre der Testversion.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const CT_PORT = 8793;
const CT = `http://127.0.0.1:${CT_PORT}`;
let ct;

// ct-daten.js so laden, als liefe es unter der angegebenen Adresse (Extension, Testversion …);
// Anfragen gehen an den Schein-CT, mit angemeldeter CT-Sitzung
function laden(pathname) {
  const ctx = {
    URLSearchParams,
    console,
    location: { hostname: "127.0.0.1", port: String(CT_PORT), origin: CT, pathname },
    fetch: (url, opts = {}) =>
      fetch(url.startsWith("/") ? CT + url : url, {
        ...opts,
        headers: { ...(opts.headers || {}), Cookie: "ct_session=angemeldet" },
      }),
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync("web/ct-daten.js", "utf8"), ctx);
  const fn = (name) => async (...a) => {
    try {
      return JSON.parse(JSON.stringify(await vm.runInContext(name, ctx)(...a)));
    } catch (e) {
      throw Object.assign(new Error(e.message), { kind: e.kind, parents: e.parents });
    }
  };
  return {
    load: fn("loadGroupData"),
    change: fn("ctChangeParents"),
    parents: fn("ctParents"),
  };
}
const schreibAnfragen = async () =>
  (await (await fetch(CT + "/_test/requests")).json()).filter((r) => ["PUT", "DELETE"].includes(r.method));
const setzen = (group, parents) =>
  fetch(CT + "/_test/parents", { method: "POST", body: JSON.stringify({ group, parents }) });

before(async () => {
  ct = spawn("python3", ["tests/fake_ct.py", String(CT_PORT)], {
    env: { ...process.env, CTG_TESTSTAMM: "1" },
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
});

after(() => ct?.kill());

test("Extension: verschieben, zusätzlich einordnen und lösen", async () => {
  const x = laden("/ccm/gruppenhierarchie/");
  const m = await x.load(CT, "");
  // Y (6) von X (5) nach B (2) verschieben
  assert.deepEqual(await x.change(m, 6, [2], [5], [5]), [2]);
  assert.deepEqual(await x.parents(6), [2]);
  // zusätzlich unter A (1) einordnen
  assert.deepEqual(await x.change(m, 6, [1], [], [2]), [1, 2]);
  // von B lösen
  assert.deepEqual(await x.change(m, 6, [], [2], [1, 2]), [1]);
  // zurück in den Ausgangszustand
  assert.deepEqual(await x.change(m, 6, [5], [1], [1]), [5]);
});

test("Geänderter Stand in CT: nichts wird geschrieben", async () => {
  const x = laden("/ccm/gruppenhierarchie/");
  const m = await x.load(CT, "");
  await setzen(6, [2]); // jemand anderes hat Y inzwischen unter B gehängt
  const vorher = (await schreibAnfragen()).length;
  await assert.rejects(x.change(m, 6, [1], [5], [5]), (e) => e.kind === "conflict" && /inzwischen/.test(e.message));
  assert.equal((await schreibAnfragen()).length, vorher, "keine Schreibanfrage");
  await setzen(6, [5]);
});

test("Fehlende Rechte: verständliche Meldung, Teiländerung wird gemeldet", async () => {
  const x = laden("/ccm/gruppenhierarchie/");
  const m = await x.load(CT, "");
  // Y unter C (keine Rechte) → nichts geändert
  await assert.rejects(x.change(m, 6, [3], [], [5]), (e) => e.kind === "rights" && /nichts geändert/.test(e.message));
  assert.deepEqual(await x.parents(6), [5]);
  // X von C (keine Rechte) nach A: Hinzufügen klappt, Lösen nicht → „teilweise“
  await assert.rejects(x.change(m, 5, [1], [3], [2, 3]), (e) => e.kind === "partial" && e.parents.join() === "1,2,3");
  await setzen(5, [2, 3]);
});

test("Testversion: nur unterhalb von „Test Gruppenhierarchie“", async () => {
  const t = laden("/ccm/gruppenhierarchietest/");
  const m = await t.load(CT, "");
  // Test C (203) von Test A (201) nach Test B (202): erlaubt
  assert.deepEqual(await t.change(m, 203, [202], [201], [201]), [202]);
  // direkt unter den Teststamm: erlaubt
  assert.deepEqual(await t.change(m, 203, [200], [202], [202]), [200]);
  const vorher = (await schreibAnfragen()).length;
  // echte Gruppe Y: gesperrt
  await assert.rejects(t.change(m, 6, [2], [5], [5]), (e) => e.kind === "lock");
  // Testgruppe unter echte Gruppe A: gesperrt
  await assert.rejects(t.change(m, 203, [1], [], [200]), (e) => e.kind === "lock");
  // den Teststamm selbst verschieben: gesperrt
  await assert.rejects(t.change(m, 200, [1], [], []), (e) => e.kind === "lock");
  assert.equal((await schreibAnfragen()).length, vorher, "gesperrt heißt: keine Schreibanfrage");
});

test("Außerhalb der Extension wird nie geschrieben", async () => {
  const w = laden("/");
  const m = await laden("/ccm/gruppenhierarchie/").load(CT, "");
  const vorher = (await schreibAnfragen()).length;
  // Webseite: die Prüfung liest noch, aber jede Schreibanfrage wird abgelehnt
  await assert.rejects(w.change(m, 6, [2], [], [5]));
  assert.equal((await schreibAnfragen()).length, vorher);
});
