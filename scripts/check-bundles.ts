import { readFile, writeFile } from "node:fs/promises";
import { measureEntry, peerFor, sizeOf, type frameworkPeers, type Size } from "./bundle-size";

const entrypoints = [
  "root",
  "elements",
  "react",
  "solid",
  "vue",
  "angular",
  "thumbnails",
  "sheet",
  "kit",
  "hover-zoom",
  "embeds",
  "model",
  "spin",
] as const;
type Entry = (typeof entrypoints)[number];
const expectedFramework: Record<Entry, readonly (typeof frameworkPeers)[number][]> = {
  root: [],
  elements: [],
  react: ["react", "react-dom"],
  solid: ["solid-js"],
  vue: ["vue"],
  angular: ["@angular/core"],
  thumbnails: [],
  sheet: [],
  kit: [],
  "hover-zoom": [],
  embeds: [],
  model: [],
  spin: [],
};

// Keep separate initial, activation, and CSS ceilings for every public entry.
// baseline/bundle-budget.md records the measurements behind them and why they moved.
// Controlled open and index added about 250 B to each binding's initial chunk,
// and looping about 100 B to the core's and 270 B to its viewer chunk.
const initialGzipLimits: Record<Entry, number> = {
  root: 10_400,
  elements: 14_450,
  react: 16_400,
  solid: 14_250,
  vue: 14_900,
  angular: 15_300,
  thumbnails: 3_850,
  sheet: 7_350,
  kit: 1_750,
  // The hover zoom add-on, loaded by pages that magnify their photos on hover.
  "hover-zoom": 1_500,
  // The media add-ons carry their few rules in their JS.
  embeds: 2_600,
  model: 1_400,
  spin: 2_500,
};
const cssGzipLimit = 2_800;
// The opt-in look, glyphs included. No entry imports it, so it counts in no
// entry's activation total.
const baselineCssGzipLimit = 3_300;
// Right-to-left support added about 200 B to every core entry's viewer chunk, and
// zoom steps that add up before a zoom rests about 90 B, and fitting an image a
// zoom left once the viewer closes or moves on about 100 B.
const activationJsGzipLimits: Record<Entry, number> = {
  root: 44_650,
  // The gallery loads the thumbnails and sheet entries when it holds their elements.
  elements: 47_900,
  react: 50_000,
  solid: 47_800,
  vue: 48_500,
  angular: 48_850,
  thumbnails: 3_850,
  sheet: 7_350,
  kit: 1_750,
  "hover-zoom": 1_500,
  embeds: 2_600,
  model: 1_400,
  spin: 2_500,
};
const activationWithCssGzipLimits: Record<Entry, number> = {
  root: 47_400,
  elements: 50_600,
  react: 52_750,
  solid: 50_550,
  vue: 51_250,
  angular: 51_600,
  thumbnails: 4_900,
  sheet: 8_350,
  kit: 4_450,
  // It needs no stylesheet; the base one counts, as for the kit.
  "hover-zoom": 4_250,
  embeds: 5_350,
  model: 4_100,
  spin: 5_250,
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
// The sheet and the thumbnails ship their own stylesheets on top of the base one.
const sheetCss = sizeOf(await readFile("packages/fluidbox/dist/sheet.css"));
const thumbnailsCss = sizeOf(await readFile("packages/fluidbox/dist/thumbnails.css"));
const baselineCss = sizeOf(await readFile("packages/fluidbox/dist/baseline.css"));
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
    baselineCssGzipBytes: baselineCssGzipLimit,
    activationJsGzipBytes: activationJsGzipLimits,
    activationWithCssGzipBytes: activationWithCssGzipLimits,
  },
  css,
  baselineCss,
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
  const entryCss = name === "sheet" ? sheetCss : name === "thumbnails" ? thumbnailsCss : css;
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
    name !== "thumbnails" && name !== "sheet" && /fluidboxSheetHost/.test(activationCode);
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
console.log(
  `baseline ${String(baselineCss.rawBytes).padStart(7)} B raw  ${String(baselineCss.gzipBytes).padStart(6)} B gzip`,
);
if (baselineCss.gzipBytes > baselineCssGzipLimit) {
  console.error(`baseline: gzip budget exceeded (${baselineCssGzipLimit} B)`);
  failed = true;
}
if (jsonPath) await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
if (failed) process.exitCode = 1;
