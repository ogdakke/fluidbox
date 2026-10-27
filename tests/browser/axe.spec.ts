import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** axe on the patterns page (apps/examples/src/patterns) with the viewer closed and in each open state. */

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(tags);
  if (include) builder.include(include);
  const { violations } = await builder.analyze();
  return violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
}

const pattern = (page: Page, name: string) => page.locator(`[data-pattern="${name}"]`);
const dialog = (page: Page) => page.locator("[data-fluidbox-dialog]");

async function openFrom(page: Page, name: string, index = 0) {
  await pattern(page, name).locator('[data-test="trigger"]').nth(index).click();
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/javascript/");
  await expect(page.locator("html")).toHaveAttribute("data-patterns-ready", "");
});

test("the patterns are clean closed", async ({ page }) => {
  expect(await violations(page, "[data-pattern]")).toEqual([]);
});

test("a single item is clean open", async ({ page }) => {
  await pattern(page, "origins").locator('[data-test="product"]').click();
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
  expect(await violations(page, "[data-fluidbox-viewer]")).toEqual([]);
});

test("a gallery is clean open", async ({ page }) => {
  await openFrom(page, "basic", 1);
  expect(await violations(page, "[data-fluidbox-viewer]")).toEqual([]);
});

test("a gallery with custom media is clean open", async ({ page }) => {
  await openFrom(page, "renderers");
  expect(await violations(page, "[data-fluidbox-viewer]")).toEqual([]);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"] video')).toBeAttached();
  expect(await violations(page, "[data-fluidbox-viewer]")).toEqual([]);
});

test("the thumbnails is clean open", async ({ page }) => {
  await openFrom(page, "thumbnails");
  await expect(dialog(page).locator("[data-fluidbox-thumbnails]")).toBeVisible();
  expect(await violations(page, "[data-fluidbox-viewer]")).toEqual([]);
});

test("the sheet is clean open, at rest and raised", async ({ page }) => {
  await openFrom(page, "sheet");
  expect(await violations(page, "[data-fluidbox-viewer]")).toEqual([]);
  await dialog(page).locator('[data-test="peek"]').click();
  await expect(dialog(page).locator('[data-test="stop"]')).toHaveText("1");
  expect(await violations(page, "[data-fluidbox-viewer]")).toEqual([]);
});

test("the headless caption is clean open", async ({ page }) => {
  await openFrom(page, "headless");
  expect(await violations(page, "[data-fluidbox-viewer]")).toEqual([]);
});

test("a zoomed image and the zoom controls are clean", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/a11y.html?zoom");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  await page.evaluate(() => (window as any).a11yFluidbox.load());
  await page.evaluate(() => (window as any).a11yFluidbox.open(0));
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
  await page.evaluate(() => (window as any).a11yFluidbox.zoomTo(2));
  await expect(dialog(page).locator("[data-fluidbox-zoom-viewport]")).toBeAttached();
  expect(await violations(page, "[data-fluidbox-viewer]")).toEqual([]);
});
