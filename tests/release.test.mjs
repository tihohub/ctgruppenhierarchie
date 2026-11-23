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

test("Release-Sicherung lässt nur Version 1.x zu", () => {
  const pruefe = (v) => {
    try {
      execFileSync("python3", ["tools/release_check.py", v], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  };
  for (const v of ["v1.0", "v1.1", "v1.12"]) assert.equal(pruefe(v), true, v);
  for (const v of ["v2.0", "v2.0-beta1", "v28", "v1.1.1", "1.1", ""]) assert.equal(pruefe(v), false, v);
});

test("Release-Sicherung lehnt Stände ab, die nicht in main sind", () => {
  // ein Commit, den es in main nicht gibt
  const leer = execFileSync("git", ["mktree"], { input: "" }).toString().trim();
  const fremd = execFileSync("git", ["commit-tree", "-m", "fremd", leer], {
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  })
    .toString()
    .trim();
  assert.throws(() =>
    execFileSync("python3", ["tools/release_check.py", "v1.1", fremd], { stdio: "pipe" }),
  );
});
