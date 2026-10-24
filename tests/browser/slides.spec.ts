import { expect, test, type Page } from "@playwright/test";
import type { Fluidbox } from "@ogdakke/fluidbox";

declare global {
  interface Window {
    slidesFixture: {
      fluidbox: Fluidbox;
      replaced: Fluidbox;
      hooks: Fluidbox;
      videos: Fluidbox;
      streamed: Fluidbox;
      attached: string[];
      log: string[];
      poses: {
        scale: number;
        x: number;
        y: number;
        moving: boolean;
        visible: { x: number; y: number; width: number; height: number };
      }[];
      gate: { open?: () => void; wait?: (promise: Promise<unknown>) => void };
    };
  }
}

const dialog = "[data-fluidbox-dialog]";
const shown = '[data-fluidbox-slide][aria-hidden="false"]';

async function load(page: Page) {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.goto("/slides.html");
  await expect(page.locator("#slides button")).toHaveCount(5);
  return warnings;
}

async function open(page: Page, grid: string, id: string) {
  await page.locator(`${grid} [data-item="${id}"]`).click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
}

test("a slide of your own draws the built-in image into its box", async ({ page }) => {
  await load(page);
  await open(page, "#slides", "product");
  const box = page.locator(`${shown} [data-fluidbox-media]`);
  // The box is the slide's own: the drawn image fills it, with the slide's content beside it.
  await expect(box).toHaveAttribute("data-fluidbox-item-content", "");
  const image = box.locator("[data-fluidbox-picture] > img[data-fluidbox-drawn]");
  await expect(image).toHaveAttribute("src", "/products/fjord-room.webp");
  await expect(image).not.toHaveAttribute("data-fluidbox-image-pending");
  await expect(image).toHaveAttribute("alt", "Photo product-image");
  await expect(box.locator(".slides-price")).toHaveText("€120");
  await expect(page.locator(`${shown} [data-fluidbox-frame]`)).toHaveAttribute(
    "data-fluidbox-image-frame",
    "",
  );
  const size = await image.evaluate((element) => {
    const box = element.closest("[data-fluidbox-media]")!.getBoundingClientRect();
    const own = element.getBoundingClientRect();
    return { width: own.width - box.width, height: own.height - box.height };
  });
  expect(size).toEqual({ width: 0, height: 0 });
});

test("the drawn image opens on the trigger's picture, then loads the full one", async ({
  page,
}) => {
  await load(page);
  // Hold the full image, so the slide shows what the open painted first.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/products/fjord-room.webp", async (route) => {
    await held;
    await route.continue();
  });
  await page.locator('#slides [data-item="product"]').click();
  const image = page.locator(`${shown} [data-fluidbox-media] img[data-fluidbox-drawn]`);
  await expect(image).toHaveAttribute("src", /fjord-room-thumb\.webp$/);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  release();
  await expect(image).toHaveAttribute("src", "/products/fjord-room.webp");
  await expect(image).not.toHaveAttribute("data-fluidbox-image-pending");
});

test("a drawn video autoplays on show and pauses as the viewer moves on", async ({ page }) => {
  await load(page);
  await open(page, "#slides", "clip");
  const video = page.locator(`${shown} [data-fluidbox-media] video[data-fluidbox-drawn]`);
  await expect(video).toHaveAttribute("src", "/video/drift.webm");
  await expect(video).toHaveAttribute("poster", "/video/drift-poster.jpg");
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(false);
  const left = page.locator("[data-fluidbox-slide] video[data-fluidbox-drawn]");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => left.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
});

test("an item type without a slide shows the slide's error and warns once", async ({ page }) => {
  const warnings = await load(page);
  await open(page, "#slides", "mystery");
  const error = page.locator(`${shown} [data-fluidbox-error]`);
  await expect(error).toBeVisible();
  await expect(error).toContainText("Unable to load media.");
  // The viewer goes on working around it.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(`${shown} [data-fluidbox-media]`)).toHaveAttribute("alt", "Photo last");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  await open(page, "#slides", "mystery");
  const missing = warnings.filter((text) => text.includes('type "mystery"'));
  expect(missing).toHaveLength(1);
});

test("unloading a slide disposes it and empties its box", async ({ page }) => {
  await load(page);
  await open(page, "#slides", "product");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.slidesFixture.log))
    .toContain("product dispose");
  const left = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll("[data-fluidbox-item-content]")];
    const product = boxes.find(
      (box) => box.getAttribute("aria-label") === "Framed print",
    ) as HTMLElement;
    return {
      children: product.childElementCount,
      frame: product.closest("[data-fluidbox-frame]")!.hasAttribute("data-fluidbox-image-frame"),
    };
  });
  expect(left).toEqual({ children: 0, frame: false });
});

test("a slide for a built-in type replaces it, and default draws the other types", async ({
  page,
}) => {
  await load(page);
  await open(page, "#replaced", "one");
  const box = page.locator(`${shown} [data-fluidbox-media]`);
  await expect(box).toHaveAttribute("data-replaced", "one");
  await expect(box.locator("img[data-fluidbox-drawn]")).toHaveAttribute(
    "src",
    /\/photo-square\.svg$/,
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(`${shown} .slides-default`)).toHaveText("Default slide for other");
});

// At rest zoomed, the box sits in the zoom's native scroller, outside its slide.
const zoomScale = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-fluidbox-media]")]
      .map((box) => box.style.getPropertyValue("--fluidbox-zoom-scale"))
      .find(Boolean),
  );

test("a slide drawing the built-in image zooms its box", async ({ page }) => {
  await load(page);
  await open(page, "#slides", "product");
  await expect
    .poll(() => page.evaluate(() => window.slidesFixture.fluidbox.state.zoom?.scale))
    .toBe(1);
  expect(await page.evaluate(() => window.slidesFixture.fluidbox.zoomTo(2))).toBe(true);
  expect(Number(await zoomScale(page))).toBeCloseTo(2, 2);
  // The clip draws a video, which doesn't zoom. Zoomed, the arrows pan, so move by command.
  await page.evaluate(() => window.slidesFixture.fluidbox.next());
  await expect.poll(() => page.evaluate(() => window.slidesFixture.fluidbox.state.zoom)).toBeNull();
});

test("a slide's own box zooms once it says so, to its own max, and reports its pose", async ({
  page,
}) => {
  await load(page);
  // A stage inset, so the stage the zoom shows the box through is not the window.
  await page.addStyleTag({ content: "[data-fluidbox-dialog] { --fluidbox-stage-top: 120px; }" });
  await open(page, "#hooks", "card");
  await expect.poll(() => page.evaluate(() => window.slidesFixture.hooks.state.zoom?.max)).toBe(3);
  expect(await page.evaluate(() => window.slidesFixture.hooks.zoomTo(5))).toBe(true);
  expect(await page.evaluate(() => window.slidesFixture.hooks.state.zoom?.scale)).toBeCloseTo(3, 2);
  expect(Number(await zoomScale(page))).toBeCloseTo(3, 2);
  await expect
    .poll(() => page.evaluate(() => window.slidesFixture.poses.at(-1)?.moving))
    .toBe(false);
  const poses = await page.evaluate(() => window.slidesFixture.poses);
  // The zoom moved through frames on its way, then rested at 3.
  expect(poses.some((pose) => pose.moving && pose.scale > 1 && pose.scale < 3)).toBe(true);
  const last = poses.at(-1)!;
  expect(last.scale).toBeCloseTo(3, 2);
  // Zoomed 3× into the middle, the zoom viewport (the stage) shows a part of the
  // item's 800 × 600 pixels its own shape: a third of it along the side the box fits.
  const stage = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight - 120,
  }));
  expect(Math.min(last.visible.width / 800, last.visible.height / 600)).toBeCloseTo(1 / 3, 1);
  expect(last.visible.width / last.visible.height).toBeCloseTo(stage.width / stage.height, 1);
  // Around the item's middle, as the zoom centres the box in the stage.
  expect(Math.abs(last.visible.x + last.visible.width / 2 - 400)).toBeLessThan(2);
  expect(Math.abs(last.visible.y + last.visible.height / 2 - 300)).toBeLessThan(2);
  // New items while zoomed release the zoom without an error.
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() =>
    window.slidesFixture.hooks.setItems([
      { type: "card", id: "card", title: "Card", width: 800, height: 600 },
    ]),
  );
  await expect
    .poll(() => page.evaluate(() => window.slidesFixture.hooks.state.zoom?.scale))
    .toBe(1);
  expect(errors).toEqual([]);
});

test("a slide's layer sits over the slide, outside the box, and doesn't fly", async ({ page }) => {
  await load(page);
  await page.locator('#hooks [data-item="card"]').click();
  const layer = page.locator(`${shown} > [data-fluidbox-slide-layer]`);
  await expect(layer).toHaveAttribute("data-fluidbox-chrome", "");
  await expect(layer.locator(".slides-caption")).toHaveText("Card caption");
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(layer).toHaveCSS("opacity", "1");
  const placed = await layer.evaluate((element) => {
    const slide = element.parentElement!.getBoundingClientRect();
    const own = element.getBoundingClientRect();
    return {
      inBox: !!element.closest("[data-fluidbox-media]"),
      same: [own.x - slide.x, own.y - slide.y, own.width - slide.width, own.height - slide.height],
      pointer: getComputedStyle(element).pointerEvents,
    };
  });
  expect(placed).toEqual({ inBox: false, same: [0, 0, 0, 0], pointer: "none" });
  // Zoomed, the layer stays where it is.
  await page.evaluate(() => window.slidesFixture.hooks.zoomTo(2));
  expect(await layer.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
});

test("an empty box opens and closes with a fade, not a flight", async ({ page }) => {
  await load(page);
  await page.locator('#hooks [data-item="blank"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "opening");
  const start = await page.locator(`${shown} [data-fluidbox-frame]`).evaluate(
    (frame) =>
      frame
        .getAnimations()
        .map((animation) => (animation.effect as KeyframeEffect).getKeyframes()[0])
        .find((keyframe) => keyframe.opacity !== undefined)?.opacity,
  );
  expect(start).toBe("0");
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "closing");
  // No copy of the box travels to the trigger.
  await expect(page.locator("[data-fluidbox-flight]")).toHaveCount(0);
  await expect(page.locator(dialog)).toHaveCount(0);
});

const overlay = "[data-fluidbox-viewer]";

/** Hold a request until the returned function lets it through. */
async function hold(page: Page, url: string) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(url, async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

/** Whether the open is still waiting for its slide: mounted but not yet shown. */
const waiting = (page: Page) =>
  page.locator(overlay).evaluate((element) => element.hasAttribute("data-fluidbox-prepared"));

test.describe("an open waits for its slide", () => {
  test("for an image of the slide's own to decode, with the card still painted", async ({
    page,
  }) => {
    await load(page);
    const release = await hold(page, "**/products/fjord-room.webp?own");
    await page.locator('#hooks [data-item="own"]').click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "opening");
    await page.waitForTimeout(400);
    expect(await waiting(page)).toBe(true);
    await expect(page.locator('#hooks [data-item="own"] img')).toBeVisible();
    // Only the slide being opened is opening; its neighbours mount without it.
    const log = await page.evaluate(() => window.slidesFixture.log);
    expect(log).toContain("own opening true");
    expect(log).toContain("film opening false");
    release();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    const image = page.locator(`${shown} [data-fluidbox-media] img`);
    expect(await image.evaluate((element: HTMLImageElement) => element.complete)).toBe(true);
  });

  test("for a video of the slide's own to show its poster", async ({ page }) => {
    await load(page);
    await hold(page, "**/video/drift.webm?own");
    const poster = await hold(page, "**/video/drift-poster.jpg?own");
    await page.locator('#hooks [data-item="film"]').click();
    await page.waitForTimeout(400);
    expect(await waiting(page)).toBe(true);
    poster();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  });

  test("for waitUntil, while Escape calls it off and the arrows move it", async ({ page }) => {
    await load(page);
    await page.locator('#hooks [data-item="gated"]').click();
    await page.waitForTimeout(300);
    expect(await waiting(page)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(dialog)).toHaveCount(0);
    expect(await page.evaluate(() => window.slidesFixture.hooks.state.status)).toBe("closed");

    await page.locator('#hooks [data-item="gated"]').click();
    await page.waitForTimeout(300);
    expect(await waiting(page)).toBe(true);
    // The arrows retarget the open to the item beside it, which waits for nothing.
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator(`${shown} [data-fluidbox-media] video`)).toHaveCount(1);
  });

  test("at most three seconds, then flies and warns what it waited for", async ({ page }) => {
    const warnings = await load(page);
    const start = Date.now();
    await page.locator('#hooks [data-item="gated"]').click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open", {
      timeout: 6000,
    });
    expect(Date.now() - start).toBeGreaterThan(2900);
    expect(warnings.find((text) => text.includes("without its slide ready"))).toMatch(
      /Gated after 3000 ms .*a waitUntil promise/,
    );
  });

  test("for a waitUntil before its flight, and warns of one after it starts", async ({ page }) => {
    const warnings = await load(page);
    await page.locator('#hooks [data-item="gated"]').click();
    await page.waitForTimeout(200);
    const late = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const { gate } = window.slidesFixture;
          const overlay = document.querySelector("[data-fluidbox-viewer]")!;
          // A second promise before the flight still holds it.
          let second!: () => void;
          gate.wait!(new Promise<void>((open) => (second = open)));
          gate.open!();
          setTimeout(() => {
            const held = overlay.hasAttribute("data-fluidbox-prepared");
            second();
            const frame = () => {
              if (overlay.hasAttribute("data-fluidbox-prepared")) {
                requestAnimationFrame(frame);
                return;
              }
              // The flight is under way: this one comes too late to hold it.
              gate.wait!(new Promise(() => {}));
              resolve(held ? "held" : "flew");
            };
            frame();
          }, 300);
        }),
    );
    expect(late).toBe("held");
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    expect(warnings.some((text) => text.includes("after the opening flight started"))).toBe(true);
  });

  test("with reduced motion too, then appears without a flight", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await load(page);
    await page.locator('#hooks [data-item="gated"]').click();
    await page.waitForTimeout(300);
    expect(await waiting(page)).toBe(true);
    await page.evaluate(() => window.slidesFixture.gate.open!());
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator("[data-fluidbox-flight]")).toHaveCount(0);
  });
});

test.describe("video sources and attach", () => {
  const video = `${shown} video`;

  test("a video with sources tries them in order before src, and has no src of its own", async ({
    page,
  }) => {
    await load(page);
    await open(page, "#videos", "encoded");
    const player = page.locator(video);
    await expect(player).not.toHaveAttribute("src");
    // The sources come first, then the tracks.
    expect(
      await player.evaluate((element) => [...element.children].map((child) => child.localName)),
    ).toEqual(["source", "source", "track"]);
    expect(
      await player
        .locator("source")
        .evaluateAll((sources) =>
          sources.map((source) => [source.getAttribute("src"), source.getAttribute("type")]),
        ),
    ).toEqual([
      ["/video/drift.webm", "video/webm"],
      ["/video/drift.mp4", null],
    ]);
    await expect
      .poll(() => player.evaluate((element: HTMLVideoElement) => element.readyState))
      .toBeGreaterThanOrEqual(1);
    expect(await player.evaluate((element: HTMLVideoElement) => element.currentSrc)).toMatch(
      /\/video\/drift\.(webm|mp4)$/,
    );
    await expect(page.locator(`${shown} [data-fluidbox-error]`)).toBeHidden();
  });

  test("a video whose every source fails shows the error, and Retry tries them again", async ({
    page,
  }) => {
    await load(page);
    await open(page, "#videos", "broken");
    const error = page.locator(`${shown} [data-fluidbox-error]`);
    await expect(error).toBeVisible();
    const last = page.locator(`${shown} video source`).last();
    await last.evaluate((source) => Object.assign(window, { failed: source }));
    await error.getByRole("button").click();
    // New sources, and the error again once the last of them fails.
    await expect(page.locator(`${shown} video source`)).toHaveCount(2);
    expect(
      await last.evaluate((source) => source === (window as unknown as { failed: Element }).failed),
    ).toBe(false);
    await expect(error).toBeVisible();
  });

  test("a video slide unloads its sources, so the video stops loading", async ({ page }) => {
    await load(page);
    await open(page, "#videos", "encoded");
    await page.locator(video).evaluate((element) => Object.assign(window, { unloaded: element }));
    for (const position of [2, 3, 4]) {
      await page.keyboard.press("ArrowRight");
      await expect(page.locator(shown)).toHaveAttribute("aria-label", `Item ${position} of 4`);
    }
    expect(
      await page.evaluate(() => {
        const element = (window as unknown as { unloaded: HTMLVideoElement }).unloaded;
        return [element.querySelectorAll("source").length, element.hasAttribute("src")];
      }),
    ).toEqual([0, false]);
  });

  test("attach loads the video itself, and its signal aborts before the video empties", async ({
    page,
  }) => {
    await load(page);
    await open(page, "#streamed", "stream");
    const player = page.locator(video);
    await expect(player).toHaveAttribute("src", "/video/drift.mp4");
    await expect(player.locator("source")).toHaveCount(0);
    for (const position of [2, 3]) {
      await page.keyboard.press("ArrowRight");
      await expect(page.locator(shown)).toHaveAttribute("aria-label", `Item ${position} of 3`);
    }
    await expect
      .poll(() => page.evaluate(() => window.slidesFixture.attached))
      .toEqual(["attach stream 0", "abort stream /video/drift.mp4"]);
  });
});
