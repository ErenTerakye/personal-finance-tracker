import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const spaDirectory = new URL(
  "../src/finance_tracker/web/static/spa/",
  import.meta.url,
);
const assetDirectory = new URL("assets/", spaDirectory);
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
  initialCss: 24 * kibibytes,
  lazyJavaScriptChunk: 45 * kibibytes,
  lazyCssChunk: 5 * kibibytes,
  totalCss: 28 * kibibytes,
};

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
await checkTotal("total CSS", allCss, budgets.totalCss);
