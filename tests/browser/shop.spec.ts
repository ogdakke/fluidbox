import { expect, test, type Page } from "@playwright/test";
import { playerMessages, stubMedia } from "./support/media";

const dialog = "[data-fluidbox-dialog]";
const shown = '[data-fluidbox-slide][aria-hidden="false"]';

async function load(page: Page) {
  const requests = await stubMedia(page);
  await page.goto("/shop.html");
  await expect(page.locator(".shop-slide")).toHaveCount(10);
  return requests;
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

  test("a press leaves the card as it was while the viewer prepares", async ({ page }) => {
    await load(page);
    const card = page.locator(".shop-slide").first();
    await expect(card.locator("img")).toHaveAttribute("data-loaded", "true");
    await card.hover();
    await page.waitForLoadState("networkidle");
    // The card without its hover zoom, which the press puts away.
    const before = await card.screenshot({ style: "[data-fluidbox-hover-zoom] { display: none }" });
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(page.locator("[data-fluidbox-hover-zoom]")).toHaveCount(0);
    // The prepared viewer's preview is the 160px thumbnail, set over the card.
    await expect(
      page.locator(
        "[data-fluidbox-prepared] [data-fluidbox-slide-preview][data-fluidbox-image-ready]",
      ),
    ).not.toHaveCount(0);
    expect(await card.screenshot()).toEqual(before);
    await page.mouse.up();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  });

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

  test("the column is a column from the first opening frame, so the flight lands true", async ({
    page,
  }) => {
    await load(page);
    await page.evaluate(() => {
      const seen: string[] = [];
      Object.assign(window, { __orientations: seen });
      new MutationObserver(() => {
        const status = document
          .querySelector("[data-fluidbox-dialog]")
          ?.getAttribute("data-fluidbox-status");
        const orientation = document
          .querySelector("[data-fluidbox-filmstrip-scroll]")
          ?.getAttribute("aria-orientation");
        if (status === "opening") seen.push(orientation ?? "none");
      }).observe(document.body, { subtree: true, attributes: true, childList: true });
    });
    await page.locator(".shop-slide").first().click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    const seen = await page.evaluate(
      () => (window as unknown as { __orientations: string[] }).__orientations,
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen)).toEqual(new Set(["vertical"]));
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
    await expect(selected).toHaveAttribute("data-index", "9");
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
    await expect(dots).toHaveCount(10);
    const sizes = () => dots.evaluateAll((all) => all.map((dot) => dot.getAttribute("data-size")));
    const hidden = (count: number) => Array.from({ length: count }, () => "hidden");
    await expect.poll(sizes).toEqual(["full", "full", "full", "full", "small", ...hidden(5)]);
    for (let step = 0; step < 4; step++) await page.keyboard.press("ArrowRight");
    await expect(dots.nth(4)).toHaveAttribute("data-active");
    await expect
      .poll(sizes)
      .toEqual([...hidden(2), "small", "full", "full", "full", "small", ...hidden(3)]);
    await page.keyboard.press("Escape");
    await expect(page.locator(`${dialog}[data-open]`)).toHaveCount(0);
    await expect.poll(() => shownSlide(page)).toBe(4);
  });
});

test.describe("shop fixture, hover zoom", () => {
  test.skip(({ isMobile }) => isMobile, "a resting mouse");
  test.use({ viewport: { width: 1440, height: 900 } });

  const lens = "[data-fluidbox-hover-zoom]";

  test("magnifies the card under the mouse, following it, until the click opens the viewer", async ({
    page,
  }) => {
    await load(page);
    const card = page.locator(".shop-slide").first();
    const image = card.locator("img");
    await expect(image).toHaveAttribute("data-loaded", "true");
    const layout = () =>
      page.evaluate(() => {
        const box = document.querySelector(".shop-slide img")!.getBoundingClientRect();
        return [box.x, box.y, box.width, box.height, document.documentElement.scrollHeight];
      });
    const before = await layout();
    await expect(page.locator(lens)).toHaveCount(0);
    const box = (await image.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await expect(page.locator(lens)).toHaveCount(1);
    await expect(card.locator(".shop-photo")).toHaveAttribute("data-fluidbox-hover-zooming", "");
    // Over the image's box, magnified, and nothing on the page moves.
    const shown = (await page.locator(lens).boundingBox())!;
    expect(Math.abs(shown.x - box.x)).toBeLessThan(1);
    expect(Math.abs(shown.width - box.width)).toBeLessThan(1);
    expect(await layout()).toEqual(before);
    const picture = page.locator(`${lens} img`);
    const offset = () =>
      picture.evaluate((element) => {
        const { m41, m42 } = new DOMMatrix(getComputedStyle(element).transform);
        return [m41, m42];
      });
    // Within 2px: the mouse lands on whole pixels, the box may not, and the zoom
    // moves 1.5px for each.
    const near = (expected: number[]) => async () =>
      (await offset()).every((value, axis) => Math.abs(value - expected[axis]!) <= 2);
    // 10px into the box is 10px into the zoom's 1.5 boxes of overhang.
    expect(await near([-15, -15])()).toBe(true);
    expect((await picture.boundingBox())!.width).toBeCloseTo(box.width * 2.5, 0);
    // Further in, the zoom shows as much further into the image: at 60% across, 60%
    // of the overhang. (The corners hold the carousel's arrows.)
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 4 });
    await expect.poll(near([box.width * -0.9, box.height * -0.9])).toBe(true);
    await page.mouse.down();
    await expect(page.locator(lens)).toHaveCount(0);
    await page.mouse.up();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  });

  test("goes as the mouse leaves", async ({ page }) => {
    await load(page);
    await page.locator(".shop-slide img").first().hover();
    await expect(page.locator(lens)).toHaveCount(1);
    await page.mouse.move(2, 2);
    await expect(page.locator(lens)).toHaveCount(0);
    await expect(page.locator("[data-fluidbox-hover-zooming]")).toHaveCount(0);
  });

  test("does nothing with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await load(page);
    await page.locator(".shop-slide img").first().hover();
    await page.mouse.move(700, 400, { steps: 3 });
    await expect(page.locator(".shop-slide").first()).toBeVisible();
    await expect(page.locator(lens)).toHaveCount(0);
  });
});

test("hover zoom does nothing on a touch screen", async ({ page, isMobile }) => {
  test.skip(!isMobile, "a touch screen");
  await load(page);
  await page.locator(".shop-slide").first().tap();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator("[data-fluidbox-hover-zoom]")).toHaveCount(0);
  await expect(page.locator("[data-fluidbox-hover-zooming]")).toHaveCount(0);
});

test.describe("shop fixture, rich media", () => {
  /** Open the card at an index from the page's carousel. */
  async function openCard(page: Page, at: number) {
    await page.locator(".shop-slide").nth(at).click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  }
  const index = (page: Page) =>
    page
      .locator(`${shown}`)
      .getAttribute("aria-label")
      .then((label) => label?.split(" ")[1]);

  test("the video plays on Play, and pauses when the viewer moves on", async ({ page }) => {
    const requests = await load(page);
    await openCard(page, 7);
    const slide = page.locator(shown);
    await expect(slide.locator('[data-fluidbox-media-poster="thumbnail"]')).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/M7lc1UVf-VE/mqdefault.jpg",
    );
    expect(requests.players).toEqual([]);
    await slide.getByRole("button", { name: "Play Video: how the print is made" }).click();
    await expect(slide.locator("[data-fluidbox-embed-ready] iframe")).toHaveCount(1);
    await page.locator(dialog).focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => index(page)).toBe("9");
    await expect
      .poll(async () =>
        (await playerMessages(page, "https://www.youtube-nocookie.com/")).map(
          (message) => (message as { data: string }).data,
        ),
      )
      .toEqual([JSON.stringify({ event: "command", func: "pauseVideo", args: [] })]);
  });

  test("the spin turns by itself until someone turns it", async ({ page }) => {
    await load(page);
    await openCard(page, 8);
    const slider = page.locator(shown).getByRole("slider");
    await expect.poll(() => slider.getAttribute("aria-valuenow")).not.toBe("1");
    await slider.focus();
    await page.keyboard.press("Home");
    await expect(slider).toHaveAttribute("aria-valuenow", "1");
    await page.waitForTimeout(400);
    await expect(slider).toHaveAttribute("aria-valuenow", "1");
  });

  test("the spin keeps still with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await load(page);
    await openCard(page, 8);
    const slider = page.locator(shown).getByRole("slider");
    await expect(slider).toHaveAttribute("data-fluidbox-spin-loaded", "");
    await page.waitForTimeout(400);
    await expect(slider).toHaveAttribute("aria-valuenow", "1");
  });

  test("the model loads its element from the CDN, and opens and closes on its poster", async ({
    page,
  }) => {
    const requests = await load(page);
    await openCard(page, 9);
    await expect(page.locator(`${shown} model-viewer`)).toHaveAttribute(
      "src",
      "/products/fjord-model.glb",
    );
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
    expect(requests.modelViewer).toEqual([
      "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js",
    ]);
    // The closing flight carries the poster home, not the live model.
    const flown = page.waitForSelector("[data-fluidbox-flight] [data-fluidbox-model]", {
      state: "attached",
    });
    await page.locator(dialog).focus();
    await page.keyboard.press("Escape");
    const visible = await (
      await flown
    ).evaluate((box) => {
      const poster = box.querySelector('[data-fluidbox-media-poster="poster"]')!;
      const model = box.querySelector("model-viewer")!;
      return [getComputedStyle(poster).visibility, getComputedStyle(model).visibility];
    });
    expect(visible).toEqual(["visible", "hidden"]);
    await expect(page.locator(`${dialog}[data-open]`)).toHaveCount(0);
  });
});
