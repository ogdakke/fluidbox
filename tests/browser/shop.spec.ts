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

  test("the filmstrip column moves the viewer, and the close lands on that card", async ({
    page,
  }) => {
    await load(page);
    await page.locator(".shop-slide").first().click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    const strip = page.locator("[data-fluidbox-filmstrip-scroll]");
    await expect(strip).toHaveAttribute("aria-orientation", "vertical");
    const box = (await strip.boundingBox())!;
    expect(box.x).toBeLessThan(40);
    expect(box.height).toBeGreaterThan(box.width * 4);
    await expect(page.locator(".shop-dots")).toBeHidden();
    await page.locator('[data-fluidbox-filmstrip-item][data-index="3"]').click();
    await expect(
      page.locator('[data-fluidbox-filmstrip-item][aria-selected="true"]'),
    ).toHaveAttribute("data-index", "3");
    await page.keyboard.press("Escape");
    await expect(page.locator(`${dialog}[data-open]`)).toHaveCount(0);
    await expect.poll(() => shownSlide(page)).toBe(3);
  });

  test("a vertical wheel scrolls the column, and up and down step through it", async ({ page }) => {
    await load(page);
    await page.locator(".shop-slide").first().click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    const strip = page.locator("[data-fluidbox-filmstrip-scroll]");
    const selected = page.locator('[data-fluidbox-filmstrip-item][aria-selected="true"]');
    await expect(selected).toHaveAttribute("data-index", "0");
    const box = (await strip.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let step = 0; step < 6; step++) await page.mouse.wheel(0, 40);
    await expect.poll(() => strip.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
    await expect(selected).not.toHaveAttribute("data-index", "0");
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    const from = Number(await selected.getAttribute("data-index"));
    await selected.focus();
    await page.keyboard.press("ArrowUp");
    await expect(selected).toHaveAttribute("data-index", String(from - 1));
    await expect(selected).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(selected).toHaveAttribute("data-index", String(from));
    await page.keyboard.press("End");
    await expect(selected).toHaveAttribute("data-index", "6");
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
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
