import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";
import { defineConfig } from "vite";

// Every HTML file is a page: index.html and */index.html are the site, the rest are test fixtures.
function findPages(directory: string, prefix = ""): [string, string][] {
  return readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      return ["node_modules", "dist", "public", "src", "scripts"].includes(entry.name)
        ? []
        : findPages(directory, path);
    }
    return entry.name.endsWith(".html") ? [[path.slice(0, -".html".length), path]] : [];
  });
}
const pages = Object.fromEntries(findPages(import.meta.dirname));

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
  plugins: [react({ include: /(react|photo-library)\.tsx$/ }), solid({ include: /solid\.tsx$/ })],
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  resolve: {
    alias: packageSource(command),
    // Package source resolves frameworks from its own node_modules; keep one copy.
    dedupe: ["react", "react-dom", "solid-js", "vue", "@angular/core", "@angular/common"],
  },
  server: {
    allowedHosts: true,
    port: Number(process.env.PORT) || 5173,
    strictPort: Boolean(process.env.PORT),
  },
  preview: {
    allowedHosts: true,
    port: Number(process.env.PORT) || 4173,
    strictPort: Boolean(process.env.PORT),
  },
  build: {
    rollupOptions: { input: pages },
  },
}));
