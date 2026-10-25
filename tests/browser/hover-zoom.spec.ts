import { expect, test, type Page } from "@playwright/test";
import { stubMedia } from "./support/media";

// hoverZoom on the JavaScript hover pattern: a product photo that opens the viewer.
const lens = "[data-fluidbox-hover-zoom]";

async function load(page: Page) {
  await stubMedia(page);
  await page.goto("/javascript/");
  await expect(page.locator("html")).toHaveAttribute("data-patterns-ready", "");
  const product = page.locator('[data-pattern="hover"] [data-test="product"]');
  const image = product.locator("img");
  await product.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).not.toBe(0);
  // Let the scroll settle first: a scroll takes the hover zoom away.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)));
  return { product, image };
}

test.describe("hover zoom", () => {
  test.skip(({ isMobile }) => isMobile, "a resting mouse");

  test("magnifies the photo under the mouse, following it, until the click opens the viewer", async ({
    page,
  }) => {
    const { image } = await load(page);
    const layout = () =>
      image.evaluate((img) => {
        const box = img.getBoundingClientRect();
        return [box.x, box.y, box.width, box.height, document.documentElement.scrollHeight];
      });
    const before = await layout();
    await expect(page.locator(lens)).toHaveCount(0);
    const box = (await image.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await expect(page.locator(lens)).toHaveCount(1);
    await expect(image).toHaveAttribute("data-fluidbox-hover-zooming", "");
    // Over the image's box, magnified, and nothing on the page moves.
    const shown = (await page.locator(lens).boundingBox())!;
    expect(Math.abs(shown.x - box.x)).toBeLessThan(1);
    expect(Math.abs(shown.width - box.width)).toBeLessThan(1);
    expect(await layout()).toEqual(before);
    const picture = page.locator(`${lens} img`);
    const offset = () =>
      picture.evaluate((element) => {
        const { m41, m42 } = new DOMMatrix(getComputedStyle(element).transform);
        return [m41, m42];
      });
    // Within 2px: the mouse lands on whole pixels, the box may not, and the zoom
    // moves 1.5px for each.
    const near = (expected: number[]) => async () =>
      (await offset()).every((value, axis) => Math.abs(value - expected[axis]!) <= 2);
    // 10px into the box is 10px into the zoom's 1.5 boxes of overhang.
    expect(await near([-15, -15])()).toBe(true);
    expect((await picture.boundingBox())!.width).toBeCloseTo(box.width * 2.5, 0);
    // Further in, the zoom shows as much further into the image: at 60% across, 60%
    // of the overhang.
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 4 });
    await expect.poll(near([box.width * -0.9, box.height * -0.9])).toBe(true);
    await page.mouse.down();
    await expect(page.locator(lens)).toHaveCount(0);
    await page.mouse.up();
    await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
      "data-fluidbox-status",
      "open",
    );
  });

  test("goes as the mouse leaves", async ({ page }) => {
    const { image } = await load(page);
    await image.hover();
    await expect(page.locator(lens)).toHaveCount(1);
    await page.mouse.move(2, 2);
    await expect(page.locator(lens)).toHaveCount(0);
    await expect(page.locator("[data-fluidbox-hover-zooming]")).toHaveCount(0);
  });

  test("does nothing with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { image } = await load(page);
    const box = (await image.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
    await expect(image).toBeVisible();
    await expect(page.locator(lens)).toHaveCount(0);
  });
});

test("hover zoom does nothing on a touch screen", async ({ page, isMobile }) => {
  test.skip(!isMobile, "a touch screen");
  const { product } = await load(page);
  await product.tap();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await expect(page.locator(lens)).toHaveCount(0);
  await expect(page.locator("[data-fluidbox-hover-zooming]")).toHaveCount(0);
});
