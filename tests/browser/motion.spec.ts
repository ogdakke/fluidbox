import { expect, test, type Page } from "@playwright/test";

test.use({ trace: "on", video: "on" });

type MotionSample = {
  time: number;
  left: number;
  top: number;
  width: number;
  height: number;
  animationTime: number;
  animationDuration: number;
};

type Interruption = { before: MotionSample; after: MotionSample };

function expectContinuous({ before, after }: Interruption) {
  // Both reads happen in one browser task. A large difference is a handoff jump,
  // not normal progress to the next animation frame.
  for (const key of ["left", "top", "width", "height"] as const) {
    expect(Math.abs(after[key] - before[key]), `${key} jumped at ${before.time}ms`).toBeLessThan(4);
  }
}

async function sampleIndexedOpening(page: Page, gallerySelector: string, index: number) {
  return page.evaluate(
    ({ gallerySelector, index }) => {
      const gallery = document.querySelector<HTMLElement & { open(index: number): void }>(
        gallerySelector,
      )!;
      gallery.open(index);
      const media = document.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]',
      )!;
      const frame = media.closest<HTMLElement>("[data-lightbox-frame]")!;
      const animations = document.getAnimations();
      const sample = () => {
        const bounds = media.getBoundingClientRect();
        return {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          frameOpacity: Number(getComputedStyle(frame).opacity),
        };
      };
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = 0;
      }
      const start = sample();
      for (const animation of animations) animation.currentTime = 120;
      const progress = sample();
      for (const animation of animations) animation.play();
      return { start, progress };
    },
    { gallerySelector, index },
  );
}

test("indexed image origin opens from its mounted thumbnail", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const thumbnail = page.locator("#virtual-gallery .virtual-card img").first();
  await thumbnail.scrollIntoViewIfNeeded();
  await thumbnail.evaluate((image: HTMLImageElement) => image.decode());
  const origin = await thumbnail.boundingBox();
  expect(origin).not.toBeNull();
  const motion = await sampleIndexedOpening(page, "#virtual-gallery", 0);
  await testInfo.attach("indexed-origin-opening-geometry", {
    body: JSON.stringify({ origin, ...motion }, null, 2),
    contentType: "application/json",
  });
  const originGeometry = {
    left: origin!.x,
    top: origin!.y,
    width: origin!.width,
    height: origin!.height,
  };
  for (const key of ["left", "top", "width", "height"] as const) {
    expect(
      Math.abs(motion.start[key] - originGeometry[key]),
      `${key} starts at the origin`,
    ).toBeLessThan(4);
  }
  expect(motion.progress.width - motion.start.width).toBeGreaterThan(20);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
});

test("indexed item without a mounted origin uses scale and fade", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/harness.html?virtual&count=1000&no-filmstrip");
  await page.evaluate(() => {
    (window as unknown as { __renderVirtualWindow(start: number): void }).__renderVirtualWindow(
      500,
    );
  });
  await expect(page.locator('[data-virtual-index="0"]')).toHaveCount(0);
  const motion = await sampleIndexedOpening(page, "app-gallery", 0);
  await testInfo.attach("indexed-originless-opening-geometry", {
    body: JSON.stringify(motion, null, 2),
    contentType: "application/json",
  });
  expect(motion.start.frameOpacity).toBeLessThan(0.05);
  expect(motion.progress.frameOpacity).toBeGreaterThan(0.1);
  expect(motion.progress.width - motion.start.width).toBeGreaterThan(5);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
});

test("indexed clipped origin carries corner radius through opening and reversal", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/photo-library.html");
  const gallery = page.locator("app-gallery");
  await expect
    .poll(() =>
      gallery.evaluate(
        (element: HTMLElement & { source?: { count: number } }) => element.source?.count,
      ),
    )
    .toBe(10_000);
  const origin = page.locator('[data-photo-index="0"]');
  await expect(origin).toBeVisible();
  await origin.scrollIntoViewIfNeeded();
  await origin.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await origin.evaluate((element: HTMLElement) => {
    element.style.borderRadius = "8px 12px 16px 4px";
  });
  const corners = await gallery.evaluate((element: HTMLElement & { open(index: number): void }) => {
    const renderedCorners = (frame: HTMLElement) => {
      const style = getComputedStyle(frame);
      const matrix = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
      return [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomRightRadius,
        style.borderBottomLeftRadius,
      ].map((value) => {
        const [horizontal, vertical = horizontal] = value.split(" ").map(Number.parseFloat);
        return {
          x: horizontal * Math.abs(matrix.a),
          y: vertical * Math.abs(matrix.d),
        };
      });
    };
    const slideFrame = () =>
      document.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
      )!;
    const setTime = (animations: Animation[], time: number) => {
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = time;
      }
    };
    element.open(0);
    const openingAnimations = document.getAnimations();
    setTime(openingAnimations, 0);
    const openingStart = renderedCorners(slideFrame());
    setTime(openingAnimations, 120);
    const openingProgress = renderedCorners(slideFrame());
    for (const animation of openingAnimations) animation.play();
    return { openingStart, openingProgress };
  });
  await testInfo.attach("clipped-origin-opening-radius", {
    body: JSON.stringify(corners, null, 2),
    contentType: "application/json",
  });
  for (const [index, expected] of [8, 12, 16, 4].entries()) {
    expect(corners.openingStart[index]!.x).toBeCloseTo(expected, 0);
    expect(corners.openingStart[index]!.y).toBeCloseTo(expected, 0);
    expect(corners.openingProgress[index]!.x).toBeLessThan(expected);
  }
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  const reversal = await gallery.evaluate(() => {
    const controller = document.querySelector<HTMLElement & { close(): void; open(): void }>(
      "[data-lightbox-source-controller]",
    )!;
    const renderedCorners = (frame: HTMLElement) => {
      const style = getComputedStyle(frame);
      const matrix = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
      return [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomRightRadius,
        style.borderBottomLeftRadius,
      ].map((value) => {
        const [horizontal, vertical = horizontal] = value.split(" ").map(Number.parseFloat);
        return {
          x: horizontal * Math.abs(matrix.a),
          y: vertical * Math.abs(matrix.d),
        };
      });
    };
    controller.close();
    const animations = document.getAnimations();
    for (const animation of animations) {
      animation.pause();
      animation.currentTime = 120;
    }
    const flight = document.querySelector<HTMLElement>(
      "[data-lightbox-flight] > [data-lightbox-frame]",
    )!;
    const before = renderedCorners(flight);
    controller.open();
    const active = document.querySelector<HTMLElement>(
      '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
    )!;
    const after = renderedCorners(active);
    return { before, after };
  });
  await testInfo.attach("clipped-origin-radius-reversal", {
    body: JSON.stringify(reversal, null, 2),
    contentType: "application/json",
  });
  for (const [index, expected] of [8, 12, 16, 4].entries()) {
    expect(reversal.before[index]!.x).toBeGreaterThan(0);
    expect(reversal.before[index]!.x).toBeLessThan(expected);
    expect(Math.abs(reversal.before[index]!.x - reversal.after[index]!.x)).toBeLessThan(2);
    expect(Math.abs(reversal.before[index]!.y - reversal.after[index]!.y)).toBeLessThan(2);
  }
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  const closingEnd = await gallery.evaluate(() => {
    const controller = document.querySelector<HTMLElement & { close(): void }>(
      "[data-lightbox-source-controller]",
    )!;
    controller.close();
    const frame = document.querySelector<HTMLElement>(
      "[data-lightbox-flight] > [data-lightbox-frame]",
    )!;
    const animations = document.getAnimations();
    const duration = Number(frame.getAnimations()[0]?.effect?.getComputedTiming().duration);
    for (const animation of animations) {
      animation.pause();
      animation.currentTime = duration - 1;
    }
    const style = getComputedStyle(frame);
    const matrix = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
    const corners = [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ].map((value) => {
      const [horizontal, vertical = horizontal] = value.split(" ").map(Number.parseFloat);
      return { x: horizontal * Math.abs(matrix.a), y: vertical * Math.abs(matrix.d) };
    });
    for (const animation of animations) animation.play();
    return corners;
  });
  await testInfo.attach("clipped-origin-closing-radius", {
    body: JSON.stringify(closingEnd, null, 2),
    contentType: "application/json",
  });
  for (const [index, expected] of [8, 12, 16, 4].entries()) {
    expect(closingEnd[index]!.x).toBeCloseTo(expected, 0);
    expect(closingEnd[index]!.y).toBeCloseTo(expected, 0);
  }
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
});

test("nested visual target takes precedence over its preview box", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/harness.html?no-filmstrip");
  const trigger = page.locator('app-lightbox[data-test-index="0"] [data-lightbox-trigger]');
  await trigger.evaluate((button: HTMLElement) => {
    button.dataset.lightboxPreview = "";
    button.style.borderRadius = "16px";
    const image = button.querySelector<HTMLImageElement>("img")!;
    image.dataset.lightboxTarget = "";
    image.style.borderRadius = "3px";
  });
  const startRadius = await page
    .locator('app-lightbox[data-test-index="0"]')
    .evaluate((lightbox: HTMLElement & { open(): void }) => {
      lightbox.open();
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
      const frame = document.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
      )!;
      const style = getComputedStyle(frame);
      const matrix = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
      const visibleRadius = Number.parseFloat(style.borderTopLeftRadius) * Math.abs(matrix.a);
      for (const animation of document.getAnimations()) animation.play();
      return visibleRadius;
    });
  expect(startRadius).toBeCloseTo(3, 0);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
});

test("unfinished open and close hand off the painted media pose", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/harness.html?no-filmstrip");
  const trigger = page.locator('app-lightbox[data-test-index="0"] [data-lightbox-trigger]');
  await page.evaluate(() => {
    const sentinel = document.createElement("aside");
    sentinel.id = "already-inert";
    sentinel.inert = true;
    document.body.append(sentinel);
  });

  // Measure the actual endpoints for this viewport and browser. This also warms
  // the image so loading cannot masquerade as an interrupted motion defect.
  const thumbnail = await trigger.locator("img").boundingBox();
  expect(thumbnail).not.toBeNull();
  await trigger.click();
  const dialog = page.locator("[data-lightbox-dialog]");
  await expect(dialog).toHaveAttribute("data-lightbox-state", "open", { timeout: 5_000 });
  const opened = await page
    .locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]')
    .boundingBox();
  expect(opened).not.toBeNull();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  const interrupt = (phase: "opening" | "closing") =>
    page.evaluate(async (phase): Promise<Interruption> => {
      const lightbox = document.querySelector<HTMLElement & { open(): void; close(): void }>(
        'app-lightbox[data-test-index="0"]',
      )!;
      const slideMedia = () =>
        document.querySelector<HTMLElement>(
          '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]',
        )!;
      const flightMedia = () =>
        document.querySelector<HTMLElement>("[data-lightbox-flight] [data-lightbox-media]")!;
      const sample = (element: HTMLElement): MotionSample => {
        const bounds = element.getBoundingClientRect();
        const animation = element.getAnimations()[0];
        const timing = animation?.effect?.getComputedTiming();
        return {
          time: performance.now(),
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          animationTime: Number(animation?.currentTime ?? NaN),
          animationDuration: Number(timing?.duration ?? NaN),
        };
      };
      if (phase === "opening") lightbox.open();
      else lightbox.close();
      // Pin every transition track to the same unfinished timeline position.
      // A timer can wake after settlement on a busy browser worker.
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 90;
      }
      const before = sample(phase === "opening" ? slideMedia() : flightMedia());
      if (phase === "opening") lightbox.close();
      else lightbox.open();
      const after = sample(phase === "opening" ? flightMedia() : slideMedia());
      return { before, after };
    }, phase);

  const opening = await interrupt("opening");
  await testInfo.attach("opening-interruption-geometry", {
    body: JSON.stringify({ thumbnail, opened, ...opening }, null, 2),
    contentType: "application/json",
  });
  for (const sample of [opening.before, opening.after]) {
    expect(sample.animationTime).toBeGreaterThanOrEqual(0);
    expect(sample.animationTime).toBeLessThan(sample.animationDuration);
  }
  expect(Math.abs(opening.before.width - thumbnail!.width)).toBeGreaterThan(15);
  expect(Math.abs(opening.before.width - opened!.width)).toBeGreaterThan(15);
  expectContinuous(opening);
  await expect(dialog).toHaveCount(0);

  await trigger.click();
  await expect(dialog).toHaveAttribute("data-lightbox-state", "open", { timeout: 5_000 });
  const closing = await interrupt("closing");
  await testInfo.attach("closing-interruption-geometry", {
    body: JSON.stringify({ thumbnail, opened, ...closing }, null, 2),
    contentType: "application/json",
  });
  for (const sample of [closing.before, closing.after]) {
    expect(sample.animationTime).toBeGreaterThanOrEqual(0);
    expect(sample.animationTime).toBeLessThan(sample.animationDuration);
  }
  expect(Math.abs(closing.before.width - thumbnail!.width)).toBeGreaterThan(15);
  expect(Math.abs(closing.before.width - opened!.width)).toBeGreaterThan(15);
  expectContinuous(closing);
  await expect(dialog).toHaveAttribute("data-lightbox-state", "open", { timeout: 5_000 });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator("[data-lightbox-flight], [data-lightbox-transition-content]"),
  ).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#already-inert")).toHaveAttribute("inert", "");
  await expect(page.locator("#fixture")).not.toHaveAttribute("inert", "");
});
