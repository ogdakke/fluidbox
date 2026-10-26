import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Fluidbox } from "@ogdakke/fluidbox";

declare global {
  interface Window {
    hotspotsFixture: {
      boxes: Record<"room" | "wide" | "filled" | "growing", Fluidbox>;
      pins: readonly { name: string; x: string | number; y: string | number }[];
      unnamed: Fluidbox;
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

test("the letterboxed photo's layer is the painted square, not the wide box", async ({ page }) => {
  await open(page, "wide");
  const [layer, box] = await page.evaluate(() =>
    ["[data-fluidbox-hotspots]", "[data-fluidbox-item-content]"].map((selector) => {
      const { width, height } = document
        .querySelector(`[data-fluidbox-dialog] ${selector}`)!
        .getBoundingClientRect();
      return width / height;
    }),
  );
  expect(box).toBeCloseTo(1.5, 1);
  expect(layer).toBeCloseTo(1, 2);
});

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
  // Without the browser's own scroll into view: the viewer pans.
  await books.evaluate((element: HTMLElement) => element.focus({ preventScroll: true }));
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
      frames.push([status, opacity("[data-fluidbox-hotspots]")]);
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
  expect(loaded).toEqual([]);
  // And a slide that adds one does.
  await page.goto("/hotspots.html");
  await page.locator("#room button").first().click();
  await expect(page.locator(pin)).toHaveCount(3);
  expect(loaded.length).toBeGreaterThan(0);
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
