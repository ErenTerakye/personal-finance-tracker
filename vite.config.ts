import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "frontend",
  build: {
    outDir: "../src/finance_tracker/web/static/spa",
    emptyOutDir: true,
    assetsDir: "assets"
  }
});
