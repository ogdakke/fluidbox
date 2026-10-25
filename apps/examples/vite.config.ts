import { readdirSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";
import vue from "@vitejs/plugin-vue";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { highlight, highlightHtml } from "../design/highlight";
import { packageSource, watchPackageSource } from "../design/package-source";
import { fluidboxStaticViewer } from "../../packages/fluidbox/src/static-viewer";
import { cspItems } from "./fixtures/csp-items";
import { exampleRegions } from "./src/patterns/regions";

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
 * `import html from "./basic.ts?highlighted"`: the file's example regions as
 * highlighted HTML, made at build time so the page ships no highlighter.
 */
function highlightedSource(): Plugin {
  const query = "?highlighted";
  return {
    name: "highlighted-source",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.endsWith(query)) return null;
      const resolved = await this.resolve(source.slice(0, -query.length), importer, {
        skipSelf: true,
      });
      return resolved && `\0${resolved.id}${query}`;
    },
    load(id) {
      if (!id.startsWith("\0") || !id.endsWith(query)) return null;
      const file = id.slice(1, -query.length);
      this.addWatchFile(file);
      const extension = file.split(".").pop()!;
      const lang = extension;
      const code = exampleRegions(readFileSync(file, "utf8")).join("\n\n");
      return `export default ${JSON.stringify(highlight(code, lang))};`;
    },
  };
}

/**
 * `?delay=1500` on any request holds the response back that long, so a
 * fixture can show what loading looks like. Capped at ten seconds.
 */
function delayedResponses(): Plugin {
  const hold = (request: { url?: string }, _response: unknown, next: () => void) => {
    const ms = Number(new URL(request.url ?? "/", "http://host").searchParams.get("delay"));
    if (ms > 0) setTimeout(next, Math.min(ms, 10_000));
    else next();
  };
  return {
    name: "delayed-responses",
    configureServer: (server) => void server.middlewares.use(hold),
    configurePreviewServer: (server) => void server.middlewares.use(hold),
  };
}

/**
 * The strict-CSP fixture, `csp.html`: `?ssr=1` renders the open viewer's copy
 * into it, as a server would. The page allows no inline script, so the dev
 * server's inline preambles come out; the fixture loads none of their modules.
 * `?vue` renders the Vue Root's HTML into it, for the client to hydrate.
 */
function cspFixture(): Plugin {
  let server: ViteDevServer | undefined;
  return {
    name: "csp-fixture",
    configureServer(devServer) {
      server = devServer;
    },
    transformIndexHtml: {
      order: "post",
      async handler(html, context) {
        if (context.path !== "/csp.html") return html;
        const ssr = new URL(context.originalUrl ?? "/", "http://host").searchParams.get("ssr");
        const copy =
          ssr === null
            ? ""
            : fluidboxStaticViewer({ items: cspItems, value: cspItems[Number(ssr) || 0]!.id! });
        const vue =
          server && new URL(context.originalUrl ?? "/", "http://host").searchParams.has("vue")
            ? await (
                (await server.ssrLoadModule("/fixtures/csp-vue-server.ts")) as {
                  renderCspVue: () => Promise<string>;
                }
              ).renderCspVue()
            : "";
        return html
          .replace("<!--fluidbox-static-viewer-->", copy ?? "")
          .replace("<div data-csp-vue></div>", `<div data-csp-vue>${vue}</div>`)
          .replace(/<script type="module">[\s\S]*?<\/script>/g, "");
      },
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    react({ include: [/(photo-library|social|shop)\.tsx$/, /patterns\/react\/.*\.tsx$/] }),
    solid({ include: [/patterns\/solid\/.*\.tsx$/] }),
    vue(),
    highlightedSource(),
    delayedResponses(),
    cspFixture(),
    highlightHtml(),
    watchPackageSource(),
  ],
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
