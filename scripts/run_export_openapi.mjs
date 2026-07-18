import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const explicitPython = process.env.FINANCE_TRACKER_PYTHON;
const candidates = explicitPython
  ? [explicitPython]
  : [".venv/bin/python", ".venv/Scripts/python.exe", "python3"];
const python = candidates.find(
  (candidate) => candidate === "python3" || existsSync(candidate),
);

if (!python) {
  console.error(
    "OpenAPI generation needs Python 3.14+ with the project web dependencies. " +
      "Create .venv as documented or set FINANCE_TRACKER_PYTHON to the Python executable.",
  );
  process.exit(1);
}

const result = spawnSync(python, ["scripts/export_openapi.py"], {
  stdio: "inherit",
});
if (result.error) {
  console.error(`Could not run ${python}: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(
    "OpenAPI export failed. Install the project with .[dev,web], or set " +
      "FINANCE_TRACKER_PYTHON to an environment containing those dependencies.",
  );
  process.exit(result.status ?? 1);
}
