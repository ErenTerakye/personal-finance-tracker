import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "frontend",
  test: {
    exclude: ["e2e/**", "e2e-fullstack/**", "node_modules/**", "dist/**"],
    environment: "jsdom",
    fileParallelism: false,
    globals: true,
    setupFiles: "src/test/setup.ts",
    coverage: {
      provider: "v8",
      thresholds: {
        branches: 72,
        functions: 70,
        lines: 77,
        statements: 77,
      },
    },
  },
});
