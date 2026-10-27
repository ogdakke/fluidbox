// Builds the docs from content/**/*.md: one route per page under /docs/, framework tabs for
// every pattern (code from apps/examples/src/patterns), prerendered HTML for each route, and
// plain Markdown copies plus llms.txt for agents. The API and CSS references are read from the
// package source (see api-source.ts and css-source.ts).
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, posix, relative } from "node:path";
import MarkdownIt from "markdown-it";
import { measureEntry } from "../../scripts/bundle-size";
import { apiSources, checkApiCoverage, expandApi, isApiSource } from "./api-source";
import { checkCss, cssSources, expandCss } from "./css-source";
import { highlight } from "../design/highlight";
import { frameworkIcon } from "../design/icons";
import type { Plugin, ViteDevServer } from "vite";
import { exampleRegions } from "../examples/src/patterns/regions";
import { frameworks, type Framework } from "./src/frameworks";
import { renderArticle, renderNav, renderToc, type DocHeading, type DocMeta } from "./src/render";

/** `summary` is the Markdown with each pattern as a link instead of its code, for llms-full.txt. */
export type DocPage = DocMeta & { html: string; markdown: string; summary: string };

const contentDir = join(import.meta.dirname, "content");
const patternsDir = join(import.meta.dirname, "../examples/src/patterns");
/** The deployed origin for absolute links in llms.txt; relative when unset. */
const site = process.env.DOCS_SITE?.replace(/\/$/, "") ?? "";
const sections = ["Start", "Patterns", "Frameworks", "Guides", "Reference"];

/** `index` → `/docs/`; `patterns/basic` → `/docs/patterns/basic/`. */
export function routeFor(slug: string): string {
  if (slug === "index") return "/docs/";
  return `/docs/${slug.replace(/\/index$/, "")}/`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function frontmatter(source: string): [Record<string, string>, string] {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) return [{}, source];
  const data: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const separator = line.indexOf(":");
    if (separator > 0) data[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return [data, source.slice(match[0].length)];
}

const codeBlock = (code: string, lang: string, label = lang || "text") =>
  `<div class="doc-code"><span class="doc-code__lang">${label}</span>${highlight(code, lang)}</div>`;

/** The package managers an install command is shown for, in tab order. */
const packageManagers = [
  { key: "pnpm", add: "pnpm add" },
  { key: "npm", add: "npm install" },
  { key: "yarn", add: "yarn add" },
  { key: "bun", add: "bun add" },
] as const;

/** A one-line install, as `npm install …` or `pnpm add …`, as tabs, one per package manager; anything else is null. */
export function installTabs(code: string, lang = "bash"): string | null {
  const match = /^(?:npm install|pnpm add|yarn add|bun add) ([^\n]+?)\s*$/.exec(code);
  if (!match || !["bash", "sh", "shell"].includes(lang)) return null;
  const packages = match[1]!;
  const tabs = packageManagers
    .map(
      ({ key }, index) =>
        `<button type="button" role="tab" data-package-manager="${key}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${key}</button>`,
    )
    .join("");
  const panels = packageManagers
    .map(
      ({ key, add }, index) =>
        `<div role="tabpanel" data-package-manager="${key}"${index === 0 ? "" : " hidden"}>${codeBlock(`${add} ${packages}`, "bash", "shell")}</div>`,
    )
    .join("");
  return `<div class="doc-install"><div class="doc-install__list" role="tablist" aria-label="Package manager">${tabs}</div>${panels}</div>`;
}

const INSTALL_DIRECTIVE = /<!--\s*install:\s*([^>]+?)\s*-->/g;
const BUNDLE_SIZE_DIRECTIVE = /<!--\s*bundle-size:\s*(initial|viewer|css)\s*-->/g;

type BundleSizes = Record<"initial" | "viewer" | "css", string>;
const kilobytes = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`;

/**
 * The React binding's cost, gzipped and without React itself: `initial` loads with the page,
 * `viewer` loads when a viewer first opens, `css` is the stylesheet. `bun run test:bundle`
 * measures the same bundle, though Bun's gzip comes out a few hundred bytes larger than Node's.
 * Reads the built package, so it needs `bun run build`.
 */
let bundleSizes: Promise<BundleSizes> | undefined;
function measureBundleSizes(): Promise<BundleSizes> {
  const root = join(import.meta.dirname, "../..");
  bundleSizes ??= measureEntry("react", root).then(({ initialJs, activationJs }) => ({
    initial: kilobytes(initialJs.gzipBytes),
    viewer: kilobytes(activationJs.gzipBytes - initialJs.gzipBytes),
    css: kilobytes(
      gzipSync(readFileSync(join(root, "packages/fluidbox/dist/styles.css"))).byteLength,
    ),
  }));
  return bundleSizes;
}

/**
 * Shared example data reads as a local module (shown in the patterns overview); the tests'
 * `data-test` hooks go in every form: markup and JSX attributes (`data-test="x"`,
 * `data-test={x}`, Vue `:data-test`, Angular `[attr.data-test]`), object keys (`h()` props,
 * Angular `host`), and `el.dataset.test = ...` statements.
 */
export const forDocs = (code: string) =>
  code
    .replaceAll(/(["'])\.\.\/shared\1/g, '"./data"')
    .replaceAll(/^[ \t]*(?::|\[attr\.)?data-test\]?=("[^"]*"|\{[^}]*\})\n/gm, "")
    .replaceAll(/ (?::|\[attr\.)?data-test\]?=("[^"]*"|\{[^}]*\})/g, "")
    .replaceAll(/,\s*(["'])data-test\1:\s*(["'])[^"']*\2/g, "")
    .replaceAll(/(["'])data-test\1:\s*(["'])[^"']*\2,\s*/g, "")
    .replaceAll(/\n[ \t]*\w+\.dataset\.test = [^;\n]+;/g, "");

/** Names the examples import from `./data`. */
const dataImports = (code: string) =>
  [...code.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"\.\/data"/g)].flatMap((match) =>
    match[1]!
      .split(",")
      .map((name) => name.trim().replace(/^type\s+/, ""))
      .filter(Boolean),
  );

/**
 * The patterns overview's "The example data" section is the `./data` every example imports, so a
 * pattern that imports a name the section doesn't define fails the build. `patterns` are the ones
 * the pages embed, wherever they are.
 */
function checkExampleData(overview: string, patterns: readonly string[]) {
  const section = /^## The example data\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(overview)?.[1] ?? "";
  const defined = new Set(
    [...section.matchAll(/^export (?:const|function|type|interface) (\w+)/gm)].map(
      (match) => match[1]!,
    ),
  );
  const missing = new Set<string>();
  for (const { key } of frameworks) {
    for (const pattern of patterns) {
      for (const { file, code } of patternFiles(key, pattern)) {
        for (const name of dataImports(code)) {
          if (!defined.has(name)) missing.add(`${name} (${key}/${file})`);
        }
        const local = /from\s*"(\.{1,2}\/(?!data")[^"]*)"/.exec(code);
        if (local) missing.add(`${local[1]} (${key}/${file})`);
      }
    }
  }
  if (missing.size) {
    throw new Error(
      `Pattern examples import names the docs never define: ${[...missing].join(", ")}. Define them under "The example data" in content/patterns/index.md.`,
    );
  }
}

const languageOf = (file: string) =>
  ({ tsx: "tsx", ts: "ts", vue: "vue", html: "html" })[file.split(".").pop()!] ?? "text";

/** The files that make one pattern for one framework, with their example regions. */
export function patternFiles(framework: Framework, pattern: string) {
  const directory = join(patternsDir, framework);
  return readdirSync(directory)
    .filter((file) => new RegExp(`^${pattern}\\.(tsx|ts|vue|html)$`, "i").test(file))
    .sort((a, b) => (a.endsWith(".html") ? -1 : b.endsWith(".html") ? 1 : a.localeCompare(b)))
    .map((file) => ({
      file,
      lang: languageOf(file),
      code: exampleRegions(readFileSync(join(directory, file), "utf8"))
        .map(forDocs)
        .join("\n\n"),
    }));
}

/** Framework tabs with a live example and the code that made it. */
export function patternTabs(pattern: string): string {
  const tabs = frameworks
    .map(
      ({ key, label }, index) =>
        `<button type="button" role="tab" data-framework="${key}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${frameworkIcon(key)}${label}</button>`,
    )
    .join("");
  const panels = frameworks
    .map(({ key }, index) => {
      const files = patternFiles(key, pattern)
        .map(({ file, lang, code }) => codeBlock(code, lang, file))
        .join("");
      return `<div role="tabpanel" data-framework="${key}"${index === 0 ? "" : " hidden"}>${files}</div>`;
    })
    .join("");
  return `<div class="doc-tabs" data-pattern="${pattern}">
<div class="doc-tabs__list" role="tablist" aria-label="Framework">${tabs}</div>
<div class="doc-live" aria-label="Live example"><p class="doc-live__hint">Loading the live example…</p></div>
${panels}
</div>`;
}

/** The same tabs as Markdown, one section per framework. */
function patternMarkdown(pattern: string): string {
  return frameworks
    .map(({ key, label }) => {
      const files = patternFiles(key, pattern)
        .map(({ file, lang, code }) => `\`${file}\`\n\n\`\`\`${lang}\n${code}\n\`\`\``)
        .join("\n\n");
      return `#### ${label}\n\n${files}`;
    })
    .join("\n\n");
}

/** A pattern as a pointer to its page's Markdown, which has the code in every framework. */
function patternLink(slug: string): string {
  const url = `${site}${routeFor(slug).replace(/\/$/, "")}.md`;
  return `The code for this example in every framework (${frameworks.map(({ label }) => label).join(", ")}) is in [${url}](${url}).`;
}

const PATTERN_DIRECTIVE = /<!--\s*pattern:\s*([\w-]+)\s*-->/g;

function createRenderer() {
  const md = new MarkdownIt({ html: true, linkify: true });
  // A fence renders as its frame alone; markdown-it would wrap it in a second <pre>.
  md.renderer.rules.fence = (tokens, idx) => {
    const { content, info } = tokens[idx]!;
    const lang = info.trim().split(/\s+/)[0] ?? "";
    return installTabs(content.replace(/\n$/, ""), lang) ?? codeBlock(content, lang);
  };
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  // `./other.md#hash` and `../react.md` become routes, so content reads well on GitHub too.
  md.renderer.rules.link_open = (tokens, idx, options, env: { slug: string }, self) => {
    const href = tokens[idx]!.attrGet("href");
    const match = href && /^(\.{1,2}\/[\w/-]+)\.md(#.*)?$/.exec(href);
    if (match) {
      const slug = posix.normalize(posix.join(posix.dirname(env.slug), match[1]!));
      tokens[idx]!.attrSet("href", routeFor(slug) + (match[2] ?? ""));
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };
  md.renderer.rules.table_open = () => '<div class="doc-table"><table>';
  md.renderer.rules.table_close = () => "</table></div>";
  return md;
}

function renderPage(md: MarkdownIt, slug: string, source: string): DocPage {
  const [data, written] = frontmatter(source);
  const body = expandCss(expandApi(written, slug), slug);
  const tokens = md.parse(body, { slug });
  const headings: DocHeading[] = [];
  let title = data.title ?? slug;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (token.type !== "heading_open") continue;
    const inline = tokens[index + 1]!;
    const depth = Number(token.tag.slice(1));
    if (depth === 1) {
      title = data.title ?? inline.content;
      continue;
    }
    if (depth !== 2 && depth !== 3) continue;
    const id = slugify(inline.content);
    token.attrSet("id", id);
    headings.push({ depth, id, text: inline.content.replace(/`/g, "") });
    const TokenClass = inline.constructor as new (
      type: string,
      tag: string,
      nesting: number,
    ) => typeof inline;
    const anchor = new TokenClass("html_inline", "", 0);
    anchor.content = `<a class="doc-anchor" href="#${id}" aria-label="Link to this section">#</a>`;
    inline.children?.push(anchor);
  }
  const html = md.renderer
    .render(tokens, md.options, { slug })
    .replace(PATTERN_DIRECTIVE, (_, pattern: string) => patternTabs(pattern));
  const copy = (expand: (pattern: string) => string) =>
    body
      .replace(PATTERN_DIRECTIVE, (_, pattern: string) => expand(pattern))
      .replace(/<div data-demo[^>]*><\/div>\n*/g, "")
      // Links in the copies point at the other copies.
      .replace(/\]\((\.{1,2}\/[\w/-]+)\.md(#[\w-]*)?\)/g, (_, path: string, hash = "") => {
        const target = posix.normalize(posix.join(posix.dirname(slug), path));
        return `](${site}${routeFor(target).replace(/\/$/, "")}.md${hash})`;
      })
      // Table padding is for the source files; readers of the copies don't need it.
      .replace(/^\|.*\|$/gm, (row) => row.replace(/ {2,}\|/g, " |").replace(/-{4,}/g, "---"))
      .trim();
  const markdown = copy(patternMarkdown);
  const summary = copy(() => patternLink(slug));
  return {
    slug,
    path: routeFor(slug),
    title,
    description: data.description ?? "",
    section: data.section ?? "Guides",
    order: Number(data.order ?? 99),
    headings,
    html,
    markdown,
    summary,
  };
}

function contentFiles(directory = contentDir): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return contentFiles(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

export function loadPages(): DocPage[] {
  const embedded = contentFiles().flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(PATTERN_DIRECTIVE)].map((match) => match[1]!),
  );
  checkExampleData(readFileSync(join(contentDir, "patterns/index.md"), "utf8"), [
    ...new Set(embedded),
  ]);
  const md = createRenderer();
  const pages = contentFiles()
    .map((file) =>
      renderPage(
        md,
        relative(contentDir, file).slice(0, -".md".length),
        readFileSync(file, "utf8"),
      ),
    )
    .sort(
      (a, b) =>
        sections.indexOf(a.section) - sections.indexOf(b.section) ||
        a.order - b.order ||
        a.title.localeCompare(b.title),
    );
  return pages;
}

const meta = ({ html: _html, markdown: _markdown, ...rest }: DocPage): DocMeta => rest;

/** `/docs/react/` → `/docs/react.md`; `/docs/` → `/docs/index.md`. */
const markdownPath = (path: string) =>
  path === "/docs/" ? "/docs/index.md" : `${path.slice(0, -1)}.md`;

function pageMarkdown(page: DocPage, text = page.markdown): string {
  const heading = text.startsWith("# ") ? "" : `# ${page.title}\n\n`;
  return `${heading}${text}\n`;
}

function llmsTxt(pages: DocPage[]): string {
  const lines = [
    "# Fluidbox",
    "",
    "> A lightbox for the web (`@ogdakke/fluidbox`): media flies out of its thumbnail, follows gestures, and lands back where it came from. Bindings for React, Vue, Solid and Angular, custom elements and a plain JavaScript API share one runtime.",
    "",
    "Every page is also available as Markdown at the same path with `.md`. The pattern pages show the same example in every framework. `llms-full.txt` holds all pages in one file, with each pattern's code linked rather than inlined.",
  ];
  for (const section of sections) {
    const items = pages.filter((page) => page.section === section);
    if (!items.length) continue;
    lines.push("", `## ${section}`, "");
    for (const page of items) {
      lines.push(
        `- [${page.title}](${site}${markdownPath(page.path)})${page.description ? `: ${page.description}` : ""}`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

function llmsFullTxt(pages: DocPage[]): string {
  return pages
    .map((page) => `<!-- ${site}${page.path} -->\n\n${pageMarkdown(page, page.summary)}`)
    .join("\n\n");
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Fill the docs shell with one page, so the route reads without JavaScript. */
export function prerender(shell: string, pages: DocPage[], path: string): string {
  const index = pages.findIndex((page) => page.path === path);
  const page = pages[index];
  if (!page) return shell;
  const title = page.slug === "index" ? "Fluidbox docs" : `${page.title} · Fluidbox docs`;
  return shell
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(
      "</head>",
      `  <meta name="description" content="${escapeHtml(page.description)}" />
    <link rel="alternate" type="text/markdown" href="${markdownPath(page.path)}" />
  </head>`,
    )
    .replace(
      '<nav id="docs-nav"></nav>',
      `<nav id="docs-nav">${renderNav(pages.map(meta), page.path)}</nav>`,
    )
    .replace(
      '<main id="content" class="docs-content"></main>',
      `<main id="content" class="docs-content">${renderArticle(meta(page), page.html, pages[index - 1], pages[index + 1])}</main>`,
    )
    .replace('<ol id="docs-toc"></ol>', `<ol id="docs-toc">${renderToc(page.headings)}</ol>`);
}

/** The docs shell with a not-found message, served for unknown routes. */
function notFound(shell: string, pages: DocPage[]): string {
  return shell
    .replace(/<title>[^<]*<\/title>/, "<title>Not found · Fluidbox docs</title>")
    .replace(
      '<nav id="docs-nav"></nav>',
      `<nav id="docs-nav">${renderNav(pages.map(meta), "")}</nav>`,
    )
    .replace(
      '<main id="content" class="docs-content"></main>',
      '<main id="content" class="docs-content"><article class="prose"><p class="fb-label">404</p><h1>Page not found</h1><p>Try the <a href="/docs/">introduction</a> or the <a href="/docs/patterns/">patterns</a>.</p></article></main>',
    );
}

const PAGES_ID = "virtual:docs-pages";
const PAGE_PREFIX = "virtual:docs-page/";

export function docsPlugin(): Plugin {
  let pages: DocPage[] = [];
  /** Why the docs don't match the source: fails a build, and shows in dev until fixed. */
  let problem: string | null = null;
  const refresh = () => {
    try {
      const loaded = loadPages();
      checkApiCoverage(loaded);
      checkCss();
      pages = loaded;
      problem = null;
    } catch (error) {
      problem = String(error);
    }
  };
  refresh();
  let server: ViteDevServer | undefined;
  let outDir = "dist";

  const textRoutes = (): Record<string, string> => ({
    "/llms.txt": llmsTxt(pages),
    "/llms-full.txt": llmsFullTxt(pages),
    ...Object.fromEntries(pages.map((page) => [markdownPath(page.path), pageMarkdown(page)])),
  });

  return {
    name: "fluidbox-docs",
    configResolved(config) {
      outDir = config.build.outDir;
      if (config.command === "build" && problem) throw new Error(problem);
    },
    resolveId(id) {
      if (id === PAGES_ID || id.startsWith(PAGE_PREFIX)) return `\0${id}`;
    },
    load(id) {
      if (id === `\0${PAGES_ID}`) {
        const loaders = pages
          .map(
            (page) =>
              `${JSON.stringify(page.path)}: () => import(${JSON.stringify(PAGE_PREFIX + page.slug)})`,
          )
          .join(",\n");
        return `export const pages = ${JSON.stringify(pages.map(meta))};\nexport const loaders = {\n${loaders}\n};`;
      }
      if (id.startsWith(`\0${PAGE_PREFIX}`)) {
        const page = pages.find((candidate) => candidate.slug === id.slice(PAGE_PREFIX.length + 1));
        return `export default ${JSON.stringify(page?.html ?? "")};`;
      }
    },
    configureServer(dev) {
      server = dev;
      dev.watcher.add([contentDir, patternsDir, ...apiSources, ...cssSources]);
      // Drift shows as the error overlay, and the last good pages stay up, until
      // the docs and the source agree again.
      const showProblem = () => {
        if (!problem) return;
        dev.config.logger.error(problem);
        dev.ws.send({ type: "error", err: { message: problem, stack: "" } });
      };
      showProblem();
      dev.ws.on("connection", showProblem);
      const reload = (file: string) => {
        const api = isApiSource(file) || cssSources.some((dir) => file.startsWith(dir));
        if (!file.startsWith(contentDir) && !file.startsWith(patternsDir) && !api) return;
        refresh();
        if (problem) {
          showProblem();
          return;
        }
        for (const module of dev.moduleGraph.idToModuleMap.values()) {
          if (module.id?.startsWith("\0virtual:docs-page"))
            dev.moduleGraph.invalidateModule(module);
        }
        if (file.startsWith(contentDir) || api) dev.ws.send({ type: "full-reload" });
      };
      dev.watcher.on("change", reload);
      dev.watcher.on("add", reload);
      dev.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? "/", "http://docs");
        const text = textRoutes()[url.pathname];
        if (text !== undefined) {
          response.setHeader(
            "content-type",
            `${url.pathname.endsWith(".md") ? "text/markdown" : "text/plain"}; charset=utf-8`,
          );
          response.end(text);
          return;
        }
        // Every docs route serves the docs shell.
        if (
          url.pathname === "/docs" ||
          (url.pathname.startsWith("/docs/") && !/\.\w+$/.test(url.pathname))
        ) {
          request.url = "/docs/index.html";
        }
        next();
      });
    },
    transformIndexHtml: {
      order: "post",
      async handler(html, context) {
        // The landing page shows pattern tabs too.
        if (html.includes("bundle-size:")) {
          const sizes = await measureBundleSizes();
          html = html.replace(BUNDLE_SIZE_DIRECTIVE, (_, key: keyof BundleSizes) => sizes[key]);
        }
        html = html
          .replace(PATTERN_DIRECTIVE, (_, pattern: string) => patternTabs(pattern))
          .replace(
            INSTALL_DIRECTIVE,
            (_, packages: string) => installTabs(`npm install ${packages}`)!,
          );
        if (!server || !context.path.startsWith("/docs/")) return html;
        const path = new URL(context.originalUrl ?? "/docs/", "http://docs").pathname;
        return prerender(html, pages, path.endsWith("/") ? path : `${path}/`);
      },
    },
    writeBundle() {
      const shell = readFileSync(join(outDir, "docs/index.html"), "utf8");
      for (const page of pages) {
        const file = join(outDir, page.path, "index.html");
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, prerender(shell, pages, page.path));
      }
      writeFileSync(join(outDir, "404.html"), notFound(shell, pages));
      for (const [path, text] of Object.entries(textRoutes())) {
        const file = join(outDir, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, text);
      }
    },
  };
}
