import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const assetDirectory = new URL("../src/finance_tracker/web/static/spa/assets/", import.meta.url);
const files = await readdir(assetDirectory);
const budgets = { ".js": 100 * 1024, ".css": 15 * 1024 };

for (const [extension, budget] of Object.entries(budgets)) {
  const matching = files.filter((file) => file.endsWith(extension));
  if (matching.length !== 1) throw new Error(`Expected one ${extension} bundle, found ${matching.length}.`);
  const bytes = await readFile(new URL(matching[0], assetDirectory));
  const gzipBytes = gzipSync(bytes).byteLength;
  if (gzipBytes > budget) {
    throw new Error(`${matching[0]} is ${gzipBytes} gzip bytes; budget is ${budget}.`);
  }
  console.log(`${matching[0]}: ${(gzipBytes / 1024).toFixed(2)} kB gzip`);
}
