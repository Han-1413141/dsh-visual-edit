import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  cacheDir: fileURLToPath(new URL("../../node_modules/.vite-fixture", import.meta.url)),
  plugins: [
    react(),
    {
      name: "embedded-inspector-fixture",
      resolveId: (id) =>
        id === "virtual:visual-edit-inspector" ? "\0inspector" : undefined,
      load: (id) =>
        id === "\0inspector"
          ? `export default ${JSON.stringify(readFileSync(new URL("../../lib/inspector.js", import.meta.url), "utf8"))}`
          : undefined,
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 5178,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
  },
});
