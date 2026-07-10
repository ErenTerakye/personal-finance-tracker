import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const label = process.argv[3] ?? "local";
const samples = [];
const browser = await chromium.launch({ headless: true });

try {
  for (let index = 0; index < 3; index += 1) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await page.addInitScript(() => {
      window.__financeTrackerVitals = { cls: 0, inp: 0, lcp: 0 };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__financeTrackerVitals.lcp = entry.startTime;
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__financeTrackerVitals.cls += entry.value;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__financeTrackerVitals.inp = Math.max(
            window.__financeTrackerVitals.inp,
            entry.duration,
          );
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    });

    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const initial = await page.evaluate(() => ({
      ...window.__financeTrackerVitals,
    }));

    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Transactions" })
      .click();
    await page.getByRole("heading", { name: "Transactions" }).waitFor();
    await page.getByRole("button", { name: "Add entry" }).click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);

    const interacted = await page.evaluate(() => ({
      ...window.__financeTrackerVitals,
    }));
    samples.push({
      cls: interacted.cls,
      inp: interacted.inp,
      lcp: initial.lcp,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

const median = Object.fromEntries(
  ["lcp", "inp", "cls"].map((metric) => {
    const values = samples
      .map((sample) => sample[metric])
      .sort((left, right) => left - right);
    return [metric, values[1]];
  }),
);

console.log(JSON.stringify({ label, median, samples, url }, null, 2));

if (median.lcp > 2_500 || median.inp > 200 || median.cls > 0.1) {
  throw new Error(`Web-vitals lab thresholds exceeded for ${label}.`);
}
