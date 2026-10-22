import { defineConfig, devices } from "@playwright/test";

// FLUIDBOX_PORT lets several checkouts run the suite at once without sharing a server.
const port = Number(process.env.FLUIDBOX_PORT) || 4173;
const baseURL = `http://127.0.0.1:${port}`;
// FLUIDBOX_SERVER=preview serves the built examples (bun run build:examples) instead of the dev server.
const preview = process.env.FLUIDBOX_SERVER === "preview";
// FLUIDBOX_RECORD=off records no trace or video; first-retry records them on a retry only.
const record = process.env.FLUIDBOX_RECORD;
const recording =
  record === "off" ? "off" : record === "first-retry" ? "on-first-retry" : "retain-on-failure";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: recording,
    screenshot: "only-on-failure",
    video: recording,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
    { name: "iphone-15-pro", use: { ...devices["iPhone 15 Pro"] } },
    { name: "ipad-pro-11", use: { ...devices["iPad Pro 11"] } },
  ],
  webServer: {
    command: `bun run --cwd apps/examples ${preview ? "preview" : "dev"} --port ${port} --strictPort`,
    url: `${baseURL}/harness.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
