import { expect, test, type Page } from "@playwright/test";
import type { FluidboxGalleryElement } from "@ogdakke/fluidbox/elements";

const dialog = (page: Page) => page.locator("[data-fluidbox-dialog]");
const activeSlide = (page: Page) => page.locator('[data-fluidbox-slide][aria-hidden="false"]');
const expectSlide = (page: Page, label: string) =>
  expect(activeSlide(page)).toHaveAttribute("aria-label", label);

/** How far the slide on show sits from the strip's box: 0 once it has come to rest there. */
const offset = (page: Page) =>
  page.locator("[data-fluidbox-slides]").evaluate((element) => {
    const active = element.querySelector('[data-fluidbox-slide][aria-hidden="false"]')!;
    return Math.abs(active.getBoundingClientRect().left - element.getBoundingClientRect().left);
  });

async function openFirst(page: Page, query: string) {
  await page.goto(`/harness.html?count=4&loop${query}`);
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  await page.locator('[data-test-index="0"] [slot="trigger"]').click();
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
  await expectSlide(page, "Item 1 of 4");
}

for (const direction of ["ltr", "rtl"] as const) {
  test.describe(`a looping gallery, ${direction}`, () => {
    const query = direction === "rtl" ? "&rtl" : "";
    const back = direction === "rtl" ? "ArrowRight" : "ArrowLeft";
    const forward = direction === "rtl" ? "ArrowLeft" : "ArrowRight";

    test("goes round by key, button and swipe", async ({ page }, testInfo) => {
      await openFirst(page, query);
      const previous = dialog(page).locator("[data-fluidbox-previous]");
      const next = dialog(page).locator("[data-fluidbox-next]");
      await expect(previous).toBeEnabled();
      await page.keyboard.press(back);
      await expectSlide(page, "Item 4 of 4");
      await expect.poll(() => offset(page)).toBeLessThan(2);
      await expect(next).toBeEnabled();
      await next.click();
      await expectSlide(page, "Item 1 of 4");
      await previous.click();
      await expectSlide(page, "Item 4 of 4");
      await page.keyboard.press(forward);
      await expectSlide(page, "Item 1 of 4");
      // Once round the whole way, past the window the strip renders at a time.
      for (let step = 0; step < 4 * 5; step++) await page.keyboard.press(forward);
      await expectSlide(page, "Item 1 of 4");
      await expect.poll(() => offset(page)).toBeLessThan(2);
      if (!testInfo.project.use.isMobile) {
        // A swipe back from the first item lands on the last.
        await page.locator("[data-fluidbox-slides]").hover();
        await page.mouse.wheel(direction === "rtl" ? 900 : -900, 0);
        await expectSlide(page, "Item 4 of 4");
        await expect.poll(() => offset(page)).toBeLessThan(2);
      }
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toHaveCount(0);
    });

    test("the thumbnails goes round too", async ({ page }) => {
      await openFirst(page, query);
      const selected = dialog(page).locator("[data-fluidbox-thumbnails-item][aria-selected=true]");
      await expect(selected).toHaveAttribute("data-index", "0");
      await selected.focus();
      await page.keyboard.press(back);
      await expect(selected).toHaveAttribute("data-index", "3");
      await expectSlide(page, "Item 4 of 4");
      await page.keyboard.press(forward);
      await expect(selected).toHaveAttribute("data-index", "0");
    });
  });
}

test("a veto holds across the seam", async ({ page }) => {
  await openFirst(page, "");
  await page.evaluate(() => {
    const gallery = document.querySelector<FluidboxGalleryElement>("fluidbox-gallery")!;
    gallery.addEventListener("beforevaluechange", (event) => {
      if (event.action === "move") event.preventDefault();
    });
  });
  await page.keyboard.press("ArrowLeft");
  await dialog(page).locator("[data-fluidbox-previous]").click();
  await expectSlide(page, "Item 1 of 4");
  await expect.poll(() => offset(page)).toBeLessThan(2);
});

test("loop turns off in place, and a single item never loops", async ({ page }) => {
  await openFirst(page, "");
  const previous = dialog(page).locator("[data-fluidbox-previous]");
  await expect(previous).toBeEnabled();
  await page.evaluate(() => document.querySelector("fluidbox-gallery")!.removeAttribute("loop"));
  await expect(previous).toBeDisabled();
  await expectSlide(page, "Item 1 of 4");
  await expect.poll(() => offset(page)).toBeLessThan(2);
  await page.keyboard.press("ArrowLeft");
  await expectSlide(page, "Item 1 of 4");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);

  await page.goto("/harness.html?count=1&loop");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  await page.locator('[data-test-index="0"] [slot="trigger"]').click();
  await expectSlide(page, "Item 1 of 1");
  await expect(dialog(page).locator("[data-fluidbox-next]")).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await expectSlide(page, "Item 1 of 1");
});

test("turning loop on and off keeps the open slide, and its iframe loaded", async ({ page }) => {
  await page.goto("/elements-slides.html");
  await page.waitForFunction(() => customElements.get("fluidbox-gallery") !== undefined);
  const loads = () => page.evaluate(() => (window as { frameLoads?: number }).frameLoads);
  // The last item: a frame that counts its loads.
  await page.locator('button[data-test="frame"]').click();
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
  await expectSlide(page, "Item 4 of 4");
  await expect.poll(loads).toBe(1);
  await activeSlide(page).evaluate((slide) => (slide.dataset.kept = ""));
  const next = dialog(page).locator("[data-fluidbox-next]");
  const gallery = page.locator("#media");
  const setLoop = (loop: boolean) =>
    gallery.evaluate((element, loop) => element.toggleAttribute("loop", loop), loop);

  await setLoop(true);
  await expect(next).toBeEnabled();
  await expect(activeSlide(page)).toHaveAttribute("data-kept", "");
  await expect.poll(() => offset(page)).toBeLessThan(2);
  // Round to the first item and back.
  await page.keyboard.press("ArrowRight");
  await expectSlide(page, "Item 1 of 4");
  await page.keyboard.press("ArrowLeft");
  await expectSlide(page, "Item 4 of 4");

  await setLoop(false);
  await expect(next).toBeDisabled();
  await expect(activeSlide(page)).toHaveAttribute("data-kept", "");
  await expect.poll(() => offset(page)).toBeLessThan(2);
  await setLoop(true);
  await expect(next).toBeEnabled();
  await expect(activeSlide(page)).toHaveAttribute("data-kept", "");
  await page.waitForTimeout(300);
  expect(await loads()).toBe(1);
});
