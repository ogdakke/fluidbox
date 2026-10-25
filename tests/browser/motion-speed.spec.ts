import { expect, test, type Page } from "@playwright/test";

/**
 * `--fluidbox-motion-speed` divides every motion's duration. The flights are
 * Web Animations, so their timing is read as they are made; a move between
 * slides is the strip's scroll, timed from its scroll events.
 */

declare global {
  interface Window {
    __durations: { duration: number; strip: boolean }[];
  }
}

async function record(page: Page) {
  await page.addInitScript(() => {
    window.__durations = [];
    const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")!.value as (
      this: Element,
      ...args: Parameters<Element["animate"]>
    ) => Animation;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
      const animation = animate.apply(this, args);
      const duration = animation.effect?.getTiming().duration;
      if (typeof duration === "number") {
        window.__durations.push({ duration, strip: this.hasAttribute("data-fluidbox-slides") });
      }
      return animation;
    };
  });
}

/** The longest motion made since the last call, of the flights or of the strip's scroll. */
const longest = (page: Page, strip = false) =>
  page.evaluate((strip) => {
    const durations = window.__durations.filter((motion) => motion.strip === strip);
    window.__durations = [];
    return Math.max(0, ...durations.map((motion) => motion.duration));
  }, strip);

/** Move to the next slide; resolves with the strip's scroll timing once it lands. */
async function move(page: Page) {
  await longest(page, true);
  await page.keyboard.press("ArrowRight");
  const strip = page.locator("[data-fluidbox-slides]");
  await expect
    .poll(() =>
      strip.evaluate((element) => {
        const slide = element.querySelector('[data-fluidbox-slide][aria-hidden="false"]')!;
        const offset = slide.getBoundingClientRect().left - element.getBoundingClientRect().left;
        return Math.abs(offset) < 1 && !element.style.scrollSnapType;
      }),
    )
    .toBe(true);
  return longest(page, true);
}

async function open(page: Page, speed: number) {
  await page.goto("/flight.html");
  await page.evaluate((speed) => {
    document.documentElement.style.setProperty("--fluidbox-motion-speed", String(speed));
  }, speed);
  const item = page.locator('[data-flight-case="scroll"] [data-flight-item]').first();
  await item.scrollIntoViewIfNeeded();
  await item.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await longest(page);
  await item.click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  return dialog;
}

/** A short, slow drag that springs back rather than closing. */
async function dragAndRelease(page: Page) {
  const frame = page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-frame]');
  const box = (await frame.boundingBox())!;
  const pointer = { pointerId: 12, pointerType: "touch", isPrimary: true };
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await frame.dispatchEvent("pointerdown", { ...pointer, clientX: x, clientY: y });
  for (const step of [10, 20, 30, 40]) {
    await frame.dispatchEvent("pointermove", { ...pointer, clientX: x, clientY: y + step });
    await page.waitForTimeout(30);
  }
  // Rest before letting go, so the release carries no speed of its own.
  await page.waitForTimeout(200);
  await frame.dispatchEvent("pointermove", { ...pointer, clientX: x, clientY: y + 40 });
  await frame.dispatchEvent("pointerup", { ...pointer, clientX: x, clientY: y + 40 });
}

test.describe("motion speed", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await record(page);
  });

  test("at speed 2 the open, release and close take half as long", async ({ page }) => {
    const durations = async (speed: number) => {
      const dialog = await open(page, speed);
      const opening = await longest(page);
      await dragAndRelease(page);
      await expect(dialog).not.toHaveAttribute("data-dragging");
      await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
      await page.waitForTimeout(400);
      const release = await longest(page);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      const close = await longest(page);
      return { opening, release, close };
    };
    const normal = await durations(1);
    const fast = await durations(2);
    expect(normal.opening).toBe(300);
    expect(fast.opening).toBeCloseTo(normal.opening / 2, 3);
    // The release's length follows the finger's last speed, which a test can't
    // fix exactly; at rest it is between 140 and 220 ms.
    expect(normal.release).toBeGreaterThanOrEqual(140);
    expect(normal.release).toBeLessThanOrEqual(220);
    expect(fast.release).toBeGreaterThanOrEqual(70);
    expect(fast.release).toBeLessThanOrEqual(110);
    // The close is timed by its distance, the same in both.
    expect(normal.close).toBeGreaterThanOrEqual(220);
    expect(fast.close).toBeCloseTo(normal.close / 2, 1);
  });

  test("at speed 2 a zoom takes half as long", async ({ page }) => {
    const zoom = async (speed: number) => {
      const dialog = await open(page, speed);
      await page.waitForTimeout(400);
      await longest(page);
      // A mouse click on the media zooms in.
      await dialog
        .locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]')
        .click();
      await expect(dialog).toHaveAttribute("data-zoomed");
      return longest(page);
    };
    expect(await zoom(1)).toBe(320);
    expect(await zoom(2)).toBe(160);
  });

  test("the speed is clamped to 0.25–4", async ({ page }) => {
    await open(page, 10);
    expect(await longest(page)).toBe(75);
  });

  test("at speed 2 a move between slides scrolls for half the 300 ms", async ({ page }) => {
    const dialog = await open(page, 2);
    expect(await move(page)).toBe(150);
    // The viewer takes the trigger's theme as it opens; set on the viewer, it applies at once.
    await dialog.evaluate((element) => element.style.setProperty("--fluidbox-motion-speed", "0.5"));
    expect(await move(page)).toBe(600);
    // At speed 1 the strip scrolls smoothly as the browser does.
    await dialog.evaluate((element) => element.style.setProperty("--fluidbox-motion-speed", "1"));
    expect(await move(page)).toBe(0);
  });

  test("a move fires its value events at the same points at every speed", async ({ page }) => {
    type Moment = { type: string; value: string | null; landed: boolean };
    const moves = async (speed: number) => {
      await open(page, speed);
      return page.evaluate(async () => {
        const fluidbox = window.flightViewers.scroll!;
        const strip = document.querySelector<HTMLElement>("[data-fluidbox-slides]")!;
        const landed = () => {
          const slide = strip.querySelector(`[data-fluidbox-slide][aria-hidden="false"]`)!;
          return (
            Math.abs(slide.getBoundingClientRect().left - strip.getBoundingClientRect().left) < 1
          );
        };
        const moments: Moment[] = [];
        let refuse = false;
        for (const type of ["beforevaluechange", "valuechange", "valuechangecomplete"]) {
          fluidbox.addEventListener(type, (event) => {
            moments.push({
              type,
              value: (event as Event & { value: string }).value,
              landed: landed(),
            });
            if (refuse && type === "beforevaluechange") event.preventDefault();
          });
        }
        const moved = await fluidbox.next();
        await new Promise((resolve) => setTimeout(resolve, 200));
        // A refused move doesn't scroll at all.
        refuse = true;
        const left = strip.scrollLeft;
        const refused = await fluidbox.next();
        await new Promise((resolve) => setTimeout(resolve, 400));
        const scrolled = Math.abs(strip.scrollLeft - left) > 1;
        return { moments, moved, refused, scrolled, value: fluidbox.state.value };
      });
    };
    const normal = await moves(1);
    const fast = await moves(2);
    const sequence = (run: typeof normal) => run.moments.map(({ type, value }) => [type, value]);
    // The same events with the same values: valuechange as the move starts,
    // valuechangecomplete as it ends, then the refused move's beforevaluechange.
    expect(sequence(fast)).toEqual(sequence(normal));
    expect(sequence(fast).map(([type]) => type)).toEqual([
      "beforevaluechange",
      "valuechange",
      "valuechangecomplete",
      "beforevaluechange",
    ]);
    for (const run of [normal, fast]) {
      expect(run.moved).toBe(true);
      expect(run.refused).toBe(false);
      expect(run.value).toBe(run.moments[1]!.value);
    }
    // The strip's own scroll has landed when it says so, and a refused move
    // doesn't scroll. (WebKit's own smooth scroll, at speed 1, can still be
    // gliding as the fallback timer completes the move.)
    expect(fast.moments[2]!.landed).toBe(true);
    expect(fast.scrolled).toBe(false);
  });

  test("reduced motion has no flights at any speed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const dialog = await open(page, 2);
    expect(await longest(page)).toBe(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(await longest(page)).toBe(0);
  });
});
