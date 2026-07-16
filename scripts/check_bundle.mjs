import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const spaDirectory = new URL(
  "../src/finance_tracker/web/static/spa/",
  import.meta.url,
);
const assetDirectory = new URL("assets/", spaDirectory);
const manifest = JSON.parse(
  await readFile(new URL("asset-manifest.json", spaDirectory), "utf8"),
);
const html = await readFile(new URL("index.html", spaDirectory), "utf8");
const files = await readdir(assetDirectory);
const initialFiles = new Set(
  [...html.matchAll(/(?:src|href)="(?:\.\/|\/)assets\/([^"]+)"/g)].map(
    (match) => match[1],
  ),
);
const gzipSize = async (file) =>
  gzipSync(await readFile(new URL(file, assetDirectory))).byteLength;

const kibibytes = 1024;
const budgets = {
  initialJavaScript: 100 * kibibytes,
  initialCss: 12 * kibibytes,
  lazyJavaScriptChunk: 45 * kibibytes,
  lazyCssChunk: 7 * kibibytes,
  routeCss: 8 * kibibytes,
  totalCss: 30 * kibibytes,
};
const routes = [
  {
    label: "dashboard route CSS",
    source: "src/features/dashboard/DashboardView.tsx",
    budget: budgets.routeCss,
  },
  {
    label: "rules route CSS",
    source: "src/features/rules/RulesView.tsx",
    budget: budgets.routeCss,
  },
  {
    label: "net worth route CSS",
    source: "src/features/net-worth/NetWorthView.tsx",
    budget: budgets.routeCss,
  },
  {
    label: "transactions route CSS",
    source: "src/features/transactions/TransactionsView.tsx",
    budget: budgets.routeCss,
  },
  {
    label: "budgets route CSS",
    source: "src/features/budgets/BudgetsView.tsx",
    budget: budgets.routeCss,
  },
];

const initialJavaScript = files.filter(
  (file) => file.endsWith(".js") && initialFiles.has(file),
);
const initialCss = files.filter(
  (file) => file.endsWith(".css") && initialFiles.has(file),
);
const lazyJavaScript = files.filter(
  (file) => file.endsWith(".js") && !initialFiles.has(file),
);
const lazyCss = files.filter(
  (file) => file.endsWith(".css") && !initialFiles.has(file),
);
const allCss = [...initialCss, ...lazyCss];
const initialCssPaths = new Set(initialCss.map((file) => `assets/${file}`));

const formatSize = (size) => `${(size / kibibytes).toFixed(2)} KiB`;

async function checkTotal(label, matching, budget) {
  if (!matching.length)
    throw new Error(`Expected at least one ${label} asset.`);
  const sizes = await Promise.all(matching.map(gzipSize));
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (total > budget) {
    throw new Error(
      `${label} is ${formatSize(total)} gzip; budget is ${formatSize(budget)}.`,
    );
  }
  const utilization = ((total / budget) * 100).toFixed(1);
  console.log(
    `${label}: ${formatSize(total)} / ${formatSize(budget)} gzip (${utilization}%)`,
  );
}

async function checkChunks(label, matching, budget) {
  for (const file of matching) {
    const size = await gzipSize(file);
    if (size > budget) {
      throw new Error(
        `${file} is ${formatSize(size)} gzip; ${label} budget is ${formatSize(budget)}.`,
      );
    }
    console.log(
      `${file}: ${formatSize(size)} / ${formatSize(budget)} gzip (${label})`,
    );
  }
}

function collectCss(chunkKey, visited = new Set()) {
  if (visited.has(chunkKey)) return new Set();
  visited.add(chunkKey);

  const chunk = manifest[chunkKey];
  if (!chunk) throw new Error(`Vite manifest is missing chunk ${chunkKey}.`);

  const css = new Set(chunk.css ?? []);
  for (const importedChunk of chunk.imports ?? []) {
    for (const file of collectCss(importedChunk, visited)) css.add(file);
  }
  return css;
}

async function checkRouteCss({ label, source, budget }) {
  const chunk = manifest[source];
  if (!chunk?.isDynamicEntry) {
    throw new Error(`Expected ${source} to be a dynamic Vite entry.`);
  }

  const routeCss = [...collectCss(source)].filter(
    (file) => !initialCssPaths.has(file),
  );
  if (!routeCss.length) throw new Error(`Expected ${label} to load CSS.`);

  const sizes = await Promise.all(
    routeCss.map(async (file) => ({
      file,
      size: await gzipSize(file.replace(/^assets\//, "")),
    })),
  );
  const total = sizes.reduce((sum, { size }) => sum + size, 0);
  if (total > budget) {
    const breakdown = sizes
      .map(({ file, size }) => `${file} ${formatSize(size)}`)
      .join(", ");
    throw new Error(
      `${label} is ${formatSize(total)} gzip; budget is ${formatSize(budget)}. Loaded CSS: ${breakdown}.`,
    );
  }
  const utilization = ((total / budget) * 100).toFixed(1);
  console.log(
    `${label}: ${formatSize(total)} / ${formatSize(budget)} gzip (${utilization}%)`,
  );
}

await checkTotal(
  "initial JavaScript",
  initialJavaScript,
  budgets.initialJavaScript,
);
await checkTotal("initial CSS", initialCss, budgets.initialCss);
await checkChunks(
  "lazy JavaScript chunk",
  lazyJavaScript,
  budgets.lazyJavaScriptChunk,
);
await checkChunks("lazy CSS chunk", lazyCss, budgets.lazyCssChunk);
for (const route of routes) await checkRouteCss(route);
await checkTotal("total CSS", allCss, budgets.totalCss);
