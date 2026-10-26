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
// reachend added about 55 B to every core entry, its rule being in the viewer chunk, and more
// to the custom elements' for their reach-end-threshold attribute and the forwarded event.
const initialGzipLimits: Record<Entry, number> = {
  root: 10_300,
  elements: 15_550,
  react: 17_900,
  // Solid's redesigned parts, the end of its icon code and the server viewer: about 3,280 B more (step 4).
  solid: 17_700,
  vue: 18_400,
  angular: 20_050,
  thumbnails: 3_850,
  sheet: 7_350,
  kit: 1_900,
  // The hover zoom add-on, loaded by pages that magnify their photos on hover.
  "hover-zoom": 1_500,
  // The media add-ons carry their few rules in their JS. Embed providers added
  // about 430 B to the embed slide; a model that waits for its first frame, 60 B.
  embed: 3_050,
  model: 2_750,
  spin: 2_450,
  "react-embed": 20_400,
  "react-model": 20_250,
  "react-spin": 19_850,
  "solid-embed": 20_050,
  "solid-model": 19_900,
  "solid-spin": 19_450,
  "vue-embed": 20_950,
  "vue-model": 20_700,
  "vue-spin": 20_300,
  "angular-embed": 22_750,
  "angular-model": 22_450,
  "angular-spin": 22_100,
  "elements-embed": 18_300,
  "elements-model": 18_150,
  "elements-spin": 17_800,
};
const cssGzipLimit = 2_850;
// The opt-in look, glyphs included. No entry imports it, so it counts in no
// entry's activation total.
const baselineCssGzipLimit = 3_300;
// Right-to-left support added about 200 B to every core entry's viewer chunk, and
// zoom steps that add up before a zoom rests about 90 B, and fitting an image a
// zoom left once the viewer closes or moves on about 100 B. The motion speed, with the strip's
// own scroll at speeds other than 1, about 255 B. Keeping the slides through a loop toggle, 110 B.
// After step 7's review, about 330 B more: reachend's rule, glides that a gesture, a close or
// new items end cleanly, slides kept at their offset through a loop toggle, and mediaerror's item.
const activationJsGzipLimits: Record<Entry, number> = {
  root: 46_450,
  // The gallery loads the thumbnails and sheet entries when it holds their elements.
  elements: 52_800,
  react: 53_300,
  solid: 53_100,
  vue: 53_750,
  angular: 55_400,
  thumbnails: 3_850,
  sheet: 7_350,
  kit: 1_900,
  "hover-zoom": 1_500,
  embed: 3_050,
  model: 2_750,
  spin: 2_450,
  "react-embed": 55_850,
  "react-model": 55_600,
  "react-spin": 55_200,
  "solid-embed": 55_450,
  "solid-model": 55_250,
  "solid-spin": 54_800,
  "vue-embed": 56_350,
  "vue-model": 56_050,
  "vue-spin": 55_650,
  "angular-embed": 58_100,
  "angular-model": 57_750,
  "angular-spin": 57_400,
  "elements-embed": 55_600,
  "elements-model": 55_450,
  "elements-spin": 55_100,
};
// Fullscreen, download and share, and a slide's zoom pose, load on first use.
const onDemandJsGzipLimits: Record<Entry, number> = {
  root: 1_200,
  elements: 1_200,
  react: 1_200,
  solid: 1_200,
  vue: 1_200,
  angular: 1_200,
  thumbnails: 50,
  sheet: 50,
  kit: 50,
  "hover-zoom": 50,
  embed: 50,
  model: 50,
  spin: 50,
  "react-embed": 1_200,
  "react-model": 1_200,
  "react-spin": 1_200,
  "solid-embed": 1_200,
  "solid-model": 1_200,
  "solid-spin": 1_200,
  "vue-embed": 1_200,
  "vue-model": 1_200,
  "vue-spin": 1_200,
  "angular-embed": 1_200,
  "angular-model": 1_200,
  "angular-spin": 1_200,
  "elements-embed": 1_200,
  "elements-model": 1_200,
  "elements-spin": 1_200,
};
// Activation and on demand together: everything a viewer can load but its add-ons.
const reachableJsGzipLimits: Record<Entry, number> = {
  root: 47_600,
  elements: 53_950,
  react: 54_450,
  solid: 54_250,
  vue: 54_900,
  angular: 56_550,
  thumbnails: 3_850,
  sheet: 7_350,
  kit: 1_900,
  "hover-zoom": 1_500,
  embed: 3_050,
  model: 2_750,
  spin: 2_450,
  "react-embed": 57_000,
  "react-model": 56_750,
  "react-spin": 56_350,
  "solid-embed": 56_600,
  "solid-model": 56_400,
  "solid-spin": 55_950,
  "vue-embed": 57_500,
  "vue-model": 57_200,
  "vue-spin": 56_800,
  "angular-embed": 59_250,
  "angular-model": 58_900,
  "angular-spin": 58_550,
  "elements-embed": 56_750,
  "elements-model": 56_600,
  "elements-spin": 56_250,
};
const activationWithCssGzipLimits: Record<Entry, number> = {
  root: 49_250,
  elements: 55_600,
  react: 56_100,
  solid: 55_900,
  vue: 56_550,
  angular: 58_200,
  thumbnails: 4_900,
  sheet: 8_350,
  kit: 4_700,
  // It needs no stylesheet; the base one counts, as for the kit.
  "hover-zoom": 4_350,
  embed: 5_850,
  model: 5_600,
  spin: 5_250,
  "react-embed": 58_650,
  "react-model": 58_400,
  "react-spin": 58_000,
  "solid-embed": 58_250,
  "solid-model": 58_050,
  "solid-spin": 57_600,
  "vue-embed": 59_150,
  "vue-model": 58_850,
  "vue-spin": 58_450,
  "angular-embed": 60_900,
  "angular-model": 60_600,
  "angular-spin": 60_200,
  "elements-embed": 58_400,
  "elements-model": 58_250,
  "elements-spin": 57_900,
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
