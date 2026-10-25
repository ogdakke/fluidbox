import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    vueSlides: {
      resolveLazy?: () => void;
      openGate?: () => void;
      reels: { index: number; read: () => { video?: { currentTime: number } } | null }[];
      held: { id: string; read: () => number }[];
      setHeldItems?: (items: unknown[]) => void;
      remount?: () => void;
      mediaErrors: () => number;
      model: () => string | null;
    };
  }
}

const dialog = "[data-fluidbox-dialog]";
const overlay = "[data-fluidbox-viewer]";
const shown = '[data-fluidbox-slide][aria-hidden="false"]';

async function load(page: Page) {
  await page.goto("/vue-slides.html");
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
  await page.evaluate(() => window.vueSlides.resolveLazy!());
  expect(await landed).toBe(true);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(`${shown} [data-test="lazy-card"]`)).toBeVisible();
});

test("a slide reads its index and its origin live", async ({ page }) => {
  await load(page);
  await page.evaluate(() => window.vueSlides.openGate!());
  // An item put before the one on show keeps its slide, at the next index.
  await page.locator('#held [data-item="held-a"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  const index = (id: string) =>
    page.evaluate((id) => window.vueSlides.held.findLast((slide) => slide.id === id)!.read(), id);
  expect(await index("held-a")).toBe(0);
  const count = await page.evaluate(() => window.vueSlides.held.length);
  await page.evaluate(() =>
    window.vueSlides.setHeldItems!([
      { type: "held", id: "held-new", title: "held new", width: 800, height: 600 },
      { type: "held", id: "held-a", title: "held held-a", width: 800, height: 600 },
      { type: "held", id: "held-b", title: "held held-b", width: 800, height: 600 },
    ]),
  );
  await expect(page.locator(`${shown} [data-test="held-card"]`)).toHaveText("held held-a at 1");
  expect(await index("held-a")).toBe(1);
  expect(
    await page.evaluate(
      (count) => window.vueSlides.held.slice(0, count).some((slide) => slide.id === "held-a"),
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
      const origin = window.vueSlides.reels.find((reel) => reel.index === 0)!.read();
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
  await page.evaluate(() => window.vueSlides.openGate!());
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

test("a Root mounted again, as a re-created view is, opens and closes as before", async ({
  page,
}) => {
  await load(page);
  const trigger = page.locator('#builtin [data-item="one"]');
  await trigger.click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  // Unmounting drops the open viewer; the new Root makes its own on the next open.
  await page.evaluate(() => window.vueSlides.remount!());
  await expect(page.locator(dialog)).toHaveCount(0);
  await page.locator('#builtin [data-item="two"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 2");
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  await expect(page.locator('#builtin [data-item="two"]')).toBeFocused();
});

test("the parts draw the viewer's controls, caption and error, with labels as text or as names", async ({
  page,
}) => {
  await load(page);
  await page.locator('#parts [data-item="caption"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  const toolbar = page.locator(`${dialog} [data-fluidbox-toolbar]`);
  await expect(toolbar).toHaveAttribute("role", "group");
  const counter = toolbar.locator("[data-fluidbox-counter]");
  await expect(counter).toHaveText("1 / 2");
  await expect(counter).toHaveAttribute("aria-hidden", "true");
  const download = toolbar.locator("a[data-fluidbox-download]");
  await expect(download).toHaveText("Download");
  await expect(download).toHaveAttribute("data-fluidbox-default", "");
  await expect(download).toHaveAttribute("href", "/photo-square.svg");
  await expect(toolbar.locator("[data-fluidbox-share]")).toHaveText("Share");
  const close = toolbar.locator("[data-fluidbox-close]");
  await expect(close).toHaveAttribute("aria-label", "Close");
  await expect(close).not.toHaveAttribute("data-fluidbox-default");
  await expect(close.locator('[data-test="close-icon"]')).toHaveCount(1);
  // label false: named by its text.
  const previous = page.locator(`${dialog} [data-fluidbox-previous]`);
  await expect(previous).toHaveText("Back");
  await expect(previous).not.toHaveAttribute("aria-label");
  await expect(previous).toBeDisabled();
  await expect(page.locator(`${dialog} [data-test="caption"]`)).toHaveText("A square, captioned");
  await expect(page.locator(`${dialog} [data-test="caption"]`)).toHaveAttribute(
    "data-fluidbox-description",
    "",
  );

  await page.locator(`${dialog} [data-fluidbox-next]`).click();
  await expect(counter).toHaveText("2 / 2");
  await expect(page.locator(`${dialog} [data-test="caption"]`)).toHaveCount(0);
  // The error of your own replaces the default one, with a Retry that loads it again.
  const error = page.locator(`${dialog} [data-test="error"]`);
  await expect(error).toHaveText(/broken didn't load\./);
  await expect.poll(() => page.evaluate(() => window.vueSlides.mediaErrors())).toBe(1);
  // The fixture leaves the parts unstyled, so the button may sit outside the view.
  await error
    .locator('[data-test="retry"]')
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect.poll(() => page.evaluate(() => window.vueSlides.mediaErrors())).toBe(2);
  await expect(error.locator('[data-test="retry"]')).toHaveText("Retry");
});

test("a move canceled in @value-change never reaches the v-model", async ({ page, isMobile }) => {
  test.skip(isMobile, "The swipe is a horizontal wheel, as on a trackpad.");
  await load(page);
  const model = () => page.evaluate(() => window.vueSlides.model());
  await page.locator('#guarded [data-item="one"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  expect(await model()).toBe("one");
  const slides = page.locator("[data-fluidbox-slides]");
  await slides.hover();
  await page.mouse.wheel(900, 0);
  await page.waitForTimeout(800);
  await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 1 of 2");
  expect(await model()).toBe("one");
  // A move it lets through reaches the model, and the viewer stays where it went.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 2");
  await expect.poll(model).toBe("two");
  await page.waitForTimeout(400);
  await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 2");
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  await expect.poll(model).toBeNull();
});
