import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const allowedHosts = [process.env.PORTLESS_URL, process.env.PORTLESS_TAILSCALE_URL]
  .filter((url): url is string => !!url)
  .map((url) => new URL(url).hostname);

export default defineConfig({
  plugins: [react({ include: /photo-library\.tsx$/ })],
  server: {
    allowedHosts,
    port: Number(process.env.PORT) || 5173,
    strictPort: Boolean(process.env.PORT),
  },
  build: {
    rollupOptions: {
      input: {
        headless: "headless.html",
        playground: "index.html",
        photoLibrary: "photo-library.html",
      },
    },
  },
});
