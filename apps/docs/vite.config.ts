import { resolve } from "node:path";
import { defineConfig } from "vite";
import { markdownPages } from "./markdown";

export default defineConfig({
  plugins: [markdownPages()],
  // Share the example site's generated artwork and map snapshot for live demos.
  publicDir: resolve(import.meta.dirname, "../examples/public"),
  server: {
    allowedHosts: true,
    port: Number(process.env.PORT) || 5180,
    strictPort: Boolean(process.env.PORT),
  },
  preview: {
    allowedHosts: true,
    port: Number(process.env.PORT) || 4180,
    strictPort: Boolean(process.env.PORT),
  },
});
