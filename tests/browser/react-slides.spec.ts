import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    reactSlides: {
      resolveLazy?: () => void;
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

async function load(page: Page) {
  await page.goto("/react-slides.html");
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
  await page.evaluate(() => window.reactSlides.resolveLazy!());
  expect(await landed).toBe(true);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(`${shown} [data-test="lazy-card"]`)).toBeVisible();
});

test("a slide reads its index and its origin live", async ({ page }) => {
  await load(page);
  await page.evaluate(() => window.reactSlides.openGate!());
  // An item put before the one on show keeps its slide, at the next index.
  await page.locator('#held [data-item="held-a"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  const index = (id: string) =>
    page.evaluate((id) => window.reactSlides.held.findLast((slide) => slide.id === id)!.read(), id);
  expect(await index("held-a")).toBe(0);
  const count = await page.evaluate(() => window.reactSlides.held.length);
  await page.evaluate(() =>
    window.reactSlides.setHeldItems!([
      { type: "held", id: "held-new", title: "held new", width: 800, height: 600 },
      { type: "held", id: "held-a", title: "held held-a", width: 800, height: 600 },
      { type: "held", id: "held-b", title: "held held-b", width: 800, height: 600 },
    ]),
  );
  await expect(page.locator(`${shown} [data-test="held-card"]`)).toHaveText("held held-a at 1");
  expect(await index("held-a")).toBe(1);
  expect(
    await page.evaluate(
      (count) => window.reactSlides.held.slice(0, count).some((slide) => slide.id === "held-a"),
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
      const origin = window.reactSlides.reels.find((reel) => reel.index === 0)!.read();
      return origin?.video?.currentTime ?? null;
    });
  expect(await origin()).toBeNull();
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  await page.locator('#reels [data-item="reel-a"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  expect(await origin()).toBeGreaterThan(0);
});
