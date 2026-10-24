import { expect, test, type Page } from "@playwright/test";
import type { Fluidbox } from "@ogdakke/fluidbox";
import { holdMotion } from "./support/hold-motion";

// A site's unlayered resets (Tailwind v3 preflight, modern-normalize, and
// `img, video { max-width: 100%; height: auto; display: block }`) load before the
// package CSS on /resets.html?resets. The viewer's mechanics must not notice:
// every box below matches the same page without the resets.

type Box = { left: number; top: number; width: number; height: number };

interface Geometry {
  opening: { start: Box; end: Box };
  open: Record<string, Box | number | null | undefined>;
  zoomed: Record<string, Box | number | null | undefined> | null;
  closing: { start: Box; end: Box } | null;
}

declare global {
  interface Window {
    resetsFixture: {
      fluidbox: Fluidbox;
    };
  }
}

async function measure(page: Page, query: string, id: string, zoom: boolean): Promise<Geometry> {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/resets.html${query}`);
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  await page
    .locator(`[data-item="${id}"] img`)
    .evaluate((image: HTMLImageElement) => image.decode());
  await expect(page.locator("[data-site-resets]")).toHaveCount(query.includes("resets") ? 1 : 0);

  await holdMotion(page);
  const opening = await page.evaluate(async (id) => {
    const rect = (target: Element): Box => {
      const { left, top, width, height } = target.getBoundingClientRect();
      return { left, top, width, height };
    };
    void window.resetsFixture.fluidbox.open(id);
    const end = await window.__motion.ready();
    const frame = document.querySelector(
      '[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-frame]',
    )!;
    window.__motion.seek(0);
    const start = rect(frame);
    window.__motion.seek(end);
    const landed = rect(frame);
    window.__motion.release();
    return { start, end: landed };
  }, id);
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");

  const read = () =>
    page.evaluate(() => {
      const rect = (selector: string): Box | null => {
        const target = document.querySelector(selector);
        if (!target) return null;
        const { left, top, width, height } = target.getBoundingClientRect();
        return { left, top, width, height };
      };
      const active = '[data-fluidbox-slide][aria-hidden="false"]';
      const slides = document.querySelector<HTMLElement>("[data-fluidbox-slides]")!;
      return {
        dialog: rect("[data-fluidbox-dialog]"),
        backdrop: rect("[data-fluidbox-backdrop]"),
        slides: rect("[data-fluidbox-slides]"),
        stripOffset: slides.scrollLeft,
        slide: rect(active),
        frame: rect(`${active} [data-fluidbox-frame]`),
        media: rect(`${active} [data-fluidbox-media], ${active} [data-fluidbox-item-content]`),
        poster: rect(`${active} [data-fluidbox-media-poster]`),
        close: rect("[data-fluidbox-close]"),
        previous: rect("[data-fluidbox-previous]"),
        next: rect("[data-fluidbox-next]"),
        zoomViewport: rect("[data-fluidbox-zoom-viewport]"),
        zoomCanvas: rect("[data-fluidbox-zoom-canvas]"),
        zoomMedia: rect("[data-fluidbox-zoom-anchor] [data-fluidbox-media]"),
        zoomScroll: document.querySelector("[data-fluidbox-zoom-viewport]")?.scrollLeft ?? null,
        thumbnails: rect("[data-fluidbox-thumbnails]"),
        thumbnailsScroll: rect("[data-fluidbox-thumbnails-scroll]"),
        ...Object.fromEntries(
          [...document.querySelectorAll("[data-fluidbox-thumbnails-item]")].flatMap(
            (item, index) => {
              const image = item.querySelector("img");
              const box = (target: Element) => {
                const { left, top, width, height } = target.getBoundingClientRect();
                return { left, top, width, height };
              };
              return [
                [`thumbnail${index}`, box(item)],
                [`thumbnailImage${index}`, image ? box(image) : null],
              ];
            },
          ),
        ),
      };
    });
  const open = await read();

  let zoomed: Geometry["zoomed"] = null;
  if (zoom) {
    expect(await page.evaluate(() => window.resetsFixture.fluidbox.zoomTo(2))).toBe(true);
    zoomed = await read();
    expect(zoomed.zoomMedia).not.toBeNull();
    expect(await page.evaluate(() => window.resetsFixture.fluidbox.zoomReset())).toBe(true);
  }

  await holdMotion(page);
  const closing = await page.evaluate(async () => {
    const rect = (target: Element): Box => {
      const { left, top, width, height } = target.getBoundingClientRect();
      return { left, top, width, height };
    };
    document.querySelector<HTMLElement>("[data-fluidbox-close]")!.click();
    const end = await window.__motion.ready();
    // A video that played closes in place, with no flight.
    const frame = document.querySelector("[data-fluidbox-flight] [data-fluidbox-frame]");
    if (!frame) {
      window.__motion.release();
      return null;
    }
    window.__motion.seek(0);
    const start = rect(frame);
    window.__motion.seek(Math.max(0, end - 1));
    const landed = rect(frame);
    window.__motion.release();
    return { start, end: landed };
  });
  await expect(page.locator("[data-fluidbox-viewer]")).toHaveCount(0);
  return { opening, open, zoomed, closing };
}

function expectSame(actual: unknown, expected: unknown, path: string) {
  if (typeof expected === "number") {
    expect(typeof actual, path).toBe("number");
    expect(
      Math.abs((actual as number) - expected),
      `${path}: ${String(actual)} vs ${expected}`,
    ).toBeLessThanOrEqual(1);
    return;
  }
  if (expected === null || typeof expected !== "object") {
    expect(actual, path).toEqual(expected);
    return;
  }
  expect(actual, path).not.toBeNull();
  for (const [key, value] of Object.entries(expected)) {
    expectSame((actual as Record<string, unknown>)[key], value, `${path}.${key}`);
  }
}

const cases = [
  { id: "square", what: "a fitted photo, zoomed", zoom: true },
  { id: "portrait", what: "a portrait photo", zoom: false },
  { id: "video", what: "a video", zoom: false },
  { id: "map", what: "a fill slide", zoom: false },
];

for (const { id, what, zoom } of cases) {
  for (const thumbnails of [false, true]) {
    test(`unlayered resets leave ${what}${thumbnails ? " with thumbnails" : ""} where it was`, async ({
      page,
    }, testInfo) => {
      const extra = thumbnails ? "&thumbnails" : "";
      const plain = await measure(page, `?plain${extra}`, id, zoom);
      const reset = await measure(page, `?resets${extra}`, id, zoom);
      await testInfo.attach("geometry", {
        body: JSON.stringify({ plain, reset }, null, 2),
        contentType: "application/json",
      });
      // The flight starts on the trigger and lands on the slide's media.
      expect(
        Math.abs(plain.opening.end.width - (plain.open.frame as Box).width),
      ).toBeLessThanOrEqual(1);
      expectSame(reset, plain, id);
    });
  }
}
