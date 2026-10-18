import { expect, test, type Page } from "@playwright/test";

/**
 * Flight conformance: whatever the origin looks like, the first painted frame
 * of an opening and the last painted frame of a closing must look like the
 * card itself. Anything else is a visible pop at the start or end of a flight.
 */

const cases = [
  "cover",
  "contain",
  "position",
  "different",
  "text",
  "badge",
  "scroll",
  "sticky",
  "scaled",
  "video-poster",
  "video-inline",
  "iframe",
] as const;

/**
 * Cases the current flight cannot draw yet. It shows the media cropped from the
 * centre to the origin's whole box, so these jump at the start and end:
 * letterboxed or anchored crops, a card half hidden by a scroller, a clip that
 * was mid-playback, and an embed snapshot cropped once by the viewer and again
 * by the flight. They pass once the flight draws the origin itself.
 */
const knownGaps = new Set<string>(["contain", "position", "scroll", "video-inline", "iframe"]);

/**
 * The player keeps its native controls through the flight on purpose, so
 * playback is never interrupted. The poster card has none, and whether the
 * controls show without hover depends on the browser.
 */
const intendedDifferences = new Set<string>(["video-poster"]);

type Box = { x: number; y: number; width: number; height: number };

/**
 * The origin's whole box, clipped only by the viewport and inset past
 * antialiasing. A scroller hides part of the card; a flight that spills over
 * the scroller's edge must show up here too.
 */
async function visibleOrigin(page: Page, id: string): Promise<Box> {
  return page.evaluate((id) => {
    const trigger = document.querySelector(`[data-flight-case="${id}"] [data-flight-trigger]`)!;
    const visual = trigger.querySelector<HTMLElement>("[data-lightbox-origin]") ?? trigger;
    const rect = visual.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(innerWidth, rect.right);
    const bottom = Math.min(innerHeight, rect.bottom);
    const inset = 3;
    return {
      x: Math.round(left + inset),
      y: Math.round(top + inset),
      width: Math.round(right - left - inset * 2),
      height: Math.round(bottom - top - inset * 2),
    };
  }, id);
}

/** Mean per-channel difference between two PNGs, from 0 (same) to 1. */
async function difference(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([first, second]) => {
      const pixels = async (base64: string) => {
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const [x, y] = await Promise.all([pixels(first), pixels(second)]);
      if (x.length !== y.length) return 1;
      let total = 0;
      for (let index = 0; index < x.length; index += 4) {
        total +=
          Math.abs(x[index]! - y[index]!) +
          Math.abs(x[index + 1]! - y[index + 1]!) +
          Math.abs(x[index + 2]! - y[index + 2]!);
      }
      return total / ((x.length / 4) * 3 * 255);
    },
    [a.toString("base64"), b.toString("base64")] as const,
  );
}

/**
 * Arm a hold before the action that starts a flight. The page checks every
 * frame, so even a loaded browser cannot finish the motion between polls.
 */
async function armHold(page: Page, at: "start" | "middle" | "end") {
  await page.evaluate((at) => {
    const state = window as unknown as { flightHeld?: boolean };
    state.flightHeld = false;
    // A timer, not requestAnimationFrame: WebKit throttles frames in busy parallel runs.
    const timer = setInterval(() => {
      const moving = Array.from(
        document.querySelectorAll(
          "[data-lightbox-overlay] [data-lightbox-frame], [data-lightbox-flight] [data-lightbox-frame]",
        ),
      ).some((frame) =>
        frame
          .getAnimations()
          // CSS transitions can start before the runtime has assembled its flight.
          .some(
            (animation) =>
              animation.playState === "running" &&
              !(animation instanceof CSSTransition) &&
              !(animation instanceof CSSAnimation),
          ),
      );
      if (!moving) return;
      clearInterval(timer);
      for (const animation of document.getAnimations()) {
        // A paused animation can paint a stale compositor frame. A crawling one
        // paints the held time, and stopping short of the end keeps it unfinished.
        const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
        animation.playbackRate = 1e-6;
        animation.currentTime =
          at === "start" ? 0 : at === "middle" ? end / 2 : Math.max(0, end - 1);
      }
      // Give the held pose time to paint.
      setTimeout(() => {
        state.flightHeld = true;
      }, 120);
    }, 4);
  }, at);
}

async function held(page: Page) {
  await page.waitForFunction(() => (window as unknown as { flightHeld?: boolean }).flightHeld);
}

async function prepareCase(page: Page, id: string) {
  await page.goto("/flight.html");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.decode().catch(() => undefined)),
    );
    // Hold each inline clip mid-way, as a playing card would be when clicked.
    await Promise.all(
      Array.from(document.querySelectorAll("video"), async (video) => {
        video.autoplay = false;
        video.pause();
        if (video.readyState < 1) {
          await new Promise((resolve) =>
            video.addEventListener("loadedmetadata", resolve, { once: true }),
          );
        }
        video.currentTime = 1.5;
        await new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true }));
      }),
    );
  });
  const trigger = page.locator(`[data-flight-case="${id}"] [data-flight-trigger]`);
  await trigger.scrollIntoViewIfNeeded();
  await trigger.hover();
  await page.waitForTimeout(100);
  return trigger;
}

for (const id of cases) {
  test(`flight from the "${id}" card starts and ends on the card`, async ({ page }) => {
    test.skip(intendedDifferences.has(id), "the player keeps its native controls in flight");
    test.fail(knownGaps.has(id), "the flight still draws the media, not the origin");
    const trigger = await prepareCase(page, id);
    const box = await visibleOrigin(page, id);
    expect(box.width).toBeGreaterThan(20);
    const before = await page.screenshot({ clip: box, animations: "allow" });

    await armHold(page, "start");
    await trigger.click();
    await held(page);
    const opening = await page.screenshot({ clip: box, animations: "allow" });
    const openDifference = await difference(page, before, opening);

    await page.evaluate(() => {
      for (const animation of document.getAnimations()) animation.playbackRate = 1;
    });
    await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
      "data-lightbox-state",
      "open",
    );
    await armHold(page, "end");
    await page.keyboard.press("Escape");
    await held(page);
    const closing = await page.screenshot({ clip: box, animations: "allow" });
    const closeDifference = await difference(page, before, closing);

    expect.soft(openDifference, "first opening frame differs from the card").toBeLessThan(0.03);
    expect.soft(closeDifference, "last closing frame differs from the card").toBeLessThan(0.03);
  });
}

test("a travelling badge keeps its size through the flight", async ({ page }) => {
  const trigger = await prepareCase(page, "badge");
  const badge = page.locator('[data-flight-case="badge"] .flight-badge');
  const size = (await badge.boundingBox())!;
  await trigger.click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await armHold(page, "middle");
  await page.keyboard.press("Escape");
  await held(page);
  const travelling = (await page
    .locator("[data-lightbox-transition-content] .flight-badge")
    .boundingBox())!;
  const opacity = await page
    .locator("[data-lightbox-transition-content]")
    .evaluate((target) => Number(getComputedStyle(target).opacity));
  expect(opacity, "the badge is visible mid-flight").toBeGreaterThan(0.9);
  // The badge is near-black with white text. If the flying image covered it,
  // this patch would be the light photo with no dark pixels at all.
  const patch = await page.screenshot({
    clip: {
      x: travelling.x + travelling.width / 2 - 6,
      y: travelling.y + travelling.height / 2 - 4,
      width: 12,
      height: 8,
    },
    animations: "allow",
  });
  const dark = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let count = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index]! + data[index + 1]! + data[index + 2]! < 150) count++;
    }
    return count / (data.length / 4);
  }, patch.toString("base64"));
  expect(dark, "the badge paints above the flying image").toBeGreaterThan(0.3);
  expect(travelling.width).toBeCloseTo(size.width, -1);
  expect(travelling.height).toBeCloseTo(size.height, -1);
});

test("a wheel during the opening takes over and dismisses", async ({ page }, testInfo) => {
  test.skip(!!testInfo.project.use.isMobile, "Wheel input is a desktop scenario.");
  // ?slow plays the opening at a tenth of its speed, so the wheel lands mid-flight.
  await page.goto("/flight.html?slow");
  const trigger = page.locator('[data-flight-case="cover"] [data-flight-trigger]');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const dialog = page.locator("[data-lightbox-dialog]");
  await expect(dialog).toHaveAttribute("data-lightbox-state", "opening");
  await page.waitForTimeout(400);
  const box = (await trigger.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(dialog, "the wheel lands while the opening still plays").toHaveAttribute(
    "data-lightbox-state",
    "opening",
  );
  await page.mouse.wheel(0, -500);
  await expect(dialog).toHaveAttribute("data-lightbox-state", "closing");
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
});

test("a close after an idle moment still animates", async ({ page }) => {
  const trigger = await prepareCase(page, "cover");
  await trigger.click();
  const dialog = page.locator("[data-lightbox-dialog]");
  await expect(dialog).toHaveAttribute("data-lightbox-state", "open");
  // Long enough for a browser to stop advancing its idle timeline.
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(120);
  await expect(dialog, "the close skipped its motion").toHaveAttribute(
    "data-lightbox-state",
    "closing",
  );
  await expect(dialog).toHaveCount(0);
});

test("a travelling badge lands exactly on the card's badge", async ({ page }) => {
  const trigger = await prepareCase(page, "badge");
  const card = (await page.locator('[data-flight-case="badge"] .flight-badge').boundingBox())!;
  await trigger.click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await armHold(page, "end");
  await page.keyboard.press("Escape");
  await held(page);
  const landing = (await page
    .locator("[data-lightbox-transition-content] .flight-badge")
    .boundingBox())!;
  expect(Math.abs(landing.x - card.x)).toBeLessThan(1.5);
  expect(Math.abs(landing.y - card.y)).toBeLessThan(1.5);
  expect(Math.abs(landing.width - card.width)).toBeLessThan(1.5);
});

test("zooming leaves no unzoomed image behind", async ({ page }, testInfo) => {
  test.skip(!!testInfo.project.use.isMobile, "Double-click zoom is a desktop scenario.");
  const trigger = await prepareCase(page, "cover");
  await trigger.click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  const media = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]');
  const box = (await media.boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 3);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute("data-zoomed", "");
  const leftovers = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"] :is([data-lightbox-slide-preview], [data-lightbox-slide-placeholder])',
      ),
      (layer) => getComputedStyle(layer).visibility,
    ),
  );
  expect(leftovers.every((visibility) => visibility === "hidden")).toBe(true);
});

test("slides stay aligned and images fit their slide on a fractional width", async ({ page }) => {
  await page.goto("/react/");
  // A fractional dialog width: rounded slide positions would drift per slide.
  await page.addStyleTag({
    content: "[data-lightbox-dialog] { width: calc(100% - 0.4px) !important; }",
  });
  const cover = page.locator(".cover");
  await cover.scrollIntoViewIfNeeded();
  await cover.click();
  const dialog = page.locator("[data-lightbox-dialog]");
  await expect(dialog).toHaveAttribute("data-lightbox-state", "open");
  for (let step = 1; step <= 4; step++) {
    await page.locator("[data-lightbox-next]").click();
    const active = page.locator('[data-lightbox-slide][aria-hidden="false"]');
    await expect(active).toHaveAttribute("aria-label", `Item ${step + 1} of 5`);
    await page.waitForTimeout(700);
    const geometry = await active.evaluate((slide) => {
      const box = (element: Element) => element.getBoundingClientRect();
      const strip = box(slide.parentElement!);
      return {
        offset: box(slide).left - strip.left,
        slide: [box(slide).left, box(slide).right],
        frame: [
          box(slide.querySelector("[data-lightbox-frame]")!).left,
          box(slide.querySelector("[data-lightbox-frame]")!).right,
        ],
      };
    });
    expect(Math.abs(geometry.offset), `slide ${step + 1} drifted`).toBeLessThan(0.5);
    expect(geometry.frame[0]!).toBeGreaterThanOrEqual(geometry.slide[0]! - 0.5);
    expect(geometry.frame[1]!).toBeLessThanOrEqual(geometry.slide[1]! + 0.5);
  }
});
