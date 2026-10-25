import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    solidSlides: {
      resolveLazy?: () => void;
      resolveFetch?: () => void;
      mounted: Record<string, number>;
      errors: string[];
      keepOpen: boolean;
      closeClicks: number;
      openGate?: () => void;
      reels: { index: number; read: () => { video?: { currentTime: number } } | null }[];
      held: { id: string; read: () => number }[];
      setHeldItems?: (items: unknown[]) => void;
    };
  }
}

const dialog = "[data-fluidbox-dialog]";
const overlay = "[data-fluidbox-viewer]";
const shown = '[data-fluidbox-slide][aria-hidden="false"]';

const expectShown = (page: Page, label: string) =>
  expect(page.locator(shown)).toHaveAttribute("aria-label", label);

async function load(page: Page) {
  await page.goto("/solid-slides.html");
  await expect(page.locator("#lazy [data-item]")).toHaveCount(1);
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

test("a slide that suspends waits inside the viewer, and the open flies onto what it renders", async ({
  page,
}) => {
  await load(page);
  await page.locator('#lazy [data-item="lazy"]').click();
  await expect(page.locator(overlay)).toHaveCount(1);
  await page.waitForTimeout(400);
  expect(await waiting(page)).toBe(true);
  // The page around the viewer stays up.
  await expect(page.locator("#outside")).toBeVisible();
  await expect(page.locator("#page-fallback")).toHaveCount(0);
  const landed = inSlideAtFlight(page, '[data-test="lazy-card"]');
  await page.evaluate(() => window.solidSlides.resolveLazy!());
  expect(await landed).toBe(true);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(`${shown} [data-test="lazy-card"]`)).toBeVisible();
});

test("a slide that reads a resource waits inside the viewer, and mounts once it resolves", async ({
  page,
}) => {
  await load(page);
  await page.locator('#fetched [data-item="fetched"]').click();
  await expect(page.locator(overlay)).toHaveCount(1);
  await page.waitForTimeout(400);
  expect(await waiting(page)).toBe(true);
  await expect(page.locator("#outside")).toBeVisible();
  await expect(page.locator("#page-fallback")).toHaveCount(0);
  const landed = inSlideAtFlight(page, '[data-test="fetched-card"]');
  await page.evaluate(() => window.solidSlides.resolveFetch!());
  expect(await landed).toBe(true);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(`${shown} [data-test="fetched-card"]`)).toHaveText("Fetched");
  expect(await page.evaluate(() => window.solidSlides.mounted.fetched)).toBe(1);
});

test("a slide reads its index and its origin live", async ({ page }) => {
  await load(page);
  await page.evaluate(() => window.solidSlides.openGate!());
  // An item put before the one on show keeps its slide, at the next index.
  await page.locator('#held [data-item="held-a"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  const index = (id: string) =>
    page.evaluate((id) => window.solidSlides.held.findLast((slide) => slide.id === id)!.read(), id);
  expect(await index("held-a")).toBe(0);
  const count = await page.evaluate(() => window.solidSlides.held.length);
  await page.evaluate(() =>
    window.solidSlides.setHeldItems!([
      { type: "held", id: "held-new", title: "held new", width: 800, height: 600 },
      { type: "held", id: "held-a", title: "held held-a", width: 800, height: 600 },
      { type: "held", id: "held-b", title: "held held-b", width: 800, height: 600 },
    ]),
  );
  await expect(page.locator(`${shown} [data-test="held-card"]`)).toHaveText("held held-a at 1");
  expect(await index("held-a")).toBe(1);
  expect(
    await page.evaluate(
      (count) => window.solidSlides.held.slice(0, count).some((slide) => slide.id === "held-a"),
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
      const origin = window.solidSlides.reels.find((reel) => reel.index === 0)!.read();
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
  // The content has committed, but its waitUntil holds the open.
  await expect(page.locator(`${overlay} [data-test="held-card"]`).first()).toBeAttached();
  await page.waitForTimeout(400);
  expect(await waiting(page)).toBe(true);
  const landed = inSlideAtFlight(page, '[data-test="held-card"]');
  await page.evaluate(() => window.solidSlides.openGate!());
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

test("the viewer's parts draw text, name themselves by their children, and replace the error", async ({
  page,
}) => {
  await load(page);
  await page.locator('#parts [data-item="square"]').click();
  const viewer = page.locator(dialog);
  await expect(viewer).toHaveAttribute("data-fluidbox-status", "open");
  const counter = viewer.locator("[data-fluidbox-toolbar] [data-fluidbox-counter]");
  await expect(counter).toHaveText("1 / 2");
  await expect(counter).toHaveAttribute("aria-hidden", "true");
  // Children with visible text and label={false}: named by the text.
  const close = viewer.locator("[data-fluidbox-toolbar] [data-fluidbox-close]");
  await expect(close).toHaveText("Done");
  await expect(close).not.toHaveAttribute("aria-label", /.*/);
  await expect(close).not.toHaveAttribute("data-fluidbox-default", /.*/);
  // The default Close steps aside for this one.
  await expect(viewer.locator("[data-fluidbox-close]")).toHaveCount(1);
  // No children: the label is the text.
  const download = viewer.locator("[data-fluidbox-download]");
  await expect(download).toHaveText("Download");
  await expect(download).toHaveAttribute("data-fluidbox-default", "");
  await expect(download).toHaveAttribute("href", "/photo-square.svg");
  // Children without text: the label names it.
  const next = viewer.locator("[data-fluidbox-next]");
  await expect(next).toHaveAttribute("aria-label", "Next");
  await expect(next).toHaveText("›");
  const zoom = viewer.locator("[data-fluidbox-zoom-controls]");
  await expect(zoom).toHaveAttribute("role", "group");
  await expect(zoom.locator("button")).toHaveText(["Zoom in", "Zoom out", "Fit to screen"]);
  const caption = viewer.locator("[data-fluidbox-caption]");
  await expect(caption).toHaveText("A square study");
  await expect(caption).toHaveAttribute("data-fluidbox-description", "");
  await expect(viewer.locator('[data-test="error"]')).toHaveCount(0);

  await next.click();
  await expectShown(page, "Item 2 of 2");
  await expect(counter).toHaveText("2 / 2");
  await expect(next).toBeDisabled();
  await expect(caption).toHaveCount(0);
  const error = viewer.locator('[data-test="error"]');
  await expect(error).toHaveText(/Photo broken failed/);
  // The default error stays, unseen, for the announcement.
  await expect(page.locator(`${shown} [data-fluidbox-error]`)).toHaveCSS("opacity", "0");
  await expect(error.locator("[data-fluidbox-retry]")).toHaveText("Retry");
  expect(await page.evaluate(() => window.solidSlides.errors)).toEqual(["broken"]);
  await close.click();
  await expect(viewer).toHaveCount(0);
});

test("a control's onClick runs first, and preventDefault in it stops the command", async ({
  page,
}) => {
  await load(page);
  await page.evaluate(() => (window.solidSlides.keepOpen = true));
  await page.locator('#parts [data-item="square"]').click();
  const viewer = page.locator(dialog);
  await expect(viewer).toHaveAttribute("data-fluidbox-status", "open");
  const close = viewer.locator("[data-fluidbox-toolbar] [data-fluidbox-close]");
  await close.click();
  await expect.poll(() => page.evaluate(() => window.solidSlides.closeClicks)).toBe(1);
  // Long enough for a close to have started.
  await page.waitForTimeout(300);
  await expect(viewer).toHaveAttribute("data-fluidbox-status", "open");
  await page.evaluate(() => (window.solidSlides.keepOpen = false));
  await close.click();
  await expect(viewer).toHaveCount(0);
  expect(await page.evaluate(() => window.solidSlides.closeClicks)).toBe(2);
});
