import { readFile, writeFile } from "node:fs/promises";
import { measureEntry, peerFor, sizeOf, type frameworkPeers, type Size } from "./bundle-size";

const entrypoints = [
  "root",
  "elements",
  "react",
  "solid",
  "vue",
  "angular",
  "filmstrip",
  "sheet",
  "kit",
] as const;
type Entry = (typeof entrypoints)[number];
const expectedFramework: Record<Entry, readonly (typeof frameworkPeers)[number][]> = {
  root: [],
  elements: [],
  react: ["react", "react-dom"],
  solid: ["solid-js"],
  vue: ["vue"],
  angular: ["@angular/core"],
  filmstrip: [],
  sheet: [],
  kit: [],
};

// Keep separate initial, activation, and CSS ceilings for every public entry.
const initialGzipLimits: Record<Entry, number> = {
  root: 7_650,
  elements: 11_150,
  react: 11_450,
  solid: 10_650,
  vue: 11_350,
  angular: 11_550,
  filmstrip: 3_600,
  sheet: 7_350,
  kit: 1_450,
};
const cssGzipLimit = 3_200;
// Right-to-left support added about 200 B to every core entry's viewer chunk.
const activationJsGzipLimits: Record<Entry, number> = {
  root: 31_850,
  // The gallery loads the filmstrip and sheet entries when it holds their elements.
  elements: 34_850,
  react: 35_400,
  solid: 34_550,
  vue: 35_300,
  angular: 35_500,
  filmstrip: 3_600,
  sheet: 7_350,
  kit: 1_450,
};
const activationWithCssGzipLimits: Record<Entry, number> = {
  root: 34_950,
  elements: 37_950,
  react: 38_500,
  solid: 37_650,
  vue: 38_400,
  angular: 38_600,
  filmstrip: 4_850,
  sheet: 8_700,
  kit: 4_550,
};

const jsonIndex = process.argv.indexOf("--json");
if (
  jsonIndex !== -1 &&
  (!process.argv[jsonIndex + 1] || process.argv[jsonIndex + 1].startsWith("--"))
) {
  throw new Error("--json requires an output path");
}
const jsonPath = jsonIndex === -1 ? null : process.argv[jsonIndex + 1];
const css = sizeOf(await readFile("packages/fluidbox/dist/styles.css"));
// The sheet and the filmstrip ship their own stylesheets on top of the base one.
const sheetCss = sizeOf(await readFile("packages/fluidbox/dist/sheet.css"));
const filmstripCss = sizeOf(await readFile("packages/fluidbox/dist/filmstrip.css"));
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
  const { initialJs, activationJs, chunks, externals, unresolved, initialCode, activationCode } =
    await measureEntry(name);
  const entryCss = name === "sheet" ? sheetCss : name === "filmstrip" ? filmstripCss : css;
  const activationWithCss = {
    rawBytes: activationJs.rawBytes + entryCss.rawBytes,
    gzipBytes: activationJs.gzipBytes + entryCss.gzipBytes,
  };
  const forbidden = [...externals].filter((specifier) => {
    const peer = peerFor(specifier);
    return !peer || !expectedFramework[name].includes(peer);
  });
  const registersFluidbox = /customElements\.define\([`"']fluidbox-item[`"']/.test(initialCode);
  // Add-ons cost nothing until used: no core entry may carry their code, only
  // load it lazily for a viewer that turns them on.
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
    chunks,
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
