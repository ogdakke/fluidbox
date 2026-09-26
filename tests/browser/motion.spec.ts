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
    async ({ gallerySelector, index }) => {
      const gallery = document.querySelector<
        HTMLElement & {
          controller: { open(target: { index: number }): Promise<unknown> };
        }
      >(gallerySelector)!;
      void gallery.controller.open({ index });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const media = document.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]',
      )!;
      const frame = media.closest<HTMLElement>("[data-lightbox-frame]")!;
      const animations = document.getAnimations();
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
  const trigger = page.locator("#virtual-gallery .virtual-card").first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  const origin = await trigger.boundingBox();
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

test("indexed close keeps the live image painted until its flight clone decodes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
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
    (window as unknown as { __releasePreparedDecode(): void }).__releasePreparedDecode();
  });
  await frame.dispatchEvent("wheel", { deltaY: -400, bubbles: true, cancelable: true });
  await expect(page.locator("[data-lightbox-flight] [data-prepared-flight]")).toHaveCount(1);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
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
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const openingAnimations = document.getAnimations();
    setTime(openingAnimations, 0);
    const openingStart = sample();
    setTime(openingAnimations, 65);
    const openingQuarter = sample();
    setTime(openingAnimations, 130);
    const openingHalf = sample();
    setTime(openingAnimations, 195);
    const openingThreeQuarter = sample();
    for (const animation of openingAnimations) animation.play();
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
    await new Promise<void>((resolve) => {
      const wait = () => (frame.getAnimations().length ? resolve() : requestAnimationFrame(wait));
      wait();
    });
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
    for (const animation of animations) animation.play();
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
  await origin.click();
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    for (const animation of document.getAnimations()) {
      animation.pause();
      const duration = Number(animation.effect?.getComputedTiming().duration);
      animation.currentTime = duration / 2;
    }
  });
  await expect(page).toHaveScreenshot("direct-photo-opening-half.png", {
    animations: "allow",
    caret: "hide",
    maxDiffPixelRatio: 0.001,
  });
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.play();
  });
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    await Promise.resolve();
    for (const animation of document.getAnimations()) {
      animation.pause();
      const duration = Number(animation.effect?.getComputedTiming().duration);
      animation.currentTime = duration / 2;
    }
  });
  await expect(page).toHaveScreenshot("direct-photo-closing-half.png", {
    animations: "allow",
    caret: "hide",
    maxDiffPixelRatio: 0.001,
  });
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.play();
  });
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

  await origin.click();
  await page.waitForTimeout(30);
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
  await page.keyboard.press("Escape");
  await page.waitForTimeout(20);
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
  const drag = await frame.evaluate((element) => {
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
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.pause();
  });
  await expect(page.locator("[data-lightbox-flight]")).toHaveCount(1);
  await expect(
    page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-flight-source-hidden]'),
  ).toHaveCount(1);

  await page.setViewportSize({ width: 740, height: 680 });
  const result = await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
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
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.play();
  });
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
  const startRadius = await page.locator("app-gallery").evaluate(
    async (
      gallery: HTMLElement & {
        controller: { open(target: { index: number }): Promise<unknown> };
      },
    ) => {
      void gallery.controller.open({ index: 0 });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
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
      for (const animation of document.getAnimations()) animation.play();
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
