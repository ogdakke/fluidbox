import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Fluidbox } from "@ogdakke/fluidbox";
import type { CustomBox } from "../../apps/examples/fixtures/hotspots";

declare global {
  interface Window {
    hotspotsFixture: {
      boxes: Record<"room" | "wide" | "filled" | "growing", Fluidbox>;
      pins: readonly { name: string; x: string | number; y: string | number }[];
      unnamed: Fluidbox;
      custom: (options: CustomBox) => Fluidbox;
    };
  }
}

const dialog = "[data-fluidbox-dialog]";
const pin = "[data-fluidbox-hotspot]";

async function open(page: Page, grid: string) {
  await page.goto("/hotspots.html");
  await page.locator(`#${grid} button`).first().click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(pin)).toHaveCount(3);
  // The photo has loaded, so it paints and the layer has its natural size.
  await expect(page.locator(`${dialog} [data-fluidbox-drawn]`)).not.toHaveAttribute(
    "data-fluidbox-image-pending",
  );
}

async function zoomTo(page: Page, grid: string, scale: number) {
  expect(
    await page.evaluate(
      ([key, to]) =>
        window.hotspotsFixture.boxes[key as keyof Window["hotspotsFixture"]["boxes"]].zoomTo(to),
      [grid, scale] as const,
    ),
  ).toBe(true);
}

/**
 * How far each pin's centre is from its point on the photo as painted: the
 * drawn image's rectangle, contained, worked out apart from the runtime.
 */
async function misses(page: Page) {
  return page.evaluate(() => {
    const image = document.querySelector<HTMLImageElement>(
      "[data-fluidbox-dialog] [data-fluidbox-drawn], [data-fluidbox-zoom-viewport] [data-fluidbox-drawn]",
    )!;
    const box = image.getBoundingClientRect();
    const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const left = box.left + (box.width - width) / 2;
    const top = box.top + (box.height - height) / 2;
    const fraction = (value: string | number) =>
      typeof value === "number" ? value / 1600 : parseFloat(value) / 100;
    return window.hotspotsFixture.pins.map(({ name, x, y }) => {
      const rect = document.querySelector(`[data-pin="${name}"]`)!.getBoundingClientRect();
      return Math.hypot(
        rect.left + rect.width / 2 - (left + fraction(x) * width),
        rect.top + rect.height / 2 - (top + fraction(y) * height),
      );
    });
  });
}

const sizes = (page: Page) =>
  page
    .locator(pin)
    .evaluateAll((pins) => pins.map((each) => Math.round(each.getBoundingClientRect().width)));

for (const grid of ["room", "wide", "filled"]) {
  test(`hotspots stay on their points at zoom 1, 2 and 4 in the ${grid} box`, async ({ page }) => {
    await open(page, grid);
    for (const scale of [1, 2, 4]) {
      if (scale > 1) await zoomTo(page, grid, scale);
      for (const miss of await misses(page)) expect(miss).toBeLessThan(0.5);
    }
  });
}

test("hotspots keep their screen size as the photo zooms", async ({ page }) => {
  await open(page, "room");
  const before = await sizes(page);
  await zoomTo(page, "room", 4);
  expect(await sizes(page)).toEqual(before);
});

test("hotspots with scaleWithZoom grow with the zoom", async ({ page }) => {
  await open(page, "growing");
  const before = await sizes(page);
  await zoomTo(page, "growing", 2);
  const after = await sizes(page);
  for (const [index, size] of after.entries()) {
    expect(size / before[index]!).toBeCloseTo(2, 1);
  }
});

test("hotspots are buttons in reading order, after the photo, and named", async ({ page }) => {
  await open(page, "room");
  const pins = page.locator(pin);
  await expect(pins).toHaveCount(3);
  for (const [index, name] of ["Framed print", "Books", "Plant"].entries()) {
    await expect(pins.nth(index)).toHaveAccessibleName(name);
    await expect(pins.nth(index)).toHaveAttribute("type", "button");
  }
  await pins.first().focus();
  await page.keyboard.press("Tab");
  await expect(pins.nth(1)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(pins.nth(2)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(pins.nth(1)).toBeFocused();
});

test("focusing a hotspot pans a zoomed photo to it", async ({ page }) => {
  await open(page, "room");
  // At 4× about the middle, the books at the left are out of view.
  await zoomTo(page, "room", 4);
  const books = page.locator('[data-pin="Books"]');
  const inView = () =>
    books.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= window.innerWidth &&
        rect.bottom <= window.innerHeight
      );
    });
  expect(await inView()).toBe(false);
  // From the keyboard, the way a pan on focus is for.
  await page
    .locator('[data-pin="Framed print"]')
    .evaluate((element: HTMLElement) => element.focus({ preventScroll: true }));
  await page.keyboard.press("Tab");
  await expect(books).toBeFocused();
  await expect.poll(inView).toBe(true);
  await expect(page.locator(dialog)).toHaveAttribute("data-zoomed", "");
});

test("a press on a hotspot doesn't zoom or close the viewer", async ({ page }) => {
  await open(page, "room");
  await page.evaluate(() =>
    document
      .querySelector('[data-pin="Plant"]')!
      .addEventListener("click", () => document.body.setAttribute("data-pressed", "")),
  );
  await page.locator('[data-pin="Plant"]').click();
  await expect(page.locator("body")).toHaveAttribute("data-pressed", "");
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(dialog)).not.toHaveAttribute("data-zoomed", "");
});

test("hotspots are hidden while the photo flies, and fade in with the controls", async ({
  page,
}) => {
  await page.goto("/hotspots.html");
  // Every frame of the open and the close: the viewer's status and the pins' opacity.
  await page.evaluate(() => {
    const frames: [string, number][] = ((window as any).frames_ = []);
    const opacity = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return 0;
      const style = getComputedStyle(element);
      return style.visibility === "hidden" ? 0 : Number(style.opacity);
    };
    const sample = () => {
      const status =
        document.querySelector("[data-fluidbox-dialog]")?.getAttribute("data-fluidbox-status") ??
        "none";
      frames.push([status, opacity("[data-fluidbox-hotspot]")]);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.locator("#room button").first().click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(pin).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  const frames = await page.evaluate(() => (window as any).frames_ as [string, number][]);
  const opening = frames.filter(([status]) => status === "opening");
  const closing = frames.filter(([status]) => status === "closing");
  expect(opening.length).toBeGreaterThan(0);
  expect(closing.length).toBeGreaterThan(0);
  expect(opening[0]![1]).toBe(0);
  // They only fade in, with the chrome's reveal as the flight lands.
  for (const [index, [, pins]] of opening.entries()) {
    expect(pins).toBeGreaterThanOrEqual(opening[index - 1]?.[1] ?? 0);
  }
  for (const [, pins] of closing) expect(pins).toBe(0);
});

test("axe passes with hotspots on show and zoomed", async ({ page }) => {
  await open(page, "room");
  const scan = async () =>
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .include(dialog)
        .analyze()
    ).violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
  expect(await scan()).toEqual([]);
  await zoomTo(page, "room", 2);
  expect(await scan()).toEqual([]);
});

test("a hotspot without a name warns in development", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await open(page, "room");
  expect(warnings.filter((text) => text.includes("accessible name"))).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  await page.evaluate(() => window.hotspotsFixture.unnamed.open(0));
  await expect
    .poll(() => warnings.filter((text) => text.includes("accessible name")))
    .toHaveLength(1);
});

test("a viewer without hotspots never loads their code", async ({ page }) => {
  const loaded: string[] = [];
  page.on("request", (request) => {
    if (/[/\\]hotspots[^/\\]*\.[jt]s/.test(request.url())) loaded.push(request.url());
  });
  await page.goto("/slides.html");
  await page.locator('#slides [data-item="product"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await page.evaluate(() => (window as any).slidesFixture.fluidbox.zoomTo(2));
  // Long enough for a request the open or the zoom set off to have gone out.
  await page.waitForTimeout(500);
  expect(loaded).toEqual([]);
  // And a slide that adds one does.
  await page.goto("/hotspots.html");
  await page.locator("#room button").first().click();
  await expect(page.locator(pin)).toHaveCount(3);
  expect(loaded.length).toBeGreaterThan(0);
});

test("hotspots can't take focus while the photo flies", async ({ page }) => {
  await open(page, "room");
  // Every frame of the close in which the box flies: whether a pin takes focus.
  await page.evaluate(() => {
    const frames: boolean[] = ((window as any).focusable_ = []);
    const sample = () => {
      const pin = document.querySelector<HTMLElement>("[data-fluidbox-hotspot]");
      if (!pin) return;
      if (pin.closest("[data-fluidbox-flight]")) {
        pin.focus();
        frames.push(document.activeElement === pin);
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.keyboard.press("Escape");
  await expect(page.locator(dialog)).toHaveCount(0);
  const frames = await page.evaluate(() => (window as any).focusable_ as boolean[]);
  expect(frames.length).toBeGreaterThan(0);
  expect(frames).not.toContain(true);
});

test("hotspots follow the photo as the window resizes", async ({ page }) => {
  await open(page, "room");
  await page.setViewportSize({ width: 700, height: 500 });
  await expect.poll(async () => Math.max(...(await misses(page)))).toBeLessThan(0.5);
});

test("a mouse press on a hotspot of a zoomed photo doesn't pan it", async ({ page }) => {
  await open(page, "room");
  await zoomTo(page, "room", 2);
  // Where the photo is on the screen: a pan would move it.
  const photo = page.locator(
    `${dialog} [data-fluidbox-drawn], [data-fluidbox-zoom-viewport] [data-fluidbox-drawn]`,
  );
  const scroll = async () => {
    const { x, y } = (await photo.first().boundingBox())!;
    return [Math.round(x), Math.round(y)];
  };
  // Once the zoom has settled: the photo still, and the pin on it.
  const plant = page.locator('[data-pin="Plant"]');
  let last = "";
  await expect
    .poll(async () => {
      const now = JSON.stringify([await photo.first().boundingBox(), await plant.boundingBox()]);
      const settled = now === last;
      last = now;
      return settled;
    })
    .toBe(true);
  const box = (await plant.boundingBox())!;
  expect(
    await page.evaluate(
      ([x, y]) =>
        document.elementFromPoint(x!, y!)?.closest("[data-pin]")?.getAttribute("data-pin"),
      [box.x + box.width / 2, box.y + box.height / 2],
    ),
  ).toBe("Plant");
  const before = await scroll();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 150, box.y - 100, { steps: 6 });
  await page.mouse.up();
  // Long enough for a zoom out the release set off to show.
  await page.waitForTimeout(300);
  // A pan would follow the mouse's 150 and 100 px, and a zoom out move it too.
  const after = await scroll();
  expect(Math.abs(after[0]! - before[0]!)).toBeLessThan(20);
  expect(Math.abs(after[1]! - before[1]!)).toBeLessThan(20);
  await expect(page.locator(dialog)).toHaveAttribute("data-zoomed", "");
});

/** Open a `custom` box: an `<img>` of the fixture's own, as `options` say. */
async function openCustom(page: Page, options: CustomBox) {
  await page.goto("/hotspots.html");
  await page.evaluate((options) => window.hotspotsFixture.custom(options).open(0), options);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(pin)).toHaveCount(3);
}

/**
 * How far each pin is from its point, worked out apart from the runtime: on
 * the custom `<img>` painted as `fit`, at `P% + Lpx` of the space left on
 * each side, its pixels counted on `space`; without one, on the box.
 */
async function customMisses(
  page: Page,
  fit: string,
  position: readonly [readonly [number, number], readonly [number, number]] = [
    [50, 0],
    [50, 0],
  ],
  space?: readonly [number, number],
) {
  return page.evaluate(
    ({ fit, position, space }) => {
      const drawn = document.querySelector<HTMLImageElement>("img[data-custom]");
      const box = (
        drawn ?? document.querySelector("[data-fluidbox-dialog] [data-fluidbox-media]")!
      ).getBoundingClientRect();
      let { left, top, width, height } = box;
      const [spaceWidth, spaceHeight] =
        space ?? (drawn ? [drawn.naturalWidth, drawn.naturalHeight] : [1500, 1000]);
      if (drawn) {
        const contain = Math.min(box.width / drawn.naturalWidth, box.height / drawn.naturalHeight);
        const cover = Math.max(box.width / drawn.naturalWidth, box.height / drawn.naturalHeight);
        const scale =
          fit === "cover"
            ? cover
            : fit === "none"
              ? 1
              : fit === "scale-down"
                ? Math.min(1, contain)
                : contain;
        width = drawn.naturalWidth * scale;
        height = drawn.naturalHeight * scale;
        left += (position[0][0] / 100) * (box.width - width) + position[0][1];
        top += (position[1][0] / 100) * (box.height - height) + position[1][1];
      }
      const fraction = (value: string | number, of: number) =>
        typeof value === "number" ? value / of : parseFloat(value) / 100;
      return window.hotspotsFixture.pins.map(({ name, x, y }) => {
        const rect = document.querySelector(`[data-pin="${name}"]`)!.getBoundingClientRect();
        return Math.hypot(
          rect.left + rect.width / 2 - (left + fraction(x, spaceWidth) * width),
          rect.top + rect.height / 2 - (top + fraction(y, spaceHeight) * height),
        );
      });
    },
    { fit, position, space },
  );
}

const loaded = (page: Page) =>
  expect(page.locator("img[data-custom]")).toHaveJSProperty("complete", true);

for (const fit of ["cover", "none", "scale-down"]) {
  test(`hotspots stay on an object-fit: ${fit} photo`, async ({ page }) => {
    await openCustom(page, { fit });
    await loaded(page);
    await expect.poll(async () => Math.max(...(await customMisses(page, fit)))).toBeLessThan(0.5);
  });
}

for (const [position, expected] of [
  [
    "right 10px bottom 20px",
    [
      [100, -10],
      [100, -20],
    ],
  ],
  [
    "calc(25% + 10px) 0",
    [
      [25, 10],
      [0, 0],
    ],
  ],
] as const) {
  test(`hotspots follow object-position: ${position}`, async ({ page }) => {
    await openCustom(page, { position });
    await loaded(page);
    await expect
      .poll(async () => Math.max(...(await customMisses(page, "contain", expected))))
      .toBeLessThan(0.5);
  });
}

test("hotspots stay on their points in a padded box", async ({ page }) => {
  await openCustom(page, { padding: "40px 10px" });
  await loaded(page);
  await expect
    .poll(async () => Math.max(...(await customMisses(page, "contain"))))
    .toBeLessThan(0.5);
});

test("pixels count the image's declared size where it differs from its own", async ({ page }) => {
  await openCustom(page, { declared: [3200, 3200] });
  await loaded(page);
  await expect
    .poll(async () => Math.max(...(await customMisses(page, "contain", undefined, [3200, 3200]))))
    .toBeLessThan(0.5);
});

test("hotspots on a box without an image are on the box", async ({ page }) => {
  await openCustom(page, { noMedia: true });
  await expect
    .poll(async () => Math.max(...(await customMisses(page, "contain"))))
    .toBeLessThan(0.5);
});

test("hotspots move to their points once a late image loads", async ({ page }) => {
  await page.route("**/fjord-room.webp?late", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await openCustom(page, { src: "/products/fjord-room.webp?late" });
  await loaded(page);
  await expect
    .poll(async () => Math.max(...(await customMisses(page, "contain"))))
    .toBeLessThan(0.5);
});

test("a hotspot taken out before the hotspots' code is in stays out", async ({ page }) => {
  await openCustom(page, {});
  await loaded(page);
  await page.waitForTimeout(300);
  await expect(page.locator(pin)).toHaveCount(3);
  for (const each of await page.locator(pin).all()) {
    await expect(each).toHaveAttribute("aria-label");
  }
});

test("a mouse click on a hotspot at the edge of a zoomed photo reaches it", async ({ page }) => {
  await open(page, "room");
  await zoomTo(page, "room", 4);
  const viewport = page.locator("[data-fluidbox-zoom-viewport]");
  await expect(viewport).toHaveCount(1);
  const plant = page.locator('[data-pin="Plant"]');
  await plant.evaluate((element) =>
    element.addEventListener("click", () => document.body.setAttribute("data-pressed", "")),
  );
  // The plant half off the window's right edge, where a pan on focus would move it.
  await page.evaluate(() => {
    const viewport = document.querySelector("[data-fluidbox-zoom-viewport]")!;
    const rect = document.querySelector('[data-pin="Plant"]')!.getBoundingClientRect();
    viewport.scrollBy({ left: rect.left + rect.width / 2 - (innerWidth - 4), behavior: "instant" });
  });
  const box = (await plant.boundingBox())!;
  const width = page.viewportSize()!.width;
  expect(box.x + box.width).toBeGreaterThan(width);
  // A press a person holds for a moment.
  await page.mouse.move(width - 3, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect(page.locator("body")).toHaveAttribute("data-pressed", "");
});

test("a hotspot outside the box, or in a positioned wrapper, warns in development", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.goto("/hotspots.html");
  await page.evaluate(() => window.hotspotsFixture.custom({ misplaced: true }).open(0));
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect
    .poll(() => warnings.filter((text) => text.includes("Fluidbox hotspot is")).sort())
    .toEqual([
      expect.stringContaining("inside an element that positions it"),
      expect.stringContaining("outside its slide's media box"),
    ]);
});

test("a press on a hotspot let go beside the box doesn't close a viewer without zoom", async ({
  page,
}) => {
  await openCustom(page, { noZoom: true });
  await loaded(page);
  const plant = (await page.locator('[data-pin="Plant"]').boundingBox())!;
  const box = (await page.locator(`${dialog} [data-fluidbox-media]`).boundingBox())!;
  await page.mouse.move(plant.x + plant.width / 2, plant.y + plant.height / 2);
  await page.mouse.down();
  // Off the box onto the slide around it, where a click closes the viewer.
  await page.mouse.move(box.x - 12, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
});

test("after a click on a hotspot, a click on the photo zooms and one on the page's content reaches it", async ({
  page,
}) => {
  await openCustom(page, { content: true });
  await loaded(page);
  await page.locator('[data-pin="Plant"]').click();
  await page.locator("[data-content]").click();
  await expect(page.locator("body")).toHaveAttribute("data-pressed", "");
  await expect(page.locator(dialog)).not.toHaveAttribute("data-zoomed", "");
  await page.locator('[data-pin="Books"]').click();
  // On the photo, away from the pins and the button.
  const photo = (await page.locator("img[data-custom]").boundingBox())!;
  await page.mouse.click(photo.x + photo.width * 0.35, photo.y + photo.height * 0.85);
  await expect(page.locator(dialog)).toHaveAttribute("data-zoomed", "");
});

test("pixels count the image's own size when only its width is declared", async ({ page }) => {
  await openCustom(page, { declared: [3200] });
  await loaded(page);
  await expect
    .poll(async () => Math.max(...(await customMisses(page, "contain"))))
    .toBeLessThan(0.5);
});

test("hotspots whose code fails to load stay hidden, with nothing unhandled", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/fluidbox\/src\/hotspots\.ts/, (route) => route.abort());
  await page.goto("/hotspots.html");
  await page.evaluate(() => {
    (window as any).unhandled_ = 0;
    addEventListener("unhandledrejection", () => (window as any).unhandled_++);
  });
  await page.locator("#room button").first().click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(pin)).toHaveCount(3);
  await page.waitForTimeout(500);
  for (const each of await page.locator(pin).all()) await expect(each).toBeHidden();
  expect(await page.evaluate(() => (window as any).unhandled_)).toBe(0);
  expect(errors).toEqual([]);
});
