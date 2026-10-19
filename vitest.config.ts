import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.spec.ts", "apps/docs/**/*.spec.ts"],
  },
});
