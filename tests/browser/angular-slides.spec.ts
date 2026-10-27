import { expect, test, type Page } from "@playwright/test";
import { expectSlideshowPart } from "./support/slideshow-part";

declare global {
  interface Window {
    angularSlides: {
      resolveLazy?: () => void;
      openGate?: () => void;
      reels: { index: number; read: () => { video?: { currentTime: number } } | null }[];
      held: { id: string; read: () => number }[];
      cards: { index: number; read: () => string | null }[];
      landings: (string | null)[];
      setHeldItems?: (items: unknown[]) => void;
      values: (string | null)[];
      cancel: string[];
    };
  }
}

const dialog = "[data-fluidbox-dialog]";
const overlay = "[data-fluidbox-viewer]";
const shown = '[data-fluidbox-slide][aria-hidden="false"]';

async function load(page: Page) {
  await page.goto("/angular-slides.html");
  await expect(page.locator("#lazy [data-item]")).toHaveCount(3);
}

/** Whether the open is still waiting for its slide: mounted but not yet shown. */
const waiting = (page: Page) =>
  page.locator(overlay).evaluate((element) => element.hasAttribute("data-fluidbox-prepared"));

/** Whether `selector` was in the slide on show as the opening flight started. */
const inSlideAtFlight = (page: Page, selector: string) =>
  page.evaluate(
    ({ shown, selector }) =>
      new Promise<boolean>((resolve) => {
        const check = () => {
          const viewer = document.querySelector("[data-fluidbox-viewer]");
          if (viewer && !viewer.hasAttribute("data-fluidbox-prepared")) {
            resolve(!!viewer.querySelector(`${shown} ${selector}`));
            return;
          }
          requestAnimationFrame(check);
        };
        check();
      }),
    { shown, selector },
  );

test("a @defer loading in a slide's media holds the open inside the viewer, and the open flies onto what it renders", async ({
  page,
}) => {
  // On the Angular the repo builds with, the binding reads the block's state.
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await load(page);
  await page.locator('#lazy [data-item="lazy"]').click();
  await expect(page.locator(overlay)).toHaveCount(1);
  await page.waitForTimeout(400);
  expect(await waiting(page)).toBe(true);
  // The page around the viewer stays up, and the placeholder stays in the slide.
  await expect(page.locator("#outside")).toBeVisible();
  await expect(page.locator(`${overlay} [data-test="lazy-placeholder"]`)).toBeAttached();
  const landed = inSlideAtFlight(page, '[data-test="lazy-card"]');
  await page.evaluate(() => window.angularSlides.resolveLazy!());
  expect(await landed).toBe(true);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(`${shown} [data-test="lazy-card"]`)).toBeVisible();
  expect(warnings.filter((text) => text.includes("view data"))).toEqual([]);
});

/** Frames from a press to the start of the opening flight. */
const framesToFlight = (page: Page, selector: string) =>
  page.locator(selector).evaluate(
    (button: HTMLElement) =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const count = () => {
          const viewer = document.querySelector("[data-fluidbox-viewer]");
          if (viewer && !viewer.hasAttribute("data-fluidbox-prepared")) return resolve(frames);
          frames += 1;
          requestAnimationFrame(count);
        };
        button.click();
        requestAnimationFrame(count);
      }),
  );

test("a @defer in the layer around a slide's media doesn't hold the open", async ({ page }) => {
  await load(page);
  // Its dependencies never finish loading here; the cap would be 180 frames.
  const frames = await framesToFlight(page, '#lazy [data-item="layered"]');
  expect(frames).toBeLessThan(30);
  await expect(page.locator(`${shown} [data-test="layered-card"]`)).toBeVisible();
  await expect(page.locator(`${shown} [data-test="layered-placeholder"]`)).toBeAttached();
});

test("a @defer that waits for a press doesn't hold the open, and the slide stops checking it", async ({
  page,
}) => {
  // Count every frame callback the page asks for.
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    const counter = { calls: 0 };
    Object.assign(window, { frameRequests: counter });
    window.requestAnimationFrame = (callback) => {
      counter.calls += 1;
      return request(callback);
    };
  });
  await load(page);
  const frames = await framesToFlight(page, '#lazy [data-item="tap"]');
  expect(frames).toBeLessThan(30);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(`${shown} [data-test="tap"]`)).toBeVisible();
  // At rest, the open viewer asks for no frames: nothing walks the slide's view.
  await page.waitForTimeout(300);
  const calls = () =>
    page.evaluate(
      () => (window as unknown as { frameRequests: { calls: number } }).frameRequests.calls,
    );
  const before = await calls();
  await page.waitForTimeout(500);
  expect((await calls()) - before).toBe(0);
});

test("a slide reads its index and its origin live", async ({ page }) => {
  await load(page);
  await page.evaluate(() => window.angularSlides.openGate!());
  // An item put before the one on show keeps its slide, at the next index.
  await page.locator('#held [data-item="held-a"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  const index = (id: string) =>
    page.evaluate(
      (id) => window.angularSlides.held.findLast((slide) => slide.id === id)!.read(),
      id,
    );
  expect(await index("held-a")).toBe(0);
  const count = await page.evaluate(() => window.angularSlides.held.length);
  await page.evaluate(() =>
    window.angularSlides.setHeldItems!([
      { type: "held", id: "held-new", title: "held new", width: 800, height: 600 },
      { type: "held", id: "held-a", title: "held held-a", width: 800, height: 600 },
      { type: "held", id: "held-b", title: "held held-b", width: 800, height: 600 },
    ]),
  );
  await expect(page.locator(`${shown} [data-test="held-card"]`)).toHaveText("held held-a at 1");
  expect(await index("held-a")).toBe(1);
  expect(
    await page.evaluate(
      (count) => window.angularSlides.held.slice(0, count).some((slide) => slide.id === "held-a"),
      count,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);

  // A slide drawn before an open from a playing trigger reads that trigger's video.
  const card = '#reels [data-item="reel-a"] video';
  await page.locator(card).scrollIntoViewIfNeeded();
  await page.waitForFunction((selector) => {
    const video = document.querySelector<HTMLVideoElement>(selector);
    return !!video && !video.paused && video.currentTime > 0.2;
  }, card);
  await page.locator('#reels [data-item="reel-b"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  // What the neighbour's slide handed out as it rendered, read again later.
  const origin = () =>
    page.evaluate(() => {
      const origin = window.angularSlides.reels.find((reel) => reel.index === 0)!.read();
      return origin?.video?.currentTime ?? null;
    });
  expect(await origin()).toBeNull();
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  await page.locator('#reels [data-item="reel-a"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  expect(await origin()).toBeGreaterThan(0);
});

test("the open waits for a slide's commit and its waitUntil, then flies onto what it rendered", async ({
  page,
}) => {
  await load(page);
  await page.locator('#held [data-item="held-a"]').click();
  await expect(page.locator(overlay)).toHaveCount(1);
  // fluidboxMedia gives the box its class and attributes, beside the viewer's own.
  const box = page.locator(`${overlay} [data-test="held-box"]`).first();
  await expect(box).toHaveClass(/\bheld-box\b/);
  expect(await box.evaluate((element: HTMLElement) => element.style.outline)).toContain("tomato");
  // The content has committed, but its waitUntil holds the open.
  await expect(page.locator(`${overlay} [data-test="held-card"]`).first()).toBeAttached();
  await page.waitForTimeout(400);
  expect(await waiting(page)).toBe(true);
  const landed = inSlideAtFlight(page, '[data-test="held-card"]');
  await page.evaluate(() => window.angularSlides.openGate!());
  expect(await landed).toBe(true);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
});

test("closing hands the trigger's video the time a slide registered with returnPlayback", async ({
  page,
}) => {
  await load(page);
  const card = '#reels [data-item="reel-a"] video';
  await page.locator(card).scrollIntoViewIfNeeded();
  await page.waitForFunction((selector) => {
    const video = document.querySelector<HTMLVideoElement>(selector);
    return !!video && !video.paused && video.currentTime > 0.2;
  }, card);
  await page.locator('#reels [data-item="reel-a"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  // The trigger rests at a known frame, so a seek and a play show.
  await page.locator(card).evaluate(async (video: HTMLVideoElement) => {
    video.pause();
    const seeked = new Promise((resolve) =>
      video.addEventListener("seeked", resolve, { once: true }),
    );
    video.currentTime = 0.5;
    await seeked;
  });
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  const back = await page.locator(card).evaluate((video: HTMLVideoElement) => ({
    time: video.currentTime,
    paused: video.paused,
  }));
  expect(back.paused).toBe(false);
  expect(back.time).toBeGreaterThanOrEqual(2.49);
  expect(back.time).toBeLessThan(3.5);
});

test("the viewer's parts name themselves, follow the item on show, and show your error content", async ({
  page,
}) => {
  await load(page);
  await page.locator('#parts [data-item="ok"]').click();
  const viewer = page.locator(dialog);
  await expect(viewer).toHaveAttribute("data-fluidbox-status", "open");
  // Empty, the toolbar holds Previous, Next and Close, each named by a default label.
  const toolbar = viewer.locator("[data-fluidbox-toolbar]");
  await expect(toolbar.locator("button")).toHaveCount(3);
  await expect(toolbar.locator("[data-fluidbox-close]")).toHaveText("Close");
  await expect(toolbar.locator("[data-fluidbox-close]")).toHaveAttribute(
    "data-fluidbox-default",
    "",
  );
  await expect(viewer.locator('[data-test="fullscreen"]')).toHaveAttribute("type", "button");
  // A bare disabled attribute disables a control the viewer would enable.
  await expect(viewer.locator('[data-test="zoom-in-off"]')).toBeDisabled();
  // Content you give names a control; the label then names it for assistive technology.
  await expect(viewer.locator('[data-test="share"]')).toHaveText("Pass it on");
  await expect(viewer.locator('[data-test="share"]')).not.toHaveAttribute(
    "data-fluidbox-default",
    "",
  );
  const download = viewer.locator('[data-test="download"]');
  await expect(download).toHaveAttribute("href", /\/photo-square\.svg$/);
  await expect(download).toHaveAttribute("download", /.*/);
  await expect(download).not.toHaveAttribute("disabled", /.*/);
  await expect(viewer.locator('[data-test="counter"]')).toHaveText("1 / 2");
  await expect(viewer.locator('[data-test="counter-of"]')).toHaveText("Photo 1 of 2");
  await expect(viewer.locator('[data-test="caption"]')).toHaveText("A square photo");
  await expect(viewer.locator('[data-test="error"]')).toHaveCount(0);

  await page.keyboard.press("ArrowRight");
  await expect(viewer.locator('[data-test="counter"]')).toHaveText("2 / 2");
  await expect(viewer.locator('[data-test="counter-of"]')).toHaveText("Photo 2 of 2");
  await expect(viewer.locator('[data-test="caption"]')).toHaveText("A photo that is not there");
  await expect(download).toHaveAttribute("href", /\/missing-photo\.svg$/);
  // The file is missing: your error content shows in place of the default one.
  await expect(viewer.locator('[data-test="error"]')).toHaveText("Photo missing didn't load.");
  await expect(viewer.locator('[data-test="retry"]')).toHaveText("Retry");

  await page.keyboard.press("ArrowLeft");
  await expect(viewer.locator('[data-test="error"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
});

test("[(value)] follows the viewer, and a change beforeValueChange cancels never reaches it", async ({
  page,
}) => {
  await load(page);
  const values = () => page.evaluate(() => [...window.angularSlides.values]);
  const cancel = (actions: string[]) =>
    page.evaluate(
      (actions) => window.angularSlides.cancel.splice(0, Infinity, ...actions),
      actions,
    );

  await cancel(["open"]);
  await page.locator('#bound [data-item="one"]').click();
  await page.waitForTimeout(300);
  await expect(page.locator(dialog)).toHaveCount(0);
  expect(await values()).toEqual([]);

  await cancel(["move", "close"]);
  await page.locator('#bound [data-item="one"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  expect(await values()).toEqual(["one"]);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(`${shown} img`)).toHaveAttribute("src", /photo-square/);
  expect(await values()).toEqual(["one"]);

  await cancel([]);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(`${shown} img`)).toHaveAttribute("src", /photo-portrait/);
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  expect(await values()).toEqual(["one", "two", null]);
});

test("a root open on its first render shows a copy of the viewer, which the viewer takes over", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.assign(window, { copies: seen });
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && node.matches("[data-fluidbox-server-viewer]"))
            seen.push(node.querySelector("img")?.getAttribute("src") ?? "");
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/angular-slides.html?open=two");
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(`${shown} img`)).toHaveAttribute("src", /photo-portrait/);
  // The copy showed the photo, and went once the viewer had it.
  expect(await page.evaluate(() => (window as unknown as { copies: string[] }).copies)).toEqual([
    "/photo-portrait.svg",
  ]);
  await expect(page.locator("[data-fluidbox-server-viewer]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
});

test("Slideshow plays and pauses, and is named for what it does next", async ({ page }) => {
  await load(page);
  await expectSlideshowPart(page, "#slideshow");
});

test("a slide reads the trigger's live model, and hears once where each close lands", async ({
  page,
}) => {
  await load(page);
  await page.locator('#cards [data-item="card-b"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  const origin = (index: number) =>
    page.evaluate(
      (index) =>
        window.angularSlides.cards.findLast((card) => card.index === index)?.read() ?? null,
      index,
    );
  expect(await origin(1)).toBe("card-b");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(`${shown} [data-test="card"]`)).toHaveText("card card-a");
  // A slide reached by moving has no origin.
  expect(await origin(0)).toBeNull();
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  await page.locator('#cards [data-item="card-b"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  expect(await page.evaluate(() => window.angularSlides.landings)).toEqual(["card-a", "card-b"]);
});
