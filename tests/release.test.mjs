// Tests der Release-Bauskripte: Dateinamen ohne „v“ (ct-gruppenhierarchie-…-1.0…),
// der Tag selbst heißt weiter „v1.0“.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("Python-Paket heißt ct-gruppenhierarchie-python-1.0.zip und zeigt „Version 1.0“", () => {
  execFileSync("python3", ["tools/build_python.py", "v1.0"]);
  assert.ok(existsSync("dist/ct-gruppenhierarchie-python-1.0.zip"));
  const server = execFileSync("python3", [
    "-c",
    "import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read('ct-gruppenhierarchie-1.0/ct_gruppenhierarchie.py').decode())",
    "dist/ct-gruppenhierarchie-python-1.0.zip",
  ]).toString();
  assert.match(server, /VERSION = "v1\.0"/);
  assert.match(server, /"Version " \+ VERSION\.lstrip\("v"\)/);
});

test("Update-Datei der Desktop-App verweist auf Dateinamen ohne „v“", () => {
  const d = mkdtempSync(join(tmpdir(), "ctg-"));
  writeFileSync(join(d, "ct-gruppenhierarchie-windows-1.0-setup.exe.sig"), "sig-win");
  writeFileSync(join(d, "ct-gruppenhierarchie-linux-1.0.AppImage.sig"), "sig-linux");
  execFileSync("python3", ["tools/make_update_json.py", "v1.0", d]);
  const j = JSON.parse(readFileSync(join(d, "latest.json"), "utf8"));
  assert.equal(j.version, "1.0.0");
  assert.equal(j.notes, "CT Gruppenhierarchie 1.0");
  assert.equal(
    j.platforms["windows-x86_64"].url,
    "https://github.com/tihohub/ctgruppenhierarchie/releases/download/v1.0/ct-gruppenhierarchie-windows-1.0-setup.exe",
  );
  assert.equal(
    j.platforms["linux-x86_64"].url,
    "https://github.com/tihohub/ctgruppenhierarchie/releases/download/v1.0/ct-gruppenhierarchie-linux-1.0.AppImage",
  );
  assert.equal(j.platforms["windows-x86_64"].signature, "sig-win");
});
