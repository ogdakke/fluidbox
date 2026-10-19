import { expect, test, type Page } from "@playwright/test";
import { holdMotion } from "./support/hold-motion";

/**
 * What every binding does live: a travelling overlay's frame layer flies as
 * itself, and labels and the viewer part change an open viewer in place.
 * The fixture is binding-live.html; see fixtures/binding-live/shared.ts.
 */
const frameworks = ["react", "solid", "vue", "angular", "javascript", "elements"] as const;

declare global {
  interface Window {
    /** Set by the specs: whether a ghost of the frame layer was ever on the cover. */
    __ghostSeen?: boolean;
  }
  interface Element {
    __liveOriginal?: boolean;
  }
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function load(page: Page, framework: string) {
  await page.goto(`/binding-live.html?framework=${framework}`);
  await expect(page.locator("html")).toHaveAttribute("data-live-ready", "");
}

async function openViewer(page: Page) {
  await page.locator('[data-test="trigger"]').click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  // Tag the dialog, so a test can tell it is the same element later.
  await dialog.evaluate((element) => (element.__liveOriginal = true));
  return dialog;
}

/** Where the frame layer is, during a flight or at rest. */
function readLayer() {
  const layers = [...document.querySelectorAll<HTMLElement>('[data-test="layer"]')];
  const shown = layers.filter(
    (layer) =>
      !layer.hasAttribute("data-fluidbox-ghost") && getComputedStyle(layer).display !== "none",
  );
  const original = layers.find((layer) => layer.__liveOriginal);
  const overlay = document.querySelector('[data-test="count"]')!;
  return {
    shown: shown.length,
    originalShown: !!original && shown.includes(original),
    // The opening flies the slide's own frame; a close may fly a copy of it.
    inFrame: !!original?.parentElement?.matches("[data-fluidbox-frame]"),
    inOverlay: !!original && overlay.contains(original),
    ghosts: document.querySelectorAll('[data-test="layer"][data-fluidbox-ghost]').length,
  };
}

for (const framework of frameworks) {
  test.describe(framework, () => {
    test("a frame layer flies as itself and comes back to its overlay", async ({ page }) => {
      const errors = watchErrors(page);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await load(page, framework);
      const trigger = page.locator('[data-test="trigger"]');
      await page.evaluate(() => {
        const layer = document.querySelector('[data-test="count"] [data-test="layer"]')!;
        layer.__liveOriginal = true;
        // The ghost only stays until the flight first paints over the card.
        window.__ghostSeen = false;
        const trigger = document.querySelector('[data-test="trigger"]')!;
        new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (
                node instanceof HTMLElement &&
                node.matches('[data-test="layer"][data-fluidbox-ghost]')
              )
                window.__ghostSeen = true;
            }
          }
        }).observe(trigger, { childList: true, subtree: true });
      });
      expect(await page.evaluate(readLayer)).toMatchObject({
        shown: 1,
        originalShown: true,
        inOverlay: true,
        ghosts: 0,
      });

      // Opening: the layer is in the flying frame, once, and a ghost holds the card.
      await holdMotion(page);
      await trigger.click();
      await page.evaluate(() => window.__motion.ready());
      expect(await page.evaluate(readLayer)).toMatchObject({
        shown: 1,
        originalShown: true,
        inFrame: true,
        inOverlay: false,
      });
      expect(await page.evaluate(() => window.__ghostSeen)).toBe(true);
      await page.evaluate(() => window.__motion.release());
      const dialog = page.locator("[data-fluidbox-dialog]");
      await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");

      // Closing: in the frame again, still once.
      await holdMotion(page);
      await page.keyboard.press("Escape");
      await page.evaluate(() => window.__motion.ready());
      expect(await page.evaluate(readLayer)).toMatchObject({
        shown: 1,
        originalShown: true,
        inFrame: true,
        inOverlay: false,
      });
      await page.evaluate(() => window.__motion.release());
      await expect(dialog).toHaveCount(0);
      await expect(page.locator("[data-fluidbox-flight]")).toHaveCount(0);

      expect(await page.evaluate(readLayer)).toMatchObject({
        shown: 1,
        originalShown: true,
        inFrame: false,
        inOverlay: true,
        ghosts: 0,
      });
      expect(errors).toEqual([]);
    });

    test("new labels relabel the open viewer without closing it", async ({ page }) => {
      const errors = watchErrors(page);
      await load(page, framework);
      const dialog = await openViewer(page);
      const close = page.locator("[data-fluidbox-close]");
      await expect(close).toHaveAttribute("aria-label", "Close");

      await page.evaluate(() =>
        window.__live.setLabels({ close: "Sulje", previous: "Edellinen", next: "Seuraava" }),
      );
      await expect(close).toHaveAttribute("aria-label", "Sulje");
      await expect(page.locator("[data-fluidbox-next]")).toHaveAttribute("aria-label", "Seuraava");
      await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
      expect(await dialog.evaluate((element) => element.__liveOriginal)).toBe(true);

      await page.evaluate(() => window.__live.setLabels(undefined));
      await expect(close).toHaveAttribute("aria-label", "Close");
      await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
      expect(await dialog.evaluate((element) => element.__liveOriginal)).toBe(true);

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test("a viewer part added or removed while open swaps the content in place", async ({
      page,
    }) => {
      const errors = watchErrors(page);
      await load(page, framework);
      const dialog = await openViewer(page);
      const custom = page.locator('[data-test="custom-viewer"]');
      const close = page.locator("[data-fluidbox-close]");
      await expect(close).toHaveCount(1);
      await expect(custom).toHaveCount(0);

      await page.evaluate(() => window.__live.setViewer(true));
      await expect(custom).toHaveCount(1);
      await expect(custom).toHaveText("Custom viewer");
      await expect(custom).toBeVisible();
      await expect(close).toHaveCount(0);
      await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
      expect(await dialog.evaluate((element) => element.__liveOriginal)).toBe(true);

      await page.evaluate(() => window.__live.setViewer(false));
      await expect(custom).toHaveCount(0);
      await expect(close).toHaveCount(1);
      await expect(close).toBeVisible();
      await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
      expect(await dialog.evaluate((element) => element.__liveOriginal)).toBe(true);

      // And back on, so a second mount works too.
      await page.evaluate(() => window.__live.setViewer(true));
      await expect(custom).toHaveCount(1);
      await expect(close).toHaveCount(0);
      await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
}
