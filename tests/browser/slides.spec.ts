import { expect, test, type Page } from "@playwright/test";
import type { Fluidbox } from "@ogdakke/fluidbox";

declare global {
  interface Window {
    slidesFixture: {
      fluidbox: Fluidbox;
      replaced: Fluidbox;
      hooks: Fluidbox;
      log: string[];
      poses: {
        scale: number;
        x: number;
        y: number;
        moving: boolean;
        visible: { x: number; y: number; width: number; height: number };
      }[];
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

// At rest zoomed, the box sits in the zoom's native scroller, outside its slide.
const zoomScale = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-fluidbox-media]")]
      .map((box) => box.style.getPropertyValue("--fluidbox-zoom-scale"))
      .find(Boolean),
  );

test("a slide drawing the built-in image zooms its box", async ({ page }) => {
  await load(page);
  await open(page, "#slides", "product");
  await expect
    .poll(() => page.evaluate(() => window.slidesFixture.fluidbox.state.zoom?.scale))
    .toBe(1);
  expect(await page.evaluate(() => window.slidesFixture.fluidbox.zoomTo(2))).toBe(true);
  expect(Number(await zoomScale(page))).toBeCloseTo(2, 2);
  // The clip draws a video, which doesn't zoom. Zoomed, the arrows pan, so move by command.
  await page.evaluate(() => window.slidesFixture.fluidbox.next());
  await expect.poll(() => page.evaluate(() => window.slidesFixture.fluidbox.state.zoom)).toBeNull();
});

test("a slide's own box zooms once it says so, to its own max, and reports its pose", async ({
  page,
}) => {
  await load(page);
  await open(page, "#hooks", "card");
  await expect.poll(() => page.evaluate(() => window.slidesFixture.hooks.state.zoom?.max)).toBe(3);
  expect(await page.evaluate(() => window.slidesFixture.hooks.zoomTo(5))).toBe(true);
  expect(await page.evaluate(() => window.slidesFixture.hooks.state.zoom?.scale)).toBeCloseTo(3, 2);
  expect(Number(await zoomScale(page))).toBeCloseTo(3, 2);
  await expect
    .poll(() => page.evaluate(() => window.slidesFixture.poses.at(-1)?.moving))
    .toBe(false);
  const poses = await page.evaluate(() => window.slidesFixture.poses);
  // The zoom moved through frames on its way, then rested at 3.
  expect(poses.some((pose) => pose.moving && pose.scale > 1 && pose.scale < 3)).toBe(true);
  const last = poses.at(-1)!;
  expect(last.scale).toBeCloseTo(3, 2);
  // Zoomed 3× into the middle, the window shows a window-shaped part of the item's
  // 800 × 600 pixels: a third of it along the side the box fits.
  const { innerWidth, innerHeight } = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));
  expect(Math.min(last.visible.width / 800, last.visible.height / 600)).toBeCloseTo(1 / 3, 1);
  expect(last.visible.width / last.visible.height).toBeCloseTo(innerWidth / innerHeight, 1);
  expect(last.visible.x + last.visible.width / 2).toBeCloseTo(400, 0);
  expect(last.visible.y + last.visible.height / 2).toBeCloseTo(300, 0);
  // New items while zoomed release the zoom without an error.
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() =>
    window.slidesFixture.hooks.setItems([
      { type: "card", id: "card", title: "Card", width: 800, height: 600 },
    ]),
  );
  await expect
    .poll(() => page.evaluate(() => window.slidesFixture.hooks.state.zoom?.scale))
    .toBe(1);
  expect(errors).toEqual([]);
});

test("a slide's layer sits over the slide, outside the box, and doesn't fly", async ({ page }) => {
  await load(page);
  await page.locator('#hooks [data-item="card"]').click();
  const layer = page.locator(`${shown} > [data-fluidbox-slide-layer]`);
  await expect(layer).toHaveAttribute("data-fluidbox-chrome", "");
  await expect(layer.locator(".slides-caption")).toHaveText("Card caption");
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(layer).toHaveCSS("opacity", "1");
  const placed = await layer.evaluate((element) => {
    const slide = element.parentElement!.getBoundingClientRect();
    const own = element.getBoundingClientRect();
    return {
      inBox: !!element.closest("[data-fluidbox-media]"),
      same: [own.x - slide.x, own.y - slide.y, own.width - slide.width, own.height - slide.height],
      pointer: getComputedStyle(element).pointerEvents,
    };
  });
  expect(placed).toEqual({ inBox: false, same: [0, 0, 0, 0], pointer: "none" });
  // Zoomed, the layer stays where it is.
  await page.evaluate(() => window.slidesFixture.hooks.zoomTo(2));
  expect(await layer.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
});

test("an empty box opens and closes with a fade, not a flight", async ({ page }) => {
  await load(page);
  await page.locator('#hooks [data-item="blank"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "opening");
  const start = await page.locator(`${shown} [data-fluidbox-frame]`).evaluate(
    (frame) =>
      frame
        .getAnimations()
        .map((animation) => (animation.effect as KeyframeEffect).getKeyframes()[0])
        .find((keyframe) => keyframe.opacity !== undefined)?.opacity,
  );
  expect(start).toBe("0");
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "closing");
  // No copy of the box travels to the trigger.
  await expect(page.locator("[data-fluidbox-flight]")).toHaveCount(0);
  await expect(page.locator(dialog)).toHaveCount(0);
});
