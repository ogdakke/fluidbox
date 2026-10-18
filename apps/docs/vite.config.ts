import { resolve } from "node:path";
import { defineConfig } from "vite";
import { markdownPages } from "./markdown";

/**
 * While serving, load @ogdakke/fluidbox from source. The package build writes
 * new hashed chunk names on every change, so a browser holding the dev page
 * imports chunks that no longer exist (on iOS the tab keeps running old code),
 * and the watcher loses dist/styles.css after its first rebuild. Builds use the
 * built package as consumers do.
 */
function packageSource(command: "build" | "serve") {
  if (command !== "serve") return [];
  const source = (file: string) =>
    resolve(import.meta.dirname, "../../packages/lightbox/src", file);
  return [
    { find: "@ogdakke/fluidbox/styles.css", replacement: source("styles.css") },
    ...["elements", "react", "solid", "vue", "angular"].map((entry) => ({
      find: `@ogdakke/fluidbox/${entry}`,
      replacement: source(`${entry}.ts`),
    })),
    { find: /^@ogdakke\/fluidbox$/, replacement: source("index.ts") },
  ];
}

export default defineConfig(({ command }) => ({
  plugins: [markdownPages()],
  resolve: { alias: packageSource(command) },
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
