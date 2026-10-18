import { resolve } from "node:path";
import { defineConfig } from "vite";
import { markdownPages } from "./markdown";

// See apps/examples/vite.config.ts: the dev server loses dist/styles.css after
// the package rebuilds it, so serve the stylesheet from source.
const sourceStyles = (command: "build" | "serve"): Record<string, string> =>
  command === "serve"
    ? {
        "@ogdakke/fluidbox/styles.css": resolve(
          import.meta.dirname,
          "../../packages/lightbox/src/styles.css",
        ),
      }
    : {};

export default defineConfig(({ command }) => ({
  plugins: [markdownPages()],
  resolve: { alias: sourceStyles(command) },
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
}));
