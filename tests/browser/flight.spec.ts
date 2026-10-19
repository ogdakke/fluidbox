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
 * A playing clip hands its current frame to the player through a canvas. The
 * Linux WebKit build cannot draw video frames into a canvas (the copy stays
 * transparent), so there the player shows its own frame. Safari on Apple
 * platforms draws them.
 */
const cannotDrawVideo = (id: string, browserName: string) =>
  id === "video-inline" && browserName === "webkit" && process.platform === "linux";

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
    const visual = trigger.querySelector<HTMLElement>("[data-fluidbox-origin]") ?? trigger;
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
          "[data-fluidbox-overlay] [data-fluidbox-frame], [data-fluidbox-flight] [data-fluidbox-frame]",
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
  test(`flight from the "${id}" card starts and ends on the card`, async ({
    page,
    browserName,
  }) => {
    test.skip(intendedDifferences.has(id), "the player keeps its native controls in flight");
    test.skip(cannotDrawVideo(id, browserName), "this WebKit build cannot draw video frames");
    const trigger = await prepareCase(page, id);
    const box = await visibleOrigin(page, id);
    expect(box.width).toBeGreaterThan(20);
    const before = await page.screenshot({ clip: box, animations: "allow", scale: "css" });

    await armHold(page, "start");
    await trigger.click();
    await held(page);
    const opening = await page.screenshot({ clip: box, animations: "allow", scale: "css" });
    const openDifference = await difference(page, before, opening);

    await page.evaluate(() => {
      for (const animation of document.getAnimations()) animation.playbackRate = 1;
    });
    await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
      "data-fluidbox-status",
      "open",
    );
    await armHold(page, "end");
    await page.keyboard.press("Escape");
    await held(page);
    const closing = await page.screenshot({ clip: box, animations: "allow", scale: "css" });
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
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await armHold(page, "middle");
  await page.keyboard.press("Escape");
  await held(page);
  const travelling = (await page
    .locator("[data-fluidbox-transition-content] .flight-badge")
    .boundingBox())!;
  const opacity = await page
    .locator("[data-fluidbox-transition-content]")
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
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "opening");
  await page.waitForTimeout(400);
  const box = (await trigger.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(dialog, "the wheel lands while the opening still plays").toHaveAttribute(
    "data-fluidbox-status",
    "opening",
  );
  await page.mouse.wheel(0, -500);
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "closing");
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
});

test("a close after an idle moment still animates", async ({ page }) => {
  const trigger = await prepareCase(page, "cover");
  await trigger.click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  // Long enough for a browser to stop advancing its idle timeline.
  await page.waitForTimeout(1200);
  // Watch the close as it happens: a loaded browser can finish it before a
  // later poll looks. A skipped close runs no motion on any of its frames.
  type CloseMotion = { closing: boolean; running: number; frames: number };
  await page.evaluate(() => {
    (window as unknown as { __closeMotion: Promise<CloseMotion> }).__closeMotion =
      new Promise<CloseMotion>((resolve) => {
        const result = { closing: false, running: 0, frames: 0 };
        const count = () => {
          if (!document.querySelector("[data-fluidbox-dialog]")) return resolve(result);
          if (result.closing) {
            result.frames += 1;
            result.running = Math.max(
              result.running,
              document.getAnimations().filter((animation) => animation.playState === "running")
                .length,
            );
          }
          requestAnimationFrame(count);
        };
        new MutationObserver((_, observer) => {
          const state = document
            .querySelector("[data-fluidbox-dialog]")
            ?.getAttribute("data-fluidbox-status");
          if (state !== "closing") return;
          observer.disconnect();
          result.closing = true;
        }).observe(document.body, {
          attributes: true,
          attributeFilter: ["data-fluidbox-status"],
          subtree: true,
        });
        requestAnimationFrame(count);
      });
  });
  await page.keyboard.press("Escape");
  const motion = await page.evaluate(
    () => (window as unknown as { __closeMotion: Promise<CloseMotion> }).__closeMotion,
  );
  expect(motion.closing, "the close skipped its motion").toBe(true);
  expect(motion.running, "the close skipped its motion").toBeGreaterThan(0);
  expect(motion.frames, "the close skipped its motion").toBeGreaterThan(0);
  await expect(dialog).toHaveCount(0);
});

test("the card stays painted until the opening has been on screen for a frame", async ({
  page,
}) => {
  // Safari can paint a freshly shown image one frame late. Hiding the card in
  // the same frame the overlay appears leaves an empty frame on screen.
  const trigger = await prepareCase(page, "cover");
  const frames = page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const image = document.querySelector<HTMLElement>('[data-flight-case="cover"] img')!;
        const seen: string[] = [];
        const tick = () => {
          const overlay = document.querySelector("[data-fluidbox-overlay]");
          const shown = !!overlay && !overlay.hasAttribute("data-fluidbox-prepared");
          if (shown) seen.push(getComputedStyle(image).visibility);
          if (seen.length < 4) requestAnimationFrame(tick);
          else resolve(seen);
        };
        requestAnimationFrame(tick);
      }),
  );
  await trigger.click();
  const seen = await frames;
  expect(seen[0], "the card is painted in the overlay's first frame").toBe("visible");
  expect(seen.at(-1), "the card is hidden once the overlay has painted").toBe("hidden");
});

test("every photo in the scroller opens its own slide of one gallery", async ({ page }) => {
  await prepareCase(page, "scroll");
  const items = page.locator('[data-flight-case="scroll"] [data-flight-item]');
  await expect(items).toHaveCount(4);
  const second = items.nth(1);
  await second.scrollIntoViewIfNeeded();
  await second.click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  await expect(second.locator("img")).toHaveAttribute("data-fluidbox-thumbnail-hidden", "");
  // The viewer browses the whole gallery, and the card it hides follows.
  await page.keyboard.press("ArrowRight");
  await expect(items.nth(2).locator("img")).toHaveAttribute("data-fluidbox-thumbnail-hidden", "");
  await expect(second.locator("img")).not.toHaveAttribute("data-fluidbox-thumbnail-hidden");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("a close right after a swipe flies to the swiped photo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "pixel-7", "CDP touch input requires mobile Chromium.");
  await prepareCase(page, "scroll");
  const items = page.locator('[data-flight-case="scroll"] [data-flight-item]');
  await items.nth(1).scrollIntoViewIfNeeded();
  await items.nth(1).tap();
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  const session = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number) =>
    session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y: 400 }],
    });
  await touch("touchStart", 330);
  for (let x = 300; x >= 60; x -= 30) {
    await touch("touchMove", x);
    await page.waitForTimeout(16);
  }
  await touch("touchEnd", 60);
  // Close before the strip settles and reveals the swiped photo on its own.
  await expect(items.nth(2).locator("img")).toHaveAttribute("data-fluidbox-thumbnail-hidden", "");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-flight]")).toHaveCount(1);
  const visible = await items.nth(2).evaluate((item) => {
    const scroller = item.closest<HTMLElement>("[data-flight-scroller]")!.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    return rect.left >= scroller.left - 1 && rect.right <= scroller.right + 1;
  });
  expect(visible, "the scroller shows the swiped photo").toBe(true);
  await expect(dialog).toHaveCount(0);
  await session.detach();
});

test("a travelling badge never widens the page", async ({ page }) => {
  // On a phone the card is nearly as wide as the screen, so the growing badge
  // layer passes the right edge. A wider page makes mobile Safari zoom it out.
  await page.setViewportSize({ width: 393, height: 852 });
  const trigger = await prepareCase(page, "badge");
  await page.evaluate(() => {
    const state = window as unknown as { widest: number; rest: number };
    state.rest = state.widest = document.documentElement.scrollWidth;
    const measure = () => {
      state.widest = Math.max(state.widest, document.documentElement.scrollWidth);
    };
    new MutationObserver(measure).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    const tick = () => {
      measure();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await trigger.click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  const { widest, rest } = await page.evaluate(() => {
    const { widest, rest } = window as unknown as { widest: number; rest: number };
    return { widest, rest };
  });
  expect(widest).toBe(rest);
});

test("a travelling badge lands exactly on the card's badge", async ({ page }) => {
  const trigger = await prepareCase(page, "badge");
  const card = (await page.locator('[data-flight-case="badge"] .flight-badge').boundingBox())!;
  await trigger.click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await armHold(page, "end");
  await page.keyboard.press("Escape");
  await held(page);
  const landing = (await page
    .locator("[data-fluidbox-transition-content] .flight-badge")
    .boundingBox())!;
  expect(Math.abs(landing.x - card.x)).toBeLessThan(1.5);
  expect(Math.abs(landing.y - card.y)).toBeLessThan(1.5);
  expect(Math.abs(landing.width - card.width)).toBeLessThan(1.5);
});

test("zooming leaves no unzoomed image behind", async ({ page }, testInfo) => {
  test.skip(!!testInfo.project.use.isMobile, "Double-click zoom is a desktop scenario.");
  const trigger = await prepareCase(page, "cover");
  await trigger.click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  const media = page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]');
  const box = (await media.boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 3);
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute("data-zoomed", "");
  const leftovers = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-fluidbox-slide][aria-hidden="false"] :is([data-fluidbox-slide-preview], [data-fluidbox-slide-placeholder])',
      ),
      (layer) => getComputedStyle(layer).visibility,
    ),
  );
  expect(leftovers.every((visibility) => visibility === "hidden")).toBe(true);
});

test("slides stay aligned and images fit their slide on a fractional width", async ({ page }) => {
  await page.goto("/react/");
  await expect(page.locator("html")).toHaveAttribute("data-patterns-ready", "");
  // A fractional dialog width: rounded slide positions would drift per slide.
  await page.addStyleTag({
    content: "[data-fluidbox-dialog] { width: calc(100% - 0.4px) !important; }",
  });
  const cover = page.locator('[data-pattern="overlay"] [data-test="trigger"]');
  await cover.scrollIntoViewIfNeeded();
  await cover.click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  for (let step = 1; step <= 4; step++) {
    await page.locator("[data-fluidbox-next]").click();
    const active = page.locator('[data-fluidbox-slide][aria-hidden="false"]');
    await expect(active).toHaveAttribute("aria-label", `Item ${step + 1} of 5`);
    await page.waitForTimeout(700);
    const geometry = await active.evaluate((slide) => {
      const box = (element: Element) => element.getBoundingClientRect();
      const strip = box(slide.parentElement!);
      return {
        offset: box(slide).left - strip.left,
        slide: [box(slide).left, box(slide).right],
        frame: [
          box(slide.querySelector("[data-fluidbox-frame]")!).left,
          box(slide.querySelector("[data-fluidbox-frame]")!).right,
        ],
      };
    });
    expect(Math.abs(geometry.offset), `slide ${step + 1} drifted`).toBeLessThan(0.5);
    expect(geometry.frame[0]!).toBeGreaterThanOrEqual(geometry.slide[0]! - 0.5);
    expect(geometry.frame[1]!).toBeLessThanOrEqual(geometry.slide[1]! + 0.5);
  }
});

test("an opening never reloads a picture that is already on screen", async ({ page }) => {
  const trigger = await prepareCase(page, "cover");
  // The card's image is the full image. Writing its source again makes Safari
  // decode it a second time and paint an empty frame in between.
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { imageWrites: string[] }).imageWrites = log;
    new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target as Element;
        if (target.matches("[data-fluidbox-media]") && record.attributeName)
          log.push(`${record.attributeName}=${target.getAttribute(record.attributeName)}`);
      }
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset", "sizes"],
    });
  });
  await trigger.click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await page.waitForTimeout(400);
  const writes = await page.evaluate(
    () => (window as unknown as { imageWrites: string[] }).imageWrites,
  );
  // The slide is built with the card's decoded image; nothing replaces it.
  expect(writes).toEqual([]);
});

test("a playing clip keeps playing from the same moment in the player and back", async ({
  page,
}) => {
  await page.goto("/flight.html");
  const card = page.locator('[data-flight-case="video-inline"] video');
  await card.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const video = document.querySelector<HTMLVideoElement>(
      '[data-flight-case="video-inline"] video',
    );
    return !!video && !video.paused && video.currentTime > 1 && video.currentTime < 3;
  });
  const clicked = await card.evaluate((video: HTMLVideoElement) => video.currentTime);
  await page.locator('[data-flight-case="video-inline"] [data-flight-trigger]').click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  const player = dialog.locator("video");
  await expect(page.locator("[data-fluidbox-video-stand-in]")).toHaveCount(0);
  const playing = await player.evaluate((video: HTMLVideoElement) => ({
    paused: video.paused,
    time: video.currentTime,
  }));
  expect(playing.paused, "the player stopped the clip").toBe(false);
  // Not restarted from the beginning: it continues from where the card was.
  expect(playing.time).toBeGreaterThan(clicked - 0.1);

  const closedAt = await player.evaluate((video: HTMLVideoElement) => video.currentTime);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const back = await card.evaluate((video: HTMLVideoElement) => ({
    paused: video.paused,
    time: video.currentTime,
  }));
  expect(back.paused).toBe(false);
  expect(back.time).toBeGreaterThan(closedAt - 0.1);
});

for (const id of ["cover", "video-inline"]) {
  test(`the "${id}" flight starts with the card's rounded corners`, async ({ page }) => {
    const trigger = await prepareCase(page, id);
    await armHold(page, "start");
    await trigger.click();
    await held(page);
    // The frame is scaled, so compare its painted radius with the card's.
    const radius = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>(
        "[data-fluidbox-dialog] [data-fluidbox-frame]",
      )!;
      const style = getComputedStyle(frame);
      return Number.parseFloat(style.borderTopLeftRadius) * new DOMMatrix(style.transform).a;
    });
    expect(radius).toBeCloseTo(14, 0);
  });
}
