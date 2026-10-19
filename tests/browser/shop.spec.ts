import { expect, test, type Page } from "@playwright/test";

const dialog = "[data-fluidbox-dialog]";

async function load(page: Page) {
  await page.goto("/shop.html");
  await expect(page.locator(".shop-slide")).toHaveCount(7);
}

/** The carousel card whose left edge sits at the carousel's start. */
function shownSlide(page: Page) {
  return page.locator(".shop-carousel").evaluate((carousel) => {
    const start =
      carousel.getBoundingClientRect().left + parseFloat(getComputedStyle(carousel).paddingLeft);
    return [...carousel.children].findIndex(
      (slide) => Math.abs(slide.getBoundingClientRect().left - start) < 2,
    );
  });
}

test.describe("shop fixture, wide screen", () => {
  test.skip(({ isMobile }) => isMobile, "the wide-screen layout");
  test.use({ viewport: { width: 1440, height: 900 } });

  test("thumbnails and frame options step the carousel", async ({ page }) => {
    await load(page);
    await page.locator(".shop-thumbs .shop-thumb").nth(2).click();
    await expect.poll(() => shownSlide(page)).toBe(2);
    await expect(page.locator(".shop-thumbs .shop-thumb").nth(2)).toHaveAttribute(
      "aria-current",
      "true",
    );
    await page.getByRole("radio", { name: "Wood frame", exact: true }).check({ force: true });
    await expect.poll(() => shownSlide(page)).toBe(5);
  });

  test("the filmstrip moves the viewer, and the close lands on that card", async ({ page }) => {
    await load(page);
    await page.locator(".shop-slide").first().click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator(dialog)).toHaveAttribute("data-filmstrip");
    await expect(page.locator(".shop-dots")).toBeHidden();
    await page.locator('[data-fluidbox-filmstrip-item][data-index="3"]').click();
    await expect(
      page.locator('[data-fluidbox-filmstrip-item][aria-selected="true"]'),
    ).toHaveAttribute("data-index", "3");
    await page.keyboard.press("Escape");
    await expect(page.locator(`${dialog}[data-open]`)).toHaveCount(0);
    await expect.poll(() => shownSlide(page)).toBe(3);
  });
});

test.describe("shop fixture, phone", () => {
  test.skip(({ isMobile }) => !isMobile, "the phone layout");

  test("a black viewer with five dots that follow the photo", async ({ page }) => {
    await load(page);
    await page.locator(".shop-slide").first().tap();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator("[data-fluidbox-filmstrip]")).toHaveCount(0);
    const dots = page.locator(".shop-dot");
    await expect(dots).toHaveCount(7);
    const sizes = () => dots.evaluateAll((all) => all.map((dot) => dot.getAttribute("data-size")));
    await expect.poll(sizes).toEqual(["full", "full", "full", "full", "small", "hidden", "hidden"]);
    for (let step = 0; step < 4; step++) await page.keyboard.press("ArrowRight");
    await expect(dots.nth(4)).toHaveAttribute("data-active");
    await expect.poll(sizes).toEqual(["hidden", "hidden", "small", "full", "full", "full", "full"]);
    await page.keyboard.press("Escape");
    await expect(page.locator(`${dialog}[data-open]`)).toHaveCount(0);
    await expect.poll(() => shownSlide(page)).toBe(4);
  });
});
