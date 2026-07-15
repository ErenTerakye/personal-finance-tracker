import { readdir, readFile } from "node:fs/promises";

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

for (const layer of layers) {
  const source = await readFile(
    new URL(`${layer}.css`, stylesDirectory),
    "utf8",
  );
  if (!source.trimStart().startsWith(`@layer ${layer} {`)) {
    throw new Error(`${layer}.css must be owned by @layer ${layer}.`);
  }
  if (/@import\s/i.test(source)) {
    throw new Error(`${layer}.css must not contain runtime @import rules.`);
  }
  const declared = [...source.matchAll(/@layer\s+([a-z-]+)/g)].map(
    (match) => match[1],
  );
  const unexpected = declared.find((name) => name !== layer);
  if (unexpected) {
    throw new Error(`${layer}.css declares unexpected layer ${unexpected}.`);
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
