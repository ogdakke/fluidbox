import { expect, test } from "@playwright/test";

test.use({ video: "on", trace: "on" });
// Chromium, desktop WebKit and Pixel 7.
test.skip(
  ({ browserName, isMobile }) =>
    browserName === "firefox" || (browserName === "webkit" && isMobile),
  "One engine per input family keeps the committed visual baselines small.",
);

test("collapsed gallery visual checkpoints", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });

  const load = async () => {
    await page.goto("/collapsed.html");
    await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  };
  const freezeOpening = async (withTravelLayer: boolean) => {
    await page.evaluate(async (withTravelLayer) => {
      for (let attempt = 0; attempt < 30; attempt++) {
        const frame = document.querySelector<HTMLElement>(
          '[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-frame]',
        );
        const layer = document.querySelector<HTMLElement>("[data-fluidbox-travel-layer]");
        if (
          document.querySelector('[data-fluidbox-dialog][data-fluidbox-status="opening"]') &&
          frame?.getAnimations().some((animation) => animation.playState === "running") &&
          (!withTravelLayer ||
            layer?.getAnimations().some((animation) => animation.playState === "running"))
        ) {
          const animations = document.getAnimations();
          if (animations.length) {
            for (const animation of animations) {
              animation.pause();
              animation.currentTime = 100;
            }
            return;
          }
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      throw new Error("Opening motion did not start");
    }, withTravelLayer);
  };

  await load();
  await expect(page.locator("#collapsed-gallery")).toHaveScreenshot("collapsed-closed-gallery.png");

  await page
    .locator("#collapsed-gallery fluidbox-item")
    .first()
    .locator('[slot="trigger"]')
    .click();
  await freezeOpening(false);
  expect(await page.screenshot({ animations: "allow" })).toMatchSnapshot(
    "collapsed-first-opening-100ms.png",
    { threshold: 0.01, maxDiffPixelRatio: 0.001 },
  );

  await load();
  await page.locator("#collapsed-gallery [data-preview-more] [slot=trigger]").click();
  await freezeOpening(true);
  expect(await page.screenshot({ animations: "allow" })).toMatchSnapshot(
    "collapsed-teaser-opening-100ms.png",
    { threshold: 0.01, maxDiffPixelRatio: 0.001 },
  );

  await load();
  await page.locator("#collapsed-gallery [data-preview-more] [slot=trigger]").click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 4 of 10",
  );
  await page.evaluate(async () => {
    const strip = document.querySelector<HTMLElement>("[data-fluidbox-slides]")!;
    let previous = strip.scrollLeft;
    let stableFrames = 0;
    for (let frame = 0; frame < 90; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const current = strip.scrollLeft;
      stableFrames = Math.abs(current - previous) < 0.01 ? stableFrames + 1 : 0;
      if (stableFrames >= 4) return;
      previous = current;
    }
    throw new Error("The native gallery scroll did not settle");
  });
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const flight = document.querySelector<HTMLElement>("[data-fluidbox-flight]");
      const layer = flight?.querySelector<HTMLElement>("[data-fluidbox-travel-layer]");
      if (flight && layer?.getAnimations().some((animation) => animation.playState === "running")) {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 100;
        }
        return;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    throw new Error("The hidden item close flight did not start");
  });
  expect(await page.screenshot({ animations: "allow" })).toMatchSnapshot(
    "collapsed-hidden-closing-100ms.png",
    { threshold: 0.01, maxDiffPixelRatio: 0.001 },
  );
});
