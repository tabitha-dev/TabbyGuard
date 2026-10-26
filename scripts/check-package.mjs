import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd,
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
});
assert.equal(result.status, 0, "npm pack dry-run failed: " + result.stderr);
const packages = JSON.parse(result.stdout);
assert.equal(packages.length, 1, "Expected one npm tarball");
const tarball = packages[0];
assert.equal(tarball.name, "tabbyguard");
assert.equal(tarball.version, manifest.version);
const names = new Set(tarball.files.map((file) => file.path));
for (const required of [
  "package.json",
  "README.md",
  "LICENSE",
  "action.yml",
  "dist/index.js",
  "dist/licenses.txt",
]) {
  assert(names.has(required), "Missing required published asset: " + required);
}
for (const filename of names) {
  assert(
    /^(dist\/|README\.md$|LICENSE$|action\.yml$|package\.json$)/.test(filename),
    "Unexpected file in the npm package: " + filename,
  );
}
assert.equal(manifest.bin.tabbyguard, "dist/index.js");
assert(tarball.size > 0, "Tarball cannot be empty");
console.log(
  "npm release package contents validated:",
  tarball.filename,
  "(" + tarball.files.length + " files, " + tarball.size + " bytes)",
);
