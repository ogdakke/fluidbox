import { defineConfig } from "tsdown";

// Built on its own, then copied into @ogdakke/fluidbox's dist by scripts/build.ts.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: "esm",
  platform: "browser",
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  report: false,
  deps: { neverBundle: [/^@ogdakke\/fluidbox(?:\/.*)?$/, /^solid-js(?:\/.*)?$/] },
});
