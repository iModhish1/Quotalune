/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const legalDocumentId = "virtual:quotalis-legal-documents";
const resolvedLegalDocumentId = `\0${legalDocumentId}`;
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  plugins: [react(), {
    name: "quotalis-bundled-legal-documents",
    resolveId(id) { return id === legalDocumentId ? resolvedLegalDocumentId : null; },
    load(id) {
      if (id !== resolvedLegalDocumentId) return null;
      const read = (name: string) => readFileSync(resolve(repoRoot, name), "utf8");
      return `export default ${JSON.stringify({ license: read("LICENSE"), notice: read("NOTICE"), thirdPartyNotices: read("THIRD_PARTY_NOTICES.md") })}`;
    },
  }],
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  clearScreen: false,
  build: {rollupOptions:{output:{manualChunks(id) {if(id.includes("/echarts/") || id.includes("/zrender/"))return "analytics-engine";}}}},
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
