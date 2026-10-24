import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    reactSlides: {
      resolveLazy?: () => void;
      openGate?: () => void;
      reels: { index: number; read: () => { video?: { currentTime: number } } | null }[];
      heldIndexes: number[];
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
