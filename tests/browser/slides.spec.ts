import { expect, test, type Page } from "@playwright/test";
import { holdMotion } from "./support/hold-motion";
import type { Fluidbox } from "@ogdakke/fluidbox";

declare global {
  interface Window {
    slidesFixture: {
      fluidbox: Fluidbox;
      replaced: Fluidbox;
      hooks: Fluidbox;
      videos: Fluidbox;
      streamed: Fluidbox;
      filled: Fluidbox;
      sheeted: Fluidbox;
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
      player: Fluidbox;
      playback: {
        returns: "stub" | "null" | "none";
        origins: {
          index: number;
          origin: { video?: { currentTime: number; paused: boolean; muted: boolean } } | null;
        }[];
      };
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

test("an image whose file has another shape than its item declares warns once in development", async ({
  page,
}) => {
  const warnings = await load(page);
  const misshapen = (items: string[]) => items.filter((text) => text.includes("declares"));
  await page.evaluate(async () => {
    const { fluidbox } = window.slidesFixture;
    // A 16:9 file declared square, and one declared at its own shape.
    await fluidbox.setItems([
      {
        type: "image",
        id: "square",
        src: "/photos/1016.webp",
        alt: "Canyon",
        width: 800,
        height: 800,
      },
      {
        type: "image",
        id: "true",
        src: "/photos/1016-1280.webp",
        alt: "Canyon",
        width: 1280,
        height: 720,
      },
    ]);
    await fluidbox.open("square");
  });
  await expect
    .poll(() => misshapen(warnings))
    .toEqual([
      expect.stringMatching(/Canyon declares 800×800, but \S*\/photos\/1016\.webp is 1920×1080/),
    ]);
  // The one declared at its own shape doesn't warn.
  await page.evaluate(() => window.slidesFixture.fluidbox.next());
  await expect(page.locator(`${shown} img`).first()).toHaveJSProperty("complete", true);
  await page.waitForTimeout(200);
  // Back to the misshapen one: still one warning.
  await page.evaluate(() => window.slidesFixture.fluidbox.previous());
  await page.waitForTimeout(200);
  expect(misshapen(warnings)).toHaveLength(1);
});

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

test("a box holding a custom element closes in its own frame, so the element never leaves the page", async ({
  page,
}) => {
  await load(page);
  await page.locator('#hooks [data-item="widget"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  const widget = page.locator(`${shown} fixture-widget`);
  await expect(widget).toHaveAttribute("data-connections", "1");
  const element = await widget.elementHandle();
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "closing");
  await expect(page.locator("[data-fluidbox-flight]")).toHaveCount(0);
  expect(await element!.evaluate((node) => !!node.closest("[data-fluidbox-dialog]"))).toBe(true);
  await expect(page.locator(dialog)).toHaveCount(0);
  // It left with the viewer, and never joined a flight on the way.
  expect(await element!.getAttribute("data-connections")).toBe("1");
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
    for (const position of [2, 3, 4]) {
      await page.keyboard.press("ArrowRight");
      await expect(page.locator(shown)).toHaveAttribute("aria-label", `Item ${position} of 4`);
    }
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.slidesFixture.attached.filter((entry) => entry.split(" ")[1] === "stream"),
        ),
      )
      .toEqual(["attach stream 0", "load stream", "abort stream /video/drift.mp4"]);
  });

  test("attach tells a neighbour's engine to wait until its slide shows", async ({ page }) => {
    await load(page);
    await open(page, "#streamed", "stream");
    // The neighbour mounted beside the opened video: attached, but not loading.
    await expect
      .poll(() => page.evaluate(() => window.slidesFixture.attached))
      .toContain("attach stream-2 0");
    const neighbour = page.locator('[data-fluidbox-slide][aria-hidden="true"] video').first();
    await expect(neighbour).not.toHaveAttribute("src");
    expect(await page.evaluate(() => window.slidesFixture.attached)).not.toContain("load stream-2");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(video)).toHaveAttribute("src", "/video/drift.webm");
    expect(await page.evaluate(() => window.slidesFixture.attached)).toContain("load stream-2");
  });

  test("a slide a glide lands on through new items is told it shows", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await load(page);
    await open(page, "#streamed", "stream");
    // A slow glide, and loop turned on while it is on its way.
    await page
      .locator(dialog)
      .evaluate((element: HTMLElement) =>
        element.style.setProperty("--fluidbox-motion-speed", "0.25"),
      );
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    await page.evaluate(() => window.slidesFixture.streamed.update({ loop: true }));
    await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 4");
    await expect(page.locator(video)).toHaveAttribute("src", "/video/drift.webm");
  });
});

test.describe("fill boxes", () => {
  const box = `${shown} [data-fluidbox-media]`;

  /** The box's layout size, its slide's width, and whether it has an aspect of its own. */
  const measure = (page: Page) =>
    page.locator(box).evaluate((element: HTMLElement) => ({
      width: element.offsetWidth,
      height: element.offsetHeight,
      slide: element.closest<HTMLElement>("[data-fluidbox-slide]")!.offsetWidth,
      aspect: element.style.getPropertyValue("--fluidbox-media-aspect"),
    }));

  test("a fill box takes the stage, with no aspect, and follows it as it resizes", async ({
    page,
  }) => {
    await load(page);
    await open(page, "#filled", "map");
    const first = await measure(page);
    expect(first.aspect).toBe("");
    expect(Math.abs(first.width - first.slide)).toBeLessThanOrEqual(1);
    // The stage less its insets: most of the window's height, and not the item's square.
    const viewport = page.viewportSize()!;
    expect(first.height).toBeGreaterThan(viewport.height * 0.6);
    expect(first.height).toBeLessThanOrEqual(viewport.height);
    expect(Math.abs(first.width - first.height)).toBeGreaterThan(20);
    await page.setViewportSize({ width: viewport.width - 100, height: viewport.height - 80 });
    await expect.poll(async () => (await measure(page)).width).toBe(first.width - 100);
    await expect.poll(async () => (await measure(page)).height).toBe(first.height - 80);
  });

  test("an image ignores fit", async ({ page }) => {
    await load(page);
    await open(page, "#filled", "photo-fill");
    const photo = await measure(page);
    expect(photo.aspect).toBe("800 / 800");
    expect(Math.abs(photo.width - photo.height)).toBeLessThanOrEqual(1);
    await expect(page.locator(box)).not.toHaveAttribute("data-fluidbox-fill");
  });

  for (const id of ["map", "sky"]) {
    test(`the opening flight starts from the poster's place in the box (${id})`, async ({
      page,
    }) => {
      test.skip(
        await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
        "Reduced motion has no flight.",
      );
      await load(page);
      await page.locator(`#filled [data-item="${id}"]`).scrollIntoViewIfNeeded();
      await holdMotion(page);
      await page.locator(`#filled [data-item="${id}"]`).click();
      await page.evaluate(() => window.__motion.ready());
      const from = (await page.locator(`#filled [data-item="${id}"] img`).boundingBox())!;
      const start = await page.evaluate(() => {
        const slide = document.querySelector('[data-fluidbox-slide][aria-hidden="false"]')!;
        const frame = slide.querySelector<HTMLElement>("[data-fluidbox-frame]")!;
        const media = slide.querySelector<HTMLElement>("[data-fluidbox-media]")!;
        const { x, y, width, height } = frame.getBoundingClientRect();
        const box = media.getBoundingClientRect();
        return { x, y, width, height, box: { width: box.width, height: box.height } };
      });
      // What shows is the square the trigger shows, not the stage-wide box.
      expect(Math.abs(start.x - from.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(start.y - from.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(start.width - from.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(start.height - from.height)).toBeLessThanOrEqual(2);
      // The box itself is the stage's shape, so it reaches past the square on one axis.
      expect(
        Math.max(start.box.width - from.width, start.box.height - from.height),
      ).toBeGreaterThan(2);
      await page.evaluate(() => window.__motion.release());
      await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
      const open = await measure(page);
      expect(Math.abs(open.width - open.slide)).toBeLessThanOrEqual(1);
    });
  }

  test("a fill box keeps its size while the sheet rises", async ({ page }) => {
    await load(page);
    await open(page, "#sheeted", "sheeted-map");
    const before = await measure(page);
    const sizes: { width: number; height: number }[] = [];
    // Record the box's layout size every frame while the sheet rises.
    await page.evaluate(() => {
      const media = document.querySelector<HTMLElement>(
        '[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]',
      )!;
      const seen: { width: number; height: number }[] = [];
      const record = () => {
        seen.push({ width: media.offsetWidth, height: media.offsetHeight });
        if (seen.length < 40) requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
      Object.assign(window, { sheetSizes: seen });
      window.slidesFixture.sheeted.sheet!.setSnap(1);
    });
    await expect(page.locator(dialog)).toHaveAttribute("data-sheet", "1");
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { sheetSizes: unknown[] }).sheetSizes.length),
      )
      .toBe(40);
    sizes.push(
      ...(await page.evaluate(
        () => (window as unknown as { sheetSizes: { width: number; height: number }[] }).sheetSizes,
      )),
    );
    for (const size of sizes) expect(size).toEqual({ width: before.width, height: before.height });
  });
});

test.describe("a player of your own and the trigger's video", () => {
  const card = '#playback [data-item="film-a"] video';

  async function playing(page: Page) {
    await page.goto("/slides.html");
    await page.locator(card).scrollIntoViewIfNeeded();
    await page.waitForFunction((selector) => {
      const video = document.querySelector<HTMLVideoElement>(selector);
      return !!video && !video.paused && video.currentTime > 0.2;
    }, card);
  }

  test("the slide opened from a playing trigger reads it live, and its neighbour reads null", async ({
    page,
  }) => {
    await playing(page);
    await page.locator('#playback [data-item="film-a"]').click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    const read = () =>
      page.evaluate(() =>
        window.slidesFixture.playback.origins.map(({ index, origin }) => ({
          index,
          time: origin?.video?.currentTime ?? null,
          muted: origin?.video?.muted ?? null,
        })),
      );
    const first = await read();
    expect(first.find((entry) => entry.index === 0)?.muted).toBe(true);
    expect(first.find((entry) => entry.index === 1)?.time).toBeNull();
    // Live: a later read is the trigger's time then.
    await page.waitForTimeout(300);
    const later = await read();
    expect(later.find((entry) => entry.index === 0)!.time!).toBeGreaterThan(
      first.find((entry) => entry.index === 0)!.time!,
    );
  });

  test("an open without a trigger gives no origin", async ({ page }) => {
    await page.goto("/slides.html");
    await page.evaluate(() => window.slidesFixture.player.open("film-a"));
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    const origins = await page.evaluate(() =>
      window.slidesFixture.playback.origins.map(({ origin }) => origin),
    );
    expect(origins.length).toBeGreaterThan(0);
    expect(origins.every((origin) => origin === null)).toBe(true);
  });

  for (const [returns, expected] of [
    ["stub", { time: 2.5, paused: false }],
    ["null", { time: 0.5, paused: true }],
    ["none", { time: 0.5, paused: true }],
  ] as const) {
    test(`closing hands the trigger's video ${returns === "stub" ? "the player's time" : `nothing (${returns})`}`, async ({
      page,
    }) => {
      await playing(page);
      await page.evaluate((returns) => (window.slidesFixture.playback.returns = returns), returns);
      await page.locator('#playback [data-item="film-a"]').click();
      await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
      // The trigger rests at a known frame, so a seek and a play show.
      await page.locator(card).evaluate(async (video: HTMLVideoElement) => {
        video.pause();
        const seeked = new Promise((resolve) =>
          video.addEventListener("seeked", resolve, { once: true }),
        );
        video.currentTime = 0.5;
        await seeked;
      });
      await page.keyboard.press("Escape");
      await expect(page.locator(dialog)).toHaveCount(0);
      const back = await page.locator(card).evaluate((video: HTMLVideoElement) => ({
        time: video.currentTime,
        paused: video.paused,
      }));
      expect(back.paused).toBe(expected.paused);
      expect(back.time).toBeGreaterThanOrEqual(expected.time - 0.01);
      expect(back.time).toBeLessThan(expected.time + 1);
    });
  }
});
