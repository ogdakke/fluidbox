import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { build } from "tsdown";

const entrypoints = ["root", "elements", "react", "solid", "vue", "angular"] as const;
const frameworks = ["react", "solid-js", "vue", "@angular/core"];
const expectedFramework: Record<(typeof entrypoints)[number], string | null> = {
  root: null,
  elements: null,
  react: "react",
  solid: "solid-js",
  vue: "vue",
  angular: "@angular/core",
};

// Gzip limits cover the initial static import graph of each consumer entry.
const gzipLimits: Record<(typeof entrypoints)[number], number> = {
  root: 600,
  elements: 25_000,
  react: 1_500,
  solid: 1_500,
  vue: 1_500,
  angular: 1_500,
};

let failed = false;

for (const name of entrypoints) {
  const result = await build({
    entry: `tests/bundle/${name}.ts`,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    dts: false,
    sourcemap: false,
    report: false,
    clean: false,
    write: false,
    deps: { neverBundle: [...frameworks, "unlazy"] },
  });

  const chunks = result.bundles
    .flatMap((bundle) => bundle.chunks)
    .filter((chunk) => chunk.type === "chunk");
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const entry = chunks.find((chunk) => chunk.isEntry);
  if (!entry) throw new Error(`tsdown did not emit an entry for ${name}`);

  const visited = new Set<string>();
  const staticChunks: typeof chunks = [];
  const externalImports = new Set<string>();
  const visit = (fileName: string): void => {
    if (visited.has(fileName)) return;
    visited.add(fileName);
    const chunk = byName.get(fileName);
    if (!chunk) return;
    staticChunks.push(chunk);
    for (const imported of chunk.imports) {
      if (byName.has(imported)) visit(imported);
      else externalImports.add(imported);
    }
  };
  visit(entry.fileName);

  const code = staticChunks.map((chunk) => chunk.code).join("\n");
  const bytes = Buffer.byteLength(code);
  const gzipBytes = gzipSync(code).byteLength;
  const allImports = new Set(
    chunks.flatMap((chunk) => [...chunk.imports, ...chunk.dynamicImports]),
  );
  const forbidden = frameworks.filter(
    (framework) => framework !== expectedFramework[name] && allImports.has(framework),
  );
  const oversized = gzipBytes > gzipLimits[name];
  const registersLightbox = /customElements\.define\([`"']app-lightbox[`"']/.test(code);
  const eagerElements = name !== "elements" && registersLightbox;
  const missingElements = name === "elements" && !registersLightbox;

  console.log(
    `${name.padEnd(8)} ${String(bytes).padStart(7)} B raw  ${String(gzipBytes).padStart(6)} B gzip  imports: ${[...externalImports].join(", ") || "none"}`,
  );
  if (forbidden.length || oversized || eagerElements || missingElements) {
    console.error(
      `${name}: ${[
        forbidden.length && `unexpected framework imports: ${forbidden.join(", ")}`,
        oversized && `gzip budget exceeded (${gzipLimits[name]} B)`,
        eagerElements && "custom elements loaded eagerly",
        missingElements && "custom element registration missing",
      ]
        .filter(Boolean)
        .join("; ")}`,
    );
    failed = true;
  }
}

const css = await readFile("packages/lightbox/dist/styles.css");
const cssGzip = gzipSync(css).byteLength;
console.log(
  `styles   ${String(css.byteLength).padStart(7)} B raw  ${String(cssGzip).padStart(6)} B gzip`,
);
if (cssGzip > 5_000) {
  console.error("styles: gzip budget exceeded (5000 B)");
  failed = true;
}

if (failed) process.exitCode = 1;
