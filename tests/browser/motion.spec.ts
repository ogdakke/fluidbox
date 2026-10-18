import { expect, test, type Page } from "@playwright/test";
import { holdMotion } from "./support/hold-motion";

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
  await holdMotion(page);
  return page.evaluate(
    async ({ gallerySelector, index }) => {
      const gallery = document.querySelector<
        HTMLElement & {
          controller: { open(target: { index: number }): Promise<unknown> };
        }
      >(gallerySelector)!;
      void gallery.controller.open({ index });
      await window.__motion.ready();
      const media = document.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]',
      )!;
      const frame = media.closest<HTMLElement>("[data-lightbox-frame]")!;
      const sample = () => {
        const bounds = frame.getBoundingClientRect();
        return {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          frameOpacity: Number(getComputedStyle(frame).opacity),
        };
      };
      window.__motion.seek(0);
      const start = sample();
      window.__motion.seek(120);
      const progress = sample();
      window.__motion.release();
      return { start, progress };
    },
    { gallerySelector, index },
  );
}

test("indexed image origin opens from its mounted thumbnail", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/playground.html");
  const trigger = page.locator("#virtual-gallery .virtual-card").first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  const origin = await trigger.locator("img").boundingBox();
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

test("indexed image closes to its thumbnail without including the caption", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/playground.html");
  const card = page.locator("#virtual-gallery .virtual-card").nth(6);
  await card.scrollIntoViewIfNeeded();
  await card.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await card.click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  const landing = await page.evaluate(async () => {
    const card = document.querySelectorAll<HTMLElement>("#virtual-gallery .virtual-card")[6]!;
    const thumbnail = card.querySelector("img")!.getBoundingClientRect();
    const button = card.getBoundingClientRect();
    document.querySelector<HTMLElement>("[data-lightbox-close]")!.click();
    let frame: HTMLElement | null = null;
    for (let attempt = 0; attempt < 100; attempt++) {
      frame = document.querySelector<HTMLElement>("[data-lightbox-flight] [data-lightbox-frame]");
      if (frame?.getAnimations().length) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (!frame?.getAnimations().length) throw new Error("Close flight did not start");
    for (const animation of document.getAnimations()) {
      animation.pause();
      const duration = Number(animation.effect?.getTiming().duration) || 0;
      animation.currentTime = Math.max(0, duration - 1);
    }
    return {
      thumbnail: { width: thumbnail.width, height: thumbnail.height },
      button: { width: button.width, height: button.height },
      flight: {
        width: frame.getBoundingClientRect().width,
        height: frame.getBoundingClientRect().height,
      },
    };
  });
  expect(landing.button.height - landing.thumbnail.height).toBeGreaterThan(20);
  expect(landing.flight.width).toBeCloseTo(landing.thumbnail.width, 0);
  expect(landing.flight.height).toBeCloseTo(landing.thumbnail.height, 0);
});

test("indexed close keeps the live image painted until its flight clone decodes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/playground.html");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  await page.evaluate(() => {
    const originalDecode = (image: HTMLImageElement) =>
      HTMLImageElement.prototype.decode.call(image);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    Object.assign(window, { __releaseFlightDecode: release });
    HTMLImageElement.prototype.decode = function () {
      if (this.closest("[data-lightbox-flight]")) return gate;
      return originalDecode(this);
    };
  });

  await page.keyboard.press("Escape");
  const source = page.locator("[data-lightbox-slides] [data-lightbox-media]").first();
  await expect(page.locator("[data-lightbox-flight]")).toHaveCount(1);
  await expect(source).not.toHaveAttribute("data-lightbox-flight-source-hidden", "");
  await page.waitForTimeout(600);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(1);
  await expect(source).not.toHaveAttribute("data-lightbox-flight-source-hidden", "");

  await page.evaluate(() => {
    (window as unknown as { __releaseFlightDecode(): void }).__releaseFlightDecode();
  });
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
});

test("touch dismissal decodes its flight image during the drag", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/photo-library.html");
  const origin = page.locator('[data-photo-index="1"]');
  await origin.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await origin.click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  await page.evaluate(() => {
    const originalDecode = (image: HTMLImageElement) =>
      HTMLImageElement.prototype.decode.call(image);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    Object.assign(window, { __releasePreparedDecode: release, __preparedDecodeCalls: 0 });
    HTMLImageElement.prototype.decode = function () {
      if (!this.isConnected) {
        this.dataset.preparedFlight = "";
        (window as unknown as { __preparedDecodeCalls: number }).__preparedDecodeCalls++;
        return gate;
      }
      return originalDecode(this);
    };
  });

  const frame = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]');
  const bounds = await frame.boundingBox();
  expect(bounds).not.toBeNull();
  const x = bounds!.x + bounds!.width / 2;
  const y = bounds!.y + bounds!.height / 2;
  const pointer = { pointerId: 12, pointerType: "touch", isPrimary: true, clientX: x };
  await frame.dispatchEvent("pointerdown", { ...pointer, clientY: y });
  await frame.dispatchEvent("pointermove", { ...pointer, clientY: y + 40 });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __preparedDecodeCalls: number }).__preparedDecodeCalls,
      ),
    )
    .toBe(1);
  await expect(page.locator("[data-lightbox-flight]")).toHaveCount(0);

  await page.evaluate(() => {
    (window as unknown as { __releasePreparedDecode(): void }).__releasePreparedDecode();
  });
  await frame.dispatchEvent("pointermove", { ...pointer, clientY: y + 100 });
  await frame.dispatchEvent("pointerup", { ...pointer, clientY: y + 100 });
  await expect(page.locator("[data-lightbox-flight] [data-prepared-flight]")).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __preparedDecodeCalls: number }).__preparedDecodeCalls,
      ),
    )
    .toBe(1);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
});

test("wheel dismissal reuses the image decoded during the wheel spring", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/photo-library.html");
  const origin = page.locator('[data-photo-index="1"]');
  await origin.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await origin.click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  await page.evaluate(() => {
    const originalDecode = (image: HTMLImageElement) =>
      HTMLImageElement.prototype.decode.call(image);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    Object.assign(window, { __releasePreparedDecode: release, __preparedDecodeCalls: 0 });
    HTMLImageElement.prototype.decode = function () {
      if (!this.isConnected) {
        this.dataset.preparedFlight = "";
        (window as unknown as { __preparedDecodeCalls: number }).__preparedDecodeCalls++;
        return gate;
      }
      return originalDecode(this);
    };
  });

  const frame = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]');
  await frame.dispatchEvent("wheel", { deltaY: -20, bubbles: true, cancelable: true });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __preparedDecodeCalls: number }).__preparedDecodeCalls,
      ),
    )
    .toBe(1);
  await expect(page.locator("[data-lightbox-flight]")).toHaveCount(0);

  await page.evaluate(() => {
    // The flight lives only as long as the close, which a loaded browser can
    // finish between polls, so note it as it is mounted.
    const probe = window as unknown as { __preparedFlightMounted: boolean };
    probe.__preparedFlightMounted = false;
    const observer = new MutationObserver(() => {
      if (!document.querySelector("[data-lightbox-flight] [data-prepared-flight]")) return;
      probe.__preparedFlightMounted = true;
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    (window as unknown as { __releasePreparedDecode(): void }).__releasePreparedDecode();
  });
  await frame.dispatchEvent("wheel", { deltaY: -400, bubbles: true, cancelable: true });
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { __preparedFlightMounted: boolean }).__preparedFlightMounted,
    ),
  ).toBe(true);
});

test("failed early decode keeps the source painted until the mounted flight decodes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/photo-library.html");
  const origin = page.locator('[data-photo-index="1"]');
  await origin.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await origin.click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  await page.evaluate(() => {
    const originalDecode = (image: HTMLImageElement) =>
      HTMLImageElement.prototype.decode.call(image);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    Object.assign(window, { __releaseMountedDecode: release, __earlyDecodeCalls: 0 });
    HTMLImageElement.prototype.decode = function () {
      if (!this.isConnected) {
        (window as unknown as { __earlyDecodeCalls: number }).__earlyDecodeCalls++;
        return Promise.reject(new Error("Detached decode failed"));
      }
      if (this.closest("[data-lightbox-flight]")) return gate;
      return originalDecode(this);
    };
  });

  const frame = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]');
  const source = frame.locator("[data-lightbox-media]");
  await frame.dispatchEvent("wheel", { deltaY: -20, bubbles: true, cancelable: true });
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __earlyDecodeCalls: number }).__earlyDecodeCalls),
    )
    .toBe(1);
  await frame.dispatchEvent("wheel", { deltaY: -400, bubbles: true, cancelable: true });
  await expect(page.locator("[data-lightbox-flight]")).toHaveCount(1);
  await expect(source).not.toHaveAttribute("data-lightbox-flight-source-hidden", "");

  await page.evaluate(() => {
    (window as unknown as { __releaseMountedDecode(): void }).__releaseMountedDecode();
  });
  await expect(source).toHaveAttribute("data-lightbox-flight-source-hidden", "");
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

test("direct React gallery carries clipped-origin geometry through opening and closing", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/photo-library.html");
  await expect(page.locator("[data-library-count]")).toHaveAttribute("data-library-count", "10000");
  const origin = page.locator('[data-photo-index="1"]');
  await expect(origin).toBeVisible();
  await origin.scrollIntoViewIfNeeded();
  await origin.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await origin.evaluate((element: HTMLElement) => {
    element.style.borderRadius = "8px 12px 16px 4px";
  });
  const originBounds = await origin.boundingBox();
  expect(originBounds).not.toBeNull();
  await holdMotion(page);
  const corners = await origin.evaluate(async (element: HTMLElement) => {
    const rect = (target: HTMLElement) => {
      const bounds = target.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
    };
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
    const sample = () => {
      const frame = slideFrame();
      const media = frame.querySelector<HTMLElement>("[data-lightbox-media]")!;
      const backdrop = document.querySelector<HTMLElement>("[data-lightbox-backdrop]")!;
      return {
        frame: rect(frame),
        media: rect(media),
        mediaAspect: media.getBoundingClientRect().width / media.getBoundingClientRect().height,
        corners: renderedCorners(frame),
        backdropOpacity: Number(getComputedStyle(backdrop).opacity),
      };
    };
    element.click();
    await Promise.resolve();
    const preparedOverlay = document.querySelector<HTMLElement>("[data-lightbox-prepared]");
    const preparation = {
      present: Boolean(preparedOverlay),
      visibility: preparedOverlay ? getComputedStyle(preparedOverlay).visibility : null,
    };
    await window.__motion.ready();
    const openingAnimations = document.getAnimations();
    setTime(openingAnimations, 0);
    const openingStart = sample();
    setTime(openingAnimations, 65);
    const openingQuarter = sample();
    setTime(openingAnimations, 130);
    const openingHalf = sample();
    setTime(openingAnimations, 195);
    const openingThreeQuarter = sample();
    window.__motion.release();
    return {
      preparation,
      openingStart,
      openingQuarter,
      openingHalf,
      openingThreeQuarter,
    };
  });
  await testInfo.attach("clipped-origin-opening-radius", {
    body: JSON.stringify(corners, null, 2),
    contentType: "application/json",
  });
  expect(corners.preparation).toEqual({ present: true, visibility: "hidden" });
  for (const [index, expected] of [8, 12, 16, 4].entries()) {
    expect(corners.openingStart.corners[index]!.x).toBeCloseTo(expected, 0);
    expect(corners.openingStart.corners[index]!.y).toBeCloseTo(expected, 0);
    expect(corners.openingHalf.corners[index]!.x).toBeLessThan(expected);
  }
  const openingSamples = [
    corners.openingStart,
    corners.openingQuarter,
    corners.openingHalf,
    corners.openingThreeQuarter,
  ];
  for (const sample of openingSamples) {
    expect(sample.mediaAspect, "the portrait media must never stretch").toBeCloseTo(2 / 3, 2);
  }
  expect(corners.openingStart.frame.left).toBeCloseTo(originBounds!.x, 0);
  expect(corners.openingStart.frame.top).toBeCloseTo(originBounds!.y, 0);
  expect(corners.openingStart.frame.width).toBeCloseTo(originBounds!.width, 0);
  expect(corners.openingStart.frame.height).toBeCloseTo(originBounds!.height, 0);
  expect(corners.openingStart.media.height).toBeGreaterThan(corners.openingStart.frame.height);
  expect(corners.openingStart.backdropOpacity).toBeLessThan(0.05);
  for (let index = 1; index < openingSamples.length; index++) {
    expect(openingSamples[index]!.frame.width).toBeGreaterThan(
      openingSamples[index - 1]!.frame.width,
    );
    expect(openingSamples[index]!.backdropOpacity).toBeGreaterThanOrEqual(
      openingSamples[index - 1]!.backdropOpacity,
    );
  }
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  await holdMotion(page);
  const closing = await page.evaluate(async () => {
    const rect = (target: HTMLElement) => {
      const bounds = target.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
    };
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const frame = document.querySelector<HTMLElement>(
      "[data-lightbox-flight] [data-lightbox-frame]",
    )!;
    await window.__motion.ready();
    const media = frame.querySelector<HTMLElement>("[data-lightbox-media]")!;
    const backdrop = document.querySelector<HTMLElement>("[data-lightbox-backdrop]")!;
    const animations = document.getAnimations();
    const duration = Number(frame.getAnimations()[0]!.effect!.getComputedTiming().duration);
    const sample = (time: number) => {
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = time;
      }
      const style = getComputedStyle(frame);
      const matrix = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
      const frameBounds = rect(frame);
      const mediaBounds = rect(media);
      return {
        frame: frameBounds,
        media: mediaBounds,
        mediaAspect: mediaBounds.width / mediaBounds.height,
        corners: [
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius,
        ].map((value) => {
          const [horizontal, vertical = horizontal] = value.split(" ").map(Number.parseFloat);
          return { x: horizontal * Math.abs(matrix.a), y: vertical * Math.abs(matrix.d) };
        }),
        backdropOpacity: Number(getComputedStyle(backdrop).opacity),
      };
    };
    const samples = [0, 0.25, 0.5, 0.75, 0.999].map((progress) => sample(duration * progress));
    window.__motion.release();
    return { duration, samples };
  });
  await testInfo.attach("clipped-origin-closing-geometry", {
    body: JSON.stringify(closing, null, 2),
    contentType: "application/json",
  });
  for (const sample of closing.samples) {
    expect(sample.mediaAspect, "the portrait media must never stretch on close").toBeCloseTo(
      2 / 3,
      2,
    );
  }
  for (let index = 1; index < closing.samples.length; index++) {
    expect(closing.samples[index]!.frame.width).toBeLessThanOrEqual(
      closing.samples[index - 1]!.frame.width,
    );
    expect(closing.samples[index]!.backdropOpacity).toBeLessThanOrEqual(
      closing.samples[index - 1]!.backdropOpacity,
    );
  }
  const closingEnd = closing.samples.at(-1)!;
  expect(closingEnd.frame.left).toBeCloseTo(originBounds!.x, 0);
  expect(closingEnd.frame.top).toBeCloseTo(originBounds!.y, 0);
  expect(closingEnd.frame.width).toBeCloseTo(originBounds!.width, 0);
  expect(closingEnd.frame.height).toBeCloseTo(originBounds!.height, 0);
  for (const [index, expected] of [8, 12, 16, 4].entries()) {
    expect(closingEnd.corners[index]!.x).toBeCloseTo(expected, 0);
    expect(closingEnd.corners[index]!.y).toBeCloseTo(expected, 0);
  }
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
});

test("direct React transition matches its reference frames", async ({ page }, testInfo) => {
  test.skip(
    !["chromium", "iphone-15-pro"].includes(testInfo.project.name),
    "Reference frames use Chromium and iPhone WebKit rendering.",
  );
  await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
  await page.goto("/photo-library.html");
  const origin = page.locator('[data-photo-index="1"]');
  await origin.scrollIntoViewIfNeeded();
  await origin.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await origin.evaluate((element: HTMLElement) => {
    element.style.borderRadius = "8px 12px 16px 4px";
  });
  await holdMotion(page);
  await origin.click();
  await page.evaluate(async () => {
    await window.__motion.ready();
    for (const animation of document.getAnimations()) {
      const duration = Number(animation.effect?.getComputedTiming().duration);
      animation.currentTime = duration / 2;
    }
  });
  await expect(page).toHaveScreenshot("direct-photo-opening-half.png", {
    animations: "allow",
    caret: "hide",
    maxDiffPixelRatio: 0.001,
  });
  await page.evaluate(() => window.__motion.release());
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await holdMotion(page);
  // The controls fade with CSS transitions, which start with the closing state.
  // Freeze them as it is published, before a stalled frame can finish them.
  await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>("[data-lightbox-dialog]")!;
    const observer = new MutationObserver(() => {
      if (dialog.dataset.lightboxState !== "closing") return;
      observer.disconnect();
      window.__motion.freeze();
    });
    observer.observe(dialog, { attributeFilter: ["data-lightbox-state"] });
  });
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    await window.__motion.ready();
    for (const animation of document.getAnimations()) {
      const duration = Number(animation.effect?.getComputedTiming().duration);
      animation.currentTime = duration / 2;
    }
  });
  await expect(page.locator("[data-lightbox-flight]")).toHaveCSS("visibility", "visible");
  await expect(origin.locator("img")).toHaveCSS("visibility", "hidden");
  await expect(page).toHaveScreenshot("direct-photo-closing-half.png", {
    animations: "allow",
    caret: "hide",
    maxDiffPixelRatio: 0.001,
  });
  await page.evaluate(() => window.__motion.release());
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
});

test("direct React transition reverses from its painted crop", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/photo-library.html");
  const origin = page.locator('[data-photo-index="1"]');
  await origin.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  const reversal = (phase: "opening" | "closing") =>
    page.evaluate(async (phase): Promise<Interruption> => {
      const media = () =>
        document.querySelector<HTMLElement>("[data-lightbox-flight] [data-lightbox-media]") ??
        document.querySelector<HTMLElement>(
          '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]',
        )!;
      const sample = (): MotionSample => {
        const element = media();
        const bounds = element.getBoundingClientRect();
        const animation = element.getAnimations()[0];
        return {
          time: performance.now(),
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          animationTime: Number(animation?.currentTime ?? NaN),
          animationDuration: Number(animation?.effect?.getComputedTiming().duration ?? NaN),
        };
      };
      await window.__motion.ready();
      const oldAnimations = document.getAnimations();
      for (const animation of oldAnimations) {
        animation.pause();
        animation.currentTime = 120;
      }
      const before = sample();
      if (phase === "opening") {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await Promise.resolve();
      } else {
        document.querySelector<HTMLElement>('[data-photo-index="1"]')!.click();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      }
      const nextAnimations = document
        .getAnimations()
        .filter((animation) => !oldAnimations.includes(animation));
      for (const animation of nextAnimations) {
        animation.pause();
        animation.currentTime = 0;
      }
      const after = sample();
      for (const animation of nextAnimations) animation.play();
      return { before, after };
    }, phase);

  await holdMotion(page);
  await origin.click();
  const opening = await reversal("opening");
  await testInfo.attach("direct-opening-reversal", {
    body: JSON.stringify(opening, null, 2),
    contentType: "application/json",
  });
  expectContinuous(opening);
  expect(opening.before.width / opening.before.height).toBeCloseTo(2 / 3, 2);
  expect(opening.after.width / opening.after.height).toBeCloseTo(2 / 3, 2);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);

  await origin.click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await holdMotion(page);
  await page.keyboard.press("Escape");
  const closing = await reversal("closing");
  await testInfo.attach("direct-closing-reversal", {
    body: JSON.stringify(closing, null, 2),
    contentType: "application/json",
  });
  expectContinuous(closing);
  expect(closing.before.width / closing.before.height).toBeCloseTo(2 / 3, 2);
  expect(closing.after.width / closing.after.height).toBeCloseTo(2 / 3, 2);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
});

test("direct touch dismissal preserves crop, radii, and native strip position", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/photo-library.html");
  const origin = page.locator('[data-photo-index="1"]');
  await origin.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await origin.evaluate((element: HTMLElement) => {
    element.style.borderRadius = "8px 12px 16px 4px";
  });
  await origin.click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  const frame = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]');
  const bounds = await frame.boundingBox();
  expect(bounds).not.toBeNull();
  const x = bounds!.x + bounds!.width / 2;
  const y = bounds!.y + bounds!.height / 2;
  await frame.dispatchEvent("pointerdown", {
    pointerId: 12,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y,
  });
  await frame.dispatchEvent("pointermove", {
    pointerId: 12,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y + 48,
  });

  await expect
    .poll(() =>
      frame.evaluate((element) =>
        element.closest("[data-lightbox-slides]")?.hasAttribute("data-lightbox-frozen"),
      ),
    )
    .toBe(true);
  // The gesture draws the move on its next frame, which a loaded page can
  // reach after the strip has already frozen.
  const drag = await frame.evaluate(async (element) => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const style = getComputedStyle(element);
    const media = element.querySelector<HTMLElement>("[data-lightbox-media]")!;
    const slides = element.closest<HTMLElement>("[data-lightbox-slides]")!;
    return {
      radius: parseFloat(style.borderTopLeftRadius),
      mediaTransform: getComputedStyle(media).transform,
      slidesHeight: slides.getBoundingClientRect().height,
      viewportHeight: innerHeight,
      centerY: element.getBoundingClientRect().y + element.getBoundingClientRect().height / 2,
    };
  });
  expect(drag.radius).toBeGreaterThan(0);
  expect(drag.mediaTransform).not.toBe("none");
  expect(drag.slidesHeight).toBe(drag.viewportHeight);
  const centerTravel = drag.centerY - (bounds!.y + bounds!.height / 2);
  expect(centerTravel).toBeGreaterThan(25);
  expect(centerTravel).toBeLessThan(55);

  await frame.dispatchEvent("pointercancel", {
    pointerId: 12,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y + 48,
  });
  await expect(page.locator("[data-lightbox-slides]")).not.toHaveAttribute(
    "data-lightbox-frozen",
    "",
  );
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
});

test("direct close flight retargets after viewport resize", async ({ page }, testInfo) => {
  test.skip(Boolean(testInfo.project.use.isMobile), "desktop viewport resize diagnostic");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 900, height: 720 });
  await page.goto("/photo-library.html");
  const origin = page.locator('[data-photo-index="1"]');
  await origin.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await origin.evaluate((element: HTMLElement) => {
    element.style.borderRadius = "8px 12px 16px 4px";
  });
  await origin.click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await holdMotion(page);
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__motion.ready());
  await expect(page.locator("[data-lightbox-flight]")).toHaveCount(1);
  await expect(
    page.locator(
      '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media][data-lightbox-flight-source-hidden]',
    ),
  ).toHaveCount(1);

  // The resize event can reach a loaded page frames after the viewport has
  // changed, so measure only once the runtime has seen it and run the two
  // retarget frames that follow it.
  await page.evaluate(() => {
    (window as Window & { __resized?: Promise<void> }).__resized = new Promise<void>((resolve) =>
      window.addEventListener("resize", () => resolve(), { once: true }),
    );
  });
  await page.setViewportSize({ width: 740, height: 680 });
  const result = await page.evaluate(async () => {
    await (window as Window & { __resized?: Promise<void> }).__resized;
    for (let frame = 0; frame < 3; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    for (const animation of document.getAnimations()) {
      animation.pause();
      const duration = Number(animation.effect?.getComputedTiming().duration);
      if (Number.isFinite(duration)) animation.currentTime = Math.max(0, duration - 1);
    }
    const flight = document
      .querySelector<HTMLElement>("[data-lightbox-flight] [data-lightbox-frame]")!
      .getBoundingClientRect();
    const target = document
      .querySelector<HTMLElement>('[data-photo-index="1"]')!
      .getBoundingClientRect();
    return {
      flight: { x: flight.x, y: flight.y, width: flight.width, height: flight.height },
      target: { x: target.x, y: target.y, width: target.width, height: target.height },
    };
  });
  for (const dimension of ["x", "y", "width", "height"] as const) {
    expect(Math.abs(result.flight[dimension] - result.target[dimension])).toBeLessThan(5);
  }
  await page.evaluate(() => window.__motion.release());
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  await expect(page.locator("[data-lightbox-flight]")).toHaveCount(0);
});

test("square image is prepainted before its close flight hides the source", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/photo-library.html");
  const origin = page.locator('[data-photo-index="3"]');
  await origin.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await origin.click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  const handoff = await page.evaluate(() => {
    const source = document.querySelector<HTMLElement>(
      '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]',
    )!;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const flight = document.querySelector<HTMLElement>(
      "[data-lightbox-flight] [data-lightbox-media]",
    );
    return {
      flightMounted: !!flight,
      cloned: flight !== source,
      sourceHidden: source.hasAttribute("data-lightbox-flight-source-hidden"),
    };
  });
  expect(handoff).toEqual({ flightMounted: true, cloned: true, sourceHidden: false });
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  await expect(origin.locator("img")).not.toHaveAttribute("data-lightbox-thumbnail-hidden", "");
});

test("close-flight handoff hides every painted layer of the source frame", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  await page.evaluate(() => {
    const decode = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "decode")!.value as (
      this: HTMLImageElement,
    ) => Promise<void>;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    Object.assign(window, { __releaseFlightHandoff: release });
    HTMLImageElement.prototype.decode = function () {
      if (!this.isConnected || this.closest("[data-lightbox-flight]"))
        return gate.then(() => decode.call(this));
      return decode.call(this);
    };
  });
  const sourceFrame = page.locator(
    '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
  );
  if (testInfo.project.use.isMobile) {
    const bounds = await sourceFrame.boundingBox();
    const x = bounds!.x + bounds!.width / 2;
    const y = bounds!.y + bounds!.height / 2;
    await sourceFrame.dispatchEvent("pointerdown", {
      pointerId: 8,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      clientY: y,
    });
    await sourceFrame.dispatchEvent("pointermove", {
      pointerId: 8,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      clientY: y + 140,
    });
    await sourceFrame.dispatchEvent("pointerup", {
      pointerId: 8,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      clientY: y + 140,
    });
  } else {
    await sourceFrame.dispatchEvent("wheel", { deltaY: -24, bubbles: true, cancelable: true });
    await sourceFrame.dispatchEvent("wheel", { deltaY: -400, bubbles: true, cancelable: true });
  }
  const flight = page.locator("[data-lightbox-flight]");
  await expect(flight).toHaveCount(1);
  await expect(flight).toHaveCSS("visibility", "hidden");
  await expect(sourceFrame).not.toHaveAttribute("data-lightbox-flight-source-hidden", "");
  await expect(sourceFrame.locator("[data-lightbox-slide-placeholder]")).toHaveCount(1);

  await page.evaluate(() => {
    (window as unknown as { __releaseFlightHandoff(): void }).__releaseFlightHandoff();
  });
  await expect(sourceFrame).toHaveAttribute("data-lightbox-flight-source-hidden", "");
  await expect(sourceFrame).toHaveCSS("opacity", "0");
  await expect(flight).toHaveCSS("visibility", "visible");
  await expect(sourceFrame.locator("[data-lightbox-slide-preview]")).toHaveAttribute(
    "data-lightbox-image-ready",
    "",
  );
});

test("opening crop transforms the fallback and media together", async ({ page }) => {
  await page.goto("/headless.html");
  const transforms = await page.evaluate(() => {
    const dispose = window.headlessViewer.prepare({ id: "one" });
    const frame = document.querySelector<HTMLElement>(
      '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
    )!;
    const media = frame.querySelector<HTMLElement>("[data-lightbox-media]")!;
    const fallback = frame.querySelector<HTMLElement>("[data-lightbox-slide-placeholder]")!;
    const result = {
      media: getComputedStyle(media).transform,
      fallback: getComputedStyle(fallback).transform,
    };
    dispose();
    return result;
  });
  expect(transforms.media).not.toBe("none");
  expect(transforms.fallback).toBe(transforms.media);

  const midFlight = await page.evaluate(async () => {
    void window.headlessViewer.open({ id: "one" });
    for (let frame = 0; frame < 8; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (
        document.querySelector("[data-lightbox-dialog][data-opening]") &&
        document.getAnimations().length
      )
        break;
    }
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 150;
    }
    const frame = document.querySelector<HTMLElement>(
      '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
    )!;
    return {
      media: getComputedStyle(frame.querySelector("[data-lightbox-media]")!).transform,
      fallback: getComputedStyle(frame.querySelector("[data-lightbox-slide-placeholder]")!)
        .transform,
    };
  });
  expect(midFlight.fallback).toBe(midFlight.media);
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
  await holdMotion(page);
  const startRadius = await page.locator("app-gallery").evaluate(
    async (
      gallery: HTMLElement & {
        controller: { open(target: { index: number }): Promise<unknown> };
      },
    ) => {
      void gallery.controller.open({ index: 0 });
      await window.__motion.ready();
      window.__motion.seek(0);
      const frame = document.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
      )!;
      const style = getComputedStyle(frame);
      const matrix = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
      const visibleRadius = Number.parseFloat(style.borderTopLeftRadius) * Math.abs(matrix.a);
      window.__motion.release();
      return visibleRadius;
    },
  );
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
      const controller = document.querySelector<
        HTMLElement & {
          controller: {
            open(target: { index: number }): Promise<unknown>;
            close(): Promise<unknown>;
          };
        }
      >("app-gallery")!.controller;
      const slideFrame = () =>
        document.querySelector<HTMLElement>(
          '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
        )!;
      const flightFrame = () =>
        document.querySelector<HTMLElement>("[data-lightbox-flight] [data-lightbox-frame]")!;
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
      const waitForAnimation = (element: () => HTMLElement) =>
        new Promise<HTMLElement>((resolve) => {
          const wait = () => {
            const target = element();
            if (target?.getAnimations().length) resolve(target);
            else requestAnimationFrame(wait);
          };
          wait();
        });
      // Hold each animation as it is created, so a stalled frame cannot play a
      // whole transition out before the frame loop above finds it.
      const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")!
        .value as Element["animate"];
      Element.prototype.animate = function (this: Element, ...args) {
        const animation = animate.apply(this, args);
        animation.playbackRate = 1e-6;
        return animation;
      };
      if (phase === "opening") void controller.open({ index: 0 });
      else void controller.close();
      const beforeFrame = await waitForAnimation(phase === "opening" ? slideFrame : flightFrame);
      // Pin every transition track to the same unfinished timeline position.
      // A timer can wake after settlement on a busy browser worker.
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 90;
      }
      const before = sample(beforeFrame);
      if (phase === "opening") void controller.close();
      else void controller.open({ index: 0 });
      const afterFrame = await waitForAnimation(phase === "opening" ? flightFrame : slideFrame);
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
      const after = sample(afterFrame);
      Element.prototype.animate = animate;
      for (const animation of document.getAnimations()) {
        animation.playbackRate = 1;
        animation.play();
      }
      return { before, after };
    }, phase);

  const opening = await interrupt("opening");
  await testInfo.attach("opening-interruption-geometry", {
    body: JSON.stringify({ thumbnail, opened, ...opening }, null, 2),
    contentType: "application/json",
  });
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
