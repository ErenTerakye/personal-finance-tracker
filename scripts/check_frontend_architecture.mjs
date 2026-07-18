import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const featuresRoot = path.resolve("frontend/src/features");
const sourceExtensions = new Set([".ts", ".tsx"]);
const violations = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(entryPath);
    else if (sourceExtensions.has(path.extname(entry.name)))
      await inspect(entryPath);
  }
}

async function inspect(sourcePath) {
  const sourceFeature = path
    .relative(featuresRoot, sourcePath)
    .split(path.sep)[0];
  const contents = await readFile(sourcePath, "utf8");
  const importPattern =
    /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of contents.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const targetPath = path.resolve(path.dirname(sourcePath), specifier);
    const relativeTarget = path.relative(featuresRoot, targetPath);
    if (
      relativeTarget.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeTarget)
    )
      continue;
    const targetFeature = relativeTarget.split(path.sep)[0];
    if (targetFeature !== sourceFeature) {
      violations.push(
        `${path.relative(process.cwd(), sourcePath)} imports ${specifier}`,
      );
    }
  }
}

await visit(featuresRoot);
if (violations.length) {
  throw new Error(
    `Cross-feature imports are forbidden:\n${violations.join("\n")}`,
  );
}
console.log("Frontend architecture: cross-feature imports verified.");
