import { expect, test, type Page } from "@playwright/test";

const dialog = "[data-fluidbox-dialog]";
const activeMedia = '[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]';
/** The image on show, in its slide or, zoomed, in the zoom's scroller. */
const shownMedia = `[data-fluidbox-zoom-viewport] [data-fluidbox-media], ${activeMedia}`;

async function openOn(page: Page, id: string) {
  await page.goto("/zoom.html");
  await page.locator(`[data-zoom-id="${id}"]`).click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
}

const zoomState = (page: Page) => page.evaluate(() => window.zoomViewer.state.zoom);

/** The scale the active image paints at, from its transform. */
const paintedScale = (page: Page) =>
  page.locator(shownMedia).evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return new DOMMatrix(transform === "none" ? undefined : transform).a;
  });

test.describe("zoom API", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("state.zoom follows the image on show, and is null for media that doesn't zoom", async ({
    page,
  }) => {
    await page.goto("/zoom.html");
    expect(await zoomState(page)).toBeNull();
    await page.locator('[data-zoom-id="ladder"]').click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    expect(await zoomState(page)).toEqual({ scale: 1, min: 1, max: 4 });
    await page.evaluate(() => window.zoomViewer.open("clip"));
    await expect.poll(() => zoomState(page)).toBeNull();
    // A command with nothing to zoom does nothing.
    expect(await page.evaluate(() => window.zoomViewer.zoomIn())).toBe(false);
    await page.evaluate(() => window.zoomViewer.update({ zoom: { max: 6 } }));
    await page.evaluate(() => window.zoomViewer.open("ladder"));
    await expect.poll(() => zoomState(page)).toEqual({ scale: 1, min: 1, max: 6 });
  });

  test("zoomTo resolves once the zoom rests, with one settled state and event", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openOn(page, "ladder");
    const result = await page.evaluate(async () => {
      const seen: (number | undefined)[] = [];
      const unsubscribe = window.zoomViewer.subscribe((state) => seen.push(state.zoom?.scale));
      const zoomed = await window.zoomViewer.zoomTo(2.5);
      unsubscribe();
      return { zoomed, seen, state: window.zoomViewer.state.zoom, events: window.zoomEvents };
    });
    expect(result.zoomed).toBe(true);
    // One snapshot as it rests, never one per frame.
    expect(result.seen).toEqual([2.5]);
    expect(result.state).toEqual({ scale: 2.5, min: 1, max: 4 });
    expect(result.events).toEqual([{ scale: 2.5, reason: "api" }]);
    expect(await paintedScale(page)).toBeCloseTo(2.5, 2);
    await expect(page.locator(dialog)).toHaveAttribute("data-zoomed", "");
  });

  test("zoomIn, zoomOut and resetZoom step by 1.5 and stop at the bounds", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openOn(page, "ladder");
    const scales = await page.evaluate(async () => {
      const viewer = window.zoomViewer;
      const scales: number[] = [];
      for (let step = 0; step < 5; step++) {
        await viewer.zoomIn();
        scales.push(viewer.state.zoom!.scale);
      }
      await viewer.zoomOut();
      scales.push(viewer.state.zoom!.scale);
      await viewer.resetZoom();
      scales.push(viewer.state.zoom!.scale);
      await viewer.zoomTo(99);
      scales.push(viewer.state.zoom!.scale);
      return scales;
    });
    expect(scales).toEqual([1.5, 2.25, 3.375, 4, 4, 2.667, 1, 4]);
    expect(await page.evaluate(() => window.zoomViewer.zoomTo(Number.NaN).catch(String))).toMatch(
      /RangeError/,
    );
  });

  test("a gesture or a newer zoom interrupts a zoom, which resolves false", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openOn(page, "ladder");
    const results = await page.evaluate(async () => {
      const viewer = window.zoomViewer;
      const first = viewer.zoomTo(3);
      const second = viewer.zoomTo(2);
      const controller = new AbortController();
      const third = viewer.zoomTo(1.5, { signal: controller.signal });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      controller.abort();
      return Promise.all([first, second, third]);
    });
    expect(results).toEqual([false, false, false]);
    // The aborted zoom stops short of its scale and comes to rest there.
    await page.waitForTimeout(600);
    const rested = (await zoomState(page))!.scale;
    expect(rested).toBeLessThan(1.5);
    expect(await paintedScale(page)).toBeCloseTo(rested, 2);
  });

  test("an origin keeps its point of the image where it is", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openOn(page, "ladder");
    const box = (await page.locator(activeMedia).boundingBox())!;
    const origin = { x: box.x + box.width * 0.25, y: box.y + box.height * 0.25 };
    await page.evaluate((origin) => window.zoomViewer.zoomTo(2, { origin }), origin);
    const zoomed = (await page.locator(shownMedia).boundingBox())!;
    // The quarter point of the image is still under the origin.
    expect(zoomed.x + zoomed.width * 0.25).toBeCloseTo(origin.x, 0);
    expect(zoomed.y + zoomed.height * 0.25).toBeCloseTo(origin.y, 0);
  });
});

test.describe("zoom controls", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("the zoom controls step the zoom, and are disabled at their limits", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openOn(page, "ladder");
    const group = page.getByRole("group", { name: "Zoomed image" });
    const zoomIn = group.getByRole("button", { name: "Zoom in" });
    const zoomOut = group.getByRole("button", { name: "Zoom out" });
    const reset = group.getByRole("button", { name: "Fit to screen" });
    await expect(zoomOut).toBeDisabled();
    await expect(reset).toBeDisabled();
    for (let step = 0; step < 4; step++) await zoomIn.click();
    await expect(zoomIn).toBeDisabled();
    expect((await zoomState(page))!.scale).toBe(4);
    await zoomOut.click();
    await expect.poll(async () => (await zoomState(page))!.scale).toBe(2.667);
    await reset.focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await zoomState(page))!.scale).toBe(1);
    await expect(zoomOut).toBeDisabled();
    const reasons = await page.evaluate(() => window.zoomEvents.map((event) => event.reason));
    expect(reasons).toEqual(["pointer", "pointer", "pointer", "pointer", "pointer", "keyboard"]);
    // A video has nothing to zoom.
    await page.evaluate(() => window.zoomViewer.open("clip"));
    await expect(zoomIn).toBeDisabled();
  });
});

test.describe("zoom accessibility", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("the zoomed scroller is a named group inside the dialog, and announces its zoom", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openOn(page, "ladder");
    await page.evaluate(() => window.zoomViewer.zoomTo(2));
    const viewport = page.locator(`${dialog} [data-fluidbox-zoom-viewport]`);
    await expect(viewport).toHaveCount(1);
    await expect(viewport).toHaveAttribute("role", "group");
    await expect(page.getByRole("group", { name: "Zoomed image" }).first()).toBeVisible();
    await expect(page.locator("[data-fluidbox-announcer]")).toHaveText("Zoom 200%");
    // Focus can rest on it and stays in the dialog.
    await viewport.focus();
    await expect(viewport).toBeFocused();
    await page.evaluate(() => window.zoomViewer.resetZoom());
    await expect(page.locator("[data-fluidbox-announcer]")).toHaveText("Zoom 100%");
    await expect(page.locator(`${dialog}`)).toBeFocused();
  });

  test("labels translate the zoom controls and the announcement", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openOn(page, "ladder");
    await page.evaluate(() =>
      window.zoomViewer.update({
        labels: { zoomIn: "Lähennä", zoomLevel: (scale: number) => `Zoomaus ${scale}×` },
      }),
    );
    await page.getByRole("button", { name: "Lähennä" }).click();
    await expect(page.locator("[data-fluidbox-announcer]")).toHaveText("Zoomaus 1.5×");
  });

  test("a click beside the zoomed image zooms out instead of closing", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openOn(page, "ladder");
    await page.evaluate(() => window.zoomViewer.zoomTo(1.2));
    const viewport = page.locator("[data-fluidbox-zoom-viewport]");
    const box = (await viewport.boundingBox())!;
    await page.mouse.click(box.x + 8, box.y + box.height / 2);
    await expect.poll(async () => (await zoomState(page))!.scale).toBe(1);
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  });
});

test.describe("zoom by pointer", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("one click of a mouse zooms in where it lands, another zooms out", async ({
    page,
  }, testInfo) => {
    test.skip(!!testInfo.project.use.isMobile, "A mouse click.");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openOn(page, "ladder");
    const box = (await page.locator(activeMedia).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(async () => (await zoomState(page))!.scale).toBe(2);
    const zoomed = page.locator("[data-fluidbox-zoom-viewport] [data-fluidbox-media]");
    const at = (await zoomed.boundingBox())!;
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    await expect.poll(async () => (await zoomState(page))!.scale).toBe(1);
    // A double-click is one zoom, not a zoom and back.
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(async () => (await zoomState(page))!.scale).toBe(2);
    expect(await page.evaluate(() => window.zoomEvents.map((event) => event.reason))).toEqual([
      "pointer",
      "pointer",
      "pointer",
    ]);
  });

  test("two taps a little slower than 250 ms apart still zoom", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, "Taps.");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openOn(page, "ladder");
    const box = (await page.locator(activeMedia).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(300);
    await page.touchscreen.tap(x, y);
    await expect.poll(async () => (await zoomState(page))?.scale).toBe(2);
  });
});

test.describe("zoom by keyboard", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  // The viewer's key handling asks the zoom first once session C's rewrite of
  // it lands (`this.#zoom?.zoomed && this.#zoom.keydown(event)`); until then
  // the arrow keys move between items while zoomed.
  test.fixme(
    !process.env.FLUIDBOX_ZOOM_KEYS,
    "Needs the driver's keydown to hand keys to FluidboxZoom.keydown.",
  );

  test("the arrow keys pan the zoomed image and leave the item where it is", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openOn(page, "ladder");
    await page.evaluate(() => window.zoomViewer.zoomTo(3));
    const viewport = page.locator("[data-fluidbox-zoom-viewport]");
    const scroll = () => viewport.evaluate((element) => [element.scrollLeft, element.scrollTop]);
    const [left, top] = await scroll();
    await page.keyboard.press("ArrowRight");
    // A fifth of the view: 256 px across a 1280 px window.
    await expect.poll(async () => (await scroll())[0]! - left!).toBeCloseTo(256, 0);
    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await scroll())[1]! - top!).toBeCloseTo(144, 0);
    await page.keyboard.press("Shift+ArrowLeft");
    await expect.poll(async () => (await scroll())[0]! - left!).toBeCloseTo(256 - 640, 0);
    expect(await page.evaluate(() => window.zoomViewer.state.index)).toBe(0);
    expect((await zoomState(page))!.scale).toBe(3);
    // Unzoomed, the keys move between items again.
    await page.keyboard.press("0");
    await expect(page.locator(dialog)).not.toHaveAttribute("data-zoomed", "");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => page.evaluate(() => window.zoomViewer.state.index)).toBe(1);
  });
});
