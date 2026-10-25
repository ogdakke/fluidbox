import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Fluidbox, FluidboxItem } from "@ogdakke/fluidbox";

declare global {
  interface Window {
    slideshowFixture: {
      fluidbox: Fluidbox;
      items: FluidboxItem[];
      log: string[];
      release: () => void;
    };
  }
}

const dialog = "[data-fluidbox-dialog]";
const control = `${dialog} [data-fluidbox-slideshow]`;

// The timer runs on a fake clock, so an interval passes at once.
async function load(page: Page, query = "") {
  await page.clock.install();
  await page.goto(`/slideshow.html${query}`);
  await expect(page.locator("#slideshow button")).toHaveCount(4);
}

async function open(page: Page, id = "one") {
  await page.locator(`#slideshow [data-item="${id}"]`).click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
}

const value = (page: Page) => page.evaluate(() => window.slideshowFixture.fluidbox.state.value);
const playing = (page: Page) => page.evaluate(() => window.slideshowFixture.fluidbox.state.playing);
const play = (page: Page) => page.evaluate(() => window.slideshowFixture.fluidbox.play());
const log = (page: Page) => page.evaluate(() => window.slideshowFixture.log);

/** Let the interval pass, and the move it makes settle. */
async function tick(page: Page, ms = 5000) {
  await page.clock.runFor(ms);
}

test.describe("slideshow", () => {
  test("doesn't start without play() or autoplay", async ({ page }) => {
    await load(page);
    await open(page);
    expect(await playing(page)).toBe(false);
    await tick(page, 20_000);
    expect(await value(page)).toBe("one");
    await expect(page.locator(control)).toHaveText("Play slideshow");
    await expect(page.locator(control)).not.toHaveAttribute("data-active");
  });

  test("advances after the interval with the reason slideshow, and stops on the last", async ({
    page,
  }) => {
    await load(page);
    await open(page);
    await play(page);
    // Real time passes too, so the checks leave it some room.
    await tick(page, 4500);
    expect(await value(page)).toBe("one");
    expect(await playing(page)).toBe(true);
    await expect(page.locator(control)).toHaveText("Pause slideshow");
    await expect(page.locator(control)).toHaveAttribute("data-active", "");
    await tick(page, 600);
    await expect.poll(() => value(page)).toBe("two");
    expect(await log(page)).toContain("move two slideshow");
    await tick(page);
    await expect.poll(() => value(page)).toBe("three");
    await tick(page);
    await expect.poll(() => value(page)).toBe("four");
    // Without a loop it stops on the last slide.
    await tick(page);
    await expect.poll(() => playing(page)).toBe(false);
    expect(await value(page)).toBe("four");
    await expect(page.locator(control)).toHaveText("Play slideshow");
  });

  test("goes round with loop", async ({ page }) => {
    await load(page, "?loop");
    await open(page, "four");
    await play(page);
    await tick(page);
    await expect.poll(() => value(page)).toBe("one");
    expect(await playing(page)).toBe(true);
  });

  test("autoplay starts as the viewer opens, and closing stops it", async ({ page }) => {
    // A flight would start on the fake clock's time, which runs ahead of the animations'.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await load(page, "?autoplay");
    await open(page);
    await expect.poll(() => playing(page)).toBe(true);
    await tick(page);
    await expect.poll(() => value(page)).toBe("two");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-fluidbox-viewer]")).toHaveCount(0);
    expect(await playing(page)).toBe(false);
    // No timer is left behind, and play() does nothing while closed.
    await play(page);
    expect(await playing(page)).toBe(false);
    await tick(page, 20_000);
    expect(await value(page)).toBe(null);
  });

  test("moves only once the next slide is ready", async ({ page }) => {
    await load(page, "?held");
    await open(page);
    await play(page);
    await tick(page);
    await tick(page, 2000);
    expect(await value(page)).toBe("one");
    await page.evaluate(() => window.slideshowFixture.release());
    await expect.poll(() => value(page)).toBe("held");
  });

  test("moves to a slide that is never ready after the interval again", async ({ page }) => {
    await load(page, "?held");
    await open(page);
    await play(page);
    await tick(page, 9500);
    expect(await value(page)).toBe("one");
    await tick(page, 600);
    await expect.poll(() => value(page)).toBe("held");
  });

  test("the control plays and pauses, and names itself by its state", async ({ page }) => {
    await load(page);
    await open(page);
    const button = page.locator(control);
    await expect(button).toHaveAttribute("data-fluidbox-default", "");
    await button.click();
    await expect.poll(() => playing(page)).toBe(true);
    await expect(button).toHaveText("Pause slideshow");
    await tick(page);
    await expect.poll(() => value(page)).toBe("two");
    // Its own press doesn't count as the input that pauses.
    await button.click();
    await expect.poll(() => playing(page)).toBe(false);
    await expect(button).toHaveText("Play slideshow");
    // By keyboard too.
    await button.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => playing(page)).toBe(true);
    await page.keyboard.press("Space");
    await expect.poll(() => playing(page)).toBe(false);
  });

  test("a page control of your own follows it", async ({ page }) => {
    await load(page);
    const own = page.locator("#page-slideshow");
    await expect(own).toBeDisabled();
    await open(page);
    await expect(own).toHaveAttribute("aria-label", "Play slideshow");
    await own.evaluate((button: HTMLElement) => button.click());
    await expect(own).toHaveAttribute("aria-label", "Pause slideshow");
    await expect(own).toHaveAttribute("data-active", "");
  });

  test("hides without a slideshow option; play() still plays", async ({ page }) => {
    await load(page, "?noslideshow");
    await open(page);
    await expect(page.locator(control)).toBeHidden();
    await play(page);
    expect(await playing(page)).toBe(true);
    await tick(page);
    await expect.poll(() => value(page)).toBe("two");
  });

  test.describe("pauses", () => {
    test("on a pointer, and stays paused", async ({ page }) => {
      await load(page);
      await open(page);
      await play(page);
      await page.locator(`${dialog} [data-fluidbox-media]`).first().dispatchEvent("pointerdown");
      expect(await playing(page)).toBe(false);
      await tick(page, 20_000);
      expect(await value(page)).toBe("one");
    });

    test("on a key", async ({ page }) => {
      await load(page);
      await open(page);
      await play(page);
      await page.keyboard.press("Shift");
      expect(await playing(page)).toBe(false);
      await tick(page, 20_000);
      expect(await value(page)).toBe("one");
    });

    test("on a zoom", async ({ page }) => {
      await load(page);
      await open(page);
      await play(page);
      await page.keyboard.press("+");
      expect(await playing(page)).toBe(false);
      // The zoom command, which no key or pointer starts, pauses too.
      await play(page);
      await page.evaluate(() => window.slideshowFixture.fluidbox.zoomIn());
      expect(await playing(page)).toBe(false);
    });

    test("while the tab is hidden, and plays again as it comes back", async ({ page }) => {
      await load(page);
      await open(page);
      await play(page);
      const visibility = (state: "hidden" | "visible") =>
        page.evaluate((state) => {
          Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
          document.dispatchEvent(new Event("visibilitychange"));
        }, state);
      await visibility("hidden");
      expect(await playing(page)).toBe(false);
      await tick(page, 20_000);
      expect(await value(page)).toBe("one");
      await visibility("visible");
      expect(await playing(page)).toBe(true);
      await tick(page);
      await expect.poll(() => value(page)).toBe("two");

      // A pause of the person's own sticks when the tab comes back.
      await page.evaluate(() => window.slideshowFixture.fluidbox.pause());
      await visibility("hidden");
      await visibility("visible");
      expect(await playing(page)).toBe(false);
    });

    test("while a video in the slide plays, and plays again as it ends", async ({ page }) => {
      await load(page, "?video");
      await open(page, "clip");
      await play(page);
      const video = page.locator(`${dialog} [data-fluidbox-slide][data-active] video`);
      await video.evaluate((video: HTMLVideoElement) => video.play());
      await expect.poll(() => playing(page)).toBe(false);
      await tick(page, 20_000);
      expect(await value(page)).toBe("clip");
      // It ends.
      await video.evaluate(async (video: HTMLVideoElement) => {
        video.currentTime = Math.max(0, video.duration - 0.1);
        await new Promise((resolve) => video.addEventListener("ended", resolve, { once: true }));
      });
      await expect.poll(() => playing(page)).toBe(true);
      await tick(page);
      await expect.poll(() => value(page)).toBe("three");
    });
  });

  test("the live region is off while playing, and polite again on pause", async ({ page }) => {
    await load(page);
    await open(page);
    const status = page.locator(`${dialog} [role=status]`);
    await expect(status).toHaveAttribute("aria-live", "polite");
    await play(page);
    await expect(status).toHaveAttribute("aria-live", "off");
    await page.evaluate(() => window.slideshowFixture.fluidbox.pause());
    await expect(status).toHaveAttribute("aria-live", "polite");
  });

  test("moves are instant under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await load(page);
    await open(page);
    await play(page);
    // A smooth scroll scrolls many times on its way; an instant move once.
    await page.locator(`${dialog} [data-fluidbox-slides]`).evaluate((strip) => {
      (window as unknown as { scrolls: number }).scrolls = 0;
      strip.addEventListener("scroll", () => (window as unknown as { scrolls: number }).scrolls++);
    });
    await tick(page);
    await expect.poll(() => value(page)).toBe("two");
    const scrolls = () => page.evaluate(() => (window as unknown as { scrolls: number }).scrolls);
    await expect.poll(scrolls).toBe(1);
    await page.waitForTimeout(400);
    expect(await scrolls()).toBe(1);
  });

  test("axe passes with the control", async ({ page }) => {
    await load(page);
    await open(page);
    await play(page);
    const results = await new AxeBuilder({ page }).include(dialog).analyze();
    expect(results.violations).toEqual([]);
  });
});
