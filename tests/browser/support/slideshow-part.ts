import { expect, type Page } from "@playwright/test";

const dialog = "[data-fluidbox-dialog]";

/**
 * Open the viewer from `grid` and check its two Slideshow parts, one with no
 * content (`data-test="slideshow-text"`) and one with an icon
 * (`data-test="slideshow-icon"`): each plays and pauses, and is named for what
 * it does next, by its text or its `aria-label`.
 */
export async function expectSlideshowPart(page: Page, grid: string) {
  await page.locator(`${grid} [data-item]`).first().click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  const text = page.locator(`${dialog} [data-test="slideshow-text"]`);
  const icon = page.locator(`${dialog} [data-test="slideshow-icon"]`);
  for (const part of [text, icon]) {
    await expect(part).toHaveAttribute("data-fluidbox-slideshow", "");
    await expect(part).toHaveAttribute("data-fluidbox-managed", "");
    await expect(part).toHaveAttribute("type", "button");
    await expect(part).toBeVisible();
    await expect(part).not.toHaveAttribute("data-active");
  }
  await expect(text).toHaveText("Play slideshow");
  await expect(text).toHaveAttribute("data-fluidbox-default", "");
  await expect(text).not.toHaveAttribute("aria-label");
  await expect(icon).toHaveAttribute("aria-label", "Play slideshow");
  await expect(icon).not.toHaveAttribute("data-fluidbox-default");
  await expect(icon.locator("svg")).toHaveCount(1);

  // By keyboard: the baseline lays both out in the same slot of the toolbar.
  await text.focus();
  await page.keyboard.press("Enter");
  await expect(text).toHaveText("Pause slideshow");
  await expect(icon).toHaveAttribute("aria-label", "Pause slideshow");
  for (const part of [text, icon]) await expect(part).toHaveAttribute("data-active", "");
  // Its own key press isn't the input that pauses it.
  await page.waitForTimeout(100);
  await expect(text).toHaveText("Pause slideshow");

  await icon.focus();
  await page.keyboard.press("Space");
  await expect(text).toHaveText("Play slideshow");
  await expect(icon).toHaveAttribute("aria-label", "Play slideshow");
  for (const part of [text, icon]) await expect(part).not.toHaveAttribute("data-active");
}
