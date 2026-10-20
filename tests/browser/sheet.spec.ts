import { expect, test, type Page } from "@playwright/test";

const dialog = (page: Page) => page.locator("[data-fluidbox-dialog]");

test.describe("sheet on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the X reply count raises the replies sheet, and Escape and close lower it", async ({
    page,
  }) => {
    await page.goto("/social.html");
    await page.locator(".x-grid button").first().click();
    await expect(page.locator("[data-fluidbox-overlay]")).toHaveAttribute(
      "data-fluidbox-status",
      "open",
    );
    await expect(dialog(page)).toHaveAttribute("data-sheet", "0");

    const trigger = page.locator(".x-phone [data-fluidbox-sheet-stop]");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(dialog(page)).toHaveAttribute("data-sheet", "1");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Once the sheet settles, the photo fits into the room above it. Without
    // scroll-driven animations, as in Firefox, the photo stays as it is.
    const fits = await page.evaluate(() => CSS.supports("animation-timeline: scroll()"));
    if (fits)
      await expect
        .poll(() =>
          page.evaluate(() => {
            const media = document
              .querySelector('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]')!
              .getBoundingClientRect();
            return Math.round(
              media.bottom -
                document.querySelector("[data-fluidbox-overlay] .x-sheet")!.getBoundingClientRect()
                  .top,
            );
          }),
        )
        .toBeLessThanOrEqual(1);

    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveAttribute("data-sheet", "0");
    await expect(page.locator("[data-fluidbox-overlay]")).toHaveAttribute(
      "data-fluidbox-status",
      "open",
    );

    await trigger.click();
    await expect(dialog(page)).toHaveAttribute("data-sheet", "1");
    await page.locator("[data-fluidbox-close]").click();
    await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(0);
  });

  test("the top stop is reachable however few the replies", async ({ page }) => {
    await page.goto("/social.html");
    await page.locator(".x-post").nth(2).locator(".x-grid button").first().click();
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
    await page.evaluate(() => {
      const scroller = document.querySelector("[data-fluidbox-sheet-scroller]")!;
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: "instant" });
    });
    await expect(dialog(page)).toHaveAttribute("data-sheet", "2");
    // The sheet stretches to the space under the top inset, 56px here.
    await expect
      .poll(() =>
        page.evaluate(() =>
          Math.round(
            document.querySelector("[data-fluidbox-overlay] .x-sheet")!.getBoundingClientRect().top,
          ),
        ),
      )
      .toBe(56);
  });

  test("the Instagram caption peeks and View all raises the comments", async ({ page }) => {
    await page.goto("/social.html");
    await page.locator(".ig-grid").scrollIntoViewIfNeeded();
    await page.locator(".ig-grid button").first().click();
    await expect(dialog(page)).toHaveAttribute("data-sheet", "0");
    await expect(page.locator(".ig-sheet")).toBeVisible();

    await page.locator(".ig-more").click();
    await expect(dialog(page)).toHaveAttribute("data-sheet", "2");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveAttribute("data-sheet", "0");
  });

  test("the sheet stays inert and unfocused until it settles", async ({ page }) => {
    await page.goto("/social.html");
    await page.locator(".x-grid button").first().click();
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
    const sheet = page.locator("[data-fluidbox-overlay] [data-fluidbox-sheet]");
    await expect(sheet).toHaveAttribute("inert");
    // A screen reader that moves into a sheet still on its way loses its place,
    // as React Aria's sheet notes, so focus and inert wait for the scroll end.
    const moving = await page.evaluate(() => {
      document.querySelector<HTMLElement>(".x-phone [data-fluidbox-sheet-stop]")!.click();
      const sheet = document.querySelector("[data-fluidbox-overlay] [data-fluidbox-sheet]")!;
      return {
        inert: sheet.hasAttribute("inert"),
        focused: sheet.contains(document.activeElement),
      };
    });
    expect(moving).toEqual({ inert: true, focused: false });
    await expect(dialog(page)).toHaveAttribute("data-sheet", "1");
    await expect(sheet).not.toHaveAttribute("inert");
    await expect(sheet).toBeFocused();
  });

  test("a scroll dismiss keeps the thumbnail in view while open; a flight dismiss hides it", async ({
    page,
  }) => {
    await page.goto("/social.html");
    for (const [grid, visibility] of [
      [".ig-grid", "visible"],
      [".x-grid", "hidden"],
    ] as const) {
      const trigger = page.locator(`${grid} button`).first();
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
      const thumbnail = page.locator("img[data-fluidbox-thumbnail-hidden]");
      await expect(thumbnail).toHaveCount(1);
      await expect(thumbnail).toHaveCSS("visibility", visibility);
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(0);
      await expect(trigger.locator("img")).toHaveCSS("visibility", "visible");
    }
  });

  test("a wheel scroll dismiss keeps the momentum from the page until it ends", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Synthetic wheel scrolling of the sheet is Chromium's.");
    await page.goto("/social.html");
    await page.locator(".ig-grid").scrollIntoViewIfNeeded();
    await page.locator(".ig-grid button").first().click();
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
    const pageScroll = await page.evaluate(() => scrollY);
    await page.mouse.move(195, 300);
    // A trackpad's momentum: wheel events keep coming, from a timer in the page
    // so a slow test run leaves no gaps in them.
    await page.evaluate(() => {
      const momentum = setInterval(() => dispatchEvent(new WheelEvent("wheel")), 30);
      Object.assign(window, { stopMomentum: () => clearInterval(momentum) });
    });
    // The flick scrolls the photo off.
    const overlay = page.locator("[data-fluidbox-overlay]");
    await expect(async () => {
      for (let event = 0; event < 8; event++) await page.mouse.wheel(0, -300);
      expect(await overlay.evaluate((node) => getComputedStyle(node).opacity)).toBe("0");
    }).toPass({ intervals: [0] });
    // Well past the fade: without the wait the overlay would be gone, and the
    // momentum would scroll the page.
    await page.waitForTimeout(400);
    await expect(overlay).toHaveCount(1);
    await page.evaluate(() => (window as unknown as { stopMomentum(): void }).stopMomentum());
    await expect(overlay).toHaveCount(0);
    expect(await page.evaluate(() => scrollY)).toBe(pageScroll);
  });
});

test.describe("sheet on a wide screen", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the X viewer keeps its sidebar and hides the sheet", async ({ page }) => {
    await page.goto("/social.html");
    await page.locator(".x-grid button").first().click();
    await expect(page.locator("[data-fluidbox-overlay]")).toHaveAttribute(
      "data-fluidbox-status",
      "open",
    );
    await expect(page.locator(".x-aside")).toBeVisible();
    await expect(page.locator("[data-fluidbox-overlay] .x-sheet")).toBeHidden();
  });
});

test.describe("zoom under stage insets", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const zoomedEdges = (page: Page) =>
    page.evaluate(() => {
      const viewport = document
        .querySelector("[data-fluidbox-zoom-viewport]")!
        .getBoundingClientRect();
      return { viewportBottom: Math.round(viewport.bottom), height: innerHeight };
    });

  async function zoomIn(page: Page) {
    await page.goto("/social.html");
    await page.locator(".x-grid button").first().click();
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
    await page
      .locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]')
      .dblclick();
    await expect(dialog(page)).toHaveAttribute("data-zoomed", "");
    await expect(page.locator("[data-fluidbox-zoom-viewport]")).toHaveCount(1);
  }

  test("the zoomed photo pans under X's action row and stops at the stage edge", async ({
    page,
  }) => {
    await zoomIn(page);
    const { viewportBottom, height } = await zoomedEdges(page);
    expect(viewportBottom).toBe(height);

    // Panned to the end, the photo stops inside the stage, by the pan padding.
    const bottom = await page.evaluate(async () => {
      const viewport = document.querySelector("[data-fluidbox-zoom-viewport]")!;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const media = viewport.querySelector("[data-fluidbox-media]")!.getBoundingClientRect();
      return Math.round(media.bottom);
    });
    expect(bottom).toBeLessThanOrEqual(900 - 52);
    expect(bottom).toBeGreaterThanOrEqual(900 - 52 - 100);
  });

  test("--fluidbox-zoom-clip keeps the zoomed photo inside the stage", async ({ page }) => {
    await page.goto("/social.html");
    await page.addStyleTag({
      content: "[data-fluidbox-dialog] { --fluidbox-zoom-clip: bottom; }",
    });
    await page.locator(".x-grid button").first().click();
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
    await page
      .locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]')
      .dblclick();
    await expect(dialog(page)).toHaveAttribute("data-zoomed", "");
    await expect(page.locator("[data-fluidbox-zoom-viewport]")).toHaveCount(1);
    const { viewportBottom } = await zoomedEdges(page);
    expect(viewportBottom).toBe(900 - 52);
  });
});
