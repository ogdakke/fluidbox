import { expect, test } from "@playwright/test";

test("plain runtime opens, navigates, composes controls, and closes without custom elements", async ({
  page,
}) => {
  await page.goto("/headless.html");

  await expect
    .poll(() => page.evaluate(() => customElements.get("app-lightbox") === undefined))
    .toBe(true);
  const first = page.locator('[data-photo-id="one"]');
  await first.click();

  const overlay = page.locator("[data-lightbox-overlay]");
  await expect(overlay).toHaveAttribute("data-lightbox-state", "open");
  await expect(page.locator("[data-lightbox-media]")).toHaveAttribute("alt", "Blue square study");
  await expect(page.locator("[data-demo-caption]")).toHaveText("one");

  await page.locator("[data-demo-next]").click();
  await expect(page.locator("[data-demo-caption]")).toHaveText("two");
  await expect(page.locator("[data-lightbox-media]")).toHaveAttribute(
    "alt",
    "Orange portrait study",
  );

  await page.locator("[data-demo-close]").click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="two"]')).toBeFocused();
});
