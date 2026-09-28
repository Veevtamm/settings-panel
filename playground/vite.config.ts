import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const port = Number(process.env.PORT) || undefined;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port, strictPort: port != null, allowedHosts: [".localhost"] },
});
