import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const port = Number(process.env.PORT) || undefined;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stageshowKit = path.join(os.homedir(), ".agents/skills/stageshow/kit");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "stageshow-kit": stageshowKit },
  },
  server: {
    host: process.env.HOST || "127.0.0.1",
    port,
    strictPort: port != null,
    allowedHosts: [".localhost"],
    fs: {
      allow: [repoRoot, stageshowKit],
    },
  },
});
