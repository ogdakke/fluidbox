import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { highlightHtml } from "../design/highlight";
import { packageSource, watchPackageSource } from "../design/package-source";
import { docsPlugin } from "./plugin";

export default defineConfig(({ command }) => ({
  // The landing page is `/`; every docs route serves the prerendered docs shell.
  appType: "mpa",
  plugins: [
    docsPlugin(),
    highlightHtml(),
    // Live examples come from the example site's pattern files.
    react({ include: [/patterns\/react\/.*\.tsx$/] }),
    solid({ include: [/patterns\/solid\/.*\.tsx$/] }),
    vue(),
    watchPackageSource(),
  ],
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  resolve: {
    alias: packageSource(command),
    dedupe: ["react", "react-dom", "solid-js", "vue", "@angular/core", "@angular/common"],
  },
  // Share the example site's generated artwork, map and video.
  publicDir: resolve(import.meta.dirname, "../examples/public"),
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, "index.html"),
        docs: resolve(import.meta.dirname, "docs/index.html"),
      },
    },
  },
  server: {
    allowedHosts: true,
    port: Number(process.env.PORT) || 5180,
    strictPort: Boolean(process.env.PORT),
  },
  preview: {
    allowedHosts: true,
    port: Number(process.env.PORT) || 4180,
    strictPort: Boolean(process.env.PORT),
  },
}));
