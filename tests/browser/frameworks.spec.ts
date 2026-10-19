import { expect, test } from "@playwright/test";
import { holdMotion } from "./support/hold-motion";

test("the overview page mounts its gallery and opens a viewer", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  const opener = page.locator("#mosaic fluidbox-item [slot=trigger]").first();
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

// Every binding updates the album cover before the close flight measures it,
// so the flight lands on the photo the viewer last showed, with its badge.
for (const framework of ["elements", "javascript", "react", "solid", "vue", "angular"]) {
  test(`${framework}: a shared trigger closes to its current preview`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`/${framework}/`);
    await expect(page.locator("html")).toHaveAttribute("data-patterns-ready", "");
    const root = page.locator('[data-pattern="overlay"]');
    const trigger = root.locator('[data-test="trigger"]');
    const preview = root.locator('[data-test="preview"]');
    await expect(preview).toHaveAttribute("src", /\/art\/dune\.svg$/);
    await trigger.click();
    const dialog = page.locator("[data-fluidbox-dialog]");
    await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      "Item 2 of 5",
    );
    await holdMotion(page);
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.__motion.ready());
    await expect(page.locator("[data-fluidbox-flight]")).toHaveCount(1);
    await expect(preview).toHaveAttribute("src", /\/art\/canyon\.svg$/);
    const landing = await page.evaluate(() => {
      const root = document.querySelector('[data-pattern="overlay"]')!;
      const cover = root.querySelector<HTMLElement>('[data-test="preview"]')!;
      const badge = root.querySelector<HTMLElement>('[data-test="count"]')!;
      const frame = document.querySelector<HTMLElement>(
        "[data-fluidbox-flight] [data-fluidbox-frame]",
      )!;
      for (const animation of document.getAnimations()) {
        animation.pause();
        const duration = Number(animation.effect?.getTiming().duration) || 0;
        animation.currentTime = Math.max(0, duration - 1);
      }
      const origin = cover.getBoundingClientRect();
      const flight = frame.getBoundingClientRect();
      return {
        origin: { width: origin.width, height: origin.height },
        flight: { width: flight.width, height: flight.height },
        badgeProgress: Number(getComputedStyle(badge).getPropertyValue("--fluidbox-closed")),
      };
    });
    expect(landing.origin.height).toBeGreaterThan(0);
    expect(landing.flight.width).toBeCloseTo(landing.origin.width, 0);
    expect(landing.flight.height).toBeCloseTo(landing.origin.height, 0);
    expect(landing.badgeProgress).toBeGreaterThan(0.9);
    await page.evaluate(() => window.__motion.release());
    await expect(dialog).toHaveCount(0);
  });
}
