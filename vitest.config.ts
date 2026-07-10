import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "frontend",
  test: {
    exclude: ["e2e/**", "e2e-fullstack/**", "node_modules/**", "dist/**"],
    environment: "jsdom",
    globals: true,
    setupFiles: "src/test/setup.ts",
  },
});
