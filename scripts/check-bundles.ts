import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { build } from "tsdown";

const entrypoints = [
  "root",
  "elements",
  "react",
  "solid",
  "vue",
  "angular",
  "filmstrip",
  "sheet",
] as const;
type Entry = (typeof entrypoints)[number];
const frameworkPeers = ["react", "react-dom", "solid-js", "vue", "@angular/core"] as const;
const expectedFramework: Record<Entry, readonly (typeof frameworkPeers)[number][]> = {
  root: [],
  elements: [],
  react: ["react", "react-dom"],
  solid: ["solid-js"],
  vue: ["vue"],
  angular: ["@angular/core"],
  filmstrip: [],
  sheet: [],
};

// Keep separate initial, activation, and CSS ceilings for every public entry.
const initialGzipLimits: Record<Entry, number> = {
  root: 23_250,
  elements: 28_250,
  react: 27_700,
  solid: 1_500,
  vue: 1_500,
  angular: 1_500,
  filmstrip: 3_100,
  sheet: 6_400,
};
const cssGzipLimit = 5_450;
const activationJsGzipLimits: Record<Entry, number> = {
  root: 33_450,
  elements: 32_350,
  react: 31_900,
  solid: 32_500,
  vue: 32_600,
  angular: 32_500,
  filmstrip: 3_100,
  sheet: 6_400,
};
const activationWithCssGzipLimits: Record<Entry, number> = {
  root: 38_850,
  elements: 37_750,
  react: 37_350,
  solid: 38_000,
  vue: 38_100,
  angular: 38_000,
  filmstrip: 8_450,
  sheet: 9_350,
};

type Chunk = Extract<
  Awaited<ReturnType<typeof build>>["bundles"][number]["chunks"][number],
  { type: "chunk" }
>;
type Size = { rawBytes: number; gzipBytes: number };

const sizeOf = (code: string | Uint8Array): Size => ({
  rawBytes: Buffer.byteLength(code),
  gzipBytes: gzipSync(code).byteLength,
});
const isFrameworkImport = (specifier: string, peer: string): boolean =>
  specifier === peer || specifier.startsWith(`${peer}/`);
const peerFor = (specifier: string): (typeof frameworkPeers)[number] | undefined =>
  frameworkPeers.find((peer) => isFrameworkImport(specifier, peer));

const jsonIndex = process.argv.indexOf("--json");
if (
  jsonIndex !== -1 &&
  (!process.argv[jsonIndex + 1] || process.argv[jsonIndex + 1].startsWith("--"))
) {
  throw new Error("--json requires an output path");
}
const jsonPath = jsonIndex === -1 ? null : process.argv[jsonIndex + 1];
const css = sizeOf(await readFile("packages/fluidbox/dist/styles.css"));
// The sheet ships its own stylesheet on top of the base one.
const sheetCss = sizeOf(await readFile("packages/fluidbox/dist/sheet.css"));
const tsdownInfo = JSON.parse(await readFile("node_modules/tsdown/package.json", "utf8")) as {
  version: string;
};
const report = {
  schemaVersion: 1,
  command: "bun run test:bundle",
  toolVersions: {
    bun: process.versions.bun ?? "unknown",
    tsdown: tsdownInfo.version,
  },
  method:
    "tsdown browser ESM, es2022, minified consumer builds; gzip each emitted JS chunk once; exclude only framework peer externals",
  limits: {
    initialJsGzipBytes: initialGzipLimits,
    cssGzipBytes: cssGzipLimit,
    activationJsGzipBytes: activationJsGzipLimits,
    activationWithCssGzipBytes: activationWithCssGzipLimits,
  },
  css,
  entries: {} as Record<
    Entry,
    {
      initialJs: Size;
      activationJs: Size;
      activationWithCss: Size;
      chunks: Array<Size & { fileName: string; phase: "initial" | "lazy" }>;
      frameworkExternals: string[];
      errors: string[];
    }
  >,
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
    deps: { neverBundle: [...frameworkPeers, /^react-dom(?:\/.*)?$/] },
  });

  const chunks = result.bundles
    .flatMap((bundle) => bundle.chunks)
    .filter((chunk): chunk is Chunk => chunk.type === "chunk");
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const entry = chunks.find((chunk) => chunk.isEntry);
  if (!entry) throw new Error(`tsdown did not emit an entry for ${name}`);

  const visited = new Set<string>();
  const initial = new Set<string>();
  const externals = new Set<string>();
  const unresolved = new Set<string>();
  const visitInitial = (fileName: string): void => {
    if (initial.has(fileName)) return;
    initial.add(fileName);
    const chunk = byName.get(fileName);
    if (!chunk) throw new Error(`${name}: missing emitted chunk ${fileName}`);
    for (const imported of chunk.imports) {
      if (byName.has(imported)) visitInitial(imported);
    }
  };
  const visitActivation = (fileName: string): void => {
    if (visited.has(fileName)) return;
    visited.add(fileName);
    const chunk = byName.get(fileName);
    if (!chunk) throw new Error(`${name}: missing emitted chunk ${fileName}`);
    for (const imported of [...chunk.imports, ...chunk.dynamicImports]) {
      if (byName.has(imported)) visitActivation(imported);
      else if (peerFor(imported)) externals.add(imported);
      else unresolved.add(imported);
    }
  };
  visitInitial(entry.fileName);
  visitActivation(entry.fileName);

  const initialChunks = [...initial].map((fileName) => byName.get(fileName)!);
  const activationChunks = [...visited].map((fileName) => byName.get(fileName)!);
  // Preserve the concatenated static-graph calculation used by earlier reports.
  const initialJs = sizeOf(initialChunks.map((chunk) => chunk.code).join("\n"));
  const chunkSizes = activationChunks.map((chunk) => ({
    fileName: chunk.fileName,
    phase: (initial.has(chunk.fileName) ? "initial" : "lazy") as "initial" | "lazy",
    ...sizeOf(chunk.code),
  }));
  const activationJs = chunkSizes.reduce<Size>(
    (total, chunk) => ({
      rawBytes: total.rawBytes + chunk.rawBytes,
      gzipBytes: total.gzipBytes + chunk.gzipBytes,
    }),
    { rawBytes: 0, gzipBytes: 0 },
  );
  const entryCss = name === "sheet" ? sheetCss : css;
  const activationWithCss = {
    rawBytes: activationJs.rawBytes + entryCss.rawBytes,
    gzipBytes: activationJs.gzipBytes + entryCss.gzipBytes,
  };
  const forbidden = [...externals].filter((specifier) => {
    const peer = peerFor(specifier);
    return !peer || !expectedFramework[name].includes(peer);
  });
  const initialCode = initialChunks.map((chunk) => chunk.code).join("\n");
  const registersFluidbox = /customElements\.define\([`"']fluidbox-item[`"']/.test(initialCode);
  // Extensions cost nothing until imported: no core entry may carry their code.
  const activationCode = activationChunks.map((chunk) => chunk.code).join("\n");
  const carriesExtension =
    name !== "filmstrip" && name !== "sheet" && /fluidboxSheetHost/.test(activationCode);
  const errors = [
    unresolved.size && `unresolved runtime externals: ${[...unresolved].join(", ")}`,
    forbidden.length && `unexpected framework imports: ${forbidden.join(", ")}`,
    initialJs.gzipBytes > initialGzipLimits[name] &&
      `initial JS gzip budget exceeded (${initialGzipLimits[name]} B)`,
    activationJs.gzipBytes > activationJsGzipLimits[name] &&
      `activation JS gzip budget exceeded (${activationJsGzipLimits[name]} B)`,
    activationWithCss.gzipBytes > activationWithCssGzipLimits[name] &&
      `activation with CSS gzip budget exceeded (${activationWithCssGzipLimits[name]} B)`,
    name !== "elements" && registersFluidbox && "custom elements loaded eagerly",
    name === "elements" && !registersFluidbox && "custom element registration missing",
    carriesExtension && "sheet extension bundled into a core entry",
  ].filter((error): error is string => typeof error === "string");

  report.entries[name] = {
    initialJs,
    activationJs,
    activationWithCss,
    chunks: chunkSizes,
    frameworkExternals: [...externals].sort(),
    errors,
  };
  console.log(
    `${name.padEnd(8)} initial ${String(initialJs.gzipBytes).padStart(6)} B gzip  activation JS ${String(activationJs.gzipBytes).padStart(6)} B gzip  + CSS ${String(activationWithCss.gzipBytes).padStart(6)} B gzip`,
  );
  if (errors.length) {
    console.error(`${name}: ${errors.join("; ")}`);
    failed = true;
  }
}

console.log(
  `styles   ${String(css.rawBytes).padStart(7)} B raw  ${String(css.gzipBytes).padStart(6)} B gzip`,
);
if (css.gzipBytes > cssGzipLimit) {
  console.error(`styles: gzip budget exceeded (${cssGzipLimit} B)`);
  failed = true;
}
if (jsonPath) await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
if (failed) process.exitCode = 1;
