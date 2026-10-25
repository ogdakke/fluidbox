import { expect, test, type Page } from "@playwright/test";

/**
 * apps/examples/csp.html runs under `default-src 'self'; style-src 'self';
 * script-src 'self'; require-trusted-types-for 'script'`, and records every
 * violation in `window.cspViolations`.
 */
const dialog = (page: Page) => page.locator("[data-fluidbox-dialog]:not([data-fluidbox-static] *)");
const activeSlide = (page: Page) =>
  dialog(page).locator('[data-fluidbox-slide][aria-hidden="false"]');
const violations = (page: Page) => page.evaluate(() => window.cspViolations);

async function load(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/csp.html${query}`);
  await page.waitForFunction(() => window.cspViewer !== undefined);
  return errors;
}

test("the plain runtime opens, navigates, zooms and closes under a strict policy", async ({
  page,
}) => {
  const errors = await load(page);
  expect(await page.evaluate(() => window.cspViewer.load())).toBe(true);
  await page.locator('[data-photo="0"]').click();
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 1 of 3");

  await dialog(page).locator("[data-fluidbox-next]").click();
  await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 2 of 3");
  await activeSlide(page).locator("[data-fluidbox-media]").dblclick();
  await expect(dialog(page)).toHaveAttribute("data-zoomed", "");
  await page.keyboard.press("0");
  await expect(dialog(page)).not.toHaveAttribute("data-zoomed", "");

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('[data-photo="1"]')).toBeFocused();
  expect(errors).toEqual([]);
  expect(await violations(page)).toEqual([]);
});

test("custom elements open and close under a strict policy", async ({ page }) => {
  const errors = await load(page);
  await page.locator("[data-csp-elements] button").click();
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 2 of 2");
  await page.keyboard.press("ArrowLeft");
  await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 1 of 2");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(await violations(page)).toEqual([]);
});

test("the plain runtime takes over the server's copy under a strict policy", async ({ page }) => {
  // Hold the page's script back to measure the copy before JavaScript runs.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/fixtures/csp.ts*", async (route) => {
    await held;
    await route.continue();
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/csp.html?ssr=1", { waitUntil: "commit" });
  const copy = page.locator("[data-fluidbox-static]");
  const media = copy.locator("[data-fluidbox-media]");
  await expect(media).toHaveJSProperty("complete", true);
  await expect(copy.locator("[data-fluidbox-dialog]")).toHaveAttribute("role", "region");
  const copied = await media.boundingBox();
  release();
  await page.waitForFunction(() => window.cspViewer !== undefined);
  expect(await page.evaluate(() => window.cspTakeOver)).toBe(true);
  await expect(copy).toBeHidden();
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 2 of 3");
  // The copy drew the photo where the viewer does, from the stylesheet alone.
  const drawn = await activeSlide(page).locator("[data-fluidbox-media]").boundingBox();
  for (const side of ["x", "y", "width", "height"] as const) {
    expect(Math.abs(copied![side] - drawn![side]), side).toBeLessThanOrEqual(1);
  }
  await page.keyboard.press("ArrowRight");
  await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 3 of 3");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(await violations(page)).toEqual([]);
});

test("a React Root that renders open draws and hands over its copy under a strict policy", async ({
  page,
}) => {
  const errors = await load(page, "?react");
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 2 of 2");
  await expect(page.locator("[data-fluidbox-server-viewer]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(await violations(page)).toEqual([]);
});

test("a Vue Root that renders open hydrates and hands over its copy under a strict policy", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (/hydration/i.test(message.text())) warnings.push(message.text());
  });
  // The server's HTML holds the copy before any script runs.
  const response = await page.request.get("/csp.html?vue");
  expect(await response.text()).toMatch(/<div data-csp-vue>.*data-fluidbox-server-viewer/s);
  const errors = await load(page, "?vue");
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 2 of 2");
  await expect(page.locator("[data-fluidbox-server-viewer]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(warnings).toEqual([]);
  expect(await violations(page)).toEqual([]);
});

test("a Solid Root that renders open draws and hands over its copy under a strict policy", async ({
  page,
}) => {
  const errors = await load(page, "?solid");
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 2 of 2");
  await expect(page.locator("[data-fluidbox-server-viewer]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(await violations(page)).toEqual([]);
});
