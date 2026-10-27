import { expect, test, type Page } from "@playwright/test";

/**
 * Each binding's Hotspot part, and the elements' <fluidbox-hotspot>: it
 * renders the app's pin, the core puts it on its point, and it takes focus.
 */

declare global {
  interface Window {
    addLamp: () => void;
  }
}

const dialog = "[data-fluidbox-dialog]";
const pins = [
  { name: "Framed print", x: 0.5, y: 0.28 },
  { name: "Books", x: 360 / 1600, y: 950 / 1600 },
];

/** How far each pin's centre is from its point on the drawn photo, contained in its box. */
const misses = (page: Page, points = pins) =>
  page.evaluate((points) => {
    const image = document.querySelector<HTMLImageElement>(
      "[data-fluidbox-slide][data-active] [data-fluidbox-drawn]",
    )!;
    const box = image.getBoundingClientRect();
    const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    return points.map(({ name, x, y }) => {
      const rect = document.querySelector(`[data-pin="${name}"]`)!.getBoundingClientRect();
      return Math.hypot(
        rect.left + rect.width / 2 - (box.left + (box.width - width) / 2 + x * width),
        rect.top + rect.height / 2 - (box.top + (box.height - height) / 2 + y * height),
      );
    });
  }, points);

for (const binding of ["react", "vue", "solid", "angular", "elements"] as const) {
  test(`${binding}: Hotspot renders the pin, on its point, and takes focus`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/hotspots-${binding}.html`);
    await page.locator('[data-item="room"]').click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    const hotspots = page.locator(`${dialog} [data-fluidbox-hotspot]`);
    await expect(hotspots).toHaveCount(2);
    await expect(page.locator(`${dialog} [data-fluidbox-drawn]`)).not.toHaveAttribute(
      "data-fluidbox-image-pending",
    );
    for (const [index, { name }] of pins.entries()) {
      const pin = hotspots.nth(index);
      // The app's own content and name, in the media box where it renders.
      await expect(pin).toHaveAccessibleName(name);
      await expect(pin).toHaveText("+");
      await expect(pin).toHaveAttribute("type", "button");
      await expect(pin).toHaveClass(/hotspot-pin/);
      expect(await pin.evaluate((element) => element.matches("[data-fluidbox-media] *"))).toBe(
        true,
      );
    }
    for (const miss of await misses(page)) expect(miss).toBeLessThan(0.5);
    // The second is given scaleWithZoom, as a bare attribute where markup has one.
    await expect(hotspots.first()).not.toHaveAttribute("data-scale-with-zoom");
    await expect(hotspots.nth(1)).toHaveAttribute("data-scale-with-zoom", "");
    await expect(hotspots.first()).toHaveAttribute("data-fluidbox-managed", "");
    await hotspots.first().focus();
    await expect(hotspots.first()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(hotspots.nth(1)).toBeFocused();
    expect(errors).toEqual([]);
  });

  if (binding === "elements") continue;
  test(`${binding}: a Hotspot added between two takes its place in the Tab order`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/hotspots-${binding}.html`);
    await page.locator('[data-item="room"]').click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    const hotspots = page.locator(`${dialog} [data-fluidbox-hotspot]`);
    await expect(hotspots).toHaveCount(2);
    await expect(page.locator(`${dialog} [data-fluidbox-drawn]`)).not.toHaveAttribute(
      "data-fluidbox-image-pending",
    );
    // The slide renders again, and React's and Vue's Media with a new render.
    await page.evaluate(() => window.addLamp());
    await expect(hotspots).toHaveCount(3);
    const lamp = { name: "Lamp", x: 0.3, y: 0.6 };
    const all = [pins[0]!, lamp, pins[1]!];
    for (const [index, { name }] of all.entries()) {
      await expect(hotspots.nth(index)).toHaveAccessibleName(name);
      await expect(hotspots.nth(index)).toBeVisible();
    }
    await expect.poll(async () => Math.max(...(await misses(page, all)))).toBeLessThan(0.5);
    await hotspots.first().focus();
    for (const name of ["Lamp", "Books"]) {
      await page.keyboard.press("Tab");
      await expect(page.locator(`[data-pin="${name}"]`)).toBeFocused();
    }
    expect(errors).toEqual([]);
  });
}

test("elements: a <fluidbox-hotspot> without x or y sits on the box's corner, never NaN", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/hotspots-elements.html");
  await page.locator('[data-item="bare"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  const bare = page.locator(`${dialog} [data-pin="Bare"]`);
  await expect(bare).toBeVisible();
  expect(await bare.evaluate((element) => [element.style.left, element.style.top])).toEqual([
    "0%",
    "0%",
  ]);
  // scale-with-zoom="false" reads false, as zoom="false" does.
  await expect(bare).not.toHaveAttribute("data-scale-with-zoom");
  expect(errors).toEqual([]);
});
