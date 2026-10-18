import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

test.use({ video: "on", trace: "on" });

const gallerySelector = "#collapsed-gallery";
const dialogSelector = "[data-lightbox-dialog]";

type Frame = {
  time: number;
  preview: string | null;
  concealed: boolean;
  state: string | null;
  sourcePainted: boolean;
  flightPainted: boolean;
  flightRadius: string | null;
  layerOpacity: number;
  labelOpacity: number;
};

async function loadGallery(page: Page) {
  await page.goto("/collapsed.html");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  const gallery = page.locator(gallerySelector);
  const teaser = gallery.locator("[data-preview-more]");
  await teaser.scrollIntoViewIfNeeded();
  return { gallery, teaser, preview: teaser.locator('[slot="trigger"] img') };
}

async function openVisible(gallery: Locator, index: number, page: Page) {
  await gallery.locator("app-lightbox").nth(index).locator('[slot="trigger"]').click();
  await expect(page.locator(dialogSelector)).toHaveAttribute("data-lightbox-state", "open");
}

async function startFrameProbe(page: Page) {
  await page.evaluate((selector) => {
    const frames: Frame[] = [];
    let running = true;
    const sample = () => {
      const teaser = document.querySelector<HTMLElement>(selector + " > [data-preview-more]");
      const dialog = document.querySelector<HTMLElement>("[data-lightbox-dialog]");
      const source = dialog?.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
      );
      const flight = document.querySelector<HTMLElement>("[data-lightbox-flight]");
      const flightFrame = flight?.querySelector<HTMLElement>("[data-lightbox-frame]");
      const layer = document.querySelector<HTMLElement>("[data-lightbox-transition-layer]");
      const label = document.querySelector<HTMLElement>(
        "[data-lightbox-transition-content] [data-collapsed-label]",
      );
      const painted = (element: HTMLElement | null | undefined) =>
        !!element &&
        getComputedStyle(element).visibility !== "hidden" &&
        Number(getComputedStyle(element).opacity) > 0.01;
      frames.push({
        time: performance.now(),
        preview: teaser?.querySelector('[slot="trigger"] img')?.getAttribute("src") ?? null,
        concealed: teaser?.hasAttribute("data-preview-concealed") ?? false,
        state: dialog?.getAttribute("data-lightbox-state") ?? null,
        sourcePainted: painted(source),
        flightPainted: painted(flight),
        flightRadius: flightFrame ? getComputedStyle(flightFrame).borderRadius : null,
        layerOpacity: layer ? Number(getComputedStyle(layer).opacity) : 0,
        labelOpacity: label ? Number(getComputedStyle(label).opacity) : 0,
      });
      if (running) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    Object.assign(window, {
      __collapsedFrames: frames,
      __stopCollapsedFrames: () => (running = false),
    });
  }, gallerySelector);
}

async function finishFrameProbe(page: Page, testInfo: TestInfo) {
  const frames = await page.evaluate(() => {
    const probe = window as unknown as Window & {
      __collapsedFrames: Frame[];
      __stopCollapsedFrames: () => void;
    };
    probe.__stopCollapsedFrames();
    return probe.__collapsedFrames;
  });
  await testInfo.attach("collapsed-animation-frames", {
    body: JSON.stringify(frames, null, 2),
    contentType: "application/json",
  });
  expect(frames.some((frame) => frame.state === "closing")).toBe(true);
  expect(frames.filter((frame) => frame.sourcePainted && frame.flightPainted)).toEqual([]);
  return frames;
}

test("visible items preserve the collapsed card while hidden items replace it", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const { gallery, teaser, preview } = await loadGallery(page);
  const initial = await preview.getAttribute("src");
  await page.evaluate(() => {
    Object.assign(window, {
      __originalCollapsedLabel: document.querySelector(
        "#collapsed-gallery [data-preview-more] [data-collapsed-label]",
      ),
    });
  });

  for (const index of [0, 1]) {
    await openVisible(gallery, index, page);
    await startFrameProbe(page);
    await page.keyboard.press("Escape");
    await expect(page.locator(dialogSelector)).toHaveCount(0);
    const frames = await finishFrameProbe(page, testInfo);
    expect(frames.every((frame) => frame.preview === initial)).toBe(true);
    await expect(preview).toHaveAttribute("src", initial!);
  }

  await teaser.locator('[slot="trigger"]').click();
  await expect(page.locator(dialogSelector)).toHaveAttribute("data-lightbox-state", "open");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 4 of 10",
  );
  await startFrameProbe(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(dialogSelector)).toHaveCount(0);
  const hiddenFrames = await finishFrameProbe(page, testInfo);
  expect(
    await page.evaluate(() => {
      const probe = window as unknown as Window & { __originalCollapsedLabel: Element };
      return (
        document.querySelector("#collapsed-gallery [data-preview-more] [data-collapsed-label]") ===
        probe.__originalCollapsedLabel
      );
    }),
  ).toBe(true);
  const hiddenSource = await gallery
    .locator("[data-preview-hidden]")
    .first()
    .locator('[slot="trigger"] img')
    .getAttribute("src");
  expect(hiddenFrames.at(-1)?.preview).toBe(hiddenSource);
  expect(hiddenFrames.some((frame) => frame.layerOpacity > 0 && frame.layerOpacity < 1)).toBe(true);
  expect(hiddenFrames.some((frame) => frame.labelOpacity > 0 && frame.labelOpacity < 1)).toBe(true);
  expect(
    hiddenFrames.some(
      (frame) =>
        frame.flightPainted && Number.parseFloat(frame.flightRadius?.split(" ")[1] ?? "0") > 0,
    ),
  ).toBe(true);
  await expect(preview).toHaveAttribute("src", hiddenSource!);

  await openVisible(gallery, 0, page);
  await startFrameProbe(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(dialogSelector)).toHaveCount(0);
  const afterVisible = await finishFrameProbe(page, testInfo);
  expect(afterVisible.every((frame) => frame.preview === hiddenSource)).toBe(true);
  await expect(preview).toHaveAttribute("src", hiddenSource!);

  await teaser.locator('[slot="trigger"]').click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 4 of 10",
  );
});

test("keyboard opening and backdrop click complete a full gallery interaction", async ({
  page,
}) => {
  const { gallery } = await loadGallery(page);
  const trigger = gallery.locator("app-lightbox").first().locator('[slot="trigger"]');
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(dialogSelector)).toHaveAttribute("data-lightbox-state", "open");
  await page.mouse.click(5, 5);
  await expect(page.locator(dialogSelector)).toHaveCount(0);
});

test("the collapsed card carries its asymmetric corners into the opening transition", async ({
  page,
}) => {
  const { teaser } = await loadGallery(page);
  await teaser.locator('[slot="trigger"]').click();
  const radii = await page.evaluate(async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const frame = document.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
      );
      const animation = frame
        ?.getAnimations()
        .find((candidate) =>
          (candidate.effect as KeyframeEffect | null)
            ?.getKeyframes()
            .some((keyframe) => "borderRadius" in keyframe),
        );
      if (animation) {
        const keyframes = (animation.effect as KeyframeEffect).getKeyframes();
        animation.pause();
        animation.currentTime = Number(animation.effect?.getTiming().duration) / 2;
        const halfway = getComputedStyle(frame!).borderRadius;
        animation.play();
        return {
          first: String(keyframes[0]?.borderRadius),
          last: String(keyframes.at(-1)?.borderRadius),
          halfway,
        };
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    throw new Error("The opening radius animation never started");
  });
  const corners = (value: string) =>
    value
      .split("/")[0]!
      .trim()
      .split(" ")
      .map((part) => Number.parseFloat(part));
  expect(corners(radii.first)[0]).toBe(0);
  expect(corners(radii.first)[1]).toBeGreaterThan(0);
  expect(corners(radii.first)[2]).toBeGreaterThan(0);
  expect(corners(radii.first)[3]).toBe(0);
  expect(corners(radii.last).every((value) => value === 0)).toBe(true);
  expect(corners(radii.halfway)[1]).toBeGreaterThan(0);
});

test("the first card carries its left corners into the opening transition", async ({ page }) => {
  const { gallery } = await loadGallery(page);
  await gallery.locator("app-lightbox").first().locator('[slot="trigger"]').click();
  const radii = await page.evaluate(async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const frame = document.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
      );
      const animation = frame
        ?.getAnimations()
        .find((candidate) =>
          (candidate.effect as KeyframeEffect | null)
            ?.getKeyframes()
            .some((keyframe) => "borderRadius" in keyframe),
        );
      if (animation) return (animation.effect as KeyframeEffect).getKeyframes()[0]?.borderRadius;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    throw new Error("The opening radius animation never started");
  });
  const corners = String(radii)
    .split("/")[0]!
    .trim()
    .split(" ")
    .map((part) => Number.parseFloat(part));
  expect(corners[0]).toBeGreaterThan(0);
  expect(corners[1]).toBe(0);
  expect(corners[2]).toBe(0);
  expect(corners[3]).toBeGreaterThan(0);
});

test("the teaser overlay does not flash after opening settles", async ({ page }, testInfo) => {
  const { teaser } = await loadGallery(page);
  await page.evaluate(() => {
    const samples: Array<Record<string, number | string | null>> = [];
    let running = true;
    const sample = () => {
      const layer = document.querySelector<HTMLElement>("[data-lightbox-transition-layer]");
      const target = document.querySelector<HTMLElement>("[data-lightbox-transition-content]");
      const label = target?.querySelector<HTMLElement>("[data-collapsed-label]");
      samples.push({
        time: performance.now(),
        state:
          document.querySelector("[data-lightbox-dialog]")?.getAttribute("data-lightbox-state") ??
          null,
        phase: layer?.getAttribute("data-lightbox-phase") ?? null,
        layer: layer ? Number(getComputedStyle(layer).opacity) : 0,
        label: label ? Number(getComputedStyle(label).opacity) : 0,
        target: target ? Number(getComputedStyle(target).opacity) : 0,
      });
      if (running) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    Object.assign(window, {
      __overlaySamples: samples,
      __stopOverlaySamples: () => (running = false),
    });
  });
  await teaser.locator('[slot="trigger"]').click();
  await expect(page.locator(dialogSelector)).toHaveAttribute("data-lightbox-state", "open");
  await page.waitForTimeout(100);
  const samples = await page.evaluate(() => {
    const probe = window as unknown as Window & {
      __overlaySamples: Array<Record<string, number | string | null>>;
      __stopOverlaySamples: () => void;
    };
    probe.__stopOverlaySamples();
    return probe.__overlaySamples;
  });
  await testInfo.attach("opening-overlay-frames", {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
  expect(samples.length).toBeGreaterThan(10);
  const settled = samples.findIndex(
    (sample) => sample.phase === "opening" && Number(sample.layer) < 0.1,
  );
  expect(settled).toBeGreaterThan(0);
  expect(samples.slice(settled).every((sample) => Number(sample.layer) < 0.2)).toBe(true);
  expect(samples.slice(settled).every((sample) => Number(sample.label) < 0.2)).toBe(true);
  expect(
    samples
      .filter((sample) => sample.state === "open")
      .every((sample) => Number(sample.layer) < 0.1),
  ).toBe(true);
});

test("the teaser content is already opaque when close settles", async ({ page }, testInfo) => {
  const { teaser } = await loadGallery(page);
  await teaser.locator('[slot="trigger"]').click();
  await expect(page.locator(dialogSelector)).toHaveAttribute("data-lightbox-state", "open");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 4 of 10",
  );
  await page.evaluate(() => {
    const samples: Array<{ state: string; label: number; layer: number }> = [];
    let running = true;
    const sample = () => {
      const teaser = document.querySelector<HTMLElement>(
        "#collapsed-gallery > [data-preview-more]",
      )!;
      const layer = document.querySelector<HTMLElement>("[data-lightbox-transition-layer]");
      const clone = document.querySelector<HTMLElement>(
        "[data-lightbox-transition-content] [data-collapsed-label]",
      );
      const staticLabel = teaser.querySelector<HTMLElement>("[data-collapsed-label]");
      const visible = getComputedStyle(teaser).visibility !== "hidden";
      samples.push({
        state:
          document.querySelector("[data-lightbox-dialog]")?.getAttribute("data-lightbox-state") ??
          "closed",
        label: clone
          ? Number(getComputedStyle(clone).opacity)
          : visible && staticLabel
            ? Number(getComputedStyle(staticLabel).opacity)
            : 0,
        layer: layer ? Number(getComputedStyle(layer).opacity) : 0,
      });
      if (running) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    Object.assign(window, {
      __closeOverlaySamples: samples,
      __stopCloseOverlaySamples: () => (running = false),
    });
  });
  await page.keyboard.press("Escape");
  await expect(page.locator(dialogSelector)).toHaveCount(0);
  await page.waitForTimeout(50);
  const samples = await page.evaluate(() => {
    const probe = window as unknown as Window & {
      __closeOverlaySamples: Array<{ state: string; label: number; layer: number }>;
      __stopCloseOverlaySamples: () => void;
    };
    probe.__stopCloseOverlaySamples();
    return probe.__closeOverlaySamples;
  });
  await testInfo.attach("closing-overlay-frames", {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
  const lastClosing = samples.findLast((sample) => sample.state === "closing");
  const firstClosed = samples.find((sample) => sample.state === "closed");
  expect(lastClosing).toBeDefined();
  expect(firstClosed).toBeDefined();
  expect(lastClosing!.label).toBeGreaterThan(0.98);
  expect(lastClosing!.layer).toBeGreaterThan(0.98);
  expect(Math.abs(firstClosed!.label - lastClosing!.label)).toBeLessThan(0.02);
  expect(
    samples.filter((sample) => sample.state === "closed").every((sample) => sample.label > 0.95),
  ).toBe(true);
  expect(
    await teaser
      .locator("[data-collapsed-label]")
      .evaluate((label) => label.getAnimations().length),
  ).toBe(0);
});

test("close button completes an interaction without a collapsed card", async ({ page }) => {
  await page.goto("/harness.html");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  await page.locator("app-lightbox").first().click();
  await expect(page.locator(dialogSelector)).toHaveAttribute("data-lightbox-state", "open");
  await page.locator("[data-lightbox-close]").click();
  await expect(page.locator(dialogSelector)).toHaveCount(0);
});

test("slow and fast wheel dismissal each finish at the source", async ({ page }, testInfo) => {
  test.skip(!!testInfo.project.use.isMobile, "Wheel input is a desktop scenario.");
  test.setTimeout(90_000);
  const { gallery, preview } = await loadGallery(page);
  const initial = await preview.getAttribute("src");
  for (const deltas of [Array(10).fill(-50) as number[], [-500]]) {
    await openVisible(gallery, 0, page);
    await startFrameProbe(page);
    const frame = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]');
    const bounds = (await frame.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    for (const delta of deltas) {
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(30);
    }
    await expect(page.locator(dialogSelector)).toHaveCount(0);
    const frames = await finishFrameProbe(page, testInfo);
    expect(frames.every((sample) => sample.preview === initial)).toBe(true);
  }
});

test("vertical wheel dismissal responds during horizontal navigation", async ({
  page,
}, testInfo) => {
  test.skip(!!testInfo.project.use.isMobile, "Wheel input is a desktop scenario.");
  const { gallery } = await loadGallery(page);
  await openVisible(gallery, 0, page);
  await startFrameProbe(page);
  const frame = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]');
  const bounds = (await frame.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(120, 0);
  await page.mouse.wheel(0, -450);
  await expect(page.locator(dialogSelector)).toHaveCount(0);
  await finishFrameProbe(page, testInfo);
});

test("touch drag closes immediately, including during horizontal snap", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "pixel-7", "CDP touch input requires mobile Chromium.");
  test.setTimeout(90_000);
  const { gallery } = await loadGallery(page);
  const session = await page.context().newCDPSession(page);
  for (const sideways of [false, true]) {
    await openVisible(gallery, 0, page);
    await startFrameProbe(page);
    const frame = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]');
    const bounds = (await frame.boundingBox())!;
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    const dispatch = (type: "touchStart" | "touchMove" | "touchEnd", dx: number, dy: number) =>
      session.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x: x + dx, y: y + dy }],
      });
    if (sideways) {
      await dispatch("touchStart", 0, 0);
      await dispatch("touchMove", -35, 0);
      await dispatch("touchEnd", -35, 0);
    }
    await dispatch("touchStart", 0, 0);
    for (const distance of [35, 70, 105, 140, 175]) {
      await dispatch("touchMove", 0, distance);
      await page.waitForTimeout(20);
    }
    await dispatch("touchEnd", 0, 175);
    await expect(page.locator(dialogSelector)).toHaveCount(0);
    await finishFrameProbe(page, testInfo);
  }
  await session.detach();
});
