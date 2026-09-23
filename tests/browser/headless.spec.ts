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
  await expect(overlay).toHaveAttribute("data-lightbox-state", "open");
  await expect(page.locator("[data-lightbox-media]")).toHaveAttribute("alt", "Blue square study");
  await expect(page.locator("[data-demo-caption]")).toHaveText("one");

  await page.locator("[data-demo-next]").click();
  await expect(page.locator("[data-demo-caption]")).toHaveText("two");
  await expect(page.locator("[data-lightbox-media]")).toHaveAttribute(
    "alt",
    "Orange portrait study",
  );

  await page.locator("[data-demo-close]").click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="two"]')).toBeFocused();
});

test("plain runtime preserves the painted frame when open and close reverse", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/headless.html");

  const samples = await page.evaluate(async () => {
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const bounds = () => {
      const frame = document.querySelector<HTMLElement>("[data-lightbox-frame]")!;
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

  const frame = page.locator("[data-lightbox-frame]");
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

  const progress = await page.locator("[data-lightbox-frame]").evaluate(async (element) => {
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
  await page.locator("[data-lightbox-frame]").dispatchEvent("wheel", {
    deltaX: 0,
    deltaY: 160,
    deltaMode: 0,
  });
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="one"]')).toBeFocused();
});
