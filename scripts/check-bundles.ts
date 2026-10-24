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
  "embed",
  "model",
  "spin",
  "react-embed",
  "react-model",
  "react-spin",
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
  embed: [],
  model: [],
  spin: [],
  "react-embed": ["react", "react-dom"],
  "react-model": ["react", "react-dom"],
  "react-spin": ["react", "react-dom"],
};

/** What each media add-on's code carries, so an entry can be checked for the others'. */
const addonMarkers = { embed: "fluidboxEmbed", model: "fluidboxModel", spin: "fluidboxSpin" };

// Keep separate initial, activation, and CSS ceilings for every public entry.
// baseline/bundle-budget.md records the measurements behind them and why they moved.
// The React binding's redesigned parts added about 1,430 B to its initial chunk.
const initialGzipLimits: Record<Entry, number> = {
  root: 10_400,
  elements: 14_550,
  react: 17_850,
  solid: 14_250,
  vue: 14_900,
  angular: 15_300,
  thumbnails: 3_850,
  sheet: 7_350,
  kit: 1_750,
  // The hover zoom add-on, loaded by pages that magnify their photos on hover.
  "hover-zoom": 1_500,
  // The media add-ons carry their few rules in their JS. Embed providers added
  // about 430 B to the embed slide; a model that waits for its first frame, 60 B.
  embed: 3_050,
  model: 1_450,
  spin: 2_500,
  "react-embed": 20_300,
  "react-model": 18_900,
  "react-spin": 19_750,
};
const cssGzipLimit = 2_850;
// The opt-in look, glyphs included. No entry imports it, so it counts in no
// entry's activation total.
const baselineCssGzipLimit = 3_300;
// Right-to-left support added about 200 B to every core entry's viewer chunk, and
// zoom steps that add up before a zoom rests about 90 B, and fitting an image a
// zoom left once the viewer closes or moves on about 100 B.
const activationJsGzipLimits: Record<Entry, number> = {
  root: 45_100,
  // The gallery loads the thumbnails and sheet entries when it holds their elements.
  elements: 48_400,
  react: 51_900,
  solid: 48_250,
  vue: 48_950,
  angular: 49_300,
  thumbnails: 3_850,
  sheet: 7_350,
  kit: 1_750,
  "hover-zoom": 1_500,
  embed: 3_050,
  model: 1_450,
  spin: 2_500,
  "react-embed": 54_450,
  "react-model": 52_950,
  "react-spin": 53_800,
};
const activationWithCssGzipLimits: Record<Entry, number> = {
  root: 47_900,
  elements: 51_200,
  react: 54_700,
  solid: 51_050,
  vue: 51_750,
  angular: 52_100,
  thumbnails: 4_900,
  sheet: 8_350,
  kit: 4_550,
  // It needs no stylesheet; the base one counts, as for the kit.
  "hover-zoom": 4_350,
  embed: 5_850,
  model: 4_250,
  spin: 5_250,
  "react-embed": 57_250,
  "react-model": 55_750,
  "react-spin": 56_600,
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
    ...Object.entries(addonMarkers)
      .filter(
        ([addon, marker]) =>
          addon !== name.replace(/^react-/, "") && activationCode.includes(marker),
      )
      .map(([addon]) => `carries the ${addon} add-on`),
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
