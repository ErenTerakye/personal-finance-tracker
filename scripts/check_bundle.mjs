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

const initialJavaScript = files.filter(
  (file) => file.endsWith(".js") && initialFiles.has(file),
);
const initialCss = files.filter(
  (file) => file.endsWith(".css") && initialFiles.has(file),
);
const lazyJavaScript = files.filter(
  (file) => file.endsWith(".js") && !initialFiles.has(file),
);

async function checkTotal(label, matching, budget) {
  if (!matching.length)
    throw new Error(`Expected at least one ${label} asset.`);
  const sizes = await Promise.all(matching.map(gzipSize));
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (total > budget) {
    throw new Error(`${label} is ${total} gzip bytes; budget is ${budget}.`);
  }
  console.log(`${label}: ${(total / 1024).toFixed(2)} kB gzip`);
}

await checkTotal("initial JavaScript", initialJavaScript, 100 * 1024);
await checkTotal("initial CSS", initialCss, 15 * 1024);
for (const file of lazyJavaScript) {
  const size = await gzipSize(file);
  const budget = 45 * 1024;
  if (size > budget) {
    throw new Error(
      `${file} is ${size} gzip bytes; lazy chunk budget is ${budget}.`,
    );
  }
  console.log(`${file}: ${(size / 1024).toFixed(2)} kB gzip (lazy)`);
}
