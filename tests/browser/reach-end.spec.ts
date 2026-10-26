import { expect, test, type Page } from "@playwright/test";

/**
 * Each binding's reachend handler, on the gallery of fixtures/growing.ts:
 * four photos, four more on each reachend while it grows.
 */

const bindings = [
  ["React", "/react-slides.html"],
  ["Vue", "/vue-slides.html"],
  ["Solid", "/solid-slides.html"],
  ["Angular", "/angular-slides.html"],
  ["custom elements", "/elements-slides.html"],
] as const;

const reachEnds = (page: Page) => page.evaluate(() => window.growth.reachEnds);

for (const [binding, url] of bindings) {
  test(`${binding}: reachend fires near the end once per count, as the gallery grows and shrinks under the open viewer`, async ({
    page,
  }) => {
    await page.goto(url);
    const triggers = page.locator("#growing [data-item]");
    await expect(triggers).toHaveCount(4);
    const dialog = page.locator("[data-fluidbox-dialog]");
    const shown = dialog.locator(
      '[data-fluidbox-slide][aria-hidden="false"] img[data-fluidbox-media]',
    );
    const go = async (index: number) => {
      await page.keyboard.press(
        (await shown.getAttribute("alt"))! < `Photo grow-${index}` ? "ArrowRight" : "ArrowLeft",
      );
      await expect(shown).toHaveAttribute("alt", `Photo grow-${index}`);
    };

    // A threshold changed after mount: 2 counts the second of four.
    await page.evaluate(() => window.growth.setThreshold(2));
    await triggers.first().click();
    await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
    expect(await reachEnds(page)).toEqual([]);
    await go(1);
    await expect.poll(() => reachEnds(page)).toEqual([["grow-1", 1, 4]]);
    // The new photos arrive under the open viewer, which stays on its photo.
    await expect(triggers).toHaveCount(8);
    await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
    await expect(shown).toHaveAttribute("alt", "Photo grow-1");

    // Back to 1, and the gallery stops growing: once per count.
    await page.evaluate(() => {
      window.growth.setThreshold(1);
      window.growth.grows = false;
    });
    for (const index of [2, 3, 4, 5]) await go(index);
    expect(await reachEnds(page)).toHaveLength(1);
    await go(6);
    await expect.poll(() => reachEnds(page)).toHaveLength(2);
    for (const index of [7, 6, 7]) await go(index);
    await page.waitForTimeout(300);
    expect(await reachEnds(page)).toEqual([
      ["grow-1", 1, 4],
      ["grow-6", 6, 8],
    ]);

    // Fewer photos re-arm it, and back to eight again.
    await page.evaluate(() => window.growth.setCount(4));
    await expect(shown).toHaveAttribute("alt", "Photo grow-3");
    await expect.poll(() => reachEnds(page)).toHaveLength(3);
    await page.evaluate(() => window.growth.setCount(8));
    await expect(triggers).toHaveCount(8);
    for (const index of [4, 5, 6]) await go(index);
    await expect
      .poll(() => reachEnds(page))
      .toEqual([
        ["grow-1", 1, 4],
        ["grow-6", 6, 8],
        ["grow-3", 3, 4],
        ["grow-6", 6, 8],
      ]);
  });
}
