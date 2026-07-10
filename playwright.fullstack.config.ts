import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./frontend/e2e-fullstack",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8010",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      ".venv/bin/finance-tracker web --host 127.0.0.1 --port 8010 --db-path build/e2e.sqlite3",
    url: "http://127.0.0.1:8010/api/settings",
    reuseExistingServer: false,
  },
});
