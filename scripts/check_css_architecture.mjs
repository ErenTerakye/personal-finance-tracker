import { readdir, readFile } from "node:fs/promises";

const sourceDirectory = new URL("../frontend/src/", import.meta.url);
const stylesDirectory = new URL(
  "../frontend/src/shared/styles/",
  import.meta.url,
);
const buildAssetsDirectory = new URL(
  "../src/finance_tracker/web/static/spa/assets/",
  import.meta.url,
);
const layers = [
  "tokens",
  "reset",
  "base",
  "layout",
  "components",
  "features",
  "utilities",
  "overrides",
];
const expectedOrder = `@layer ${layers.join(", ")};`;
const indexCss = (
  await readFile(new URL("index.css", stylesDirectory), "utf8")
).trim();

if (indexCss !== expectedOrder) {
  throw new Error(`index.css must contain exactly: ${expectedOrder}`);
}

const sourceCssFiles = (await readdir(sourceDirectory, { recursive: true }))
  .filter((path) => path.endsWith(".css"))
  .filter((path) => path !== "shared/styles/index.css");

for (const relativePath of sourceCssFiles) {
  const sourceUrl = new URL(relativePath, sourceDirectory);
  const source = await readFile(sourceUrl, "utf8");
  const declared = [...source.matchAll(/@layer\s+([a-z-]+)/g)].map(
    (match) => match[1],
  );
  const owner = declared[0];
  if (!owner || !layers.includes(owner)) {
    throw new Error(
      `${relativePath} must start with one of the ordered CSS layers.`,
    );
  }
  if (!source.trimStart().startsWith(`@layer ${owner} {`)) {
    throw new Error(`${relativePath} must be wrapped by @layer ${owner}.`);
  }
  if (/@import\s/i.test(source)) {
    throw new Error(`${relativePath} must not contain runtime @import rules.`);
  }
  const nonTokenTracking = [
    ...source.matchAll(/letter-spacing\s*:\s*([^;]+);/g),
  ].find((match) => !/^var\(--tracking-[a-z-]+\)$/.test(match[1].trim()));
  if (nonTokenTracking) {
    throw new Error(
      `${relativePath} must use a role-based --tracking-* token for letter-spacing.`,
    );
  }
  const unexpected = declared.find((name) => name !== owner);
  if (unexpected) {
    throw new Error(
      `${relativePath} declares both ${owner} and unexpected layer ${unexpected}.`,
    );
  }
}

const assets = await readdir(buildAssetsDirectory);
const builtCssFiles = assets.filter((name) => name.endsWith(".css"));
if (!builtCssFiles.length) {
  throw new Error("The packaged SPA must contain a built CSS asset.");
}
let hasGlobalLayerOrder = false;
for (const file of builtCssFiles) {
  const builtCss = await readFile(new URL(file, buildAssetsDirectory), "utf8");
  if (/@import\s/i.test(builtCss)) {
    throw new Error(`${file} contains a runtime @import rule.`);
  }
  const declared = [
    ...builtCss.matchAll(/@layer\s+([a-z-]+)(?=\s*[{,;])/g),
  ].map((match) => match[1]);
  const unexpected = declared.find((name) => !layers.includes(name));
  if (unexpected) {
    throw new Error(`${file} declares unexpected layer ${unexpected}.`);
  }
  const emittedOrder = [...new Set(declared)];
  const layerPositions = emittedOrder.map((name) => layers.indexOf(name));
  const isOrdered = layerPositions.every(
    (position, index) => index === 0 || position > layerPositions[index - 1],
  );
  if (!isOrdered) {
    throw new Error(
      `${file} emits CSS layers out of order: ${emittedOrder.join(", ") || "none"}.`,
    );
  }
  if (emittedOrder.join(",") === layers.join(",")) hasGlobalLayerOrder = true;
}

if (!hasGlobalLayerOrder) {
  throw new Error(
    "The packaged SPA must emit the complete global layer order.",
  );
}

console.log(`CSS architecture: ${layers.length} ordered layers verified.`);
