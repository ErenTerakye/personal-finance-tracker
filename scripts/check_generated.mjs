import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["run", "generate:api"]);
run("npm", ["run", "build"]);
run("npm", ["run", "check:bundle"]);

const generated = spawnSync(
  "git",
  [
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    "frontend/src/generated/api.ts",
    "src/finance_tracker/web/static/spa",
  ],
  { encoding: "utf8" },
);
if (generated.status !== 0) process.exit(generated.status ?? 1);
if (generated.stdout.trim()) {
  console.error("Generated artifacts are stale:\n" + generated.stdout.trim());
  process.exit(1);
}
console.log("Generated API and packaged SPA assets match source.");
