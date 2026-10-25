import { expect, test } from "@playwright/test";

/**
 * Each binding's reachend handler, on a gallery that appends four photos as
 * the viewer comes within one item of its end (`reachEndThreshold` 1).
 */

declare global {
  interface Window {
    reachEnds: [string, number, number][];
  }
}

const bindings = [
  ["React", "/react-slides.html"],
  ["Vue", "/vue-slides.html"],
  ["Solid", "/solid-slides.html"],
  ["Angular", "/angular-slides.html"],
  ["custom elements", "/elements-slides.html"],
] as const;

for (const [binding, url] of bindings) {
  test(`${binding}: the reachend handler fires near the end, and the gallery grows under the open viewer`, async ({
    page,
  }) => {
    await page.goto(url);
    const triggers = page.locator("#growing [data-item]");
    await expect(triggers).toHaveCount(4);
    await triggers.first().click();
    const dialog = page.locator("[data-fluidbox-dialog]");
    await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
    const shown = dialog.locator(
      '[data-fluidbox-slide][aria-hidden="false"] img[data-fluidbox-media]',
    );
    const reachEnds = () => page.evaluate(() => window.reachEnds);

    // Two from the end, which the default threshold of 2 would count; 1 doesn't.
    await page.keyboard.press("ArrowRight");
    await expect(shown).toHaveAttribute("alt", "Photo grow-1");
    expect(await reachEnds()).toEqual([]);

    await page.keyboard.press("ArrowRight");
    await expect(shown).toHaveAttribute("alt", "Photo grow-2");
    await expect.poll(reachEnds).toEqual([["grow-2", 2, 4]]);
    // The new photos arrive under the open viewer, which stays on its photo.
    await expect(triggers).toHaveCount(8);
    await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
    await expect(shown).toHaveAttribute("alt", "Photo grow-2");

    for (let index = 3; index <= 6; index++) {
      await page.keyboard.press("ArrowRight");
      await expect(shown).toHaveAttribute("alt", `Photo grow-${index}`);
    }
    await expect.poll(reachEnds).toEqual([
      ["grow-2", 2, 4],
      ["grow-6", 6, 8],
    ]);
    await expect(triggers).toHaveCount(12);
  });
}
