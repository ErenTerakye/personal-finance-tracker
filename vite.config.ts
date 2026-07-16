import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "frontend",
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  build: {
    outDir: "../src/finance_tracker/web/static/spa",
    emptyOutDir: true,
    assetsDir: "assets",
    manifest: "asset-manifest.json",
  },
});
