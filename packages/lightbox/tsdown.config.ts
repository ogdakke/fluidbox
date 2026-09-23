import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    elements: "src/elements.ts",
    react: "src/react.ts",
    solid: "src/solid.ts",
    vue: "src/vue.ts",
    angular: "src/angular.ts",
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
  ],
  publint: { level: "error" },
  attw: { profile: "esm-only", level: "error" },
});
