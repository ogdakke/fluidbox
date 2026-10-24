import { expect, test, type Page } from "@playwright/test";
import type { Fluidbox } from "@ogdakke/fluidbox";

// baseline.css lays Full screen, Download, Share, Slideshow and the counter out
// in a row along the top. A control that hides there, as Download does for an
// item without a file, leaves no hole: the ones after it close up.

const order = ["fullscreen", "download", "share", "slideshow", "counter"];
const controls = "previous,next,close,counter,share,download,fullscreen";
// The fixture's stage insets, on the dialog.
const stage = { left: 32, right: 32 };

async function row(page: Page) {
  return page.evaluate((order) => {
    const shown: { name: string; left: number; right: number; top: number }[] = [];
    for (const name of order) {
      const control = document.querySelector<HTMLElement>(`[data-fluidbox-${name}]`);
      if (!control || control.hidden) continue;
      const box = control.getBoundingClientRect();
      shown.push({ name, left: box.left, right: innerWidth - box.right, top: box.top });
    }
    return shown;
  }, order);
}

for (const rtl of [false, true]) {
  test(`hidden top-bar controls leave no gap${rtl ? ", right to left" : ""}`, async ({ page }) => {
    await page.goto(`/resets.html?controls=${controls}${rtl ? "&rtl" : ""}`);
    await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
    await page.locator('[data-item="square"]').click();
    const dialog = page.locator("[data-fluidbox-dialog]");
    await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator("[data-fluidbox-viewer]")).toHaveAttribute(
      "dir",
      rtl ? "rtl" : "ltr",
    );

    const side = rtl ? "right" : "left";
    const expectRow = (shown: Awaited<ReturnType<typeof row>>) => {
      // In the order of the names, not of the controls option, 40px apart from the corner.
      expect(shown.map(({ name }) => name)).toEqual(
        order.filter((name) => shown.some((each) => each.name === name)),
      );
      shown.forEach((control, index) => {
        expect(control[side], `${control.name} ${side}`).toBeCloseTo(
          stage[side] + 16 + index * 40,
          0,
        );
        expect(control.top).toBe(shown[0]!.top);
      });
    };

    const withFile = await row(page);
    expect(withFile.map(({ name }) => name)).toContain("download");
    expect(withFile.map(({ name }) => name)).toContain("counter");
    expectRow(withFile);

    // The portrait has download: false, so Download hides.
    await page.evaluate(() => window.resetsFixture.fluidbox.open("portrait"));
    await expect(page.locator("[data-fluidbox-download]")).toBeHidden();
    const without = await row(page);
    expect(without.map(({ name }) => name)).not.toContain("download");
    expect(without).toHaveLength(withFile.length - 1);
    expectRow(without);
    const after = withFile.findIndex(({ name }) => name === "download");
    // Everything after Download moved one place toward the corner.
    for (const control of withFile.slice(after + 1)) {
      const moved = without.find(({ name }) => name === control.name)!;
      expect(control[side] - moved[side]).toBeCloseTo(40, 0);
    }
  });
}

declare global {
  interface Window {
    resetsFixture: { fluidbox: Fluidbox };
  }
}
