import { expect, test, type Page } from "@playwright/test";

const dialog = (page: Page) => page.locator("[data-lightbox-dialog]");

test.describe("sheet on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the X reply count raises the replies sheet, and Escape and close lower it", async ({
    page,
  }) => {
    await page.goto("/social.html");
    await page.locator(".x-grid button").first().click();
    await expect(page.locator("[data-lightbox-overlay]")).toHaveAttribute(
      "data-lightbox-state",
      "open",
    );
    await expect(dialog(page)).toHaveAttribute("data-sheet", "photo");

    const trigger = page.locator(".x-phone [data-lightbox-sheet-stop]");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(dialog(page)).toHaveAttribute("data-sheet", "info");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Once the sheet settles, the photo fits into the room above it.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const media = document
            .querySelector('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]')!
            .getBoundingClientRect();
          return Math.round(
            media.bottom - document.querySelector(".x-sheet")!.getBoundingClientRect().top,
          );
        }),
      )
      .toBeLessThanOrEqual(1);

    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveAttribute("data-sheet", "photo");
    await expect(page.locator("[data-lightbox-overlay]")).toHaveAttribute(
      "data-lightbox-state",
      "open",
    );

    await trigger.click();
    await expect(dialog(page)).toHaveAttribute("data-sheet", "info");
    await page.locator("[data-lightbox-close]").click();
    await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(0);
  });

  test("the Instagram caption peeks and View all raises the comments", async ({ page }) => {
    await page.goto("/social.html");
    await page.locator(".ig-grid").scrollIntoViewIfNeeded();
    await page.locator(".ig-grid button").first().click();
    await expect(dialog(page)).toHaveAttribute("data-sheet", "photo");
    await expect(page.locator(".ig-sheet")).toBeVisible();

    await page.locator(".ig-more").click();
    await expect(dialog(page)).toHaveAttribute("data-sheet", "full");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveAttribute("data-sheet", "photo");
  });
});

test.describe("sheet on a wide screen", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the X viewer keeps its sidebar and hides the sheet", async ({ page }) => {
    await page.goto("/social.html");
    await page.locator(".x-grid button").first().click();
    await expect(page.locator("[data-lightbox-overlay]")).toHaveAttribute(
      "data-lightbox-state",
      "open",
    );
    await expect(page.locator(".x-aside")).toBeVisible();
    await expect(page.locator(".x-sheet")).toBeHidden();
  });
});
