import { readdirSync } from "node:fs";
import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";
import { defineConfig } from "vite";

// Every top-level HTML file is a page: index.html is the showcase, the rest are test fixtures.
const pages = Object.fromEntries(
  readdirSync(import.meta.dirname)
    .filter((file) => file.endsWith(".html"))
    .map((file) => [file.slice(0, -".html".length), file]),
);

export default defineConfig({
  plugins: [react({ include: /(react|photo-library)\.tsx$/ }), solid({ include: /solid\.tsx$/ })],
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  server: {
    allowedHosts: true,
    port: Number(process.env.PORT) || 5173,
    strictPort: Boolean(process.env.PORT),
  },
  preview: {
    allowedHosts: true,
    port: Number(process.env.PORT) || 4173,
    strictPort: Boolean(process.env.PORT),
  },
  build: {
    rollupOptions: { input: pages },
  },
});
