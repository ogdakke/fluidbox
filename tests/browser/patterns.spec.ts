import { expect, test, type Locator, type Page } from "@playwright/test";
import { stubMedia } from "./support/media";

/**
 * Every framework page implements the same thirteen patterns (apps/examples/src/patterns/CONTRACT.md).
 * Set PATTERNS=react,vue to run some of them.
 */
const all = ["react", "vue", "solid", "angular", "elements", "javascript"] as const;
const frameworks = process.env.PATTERNS
  ? all.filter((name) => process.env.PATTERNS!.split(",").includes(name))
  : all;

const dialog = (page: Page) => page.locator("[data-fluidbox-dialog]");
const activeSlide = (page: Page) => page.locator('[data-fluidbox-slide][aria-hidden="false"]');
/** The image on show, in its slide or, zoomed, in the zoom's scroller. */
const shownMedia = (page: Page) =>
  page.locator(
    '[data-fluidbox-zoom-viewport] [data-fluidbox-media], [data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]',
  );
const expectSlide = (page: Page, label: string) =>
  expect(activeSlide(page)).toHaveAttribute("aria-label", label);

async function open(page: Page, trigger: Locator, label: string) {
  await trigger.click();
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
  await expectSlide(page, label);
}

async function close(page: Page) {
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
}

for (const framework of frameworks) {
  test.describe(framework, () => {
    let media: Awaited<ReturnType<typeof stubMedia>>;

    test.beforeEach(async ({ page }) => {
      // YouTube, its stills and <model-viewer> come from the test, so the page stays offline.
      media = await stubMedia(page);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/${framework}/`);
      await expect(page.locator("html")).toHaveAttribute("data-patterns-ready", "");
      expect(errors).toEqual([]);
    });

    const pattern = (page: Page, name: string) => page.locator(`[data-pattern="${name}"]`);

    test("basic", async ({ page }) => {
      const triggers = pattern(page, "basic").locator('[data-test="trigger"]');
      await expect(triggers).toHaveCount(4);
      await open(page, triggers.nth(0), "Item 1 of 4");
      await dialog(page).locator("[data-fluidbox-next]").click();
      await expectSlide(page, "Item 2 of 4");
      await close(page);
      await expect(triggers.nth(1)).toBeFocused();
    });

    test("overlay", async ({ page }) => {
      const root = pattern(page, "overlay");
      const trigger = root.locator('[data-test="trigger"]');
      await expect(root.locator('[data-test="count"]')).toHaveText("+4");
      await open(page, trigger, "Item 1 of 5");
      await page.keyboard.press("ArrowRight");
      await expectSlide(page, "Item 2 of 5");
      await close(page);
      await expect(root.locator('[data-test="preview"]')).toHaveAttribute(
        "src",
        /\/art\/canyon\.svg$/,
      );
      await open(page, trigger, "Item 2 of 5");
    });

    test("origins", async ({ page }) => {
      const root = pattern(page, "origins");
      await open(page, root.locator('[data-test="product"]'), "Item 1 of 1");
      await close(page);
      const scroller = root.locator('[data-test="scroller"]');
      const triggers = scroller.locator('[data-test="trigger"]');
      await expect(triggers).toHaveCount(8);
      await open(page, triggers.nth(0), "Item 1 of 8");
      for (let step = 0; step < 7; step++) await page.keyboard.press("ArrowRight");
      await expectSlide(page, "Item 8 of 8");
      await close(page);
      const [box, last] = await Promise.all([
        scroller.boundingBox(),
        triggers.nth(7).boundingBox(),
      ]);
      expect(last!.x + last!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
    });

    test("renderers", async ({ page }) => {
      const triggers = pattern(page, "renderers").locator('[data-test="trigger"]');
      await open(page, triggers.nth(0), "Item 1 of 4");
      await expect(dialog(page).locator(".pattern-note")).toHaveText("Theme: dusk");
      await page.keyboard.press("ArrowRight");
      await expect(activeSlide(page).locator("iframe")).toHaveCount(1);
      await page.keyboard.press("ArrowRight");
      await expectSlide(page, "Item 3 of 4");
      await page.keyboard.press("ArrowRight");
      const youtube = activeSlide(page).locator("iframe");
      await expect(youtube).toHaveAttribute("src", /youtube-nocookie\.com\/embed\//);
      await expect(youtube).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      await close(page);
    });

    test("programmatic", async ({ page }, testInfo) => {
      const root = pattern(page, "programmatic");
      const status = root.locator('[data-test="status"]');
      const openThird = root.locator('[data-test="open-third"]');
      await expect(status).toHaveText("closed -");
      await openThird.click();
      await expectSlide(page, "Item 3 of 4");
      await expect(status).toHaveText("open 2");
      await expect(
        root.locator('[data-test="log"] li', { hasText: "valuechange" }),
      ).not.toHaveCount(0);
      await close(page);
      await expect(status).toHaveText("closed -");
      await root.locator('[data-test="lock"]').check();
      await openThird.click();
      await expectSlide(page, "Item 3 of 4");
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
      await expectSlide(page, "Item 3 of 4");
      if (!testInfo.project.use.isMobile) {
        // A locked swipe meets an edge and stays on the item.
        const slides = page.locator("[data-fluidbox-slides]");
        await slides.hover();
        await page.mouse.wheel(900, 0);
        await page.waitForTimeout(800);
        await expectSlide(page, "Item 3 of 4");
        const offset = await slides.evaluate((element) => {
          const active = element.querySelector('[data-fluidbox-slide][aria-hidden="false"]')!;
          return Math.abs(
            active.getBoundingClientRect().left - element.getBoundingClientRect().left,
          );
        });
        expect(offset, "the current slide sits in place").toBeLessThan(2);
      }
      await close(page);
    });

    test("zoom", async ({ page }) => {
      // Two galleries of four: zoom on with its controls and readout, then zoom off.
      const triggers = pattern(page, "zoom").locator('[data-test="trigger"]');
      await expect(triggers).toHaveCount(8);
      await open(page, triggers.nth(0), "Item 1 of 4");
      const level = dialog(page).locator('[data-test="zoom-level"]');
      await expect(level).toHaveText("100%");
      await expect(dialog(page).locator("[data-fluidbox-zoom-reset]")).toBeDisabled();
      await dialog(page).locator("[data-fluidbox-zoom-in]").click();
      await expect(dialog(page)).toHaveAttribute("data-zoomed", "");
      await expect(level).toHaveText("150%");
      // The readout stays over the zoomed image.
      const center = await level.boundingBox();
      await expect
        .poll(() =>
          level.evaluate(
            (output, [x, y]) => output.contains(document.elementFromPoint(x!, y!)),
            [center!.x + center!.width / 2, center!.y + center!.height / 2],
          ),
        )
        .toBe(true);
      await dialog(page).locator("[data-fluidbox-zoom-reset]").click();
      await expect(level).toHaveText("100%");
      await expect(dialog(page)).not.toHaveAttribute("data-zoomed", "");
      await activeSlide(page).locator("img").last().dblclick();
      await expect(dialog(page)).toHaveAttribute("data-zoomed", "");
      await expect(level).toHaveText("300%");
      await page.keyboard.press("Escape");
      await close(page);
      await open(page, triggers.nth(4), "Item 1 of 4");
      await activeSlide(page).locator("img").last().dblclick();
      await page.waitForTimeout(400);
      await expect(dialog(page)).not.toHaveAttribute("data-zoomed", "");
      await close(page);
    });

    test.describe("zoom at a pixel ratio of 1", () => {
      // The candidates' thresholds below are at 1x and 1280 px across, as in zoom.spec.ts.
      test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      test.skip(({ isMobile }) => isMobile, "Thresholds measured at a pixel ratio of 1.");

      test("zoom loads the sharper image", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const triggers = pattern(page, "zoom").locator('[data-test="trigger"]');
        await open(page, triggers.nth(0), "Item 1 of 4");
        const source = () =>
          shownMedia(page).evaluate(
            (image: HTMLImageElement) => new URL(image.currentSrc).pathname,
          );
        // At fit the photo is under 1280 px across, so the 1280w candidate has the pixels.
        await expect.poll(source).toBe("/photos/1015-1280.webp");
        // Zoomed by 1.5 it needs more than the srcset has: zoom.src, the full-size file.
        await dialog(page).locator("[data-fluidbox-zoom-in]").click();
        await expect.poll(source).toBe("/photos/1015.webp");
        await close(page);
      });
    });

    test("thumbnails", async ({ page }) => {
      // Two galleries of four: the default strip, then custom thumbnails.
      const triggers = pattern(page, "thumbnails").locator('[data-test="trigger"]');
      await expect(triggers).toHaveCount(8);
      await open(page, triggers.nth(0), "Item 1 of 4");
      await expect(dialog(page).locator("[data-fluidbox-thumbnails]")).toHaveCount(1);
      await close(page);
      await open(page, triggers.nth(4), "Item 1 of 4");
      const thumbs = dialog(page).locator('[data-test="thumb"]');
      await expect(thumbs).toHaveCount(4);
      const button = (index: number) => thumbs.nth(index).locator("xpath=ancestor::button[1]");
      await expect(button(0)).toHaveAttribute("data-fluidbox-selected");
      await page.keyboard.press("ArrowRight");
      await expect(button(1)).toHaveAttribute("data-fluidbox-selected");
      await expect(button(0)).not.toHaveAttribute("data-fluidbox-selected");
      await close(page);
    });

    test("sheet", async ({ page }) => {
      const root = pattern(page, "sheet");
      await open(page, root.locator('[data-test="trigger"]').first(), "Item 1 of 4");
      const sheet = dialog(page).locator("[data-fluidbox-sheet]");
      // Every framework fills the runtime's own sheet, a section named by its label.
      await expect(sheet).toHaveCount(1);
      await expect(sheet).toHaveJSProperty("tagName", "SECTION");
      await expect(sheet).toHaveAttribute("aria-label", "Details");
      await expect(sheet.locator('[data-test="sheet-title"]')).not.toBeEmpty();
      const stop = sheet.locator('[data-test="stop"]');
      await expect(stop).toHaveText("0");
      await dialog(page).locator('[data-test="peek"]').click();
      await expect(stop).toHaveText("1");
      await sheet.locator('[data-test="expand"]').click();
      await expect(stop).toHaveText("2");
      const field = sheet.locator('[data-test="field"]');
      await field.fill("hello");
      await field.press("ArrowRight");
      await expect(field).toHaveValue("hello");
      await expectSlide(page, "Item 1 of 4");
    });

    test("headless", async ({ page }) => {
      const root = pattern(page, "headless");
      await open(page, root.locator('[data-test="trigger"]').first(), "Item 1 of 4");
      const caption = dialog(page).locator(".pattern-caption");
      await expect(caption.locator('[data-test="counter"]')).toHaveText("1 / 4");
      await expect(caption.locator('[data-test="title"]')).not.toBeEmpty();
      // The caption's close calls close(); the default Close stays as a way out.
      await expect(dialog(page).locator("[data-fluidbox-close]")).toHaveCount(1);
      await caption.locator('[data-test="next"]').click();
      await expect(caption.locator('[data-test="counter"]')).toHaveText("2 / 4");
      await caption.locator('[data-test="close"]').click();
      await expect(dialog(page)).toHaveCount(0);
    });

    test("rtl", async ({ page }, testInfo) => {
      const root = pattern(page, "rtl");
      const triggers = root.locator('[data-test="trigger"]');
      await expect(triggers).toHaveCount(4);
      await open(page, triggers.nth(0), "العنصر ١ من ٤");
      const overlay = page.locator("[data-fluidbox-viewer]");
      await expect(overlay).toHaveAttribute("dir", "rtl");
      await expect(overlay).toHaveAttribute("lang", "ar");
      const slides = page.locator("[data-fluidbox-slides]");
      const inPlace = () =>
        slides.evaluate((element) => {
          const active = element.querySelector('[data-fluidbox-slide][aria-hidden="false"]')!;
          return Math.abs(
            active.getBoundingClientRect().right - element.getBoundingClientRect().right,
          );
        });
      // Forward is to the left: the key, the button and the swipe.
      await page.keyboard.press("ArrowLeft");
      await expectSlide(page, "العنصر ٢ من ٤");
      await expect
        .poll(inPlace, { message: "the slide on show is the current one" })
        .toBeLessThan(2);
      const next = dialog(page).locator("[data-fluidbox-next]");
      await expect(next).toHaveAccessibleName("التالي");
      const [nextBox, slidesBox] = await Promise.all([next.boundingBox(), slides.boundingBox()]);
      expect(nextBox!.x + nextBox!.width / 2).toBeLessThan(slidesBox!.x + slidesBox!.width / 2);
      await page.keyboard.press("ArrowRight");
      await expectSlide(page, "العنصر ١ من ٤");
      await next.click();
      await expectSlide(page, "العنصر ٢ من ٤");
      if (!testInfo.project.use.isMobile) {
        await slides.hover();
        await page.mouse.wheel(-900, 0);
        await expectSlide(page, "العنصر ٣ من ٤");
        await expect.poll(inPlace).toBeLessThan(2);
      } else {
        await page.keyboard.press("ArrowLeft");
        await expectSlide(page, "العنصر ٣ من ٤");
      }
      const selected = dialog(page).locator("[data-fluidbox-thumbnails-item][aria-selected=true]");
      await expect(selected).toHaveAttribute("data-index", "2");
      // The thumbnails runs right to left too: the first thumbnail is on the right.
      const thumbs = dialog(page).locator("[data-fluidbox-thumbnails-item]");
      const [first, second] = await Promise.all([
        thumbs.nth(0).boundingBox(),
        thumbs.nth(1).boundingBox(),
      ]);
      expect(first!.x).toBeGreaterThan(second!.x);
      await close(page);
      await expect(triggers.nth(2)).toBeFocused();
    });

    test("url", async ({ page }) => {
      const triggers = pattern(page, "url").locator('[data-test="trigger"]');
      const photo = () => new URL(page.url()).searchParams.get("photo");
      await expect(triggers).toHaveCount(4);
      await open(page, triggers.nth(1), "Item 2 of 4");
      await expect.poll(photo).toBe("2");
      await page.keyboard.press("ArrowRight");
      await expectSlide(page, "Item 3 of 4");
      await expect.poll(photo).toBe("3");
      // Opening added one entry and moving replaced it: Back closes, Forward reopens.
      await page.goBack();
      await expect(dialog(page)).toHaveCount(0);
      expect(photo()).toBeNull();
      await page.goForward();
      await expectSlide(page, "Item 3 of 4");
      await close(page);
      await expect.poll(photo).toBeNull();
      // A link with the photo in it opens it, and closing drops it from the address.
      await page.goto(`/${framework}/?photo=4`);
      await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
      await expectSlide(page, "Item 4 of 4");
      await close(page);
      await expect.poll(photo).toBeNull();
      await expect(triggers.nth(3)).toBeFocused();
    });

    test("headless controls fade when a dismiss starts", async ({ page }) => {
      const root = pattern(page, "headless");
      await open(page, root.locator('[data-test="trigger"]').first(), "Item 1 of 4");
      const caption = dialog(page).locator(".pattern-caption");
      await expect(caption).toHaveCSS("opacity", "1");
      const media = dialog(page).locator(
        '[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]',
      );
      const box = (await media.boundingBox())!;
      const pointer = { pointerId: 7, pointerType: "touch", isPrimary: true, buttons: 1 };
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await media.dispatchEvent("pointerdown", { ...pointer, clientX: x, clientY: y });
      for (let step = 1; step <= 8; step++) {
        await media.dispatchEvent("pointermove", {
          ...pointer,
          clientX: x,
          clientY: y + step * 15,
        });
      }
      await expect(dialog(page)).toHaveAttribute("data-dismissing", "");
      await expect(caption).toHaveCSS("opacity", "0");
    });

    test("hover", async ({ page, isMobile }) => {
      const product = pattern(page, "hover").locator('[data-test="product"]');
      const image = product.locator("img");
      // A resting mouse magnifies the photo; touch screens get no hover zoom.
      if (!isMobile) {
        await product.scrollIntoViewIfNeeded();
        // Let the scroll settle first: a scroll takes the hover zoom away.
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)));
        await product.hover();
        await expect(image).toHaveAttribute("data-fluidbox-hover-zooming", "");
        const lens = page.locator("[data-fluidbox-hover-zoom] img");
        await expect
          .poll(() => lens.evaluate((picture: HTMLImageElement) => new URL(picture.src).pathname))
          .toBe("/products/fjord-wood.webp");
      }
      // A click still opens the viewer, and the hover zoom goes.
      await open(page, product, "Item 1 of 1");
      await expect(page.locator("[data-fluidbox-hover-zoom]")).toHaveCount(0);
      await expect(image).not.toHaveAttribute("data-fluidbox-hover-zooming", "");
      await close(page);
    });

    test("media", async ({ page }) => {
      const triggers = pattern(page, "media").locator('[data-test="trigger"]');
      await expect(triggers).toHaveCount(4);
      await open(page, triggers.nth(0), "Item 1 of 4");
      await expect(activeSlide(page).locator("img").last()).toHaveAttribute(
        "alt",
        "The print in a wood frame",
      );
      const next = dialog(page).locator("[data-fluidbox-next]");
      // The YouTube facade: nothing loads from YouTube until Play.
      await next.click();
      await expectSlide(page, "Item 2 of 4");
      expect(media.players).toEqual([]);
      await activeSlide(page).getByRole("button", { name: "Play" }).click();
      await expect(activeSlide(page).locator("iframe")).toHaveAttribute(
        "src",
        /^https:\/\/www\.youtube-nocookie\.com\/embed\/M7lc1UVf-VE\?/,
      );
      expect(media.players).toHaveLength(1);
      // The spin: a slider that turns a frame per arrow key.
      await next.click();
      await expectSlide(page, "Item 3 of 4");
      const spin = activeSlide(page).locator("[data-fluidbox-spin]");
      await expect(spin).toHaveAttribute("data-frame", "0");
      await spin.focus();
      await page.keyboard.press("ArrowRight");
      await expect(spin).toHaveAttribute("data-frame", "1");
      // The model: <model-viewer> loads once, from the URL the example gives load().
      await next.click();
      await expectSlide(page, "Item 4 of 4");
      await expect(activeSlide(page).locator("[data-fluidbox-model-ready]")).toHaveCount(1);
      expect(media.modelViewer).toEqual([
        "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js",
      ]);
      // A double render, as StrictMode makes, leaves one box and an element
      // that joined the page once, and so does a reopen.
      for (let round = 0; round < 2; round++) {
        await expect(activeSlide(page).locator("[data-fluidbox-model]")).toHaveCount(1);
        await expect(activeSlide(page).locator("model-viewer")).toHaveCount(1);
        await expect(activeSlide(page).locator("model-viewer")).toHaveAttribute(
          "data-connections",
          "1",
        );
        await close(page);
        if (round === 0) await open(page, triggers.nth(3), "Item 4 of 4");
      }
      await open(page, triggers.nth(1), "Item 2 of 4");
      await expect(activeSlide(page).locator("[data-fluidbox-embed]")).toHaveCount(1);
      await close(page);
    });

    // JavaScript and React show the model's card as a live <model-viewer>.
    if (framework === "javascript" || framework === "react") {
      test("media: a live model card opens on its view", async ({ page }) => {
        const trigger = pattern(page, "media").locator('[data-test="trigger"]').nth(3);
        const card = trigger.locator("model-viewer");
        await expect(card).toHaveAttribute("data-orbit-at-load", "0");
        await expect(card).toHaveAttribute("aria-hidden", "true");
        await expect(trigger).toHaveAccessibleName("Damaged Helmet, a 3D model");
        // A drag turns the card and leaves the viewer closed.
        await card.scrollIntoViewIfNeeded();
        const box = (await card.boundingBox())!;
        const x = Math.round(box.x + box.width / 2);
        const y = Math.round(box.y + box.height / 2);
        await page.mouse.move(x, y);
        await page.mouse.down();
        for (let step = 1; step <= 8; step++) await page.mouse.move(x - step * 5, y);
        await page.mouse.up();
        await expect(card).toHaveAttribute("data-orbit", "-40");
        await expect(dialog(page)).toHaveCount(0);
        // A click opens on the card's view, and a close brings the slide's view home.
        await open(page, trigger, "Item 4 of 4");
        const model = activeSlide(page).locator("model-viewer");
        await expect(model).toHaveAttribute("data-orbit-at-load", "-40");
        await close(page);
        await expect(card).toHaveAttribute("data-camera-orbit", "-40deg 75deg 2m");
        await expect(card).toHaveAttribute("data-connections", "1");
      });
    }
  });
}
