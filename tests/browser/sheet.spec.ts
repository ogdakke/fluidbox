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

test.describe("zoom under stage insets", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const zoomedEdges = (page: Page) =>
    page.evaluate(() => {
      const viewport = document
        .querySelector("[data-lightbox-zoom-viewport]")!
        .getBoundingClientRect();
      return { viewportBottom: Math.round(viewport.bottom), height: innerHeight };
    });

  async function zoomIn(page: Page) {
    await page.goto("/social.html");
    await page.locator(".x-grid button").first().click();
    await expect(dialog(page)).toHaveAttribute("data-lightbox-state", "open");
    await page
      .locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]')
      .dblclick();
    await expect(dialog(page)).toHaveAttribute("data-zoomed", "");
    await expect(page.locator("[data-lightbox-zoom-viewport]")).toHaveCount(1);
  }

  test("the zoomed photo pans under X's action row and stops at the stage edge", async ({
    page,
  }) => {
    await zoomIn(page);
    const { viewportBottom, height } = await zoomedEdges(page);
    expect(viewportBottom).toBe(height);

    // Panned to the end, the photo stops inside the stage, by the pan padding.
    const bottom = await page.evaluate(async () => {
      const viewport = document.querySelector("[data-lightbox-zoom-viewport]")!;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const media = viewport.querySelector("[data-lightbox-media]")!.getBoundingClientRect();
      return Math.round(media.bottom);
    });
    expect(bottom).toBeLessThanOrEqual(900 - 52);
    expect(bottom).toBeGreaterThanOrEqual(900 - 52 - 100);
  });

  test("--lightbox-zoom-clip keeps the zoomed photo inside the stage", async ({ page }) => {
    await page.goto("/social.html");
    await page.addStyleTag({
      content: "[data-lightbox-dialog] { --lightbox-zoom-clip: bottom; }",
    });
    await page.locator(".x-grid button").first().click();
    await expect(dialog(page)).toHaveAttribute("data-lightbox-state", "open");
    await page
      .locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]')
      .dblclick();
    await expect(dialog(page)).toHaveAttribute("data-zoomed", "");
    await expect(page.locator("[data-lightbox-zoom-viewport]")).toHaveCount(1);
    const { viewportBottom } = await zoomedEdges(page);
    expect(viewportBottom).toBe(900 - 52);
  });
});
