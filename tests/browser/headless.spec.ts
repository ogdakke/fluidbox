import { expect, test } from "@playwright/test";

test("plain runtime opens, navigates, composes controls, and closes without custom elements", async ({
  page,
}) => {
  await page.goto("/headless.html");

  await expect
    .poll(() => page.evaluate(() => customElements.get("app-lightbox") === undefined))
    .toBe(true);
  const first = page.locator('[data-photo-id="one"]');
  await first.click();

  const overlay = page.locator("[data-lightbox-overlay]");
  const activeMedia = page.locator(
    '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]',
  );
  await expect(overlay).toHaveAttribute("data-lightbox-state", "open");
  await expect(activeMedia).toHaveAttribute("alt", "Blue square study");
  await expect(
    page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-picture] source'),
  ).toHaveCount(1);
  await expect(activeMedia).toHaveAttribute(
    "srcset",
    "/photo-square.svg 400w, /photo-square.svg 800w",
  );
  await expect(activeMedia).toHaveAttribute("sizes", "min(100vw, 800px)");
  await expect(page.locator("[data-demo-caption]")).toHaveText("one");

  await page.locator("[data-demo-next]").click();
  await expect(page.locator("[data-demo-caption]")).toHaveText("two");
  await expect(activeMedia).toHaveAttribute("alt", "Orange portrait study");
  await expect(
    page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-picture] source'),
  ).toHaveCount(0);
  await expect(activeMedia).not.toHaveAttribute("srcset", /.+/);
  await expect(activeMedia).not.toHaveAttribute("sizes", /.+/);

  await page.locator("[data-demo-close]").click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="two"]')).toBeFocused();
});

test("plain runtime does not take native horizontal swipe ownership", async ({ page }) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  await expect(page.locator("[data-lightbox-overlay]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  const sample = await page.locator("[data-lightbox-slides]").evaluate(async (scroller) => {
    const element = scroller as HTMLElement;
    const width = element.clientWidth;
    element.style.scrollSnapType = "none";
    element.scrollLeft = width * 0.62;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return {
      position: element.scrollLeft / width,
      selected: element
        .querySelector('[data-lightbox-slide][aria-hidden="false"]')
        ?.getAttribute("aria-label"),
      snapOverride: element.style.scrollSnapType,
    };
  });

  expect(sample.selected).toBe("Item 2 of 2");
  expect(sample.position).toBeGreaterThan(0.55);
  expect(sample.position).toBeLessThan(0.8);
  expect(sample.snapOverride).toBe("none");
});

test("plain runtime preserves the painted frame when open and close reverse", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/headless.html");

  const samples = await page.evaluate(async () => {
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const bounds = () => {
      const frame = document.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
      )!;
      const rect = frame.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    };
    const setMotionTime = (time: number) => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = time;
      }
    };

    void window.headlessViewer.open({ id: "one" });
    await nextFrame();
    setMotionTime(120);
    const openingBefore = bounds();
    void window.headlessViewer.close();
    const openingAfter = bounds();

    setMotionTime(90);
    const closingBefore = bounds();
    void window.headlessViewer.open({ id: "one" });
    const closingAfter = bounds();
    return { openingBefore, openingAfter, closingBefore, closingAfter };
  });

  for (const [before, after] of [
    [samples.openingBefore, samples.openingAfter],
    [samples.closingBefore, samples.closingAfter],
  ]) {
    for (const property of ["left", "top", "width", "height"] as const) {
      expect(Math.abs(before[property] - after[property])).toBeLessThan(4);
    }
  }
  await expect(page.locator("[data-lightbox-overlay]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
});

test("plain runtime publishes drag state and dismisses from a touch pointer", async ({ page }) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const overlay = page.locator("[data-lightbox-overlay]");
  await expect(overlay).toHaveAttribute("data-lightbox-state", "open");

  const frame = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]');
  const center = await frame.boundingBox();
  expect(center).not.toBeNull();
  const x = center!.x + center!.width / 2;
  const y = center!.y + center!.height / 2;
  await frame.dispatchEvent("pointerdown", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y,
  });
  await frame.dispatchEvent("pointermove", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    clientX: x + 4,
    clientY: y + 120,
  });

  await expect(overlay).toHaveAttribute("data-dragging", "");
  await expect
    .poll(() =>
      overlay.evaluate((element) =>
        Number(element.style.getPropertyValue("--lightbox-dismiss-progress")),
      ),
    )
    .toBeGreaterThan(0);

  await frame.dispatchEvent("pointerup", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    clientX: x + 4,
    clientY: y + 120,
  });
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="one"]')).toBeFocused();
});

test("plain runtime dismisses from a vertical trackpad wheel gesture", async ({ page }) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const overlay = page.locator("[data-lightbox-overlay]");
  await expect(overlay).toHaveAttribute("data-lightbox-state", "open");

  const frame = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]');
  const progress = await frame.evaluate(async (element) => {
    let maximum = 0;
    for (let index = 0; index < 3; index++) {
      element.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 40 }),
      );
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const overlay = document.querySelector<HTMLElement>("[data-lightbox-overlay]")!;
      maximum = Math.max(
        maximum,
        Number(overlay.style.getPropertyValue("--lightbox-dismiss-progress")),
      );
    }
    return maximum;
  });
  expect(progress).toBeGreaterThan(0);
  await frame.dispatchEvent("wheel", {
    deltaX: 0,
    deltaY: 160,
    deltaMode: 0,
  });
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="one"]')).toBeFocused();
});

test("plain runtime reuses pinch and double-click zoom interaction", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const dialog = page.locator("[data-lightbox-dialog]");
  const media = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]');
  await expect(dialog).toHaveAttribute("data-lightbox-state", "open");

  await media.dblclick({ position: { x: 260, y: 260 } });
  await expect(dialog).toHaveAttribute("data-zoomed", "");
  const zoomViewport = page.locator("[data-lightbox-zoom-viewport]");
  await expect(zoomViewport).toHaveCount(1);
  const scale = await zoomViewport.locator("[data-lightbox-media]").evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return new DOMMatrix(transform === "none" ? undefined : transform).a;
  });
  expect(scale).toBeGreaterThan(1.5);

  await page.keyboard.press("0");
  await expect(dialog).not.toHaveAttribute("data-zoomed", "");
  await expect(page.locator("[data-lightbox-zoom-viewport]")).toHaveCount(0);
  await expect(media).toBeVisible();

  await page.locator("[data-lightbox-container]").evaluate((container) => {
    const gesture = (type: string, scale: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        scale: { value: scale },
        clientX: { value: innerWidth / 2 },
        clientY: { value: innerHeight / 2 },
      });
      container.dispatchEvent(event);
    };
    gesture("gesturestart", 1);
    gesture("gesturechange", 2);
    gesture("gestureend", 2);
  });
  await expect(dialog).toHaveAttribute("data-zoomed", "");
  await expect(page.locator("[data-lightbox-zoom-viewport]")).toHaveCount(1);
  await page.keyboard.press("0");
  await expect(dialog).not.toHaveAttribute("data-zoomed", "");
});

test("plain runtime keeps a 100k source bounded without custom elements", async ({ page }) => {
  await page.goto("/headless.html");
  await page.evaluate(() => {
    const count = 100_000;
    void window.headlessViewer.setSource({
      count,
      getItem(index) {
        return {
          id: `large-${index}`,
          media: {
            type: "image",
            src: "/photo-square.svg",
            alt: `Large item ${index + 1}`,
            width: 800,
            height: 800,
          },
        };
      },
      getIndex(id) {
        const index = Number(String(id).replace("large-", ""));
        return Number.isInteger(index) && index >= 0 && index < count ? index : null;
      },
    });
    void window.headlessViewer.open({ index: 90_000 });
  });

  const active = page.locator('[data-lightbox-slide][aria-hidden="false"]');
  await expect(active).toHaveAttribute("aria-label", "Item 90001 of 100000");
  expect(await page.locator("[data-lightbox-slide]").count()).toBeLessThanOrEqual(31);
  expect(await page.locator("[data-lightbox-media][src]").count()).toBeLessThanOrEqual(3);

  await page.keyboard.press("ArrowRight");
  await expect(active).toHaveAttribute("aria-label", "Item 90002 of 100000");
  expect(await page.locator("[data-lightbox-slide]").count()).toBeLessThanOrEqual(31);
  expect(await page.locator("[data-lightbox-media][src]").count()).toBeLessThanOrEqual(3);

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(0);
});
