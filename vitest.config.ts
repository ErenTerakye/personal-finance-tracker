import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "frontend",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "src/test/setup.ts"
  }
});
