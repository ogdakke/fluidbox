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
 * The package build replaces dist/styles.css by renaming a new file over it,
 * and the dev server's watcher loses the file after the first replacement, so
 * edits stop reaching the page. While serving, read the stylesheet from source.
 */
function sourceStyles(command: "build" | "serve"): Record<string, string> {
  return command === "serve"
    ? {
        "@ogdakke/fluidbox/styles.css": resolve(
          import.meta.dirname,
          "../../packages/lightbox/src/styles.css",
        ),
      }
    : {};
}

export default defineConfig(({ command }) => ({
  plugins: [react({ include: /(react|photo-library)\.tsx$/ }), solid({ include: /solid\.tsx$/ })],
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  resolve: { alias: sourceStyles(command) },
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
