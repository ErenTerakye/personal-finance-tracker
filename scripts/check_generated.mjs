import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const generatedRoots = [
  "frontend/src/generated/api.ts",
  "src/finance_tracker/web/static/spa",
];

async function snapshotGeneratedArtifacts() {
  const snapshot = new Map();

  async function visit(path) {
    const entries = await readdir(path, { withFileTypes: true }).catch(
      () => null,
    );
    if (entries) {
      for (const entry of entries) await visit(resolve(path, entry.name));
      return;
    }
    const contents = await readFile(path);
    snapshot.set(
      relative(process.cwd(), path),
      createHash("sha256").update(contents).digest("hex"),
    );
  }

  for (const root of generatedRoots) await visit(resolve(root));
  return snapshot;
}

const before = await snapshotGeneratedArtifacts();

run("npm", ["run", "generate:api"]);
run("npm", ["run", "build"]);
run("npm", ["run", "check:bundle"]);

const after = await snapshotGeneratedArtifacts();
const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
  (path) => before.get(path) !== after.get(path),
);
if (changed.length) {
  console.error(
    "Generated artifacts were stale and changed during verification:\n" +
      changed.map((path) => `  ${path}`).join("\n"),
  );
  process.exit(1);
}
console.log("Generated API and packaged SPA assets match source.");
