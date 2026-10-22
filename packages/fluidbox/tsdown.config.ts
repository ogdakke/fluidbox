import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    elements: "src/elements.ts",
    filmstrip: "src/filmstrip-entry.ts",
    sheet: "src/sheet-entry.ts",
    kit: "src/kit.ts",
    "hover-zoom": "src/hover-zoom.ts",
  },
  format: "esm",
  platform: "browser",
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  report: true,
  copy: [
    { from: "src/styles.css", to: "dist", rename: "styles.css" },
    { from: "src/styles.css.d.ts", to: "dist", rename: "styles.css.d.ts" },
    { from: "src/sheet.css", to: "dist", rename: "sheet.css" },
    { from: "src/styles.css.d.ts", to: "dist", rename: "sheet.css.d.ts" },
    { from: "src/filmstrip.css", to: "dist", rename: "filmstrip.css" },
    { from: "src/styles.css.d.ts", to: "dist", rename: "filmstrip.css.d.ts" },
  ],
  // publint and attw run in scripts/build.ts once the framework bindings are copied in.
});
