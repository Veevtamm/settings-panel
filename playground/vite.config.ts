import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const port = Number(process.env.PORT) || undefined;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: process.env.HOST || "127.0.0.1",
    port,
    strictPort: port != null,
    allowedHosts: [".localhost"],
    fs: {
      allow: [repoRoot],
    },
  },
});
