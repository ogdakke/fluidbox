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
    // Without a loop it stops as it reaches the last slide, with nothing left to move to.
    await expect.poll(() => playing(page)).toBe(false);
    await expect(page.locator(control)).toHaveText("Play slideshow");
    // And there, play() does nothing.
    await play(page);
    expect(await playing(page)).toBe(false);
    await expect(page.locator(control)).toHaveText("Play slideshow");
    await tick(page, 20_000);
    expect(await value(page)).toBe("four");
  });

  test("play() while playing keeps the interval under way", async ({ page }) => {
    await load(page);
    await open(page);
    await play(page);
    await tick(page, 3000);
    await play(page);
    await tick(page, 2100);
    // The clock runs on in real time too: a restarted interval would take seconds more.
    await expect.poll(() => value(page), { timeout: 1000 }).toBe("two");
  });

  test("a pause in the same task as play(), or during the opening, wins", async ({ page }) => {
    await load(page);
    // The viewer isn't loaded yet, so play() waits for it.
    await page.evaluate(() => {
      const { fluidbox } = window.slideshowFixture;
      void fluidbox.open("one");
      fluidbox.play();
      fluidbox.pause();
    });
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    expect(await playing(page)).toBe(false);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-fluidbox-viewer]")).toHaveCount(0);
    await page.evaluate(() => {
      const { fluidbox } = window.slideshowFixture;
      void fluidbox.open("one");
      fluidbox.play();
      requestAnimationFrame(() => fluidbox.pause());
    });
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    expect(await playing(page)).toBe(false);
    await tick(page, 20_000);
    expect(await value(page)).toBe("one");
  });

  test("items set while it plays leave the interval alone", async ({ page }) => {
    await load(page);
    await open(page);
    await play(page);
    await tick(page, 4000);
    // As a reachend handler does: more items after these.
    await page.evaluate(() => {
      const { fluidbox, items } = window.slideshowFixture;
      return fluidbox.setItems([...items, { ...items[0]!, id: "five" }]);
    });
    await tick(page, 1100);
    await expect.poll(() => value(page), { timeout: 1000 }).toBe("two");
    expect(await playing(page)).toBe(true);
  });

  test("an update of the option while it plays", async ({ page }) => {
    await load(page);
    await open(page);
    await play(page);
    // A new interval counts from the next move.
    await page.evaluate(() =>
      window.slideshowFixture.fluidbox.update({ slideshow: { interval: 1000 } }),
    );
    await tick(page, 5100);
    await expect.poll(() => value(page)).toBe("two");
    await tick(page, 1100);
    await expect.poll(() => value(page)).toBe("three");
    // Without the option it plays on, and the control stays to stop it.
    await page.evaluate(() => window.slideshowFixture.fluidbox.update({ slideshow: undefined }));
    expect(await playing(page)).toBe(true);
    await expect(page.locator(control)).toBeVisible();
    await expect(page.locator(control)).toHaveText("Pause slideshow");
    await page.locator(control).evaluate((button: HTMLElement) => button.click());
    await expect.poll(() => playing(page)).toBe(false);
    await expect(page.locator(control)).toBeHidden();
  });

  test("state stops playing as the close starts, not once it ends", async ({ page }) => {
    await load(page);
    await open(page);
    await play(page);
    const states = await page.evaluate(() => {
      const { fluidbox } = window.slideshowFixture;
      const seen: string[] = [];
      fluidbox.subscribe((state) => seen.push(`${state.status} ${state.playing}`));
      void fluidbox.close();
      return seen;
    });
    expect(states[0]).toBe("closing false");
    await expect(page.locator(control)).toHaveText("Play slideshow");
    await expect(page.locator(control)).not.toHaveAttribute("data-active");
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

  test("a pause during the wait for the next slide moves nothing, and ends the wait", async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") warnings.push(message.text());
    });
    await load(page, "?held");
    await open(page);
    await play(page);
    await tick(page, 6000);
    await page.evaluate(() => window.slideshowFixture.fluidbox.pause());
    // The wait's cap ends with it: no warning that the slide wasn't ready.
    await tick(page, 20_000);
    await page.evaluate(() => window.slideshowFixture.release());
    await tick(page, 1000);
    expect(await value(page)).toBe("one");
    expect(warnings.filter((text) => text.includes("without its slide ready"))).toEqual([]);

    // Playing again waits for the slide's interval, and play() during the wait changes nothing.
    await play(page);
    await tick(page, 5100);
    await play(page);
    await expect.poll(() => value(page)).toBe("held");
  });

  test("a close during the wait for the next slide moves nothing", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await load(page, "?held");
    await open(page);
    await play(page);
    await tick(page, 6000);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-fluidbox-viewer]")).toHaveCount(0);
    await page.evaluate(() => window.slideshowFixture.release());
    await tick(page, 20_000);
    expect(await value(page)).toBe(null);
    expect(await log(page)).not.toContain("move held slideshow");
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

  test("hides without a slideshow option, but not while play() plays", async ({ page }) => {
    await load(page, "?noslideshow");
    await open(page);
    await expect(page.locator(control)).toBeHidden();
    await play(page);
    expect(await playing(page)).toBe(true);
    await expect(page.locator(control)).toBeVisible();
    await expect(page.locator(control)).toHaveText("Pause slideshow");
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

    test("on an arrow key, which moves without it", async ({ page }) => {
      await load(page);
      await open(page);
      await play(page);
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => value(page)).toBe("two");
      expect(await playing(page)).toBe(false);
      await tick(page, 20_000);
      expect(await value(page)).toBe("two");
    });

    test("on a swipe", async ({ page }) => {
      await load(page);
      await open(page);
      await play(page);
      const box = (await page.locator(`${dialog} [data-fluidbox-slides]`).boundingBox())!;
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.7, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.3, y, { steps: 5 });
      await page.mouse.up();
      expect(await playing(page)).toBe(false);
      await tick(page, 20_000);
      expect(await playing(page)).toBe(false);
    });

    test("on keys and wheels on the control, but its own Enter and Space", async ({ page }) => {
      await load(page);
      await open(page);
      const button = page.locator(control);
      await button.focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => playing(page)).toBe(true);
      // An arrow on the control moves, as on any control, and pauses.
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => value(page)).toBe("two");
      expect(await playing(page)).toBe(false);
      await page.keyboard.press("Space");
      await expect.poll(() => playing(page)).toBe(true);
      // So does a zoom key.
      await page.keyboard.press("+");
      expect(await playing(page)).toBe(false);
      await page.keyboard.press("0");
      await page.keyboard.press("Enter");
      await expect.poll(() => playing(page)).toBe(true);
      await button.dispatchEvent("wheel");
      expect(await playing(page)).toBe(false);
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

    test("while the tab is hidden, holding it, and starts the interval again as it comes back", async ({
      page,
    }) => {
      await load(page);
      await open(page);
      await play(page);
      const visibility = (state: "hidden" | "visible") =>
        page.evaluate((state) => {
          Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
          document.dispatchEvent(new Event("visibilitychange"));
        }, state);
      await tick(page, 4000);
      await visibility("hidden");
      // A hold, not a pause: it still plays, and the control still says Pause.
      expect(await playing(page)).toBe(true);
      await expect(page.locator(control)).toHaveText("Pause slideshow");
      await tick(page, 20_000);
      expect(await value(page)).toBe("one");
      await visibility("visible");
      await tick(page, 4500);
      expect(await value(page)).toBe("one");
      await tick(page, 600);
      await expect.poll(() => value(page)).toBe("two");

      // A pause of the person's own sticks when the tab comes back.
      await page.evaluate(() => window.slideshowFixture.fluidbox.pause());
      await visibility("hidden");
      await visibility("visible");
      expect(await playing(page)).toBe(false);
      await tick(page, 20_000);
      expect(await value(page)).toBe("two");
    });

    test("while a video in the slide plays, holding it until the video ends", async ({ page }) => {
      await load(page, "?video");
      await open(page, "clip");
      await play(page);
      const video = page.locator(`${dialog} [data-fluidbox-slide][data-active] video`);
      await video.evaluate((video: HTMLVideoElement) => video.play());
      await tick(page, 20_000);
      expect(await value(page)).toBe("clip");
      expect(await playing(page)).toBe(true);
      await expect(page.locator(control)).toHaveText("Pause slideshow");
      // It ends.
      await video.evaluate(async (video: HTMLVideoElement) => {
        video.currentTime = Math.max(0, video.duration - 0.1);
        await new Promise((resolve) => video.addEventListener("ended", resolve, { once: true }));
      });
      // A full interval from the end, not what was left of it.
      await tick(page, 4500);
      expect(await value(page)).toBe("clip");
      await tick(page, 600);
      await expect.poll(() => value(page)).toBe("three");
    });

    test("while the tab shows again with the video still playing", async ({ page }) => {
      await load(page, "?video");
      await open(page, "clip");
      await play(page);
      const video = page.locator(`${dialog} [data-fluidbox-slide][data-active] video`);
      await video.evaluate((video: HTMLVideoElement) => video.play());
      for (const state of ["hidden", "visible"]) {
        await page.evaluate((state) => {
          Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
          document.dispatchEvent(new Event("visibilitychange"));
        }, state);
      }
      await tick(page, 20_000);
      expect(await value(page)).toBe("clip");
      expect(await playing(page)).toBe(true);
    });

    test("not for a video playing in another slide", async ({ page }) => {
      await load(page, "?video");
      await open(page);
      await play(page);
      const video = page.locator(`${dialog} [data-fluidbox-slide]:not([data-active]) video`);
      await expect(video).toHaveCount(1);
      await video.evaluate((video: HTMLVideoElement) => video.play());
      await tick(page);
      await expect.poll(() => value(page)).toBe("clip");
    });

    test("for good when the control is pressed during a video", async ({ page }) => {
      await load(page, "?video");
      await open(page, "clip");
      await play(page);
      const video = page.locator(`${dialog} [data-fluidbox-slide][data-active] video`);
      await video.evaluate((video: HTMLVideoElement) => video.play());
      await page.locator(control).evaluate((button: HTMLElement) => button.click());
      await expect.poll(() => playing(page)).toBe(false);
      await expect(page.locator(control)).toHaveText("Play slideshow");
      await video.evaluate((video: HTMLVideoElement) => video.pause());
      await tick(page, 20_000);
      expect(await value(page)).toBe("clip");
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
