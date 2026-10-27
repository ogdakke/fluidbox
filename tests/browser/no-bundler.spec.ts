import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";

const root = join(import.meta.dirname, "../..");
const dist = join(root, "packages/fluidbox/dist");
const assets = join(root, "apps/examples/public");
const origin = "http://no-bundler.test";
const types: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".html": "text/html",
};

/**
 * A page that imports the built package as a CDN would serve it, with no
 * bundler and so no `process`: a theme's `<script type="module">`.
 */
const page_ = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="/dist/styles.css" />
    <link rel="stylesheet" href="/dist/baseline.css" />
  </head>
  <body>
    <button type="button" id="photo">Photo</button>
    <button type="button" id="model">Model</button>
    <button type="button" id="spin">Spin</button>
    <script type="module">
      import { createFluidbox } from "/dist/index.js";
      import { createModelSlide, modelItem } from "/dist/model.js";
      import { createSpinSlide, spinItem } from "/dist/spin.js";
      // A stand-in for <model-viewer> that loads at once.
      customElements.define(
        "model-viewer",
        class extends HTMLElement {
          connectedCallback() {
            setTimeout(() => this.dispatchEvent(new Event("load")), 20);
          }
        },
      );
      const fluidbox = createFluidbox({
        items: [
          { type: "image", id: "photo", src: "/photo-square.svg", alt: "Photo", width: 800, height: 800 },
          modelItem({
            title: "Helmet",
            src: "/products/damaged-helmet/damaged-helmet.glb",
            poster: "/products/damaged-helmet/damaged-helmet.webp",
            width: 800,
            height: 800,
          }),
          spinItem({
            title: "Print",
            frames: { src: "/products/spin/fjord-{index}.webp", count: 36, digits: 2 },
            width: 800,
            height: 800,
          }),
        ],
        slides: { model: createModelSlide(), spin: createSpinSlide() },
      });
      for (const [index, id] of ["photo", "model", "spin"].entries()) {
        fluidbox.bind(document.getElementById(id), index);
      }
      window.fluidbox = fluidbox;
      document.documentElement.dataset.ready = "";
    </script>
  </body>
</html>`;

test("the built package runs on a page without a bundler", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "What the page lacks doesn't depend on the browser.");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(`${origin}/**`, async (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    if (path === "/") return route.fulfill({ body: page_, contentType: "text/html" });
    const file = path.startsWith("/dist/")
      ? join(dist, normalize(path.slice("/dist/".length)))
      : join(assets, normalize(path));
    try {
      const body = await readFile(file);
      return route.fulfill({
        body,
        contentType: types[extname(file)] ?? "application/octet-stream",
      });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  await page.goto(`${origin}/`);
  await expect(page.locator("html")).toHaveAttribute("data-ready", "");
  expect(await page.evaluate(() => typeof (globalThis as { process?: unknown }).process)).toBe(
    "undefined",
  );
  const dialog = page.locator("[data-fluidbox-dialog]");
  for (const id of ["photo", "model", "spin"]) {
    await page.locator(`#${id}`).click();
    await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
  // A misuse still throws, with the production message.
  const message = await page.evaluate(() => {
    try {
      (
        window as unknown as { fluidbox: { bindControl(element: Element, name: string): unknown } }
      ).fluidbox.bindControl(document.body, "nothing");
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  });
  expect(message).toBe("fluidbox");
  expect(errors).toEqual([]);
});
