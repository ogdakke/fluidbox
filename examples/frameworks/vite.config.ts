import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react({ include: /react\.tsx$/ }), solid({ include: /solid\.tsx$/ })],
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  build: {
    rollupOptions: {
      input: {
        react: "react.html",
        solid: "solid.html",
        vue: "vue.html",
        angular: "angular.html",
      },
    },
  },
});
