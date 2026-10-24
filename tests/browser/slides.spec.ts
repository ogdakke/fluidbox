import { expect, test, type Page } from "@playwright/test";
import type { Fluidbox } from "@ogdakke/fluidbox";

declare global {
  interface Window {
    slidesFixture: {
      fluidbox: Fluidbox;
      replaced: Fluidbox;
      log: string[];
    };
  }
}

const dialog = "[data-fluidbox-dialog]";
const shown = '[data-fluidbox-slide][aria-hidden="false"]';

async function load(page: Page) {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.goto("/slides.html");
  await expect(page.locator("#slides button")).toHaveCount(5);
  return warnings;
}

async function open(page: Page, grid: string, id: string) {
  await page.locator(`${grid} [data-item="${id}"]`).click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
}

test("a slide of your own draws the built-in image into its box", async ({ page }) => {
  await load(page);
  await open(page, "#slides", "product");
  const box = page.locator(`${shown} [data-fluidbox-media]`);
  // The box is the slide's own: the drawn image fills it, with the slide's content beside it.
  await expect(box).toHaveAttribute("data-fluidbox-item-content", "");
  const image = box.locator("[data-fluidbox-picture] > img[data-fluidbox-drawn]");
  await expect(image).toHaveAttribute("src", "/products/fjord-room.webp");
  await expect(image).not.toHaveAttribute("data-fluidbox-image-pending");
  await expect(image).toHaveAttribute("alt", "Photo product-image");
  await expect(box.locator(".slides-price")).toHaveText("€120");
  await expect(page.locator(`${shown} [data-fluidbox-frame]`)).toHaveAttribute(
    "data-fluidbox-image-frame",
    "",
  );
  const size = await image.evaluate((element) => {
    const box = element.closest("[data-fluidbox-media]")!.getBoundingClientRect();
    const own = element.getBoundingClientRect();
    return { width: own.width - box.width, height: own.height - box.height };
  });
  expect(size).toEqual({ width: 0, height: 0 });
});

test("the drawn image opens on the trigger's picture, then loads the full one", async ({
  page,
}) => {
  await load(page);
  // Hold the full image, so the slide shows what the open painted first.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/products/fjord-room.webp", async (route) => {
    await held;
    await route.continue();
  });
  await page.locator('#slides [data-item="product"]').click();
  const image = page.locator(`${shown} [data-fluidbox-media] img[data-fluidbox-drawn]`);
  await expect(image).toHaveAttribute("src", /fjord-room-thumb\.webp$/);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  release();
  await expect(image).toHaveAttribute("src", "/products/fjord-room.webp");
  await expect(image).not.toHaveAttribute("data-fluidbox-image-pending");
});

test("a drawn video autoplays on show and pauses as the viewer moves on", async ({ page }) => {
  await load(page);
  await open(page, "#slides", "clip");
  const video = page.locator(`${shown} [data-fluidbox-media] video[data-fluidbox-drawn]`);
  await expect(video).toHaveAttribute("src", "/video/drift.webm");
  await expect(video).toHaveAttribute("poster", "/video/drift-poster.jpg");
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(false);
  const left = page.locator("[data-fluidbox-slide] video[data-fluidbox-drawn]");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => left.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
});

test("an item type without a slide shows the slide's error and warns once", async ({ page }) => {
  const warnings = await load(page);
  await open(page, "#slides", "mystery");
  const error = page.locator(`${shown} [data-fluidbox-error]`);
  await expect(error).toBeVisible();
  await expect(error).toContainText("Unable to load media.");
  // The viewer goes on working around it.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(`${shown} [data-fluidbox-media]`)).toHaveAttribute("alt", "Photo last");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  await open(page, "#slides", "mystery");
  const missing = warnings.filter((text) => text.includes('type "mystery"'));
  expect(missing).toHaveLength(1);
});

test("unloading a slide disposes it and empties its box", async ({ page }) => {
  await load(page);
  await open(page, "#slides", "product");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.slidesFixture.log))
    .toContain("product dispose");
  const left = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll("[data-fluidbox-item-content]")];
    const product = boxes.find(
      (box) => box.getAttribute("aria-label") === "Framed print",
    ) as HTMLElement;
    return {
      children: product.childElementCount,
      frame: product.closest("[data-fluidbox-frame]")!.hasAttribute("data-fluidbox-image-frame"),
    };
  });
  expect(left).toEqual({ children: 0, frame: false });
});

test("a slide for a built-in type replaces it, and default draws the other types", async ({
  page,
}) => {
  await load(page);
  await open(page, "#replaced", "one");
  const box = page.locator(`${shown} [data-fluidbox-media]`);
  await expect(box).toHaveAttribute("data-replaced", "one");
  await expect(box.locator("img[data-fluidbox-drawn]")).toHaveAttribute(
    "src",
    /\/photo-square\.svg$/,
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(`${shown} .slides-default`)).toHaveText("Default slide for other");
});
