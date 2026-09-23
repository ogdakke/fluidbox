import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

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
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
    { name: "iphone-13", use: { ...devices["iPhone 13"] } },
    { name: "ipad-pro-11", use: { ...devices["iPad Pro 11"] } },
  ],
  webServer: [
    {
      command: "bun run --cwd examples/vanilla dev --port 4173 --strictPort",
      url: `${baseURL}/harness.html`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "bun run --cwd examples/frameworks dev --port 4174 --strictPort",
      url: "http://127.0.0.1:4174/react.html",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
