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
  "solid-embed",
  "solid-model",
  "solid-spin",
  "vue-embed",
  "vue-model",
  "vue-spin",
  "angular-embed",
  "angular-model",
  "angular-spin",
  "elements-embed",
  "elements-model",
  "elements-spin",
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
  "solid-embed": ["solid-js"],
  "solid-model": ["solid-js"],
  "solid-spin": ["solid-js"],
  "vue-embed": ["vue"],
  "vue-model": ["vue"],
  "vue-spin": ["vue"],
  "angular-embed": ["@angular/core"],
  "angular-model": ["@angular/core"],
  "angular-spin": ["@angular/core"],
  "elements-embed": [],
  "elements-model": [],
  "elements-spin": [],
};

/** What each media add-on's code carries, so an entry can be checked for the others'. */
const addonMarkers = { embed: "fluidboxEmbed", model: "fluidboxModel", spin: "fluidboxSpin" };

/** The prefixes of the add-on parts that are entries of their own, as `react-` of `react-embed`. */
const addonEntry = new RegExp(`^(.+)-(${Object.keys(addonMarkers).join("|")})$`);
const bindingPrefix = new RegExp(
  `^(${[...new Set(entrypoints.map((name) => addonEntry.exec(name)?.[1]).filter(Boolean))].join("|")})-`,
);

// Keep separate initial, activation, and CSS ceilings for every public entry.
// baseline/bundle-budget.md records the measurements behind them and why they moved.
// The React binding's redesigned parts added about 1,430 B to its initial chunk; the size
// pass after step 3 took 634 B back, mostly development-only checks and messages. The Vue
// binding's added about 1,850 B to its own. The custom elements' value, slide templates and
// registry added about 740 B to theirs; their parts load only for a gallery with templates.
const initialGzipLimits: Record<Entry, number> = {
  root: 10_200,
  elements: 15_200,
  react: 17_700,
  // Solid's redesigned parts, the end of its icon code and the server viewer: about 3,280 B more (step 4).
  solid: 17_500,
  vue: 18_150,
  angular: 19_900,
  thumbnails: 3_850,
  sheet: 7_350,
  kit: 1_900,
  // The hover zoom add-on, loaded by pages that magnify their photos on hover.
  "hover-zoom": 1_500,
  // The media add-ons carry their few rules in their JS. Embed providers added
  // about 430 B to the embed slide; a model that waits for its first frame, 60 B.
  embed: 3_050,
  model: 2_550,
  spin: 2_450,
  "react-embed": 20_250,
  "react-model": 19_850,
  "react-spin": 19_650,
  "solid-embed": 19_850,
  "solid-model": 19_450,
  "solid-spin": 19_250,
  "vue-embed": 20_700,
  "vue-model": 20_250,
  "vue-spin": 20_100,
  "angular-embed": 22_550,
  "angular-model": 22_100,
  "angular-spin": 21_900,
  "elements-embed": 18_000,
  "elements-model": 17_650,
  "elements-spin": 17_450,
};
const cssGzipLimit = 2_950;
// The opt-in look, glyphs included. No entry imports it, so it counts in no
// entry's activation total.
const baselineCssGzipLimit = 3_300;
// Right-to-left support added about 200 B to every core entry's viewer chunk, and
// zoom steps that add up before a zoom rests about 90 B, and fitting an image a
// zoom left once the viewer closes or moves on about 100 B.
const activationJsGzipLimits: Record<Entry, number> = {
  root: 44_700,
  // The gallery loads the thumbnails and sheet entries when it holds their elements.
  elements: 51_000,
  react: 51_600,
  solid: 51_400,
  vue: 52_050,
  angular: 53_700,
  thumbnails: 3_850,
  sheet: 7_350,
  kit: 1_900,
  "hover-zoom": 1_500,
  embed: 3_050,
  model: 2_550,
  spin: 2_450,
  "react-embed": 54_200,
  "react-model": 53_750,
  "react-spin": 53_500,
  "solid-embed": 53_800,
  "solid-model": 53_350,
  "solid-spin": 53_100,
  "vue-embed": 54_650,
  "vue-model": 54_150,
  "vue-spin": 53_950,
  "angular-embed": 56_450,
  "angular-model": 55_900,
  "angular-spin": 55_750,
  "elements-embed": 53_750,
  "elements-model": 53_450,
  "elements-spin": 53_250,
};
// Fullscreen, download and share, and a slide's zoom pose, load on first use.
const onDemandJsGzipLimits: Record<Entry, number> = {
  root: 2_500,
  elements: 2_500,
  react: 2_500,
  solid: 2_500,
  vue: 2_500,
  angular: 2_500,
  thumbnails: 50,
  sheet: 50,
  kit: 50,
  "hover-zoom": 50,
  embed: 50,
  model: 50,
  spin: 50,
  "react-embed": 2_500,
  "react-model": 2_500,
  "react-spin": 2_500,
  "solid-embed": 2_500,
  "solid-model": 2_500,
  "solid-spin": 2_500,
  "vue-embed": 2_500,
  "vue-model": 2_500,
  "vue-spin": 2_500,
  "angular-embed": 2_500,
  "angular-model": 2_500,
  "angular-spin": 2_500,
  "elements-embed": 2_500,
  "elements-model": 2_500,
  "elements-spin": 2_500,
};
// Activation and on demand together: everything a viewer can load but its add-ons.
const reachableJsGzipLimits: Record<Entry, number> = {
  root: 47_150,
  elements: 53_450,
  react: 54_050,
  solid: 53_850,
  vue: 54_500,
  angular: 56_150,
  thumbnails: 3_850,
  sheet: 7_350,
  kit: 1_900,
  "hover-zoom": 1_500,
  embed: 3_050,
  model: 2_550,
  spin: 2_450,
  "react-embed": 56_600,
  "react-model": 56_150,
  "react-spin": 55_950,
  "solid-embed": 56_200,
  "solid-model": 55_800,
  "solid-spin": 55_550,
  "vue-embed": 57_050,
  "vue-model": 56_550,
  "vue-spin": 56_400,
  "angular-embed": 58_850,
  "angular-model": 58_350,
  "angular-spin": 58_150,
  "elements-embed": 56_200,
  "elements-model": 55_850,
  "elements-spin": 55_700,
};
const activationWithCssGzipLimits: Record<Entry, number> = {
  root: 47_600,
  elements: 53_900,
  react: 54_500,
  solid: 54_300,
  vue: 54_950,
  angular: 56_600,
  thumbnails: 4_900,
  sheet: 8_350,
  kit: 4_800,
  // It needs no stylesheet; the base one counts, as for the kit.
  "hover-zoom": 4_350,
  embed: 5_950,
  model: 5_450,
  spin: 5_350,
  "react-embed": 57_050,
  "react-model": 56_600,
  "react-spin": 56_400,
  "solid-embed": 56_650,
  "solid-model": 56_250,
  "solid-spin": 56_000,
  "vue-embed": 57_500,
  "vue-model": 57_050,
  "vue-spin": 56_850,
  "angular-embed": 59_300,
  "angular-model": 58_800,
  "angular-spin": 58_600,
  "elements-embed": 56_650,
  "elements-model": 56_300,
  "elements-spin": 56_150,
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
    onDemandJsGzipBytes: onDemandJsGzipLimits,
    reachableJsGzipBytes: reachableJsGzipLimits,
    activationWithCssGzipBytes: activationWithCssGzipLimits,
  },
  css,
  baselineCss,
  entries: {} as Record<
    Entry,
    {
      initialJs: Size;
      activationJs: Size;
      onDemandJs: Size;
      reachableJs: Size;
      activationWithCss: Size;
      chunks: Array<Size & { fileName: string; phase: "initial" | "lazy" | "on demand" }>;
      frameworkExternals: string[];
      errors: string[];
    }
  >,
};

let failed = false;
for (const name of entrypoints) {
  const {
    initialJs,
    activationJs,
    onDemandJs,
    reachableJs,
    chunks,
    externals,
    unresolved,
    initialCode,
    activationCode,
  } = await measureEntry(name);
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
    onDemandJs.gzipBytes > onDemandJsGzipLimits[name] &&
      `on-demand JS gzip budget exceeded (${onDemandJsGzipLimits[name]} B)`,
    reachableJs.gzipBytes > reachableJsGzipLimits[name] &&
      `reachable JS gzip budget exceeded (${reachableJsGzipLimits[name]} B)`,
    activationWithCss.gzipBytes > activationWithCssGzipLimits[name] &&
      `activation with CSS gzip budget exceeded (${activationWithCssGzipLimits[name]} B)`,
    !name.startsWith("elements") && registersFluidbox && "custom elements loaded eagerly",
    name.startsWith("elements") && !registersFluidbox && "custom element registration missing",
    carriesExtension && "sheet extension bundled into a core entry",
    ...Object.entries(addonMarkers)
      .filter(
        ([addon, marker]) =>
          addon !== name.replace(bindingPrefix, "") && activationCode.includes(marker),
      )
      .map(([addon]) => `carries the ${addon} add-on`),
  ].filter((error): error is string => typeof error === "string");

  report.entries[name] = {
    initialJs,
    activationJs,
    onDemandJs,
    reachableJs,
    activationWithCss,
    chunks,
    frameworkExternals: [...externals].sort(),
    errors,
  };
  const column = (size: Size) => `${String(size.gzipBytes).padStart(6)} B`;
  console.log(
    `${name.padEnd(11)} initial ${column(initialJs)}  activation ${column(activationJs)}  on demand ${column(onDemandJs)}  reachable ${column(reachableJs)}  activation + CSS ${column(activationWithCss)}  (gzip)`,
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
