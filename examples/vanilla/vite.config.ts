import { defineConfig } from "vite";

const allowedHosts = [process.env.PORTLESS_URL, process.env.PORTLESS_TAILSCALE_URL]
  .filter((url): url is string => !!url)
  .map((url) => new URL(url).hostname);

export default defineConfig({
  server: { allowedHosts },
});
