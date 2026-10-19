import { resolve } from "node:path";
import type { Alias, Plugin } from "vite";

const packages = resolve(import.meta.dirname, "../../packages");
const core = (file: string) => resolve(packages, "fluidbox/src", file);
const bindings = ["react", "solid", "vue", "angular"];

/**
 * While serving, load @ogdakke/fluidbox from source. The package build writes
 * new hashed chunk names on every change, so a browser holding the dev page
 * imports chunks that no longer exist (on iOS the tab keeps running old code),
 * and the watcher loses dist/styles.css after its first rebuild. Builds use the
 * built package as consumers do.
 */
export function packageSource(command: "build" | "serve"): Alias[] {
  if (command !== "serve") return [];
  return [
    { find: "@ogdakke/fluidbox/styles.css", replacement: core("styles.css") },
    { find: "@ogdakke/fluidbox/sheet.css", replacement: core("sheet.css") },
    { find: "@ogdakke/fluidbox/filmstrip.css", replacement: core("filmstrip.css") },
    { find: "@ogdakke/fluidbox/filmstrip", replacement: core("filmstrip-entry.ts") },
    { find: "@ogdakke/fluidbox/sheet", replacement: core("sheet-entry.ts") },
    { find: "@ogdakke/fluidbox/kit", replacement: core("kit.ts") },
    { find: "@ogdakke/fluidbox/elements", replacement: core("elements.ts") },
    ...bindings.map((name) => ({
      find: `@ogdakke/fluidbox/${name}`,
      replacement: resolve(packages, name, "src/index.ts"),
    })),
    { find: /^@ogdakke\/fluidbox$/, replacement: core("index.ts") },
  ];
}

/**
 * Watch the package sources as folders. Vite watches files outside the app
 * one by one, and a file replaced on disk (an editor's atomic save, a git
 * checkout or stash) drops its watch, so the page would keep that file's old
 * code until the server restarts.
 */
export function watchPackageSource(): Plugin {
  return {
    name: "watch-package-source",
    apply: "serve",
    configureServer(server) {
      for (const name of ["fluidbox", ...bindings]) {
        server.watcher.add(resolve(packages, name, "src"));
      }
    },
  };
}
