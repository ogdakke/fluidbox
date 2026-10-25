import { expect, test, type Page } from "@playwright/test";
import type { Fluidbox } from "@ogdakke/fluidbox";
import { holdMotion } from "./support/hold-motion";
import { playerMessages, stubMedia } from "./support/media";

declare global {
  interface Window {
    mediaFixture: {
      fluidbox: Fluidbox;
      log: string[];
      closes: string[];
    };
    liveFixture: { fluidbox: Fluidbox; unbind: Record<string, () => void> };
    __modelViewerDelay?: number;
    __modelViewerTainted?: boolean;
    __modelViewerNoCanvas?: boolean;
    __oldCard?: HTMLElement;
  }
}

const dialog = "[data-fluidbox-dialog]";
const shown = '[data-fluidbox-slide][aria-hidden="false"]';

async function load(page: Page) {
  const requests = await stubMedia(page);
  await page.goto("/media.html");
  await expect(page.locator("#media button")).toHaveCount(8);
  return requests;
}

async function open(page: Page, id: string) {
  await page.locator(`#media [data-item="${id}"]`).click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
}

/** Close, counting the flights the close puts in the page. */
const closeCountingFlights = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let count = 0;
        const observer = new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node instanceof HTMLElement && node.matches("[data-fluidbox-flight]")) count++;
            }
          }
        });
        observer.observe(document.body, { childList: true });
        void window.mediaFixture.fluidbox.close().then(() => {
          observer.disconnect();
          resolve(count);
        });
      }),
  );

const index = (page: Page) => page.evaluate(() => window.mediaFixture.fluidbox.state.index);
const log = (page: Page) => page.evaluate(() => window.mediaFixture.log);

test.describe("slide activity", () => {
  test("a custom slide hears when it comes on show and when it leaves", async ({ page }) => {
    await load(page);
    await open(page, "a");
    // The slides load as the viewer prepares, and the one it opens on comes on show.
    expect(await log(page)).toEqual(["a mount inactive", "b mount inactive", "a active"]);
    await page.evaluate(() => window.mediaFixture.fluidbox.next());
    await expect.poll(async () => (await log(page)).slice(3)).toEqual(["a inactive", "b active"]);
    await expect(page.locator(shown).getByText("b: on show")).toBeVisible();
    await page.evaluate(() => window.mediaFixture.fluidbox.previous());
    await expect.poll(async () => (await log(page)).slice(5)).toEqual(["b inactive", "a active"]);
    await page.evaluate(() => window.mediaFixture.fluidbox.close());
    await expect(page.locator(dialog)).toHaveCount(0);
    // A closed viewer keeps its slides for the next open, with none on show.
    expect((await log(page)).slice(7)).toEqual(["a inactive"]);
    await open(page, "a");
    expect((await log(page)).slice(8)).toEqual(["a active"]);
  });

  test("a slide that mounts beside the one on show starts inactive and comes on show", async ({
    page,
  }) => {
    await load(page);
    await open(page, "photo");
    expect(await log(page)).toEqual(["a mount inactive"]);
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => log(page))
      .toEqual(["a mount inactive", "b mount inactive", "a active"]);
  });
});

test.describe("YouTube and Vimeo facades", () => {
  test("a video shows its poster and loads its player only when Play is pressed", async ({
    page,
  }) => {
    const requests = await load(page);
    await open(page, "youtube:M7lc1UVf-VE");
    const slide = page.locator(shown);
    const box = slide.locator("[data-fluidbox-embed=youtube]");
    await expect(box.locator('[data-fluidbox-media-poster="thumbnail"]')).toHaveAttribute(
      "src",
      "/products/fjord-room-thumb.webp",
    );
    // YouTube's own still, sharper, over the thumbnail once it has decoded.
    const poster = box.locator('[data-fluidbox-media-poster="poster"]');
    await expect(poster).toHaveAttribute("src", "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg");
    await expect(poster).not.toHaveAttribute("data-fluidbox-media-pending", "");
    expect(requests.players).toEqual([]);
    await expect(box.locator("iframe")).toHaveCount(0);

    const play = slide.getByRole("button", { name: "Play YouTube video" });
    await play.click();
    const frame = box.locator("iframe");
    await expect(frame).toHaveCount(1);
    const src = new URL((await frame.getAttribute("src"))!);
    expect(src.origin).toBe("https://www.youtube-nocookie.com");
    expect(src.pathname).toBe("/embed/M7lc1UVf-VE");
    expect(src.searchParams.get("autoplay")).toBe("1");
    expect(src.searchParams.get("enablejsapi")).toBe("1");
    await expect(frame).toHaveAttribute("title", "YouTube video");
    await expect(frame).toHaveAttribute(
      "allow",
      "autoplay; fullscreen; picture-in-picture; encrypted-media",
    );
    await expect(frame).toHaveAttribute("sandbox", /allow-scripts/);
    await expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    await expect(frame).toBeFocused();
    await expect(box).toHaveAttribute("data-fluidbox-embed-ready", "");
    expect(requests.players).toHaveLength(1);
  });

  test("a playing video pauses when the viewer moves on, and unloads further away", async ({
    page,
  }) => {
    const requests = await load(page);
    await open(page, "youtube:M7lc1UVf-VE");
    await page.locator(shown).getByRole("button", { name: "Play YouTube video" }).click();
    await expect(page.locator(`${shown} [data-fluidbox-embed-ready]`)).toHaveCount(1);
    await page.evaluate(() => window.mediaFixture.fluidbox.next());
    await expect
      .poll(() => playerMessages(page, "https://www.youtube-nocookie.com/"))
      .toEqual([
        {
          data: JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
          origin: "http://127.0.0.1:" + new URL(page.url()).port,
        },
      ]);
    // Still one slide away, the player keeps its place; two away, it goes.
    await expect(page.locator("[data-fluidbox-embed=youtube] iframe")).toHaveCount(1);
    await page.evaluate(() => window.mediaFixture.fluidbox.next());
    await expect(page.locator("[data-fluidbox-embed=youtube] iframe")).toHaveCount(0);
    await expect(page.locator("[data-fluidbox-embed=youtube]")).toHaveCount(0);
    expect(page.frames().some((frame) => frame.url().includes("youtube"))).toBe(false);
    await page.evaluate(() => window.mediaFixture.fluidbox.previous());
    await page.evaluate(() => window.mediaFixture.fluidbox.previous());
    await expect(
      page.locator(shown).getByRole("button", { name: "Play YouTube video" }),
    ).toBeVisible();
    expect(requests.players).toHaveLength(1);
  });

  test("a Vimeo video plays from player.vimeo.com and pauses through its API", async ({ page }) => {
    await load(page);
    await open(page, "vimeo:76979871");
    await page.locator(shown).getByRole("button", { name: "Play Vimeo video" }).click();
    const frame = page.locator(`${shown} [data-fluidbox-embed=vimeo] iframe`);
    await expect(frame).toHaveAttribute(
      "src",
      "https://player.vimeo.com/video/76979871?h=8272103f6e&autoplay=1&dnt=1",
    );
    await expect(page.locator(`${shown} [data-fluidbox-embed-ready]`)).toHaveCount(1);
    await page.evaluate(() => window.mediaFixture.fluidbox.previous());
    await expect
      .poll(async () =>
        (await playerMessages(page, "https://player.vimeo.com/")).map(
          (message) => (message as { data: string }).data,
        ),
      )
      .toEqual([JSON.stringify({ method: "pause" })]);
  });

  test("a playing video closes in its frame, so its player doesn't reload", async ({ page }) => {
    const requests = await load(page);
    await open(page, "youtube:M7lc1UVf-VE");
    await page.locator(shown).getByRole("button", { name: "Play YouTube video" }).click();
    await expect(page.locator(`${shown} [data-fluidbox-embed-ready]`)).toHaveCount(1);
    expect(await closeCountingFlights(page)).toBe(0);
    expect(requests.players).toHaveLength(1);
  });

  test("a closed viewer leaves a played video on its poster for the next open", async ({
    page,
  }) => {
    const requests = await load(page);
    await open(page, "youtube:M7lc1UVf-VE");
    await page.locator(shown).getByRole("button", { name: "Play YouTube video" }).click();
    await expect(page.locator(`${shown} [data-fluidbox-embed-ready]`)).toHaveCount(1);
    await page.evaluate(() => window.mediaFixture.fluidbox.close());
    await expect(page.locator(dialog)).toHaveCount(0);
    await open(page, "youtube:M7lc1UVf-VE");
    await expect(
      page.locator(shown).getByRole("button", { name: "Play YouTube video" }),
    ).toBeVisible();
    await expect(page.locator(`${shown} iframe`)).toHaveCount(0);
    expect(requests.players).toHaveLength(1);
  });

  for (const [id, name] of [
    ["youtube:M7lc1UVf-VE", "YouTube"],
    ["vimeo:76979871", "Vimeo"],
  ] as const) {
    test(`a reopen of a played ${name} video holds its poster, with no player coming back`, async ({
      page,
    }) => {
      const requests = await load(page);
      await open(page, id);
      await page
        .locator(shown)
        .getByRole("button", { name: `Play ${name} video` })
        .click();
      await expect(page.locator(`${shown} [data-fluidbox-embed-ready]`)).toHaveCount(1);
      await page.evaluate(() => window.mediaFixture.fluidbox.close());
      await expect(page.locator(dialog)).toHaveCount(0);
      // Whether an iframe joined the page during the reopen, and whether the
      // poster showed as its flight started.
      const watched = page.evaluate(
        () =>
          new Promise<{ iframe: boolean; poster: boolean }>((resolve) => {
            let iframe = false;
            const observer = new MutationObserver((records) => {
              for (const record of records) {
                for (const node of record.addedNodes) {
                  if (
                    node instanceof Element &&
                    (node.matches("iframe") || node.querySelector("iframe"))
                  )
                    iframe = true;
                }
              }
            });
            observer.observe(document.body, { subtree: true, childList: true });
            const check = () => {
              const viewer = document.querySelector("[data-fluidbox-viewer]");
              if (viewer && !viewer.hasAttribute("data-fluidbox-prepared")) {
                const poster = viewer.querySelector<HTMLElement>(
                  '[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media-poster="poster"]',
                );
                observer.disconnect();
                resolve({
                  iframe,
                  poster:
                    !!poster &&
                    getComputedStyle(poster).visibility !== "hidden" &&
                    getComputedStyle(poster).opacity !== "0",
                });
                return;
              }
              requestAnimationFrame(check);
            };
            check();
          }),
      );
      await open(page, id);
      expect(await watched).toEqual({ iframe: false, poster: true });
      await expect(page.locator(`${shown} iframe`)).toHaveCount(0);
      await expect(
        page.locator(shown).getByRole("button", { name: `Play ${name} video` }),
      ).toBeVisible();
      expect(requests.players).toHaveLength(1);
    });
  }

  test("a video that hasn't played flies home like a photo", async ({ page }) => {
    await load(page);
    await open(page, "youtube:M7lc1UVf-VE");
    expect(await closeCountingFlights(page)).toBe(1);
  });

  test("the opening flies the thumbnail, painted from its first frame", async ({ page }) => {
    await load(page);
    await holdMotion(page);
    await page.locator('#media [data-item="youtube:M7lc1UVf-VE"]').click();
    await page.evaluate(() => window.__motion.ready());
    const first = await page.evaluate(() => {
      const slide = document.querySelector('[data-fluidbox-slide][aria-hidden="false"]')!;
      const content = slide.querySelector<HTMLElement>("[data-fluidbox-item-content]")!;
      const thumbnail = content.querySelector<HTMLImageElement>(
        '[data-fluidbox-media-poster="thumbnail"]',
      )!;
      const box = content.getBoundingClientRect();
      const painted = thumbnail.getBoundingClientRect();
      return {
        moving: content.getAnimations().length > 0,
        decoded: thumbnail.complete && thumbnail.naturalWidth > 0,
        covers:
          Math.abs(box.width - painted.width) < 1 && Math.abs(box.height - painted.height) < 1,
      };
    });
    expect(first).toEqual({ moving: true, decoded: true, covers: true });
    await page.evaluate(() => window.__motion.release());
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(
      page.locator(
        `${shown} [data-fluidbox-media-poster="poster"]:not([data-fluidbox-media-pending])`,
      ),
    ).toBeVisible();
  });
});

test.describe("360° spin", () => {
  const spin = "/products/spin/fjord-00.webp";

  test("the arrow keys step its frames as a slider, not the viewer", async ({ page }) => {
    await load(page);
    await open(page, spin);
    const slider = page.locator(shown).getByRole("slider", {
      name: "Framed print, all the way round",
    });
    await expect(slider).toHaveAttribute("aria-valuetext", "Frame 1 of 36");
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuetext", "Frame 2 of 36");
    await expect(slider).toHaveAttribute("aria-valuenow", "2");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(slider).toHaveAttribute("aria-valuetext", "Frame 36 of 36");
    await page.keyboard.press("Home");
    await expect(slider).toHaveAttribute("aria-valuetext", "Frame 1 of 36");
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute("aria-valuetext", "Frame 36 of 36");
    expect(await index(page)).toBe(5);
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    // Escape still closes.
    await page.keyboard.press("Escape");
    await expect(page.locator(dialog)).toHaveCount(0);
  });

  test("a drag turns it and lets go onto a frame, and the viewer stays", async ({ page }) => {
    await load(page);
    await open(page, spin);
    const slider = page.locator(shown).getByRole("slider");
    await expect(slider).toHaveAttribute("data-fluidbox-spin-loaded", "");
    const box = (await slider.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    // A quarter of the width is a quarter of a turn: nine frames.
    for (let step = 1; step <= 10; step++) {
      await page.mouse.move(box.x + box.width / 2 + (box.width / 4) * (step / 10), y);
    }
    await expect(slider).toHaveAttribute("aria-valuenow", "10");
    // A pointer that rests before it lifts doesn't throw the spin.
    await page.waitForTimeout(120);
    await page.mouse.up();
    await expect(slider).toHaveAttribute("aria-valuenow", "10");
    await expect(slider).toHaveAttribute("data-frame", "9");
    await expect(page.locator(`${shown} [data-fluidbox-media-poster="poster"]`)).toHaveAttribute(
      "src",
      "/products/spin/fjord-09.webp",
    );
    expect(await index(page)).toBe(5);
  });

  test("a throw keeps it turning, then it settles on a frame", async ({ page }) => {
    await load(page);
    await open(page, spin);
    const slider = page.locator(shown).getByRole("slider");
    await expect(slider).toHaveAttribute("data-fluidbox-spin-loaded", "");
    const box = (await slider.boundingBox())!;
    const y = box.y + box.height / 2;
    // The pointer goes down for real, so the spin can capture it; the throw is
    // then paced in the page, as a remote mouse can't time a release within the
    // 60 ms that tells a throw from a rest.
    await slider.evaluate((element) =>
      element.addEventListener(
        "pointerdown",
        (event) =>
          ((window as { pointerId?: number }).pointerId = (event as PointerEvent).pointerId),
        { once: true },
      ),
    );
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();
    const released = await slider.evaluate(
      async (element, { x, y, width }) => {
        const { pointerId } = window as { pointerId?: number };
        const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        const send = (type: string, clientX: number) =>
          element.dispatchEvent(
            new PointerEvent(type, {
              pointerId,
              isPrimary: true,
              pointerType: "mouse",
              clientX,
              clientY: y,
              bubbles: true,
            }),
          );
        for (let step = 1; step <= 4; step++) {
          await frame();
          send("pointermove", x + width * step * 0.04);
        }
        const value = Number(element.getAttribute("aria-valuenow"));
        send("pointerup", x + width * 0.16);
        return value;
      },
      { x: box.x + box.width * 0.3, y, width: box.width },
    );
    await page.mouse.up();
    await expect
      .poll(async () => Number(await slider.getAttribute("aria-valuenow")))
      .not.toBe(released);
    // At rest: the frame it shows is the value it reads, and it no longer moves.
    let last = "";
    await expect
      .poll(
        async () => {
          const now = (await slider.getAttribute("aria-valuenow"))!;
          const settled = now === last;
          last = now;
          return settled;
        },
        { intervals: [600] },
      )
      .toBe(true);
    expect(Number(await slider.getAttribute("data-frame"))).toBe(Number(last) - 1);
    expect(await index(page)).toBe(5);
  });

  test("it shows frame 0 at once and loads the rest only once it is on show", async ({ page }) => {
    await load(page);
    const frames: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/products/spin/fjord-") && !request.url().includes("thumb")) {
        frames.push(new URL(request.url()).pathname);
      }
    });
    // The Vimeo slide is the spin's neighbour: the spin mounts there, but isn't on show.
    await open(page, "vimeo:76979871");
    await expect(page.locator("[data-fluidbox-spin]")).toHaveCount(1);
    await expect(
      page.locator('[data-fluidbox-spin] [data-fluidbox-media-poster="poster"]'),
    ).toHaveAttribute("src", "/products/spin/fjord-00.webp");
    await page.waitForTimeout(300);
    expect([...new Set(frames)]).toEqual(["/products/spin/fjord-00.webp"]);
    await page.evaluate(() => window.mediaFixture.fluidbox.next());
    await expect(page.locator(`${shown} [data-fluidbox-spin-loaded]`)).toHaveCount(1);
    expect(new Set(frames).size).toBe(36);
  });

  test("a swipe on it turns it rather than the slides", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "pixel-7", "Touch goes through Chromium's CDP.");
    await load(page);
    await open(page, spin);
    const slider = page.locator(shown).getByRole("slider");
    const session = await page.context().newCDPSession(page);
    const touch = (
      type: "touchStart" | "touchMove" | "touchEnd",
      points: { x: number; y: number }[],
    ) =>
      session.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: points.map((point) => ({ ...point, id: 1 })),
      });
    const box = (await slider.boundingBox())!;
    const y = box.y + box.height / 2;
    const scroller = page.locator("[data-fluidbox-slides]");
    const left = await scroller.evaluate((element) => element.scrollLeft);
    await touch("touchStart", [{ x: box.x + box.width * 0.7, y }]);
    for (let step = 1; step <= 12; step++) {
      await touch("touchMove", [{ x: box.x + box.width * (0.7 - step * 0.03), y }]);
    }
    await touch("touchEnd", []);
    await expect(slider).not.toHaveAttribute("aria-valuenow", "1");
    expect(await scroller.evaluate((element) => element.scrollLeft)).toBe(left);
    expect(await index(page)).toBe(5);
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  });
});

test.describe("3D model", () => {
  const model = "/products/damaged-helmet/damaged-helmet.glb";

  test("loads model-viewer only once its slide is on show, and shows its poster till then", async ({
    page,
  }) => {
    const requests = await load(page);
    await open(page, "/products/spin/fjord-00.webp");
    // The neighbour shows its poster, and nothing loads for it.
    const poster = page.locator('[data-fluidbox-model] [data-fluidbox-media-poster="poster"]');
    await expect(poster).toHaveAttribute("src", "/products/damaged-helmet/damaged-helmet.webp");
    await page.waitForTimeout(200);
    expect(requests.modelViewer).toEqual([]);
    await expect(page.locator("model-viewer")).toHaveCount(0);

    await page.evaluate(() => window.mediaFixture.fluidbox.next());
    const element = page.locator(`${shown} model-viewer`);
    await expect(element).toHaveCount(1);
    expect(requests.modelViewer).toHaveLength(1);
    for (const [name, value] of [
      ["src", model],
      ["alt", "Damaged Helmet in 3D"],
      ["camera-controls", ""],
      ["touch-action", "none"],
      ["ar", ""],
      ["ar-modes", "webxr quick-look"],
      ["ios-src", "/products/damaged-helmet/damaged-helmet.usdz"],
      ["data-fluidbox-owns-input", ""],
    ]) {
      await expect(element).toHaveAttribute(name!, value!);
    }
    await expect(page.locator(`${shown} [data-fluidbox-model]`)).toHaveAttribute(
      "data-fluidbox-model-ready",
      "",
    );
    await expect(page.locator(`${shown} [data-fluidbox-media-poster="poster"]`)).toBeHidden();
    // Back and forth: the element loaded once.
    await page.evaluate(() => window.mediaFixture.fluidbox.previous());
    await page.evaluate(() => window.mediaFixture.fluidbox.next());
    await expect(page.locator(`${shown} model-viewer`)).toHaveCount(1);
    expect(
      await page.evaluate(() => (window as { __modelViewerLoads?: number }).__modelViewerLoads),
    ).toBe(1);
  });

  test("opens again on a model that draws: each show gets an element that never left the page", async ({
    page,
  }) => {
    await load(page);
    const ready = page.locator(`${shown} [data-fluidbox-model-ready]`);
    const element = page.locator(`${shown} model-viewer`);
    // A slow load, so an opening that didn't wait for the model would land first.
    await page.evaluate(
      () => ((window as { __modelViewerDelay?: number }).__modelViewerDelay = 900),
    );
    for (let round = 0; round < 3; round++) {
      // Whether the model had drawn when the opening landed.
      const landed = page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const observer = new MutationObserver(() => {
              const dialog = document.querySelector("[data-fluidbox-dialog]");
              if (dialog?.getAttribute("data-fluidbox-status") !== "open") return;
              observer.disconnect();
              resolve(!!dialog.querySelector("[data-fluidbox-model-ready] model-viewer"));
            });
            observer.observe(document.body, {
              subtree: true,
              childList: true,
              attributeFilter: ["data-fluidbox-status"],
            });
          }),
      );
      await open(page, model);
      expect(await landed).toBe(true);
      await expect(ready).toHaveCount(1);
      await expect(element).toHaveCount(1);
      await expect(element).toHaveAttribute("data-connections", "1");
      await expect(element).toBeVisible();
      await expect(page.locator(`${shown} [data-fluidbox-media-poster="poster"]`)).toBeHidden();
      await page.evaluate(() => window.mediaFixture.fluidbox.close());
      await expect(page.locator(dialog)).toHaveCount(0);
      // Off show, the slide keeps its poster and no element.
      expect(await page.locator("model-viewer").count()).toBe(0);
    }
    // Away and back: a new element, on the poster until it loads.
    await open(page, model);
    await expect(ready).toHaveCount(1);
    await page.evaluate(() => window.mediaFixture.fluidbox.next());
    await expect(page.locator("model-viewer")).toHaveCount(0);
    await page.evaluate(() => window.mediaFixture.fluidbox.previous());
    await expect(page.locator(`${shown} [data-fluidbox-media-poster="poster"]`)).toBeVisible();
    await expect(ready).toHaveCount(1);
    await expect(element).toHaveAttribute("data-connections", "1");
    await expect(page.locator(`${shown} [data-fluidbox-media-poster="poster"]`)).toBeHidden();
    expect(
      await page.evaluate(() => (window as { __modelViewerLoads?: number }).__modelViewerLoads),
    ).toBe(1);
  });

  test("a drag turns the model, and the arrow keys turn it while focused", async ({ page }) => {
    await load(page);
    await open(page, model);
    const element = page.locator(`${shown} model-viewer`);
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
    const box = (await element.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    for (let step = 1; step <= 8; step++)
      await page.mouse.move(box.x + box.width / 2 - step * 20, y);
    await page.mouse.up();
    await expect(element).toHaveAttribute("data-orbit", "-160");
    expect(await index(page)).toBe(6);

    await element.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(element).toHaveAttribute("data-orbit", "-140");
    expect(await index(page)).toBe(6);
    // The viewer still moves by its buttons, and by the keys off the model.
    await page.locator(dialog).focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => index(page)).toBe(7);
  });

  test("a pinch on the model zooms the model, not the slide", async ({ page }, testInfo) => {
    test.skip(
      ["iphone-15-pro", "ipad-pro-11"].includes(testInfo.project.name),
      "Mobile WebKit has no wheel to pinch a trackpad with.",
    );
    await load(page);
    await open(page, model);
    const element = page.locator(`${shown} model-viewer`);
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
    const box = (await element.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // A trackpad pinch is a wheel with the control key.
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -100);
    await page.keyboard.up("Control");
    await expect
      .poll(async () => Number(await element.getAttribute("data-zoom")))
      .toBeGreaterThan(1);
    await expect(page.locator(dialog)).not.toHaveAttribute("data-zoomed", "");
    expect(await index(page)).toBe(6);
  });

  test("a swipe on the model turns it, and the controls still move the viewer", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "pixel-7", "Touch goes through Chromium's CDP.");
    await load(page);
    await open(page, model);
    const element = page.locator(`${shown} model-viewer`);
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
    const session = await page.context().newCDPSession(page);
    const swipe = async (from: { x: number; y: number }, dx: number, dy = 0) => {
      const point = (step: number) => [
        { x: from.x + (dx * step) / 12, y: from.y + (dy * step) / 12, id: 1 },
      ];
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(0) });
      for (let step = 1; step <= 12; step++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: point(step),
        });
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const box = (await element.boundingBox())!;
    const centre = { x: box.x + box.width * 0.7, y: box.y + box.height / 2 };
    await swipe(centre, -box.width * 0.4);
    await expect(element).not.toHaveAttribute("data-orbit", "0");
    // Down, as a dismiss would go: the model keeps it too.
    await swipe(centre, 0, 160);
    await page.waitForTimeout(300);
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    expect(await index(page)).toBe(6);
    // Sideways too: a fill model is the whole stage, and every swipe on it is its own.
    await swipe(centre, -box.width * 0.6);
    await page.waitForTimeout(300);
    expect(await index(page)).toBe(6);
    await page.locator(`${dialog} [data-fluidbox-next]`).click();
    await expect.poll(() => index(page)).toBe(7);
  });
});

test.describe("every close tells the slide on show", () => {
  const closes = (page: Page) => page.evaluate(() => window.mediaFixture.closes);
  const closed = (page: Page) => expect(page.locator(dialog)).toHaveCount(0);
  const frame = `${shown} [data-fluidbox-frame]`;
  const paths: Record<string, (page: Page) => Promise<unknown>> = {
    Escape: (page) => page.keyboard.press("Escape"),
    "the close button": (page) => page.locator(`${dialog} [data-fluidbox-close]`).click(),
    "the backdrop": (page) => page.mouse.click(5, 5),
    "close()": (page) => page.evaluate(() => window.mediaFixture.fluidbox.close()),
    "a drag to dismiss": async (page) => {
      const target = page.locator(frame);
      const box = (await target.boundingBox())!;
      const pointer = (clientY: number) => ({
        pointerId: 7,
        pointerType: "touch",
        isPrimary: true,
        clientX: box.x + box.width / 2,
        clientY,
      });
      const y = box.y + box.height / 2;
      await target.dispatchEvent("pointerdown", pointer(y));
      await target.dispatchEvent("pointermove", pointer(y + 120));
      await target.dispatchEvent("pointerup", pointer(y + 120));
    },
    "a wheel to dismiss": (page) =>
      page.locator(frame).evaluate(async (element) => {
        for (let step = 0; step < 6; step++) {
          element.dispatchEvent(
            new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 }),
          );
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }),
  };
  for (const [name, close] of Object.entries(paths)) {
    test(`a close by ${name}`, async ({ page }, testInfo) => {
      test.skip(
        name === "a wheel to dismiss" && testInfo.project.use.hasTouch === true,
        "Touch devices have no wheel.",
      );
      await load(page);
      await open(page, "a");
      expect(await closes(page)).toEqual([]);
      await close(page);
      await closed(page);
      expect(await closes(page)).toEqual(["a"]);
    });
  }

  test("a close that a reopen interrupts, once", async ({ page }) => {
    await load(page);
    await open(page, "a");
    await page.evaluate(() => {
      void window.mediaFixture.fluidbox.close();
      void window.mediaFixture.fluidbox.open("a");
    });
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    expect(await closes(page)).toEqual(["a"]);
  });

  test("the slide on show hears it, after moving", async ({ page }) => {
    await load(page);
    await open(page, "a");
    await page.evaluate(() => window.mediaFixture.fluidbox.next());
    await expect.poll(() => index(page)).toBe(2);
    await page.evaluate(() => window.mediaFixture.fluidbox.close());
    await closed(page);
    expect(await closes(page)).toEqual(["b"]);
  });
});

test.describe("live 3D thumbnail", () => {
  const card = (page: Page, id: string) => page.locator(`#live [data-item="${id}"] model-viewer`);
  const slideModel = (page: Page) => page.locator(`${shown} model-viewer`);
  const status = (page: Page) => page.evaluate(() => window.liveFixture.fluidbox.state.status);

  async function loadLive(page: Page) {
    await stubMedia(page);
    await page.goto("/media-live.html");
    // The cards' own models have drawn.
    await expect(card(page, "live-a")).toHaveAttribute("data-orbit-at-load", "0");
    await expect(card(page, "live-b")).toHaveAttribute("data-orbit-at-load", "0");
  }

  /** Drag across a model by `distance` CSS pixels, a multiple of 8, in whole-pixel steps. */
  async function turn(page: Page, model: ReturnType<Page["locator"]>, distance: number) {
    await model.scrollIntoViewIfNeeded();
    const box = (await model.boundingBox())!;
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let step = 1; step <= 8; step++) await page.mouse.move(x + (distance * step) / 8, y);
    await page.mouse.up();
  }

  async function openCard(page: Page, id: string) {
    await card(page, id).click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  }

  async function closeViewer(page: Page) {
    await page.evaluate(() => window.liveFixture.fluidbox.close());
    await expect(page.locator(dialog)).toHaveCount(0);
  }

  /**
   * The orbit the slide's snapshot shows: a copy of the fake's canvas keeps its
   * first pixel, and the picture `toDataURL` makes names it.
   */
  const snapshotOrbit = (page: Page) =>
    page.locator(`${shown} [data-fluidbox-media-poster="snapshot"]`).evaluate((snapshot) => {
      if (snapshot instanceof HTMLImageElement) return Number(snapshot.src.split("#orbit=")[1]);
      const [red, green] = (snapshot as HTMLCanvasElement)
        .getContext("2d")!
        .getImageData(0, 0, 1, 1).data;
      return red! + green! * 256 - 512;
    });

  /** How often each model element has joined the page. */
  const connections = (page: Page) =>
    page.locator("model-viewer").evaluateAll((models) => models.map((m) => m.dataset.connections));

  test("a drag on the card turns it and doesn't open the viewer", async ({ page }) => {
    await loadLive(page);
    await turn(page, card(page, "live-a"), -48);
    await expect(card(page, "live-a")).toHaveAttribute("data-orbit", "-48");
    // The drag ended in a click on the card, which the trigger let go.
    await expect(card(page, "live-a")).toHaveAttribute("data-clicks", "1");
    await page.waitForTimeout(400);
    expect(await status(page)).toBe("closed");
    await expect(page.locator(dialog)).toHaveCount(0);
  });

  test("the card is one stop for a keyboard and a screen reader, and Enter opens it", async ({
    page,
  }) => {
    await loadLive(page);
    const a = page.locator('#live [data-item="live-a"]');
    await expect(card(page, "live-a")).toHaveAttribute("aria-hidden", "true");
    expect(
      await card(page, "live-a").evaluate(
        (model) => model.shadowRoot!.querySelector<HTMLElement>(".userInput")!.tabIndex,
      ),
    ).toBe(-1);
    await expect(a).toHaveAccessibleName("Open 3D view: Damaged Helmet");
    await a.focus();
    await page.keyboard.press("Tab");
    await expect(page.locator('#live [data-item="live-b"]')).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(a).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await page.keyboard.press("Escape");
    await expect(page.locator(dialog)).toHaveCount(0);
    await expect(a).toBeFocused();
  });

  test("a model put in a trigger after it was bound is quieted too", async ({ page }) => {
    await loadLive(page);
    const still = page.locator('#live [data-item="still-c"]');
    await still.evaluate((button) => {
      const model = document.createElement("model-viewer");
      model.setAttribute("src", "/products/damaged-helmet/damaged-helmet.glb?copy=c");
      model.setAttribute("camera-controls", "");
      button.replaceChildren(model);
    });
    const model = still.locator("model-viewer");
    await expect(model).toHaveAttribute("aria-hidden", "true");
    await expect
      .poll(() =>
        model.evaluate(
          (element) => element.shadowRoot!.querySelector<HTMLElement>(".userInput")!.tabIndex,
        ),
      )
      .toBe(-1);
  });

  test("unbinding a card, or taking its model out, gives the model its own accessibility back", async ({
    page,
  }) => {
    await loadLive(page);
    const input = (model: ReturnType<Page["locator"]>) =>
      model.evaluate(
        (element) => element.shadowRoot!.querySelector<HTMLElement>(".userInput")!.tabIndex,
      );
    await expect.poll(() => input(card(page, "live-a"))).toBe(-1);
    await page.evaluate(() => window.liveFixture.unbind["live-a"]!());
    await expect(card(page, "live-a")).not.toHaveAttribute("aria-hidden", /./);
    expect(await input(card(page, "live-a"))).toBe(0);
    // Content changes in a trigger no longer bound don't quiet it again.
    await page.locator('#live [data-item="live-a"]').evaluate((button) => button.append(" "));
    await page.waitForTimeout(50);
    await expect(card(page, "live-a")).not.toHaveAttribute("aria-hidden", /./);

    // A model taken out of a bound trigger is restored too.
    await expect.poll(() => input(card(page, "live-b"))).toBe(-1);
    const restored = await page.locator('#live [data-item="live-b"]').evaluate(async (button) => {
      const model = button.querySelector<HTMLElement>("model-viewer")!;
      button.replaceChildren(document.createElement("span"));
      await new Promise((resolve) => setTimeout(resolve));
      return {
        hidden: model.getAttribute("aria-hidden"),
        tabIndex: model.shadowRoot!.querySelector<HTMLElement>(".userInput")!.tabIndex,
      };
    });
    expect(restored).toEqual({ hidden: null, tabIndex: 0 });
  });

  test("a hover after a press doesn't swallow the next activation", async ({ page }) => {
    await loadLive(page);
    const a = page.locator('#live [data-item="live-a"]');
    const hover = async () => {
      const box = (await card(page, "live-a").boundingBox())!;
      for (let step = 0; step <= 4; step++) {
        await page.mouse.move(box.x + 20 + step * 10, box.y + box.height / 2);
      }
    };
    // A plain click opens; the pointer then wanders over the card with no button held.
    await card(page, "live-a").click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await closeViewer(page);
    await hover();
    await a.evaluate((button: HTMLElement) => button.click());
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await closeViewer(page);
    // After a drag, too: it swallows only its own click.
    await turn(page, card(page, "live-a"), -48);
    await expect(card(page, "live-a")).toHaveAttribute("data-orbit", "-48");
    await page.waitForTimeout(50);
    expect(await status(page)).toBe("closed");
    await hover();
    await a.evaluate((button: HTMLElement) => button.click());
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  });

  test("a model put in a trigger after bind opens on its view, and takes the slide's home", async ({
    page,
  }) => {
    await loadLive(page);
    const still = page.locator('#live [data-item="still-c"]');
    await still.evaluate((button) => {
      const model = document.createElement("model-viewer");
      model.setAttribute("src", "/products/damaged-helmet/damaged-helmet.glb?copy=c");
      model.setAttribute("camera-controls", "");
      button.replaceChildren(model);
    });
    await expect(card(page, "still-c")).toHaveAttribute("data-orbit-at-load", "0");
    await turn(page, card(page, "still-c"), -40);
    await expect(card(page, "still-c")).toHaveAttribute("data-orbit", "-40");
    await openCard(page, "still-c");
    await expect(slideModel(page)).toHaveAttribute("data-orbit-at-load", "-40");
    await turn(page, slideModel(page), 64);
    await expect(slideModel(page)).toHaveAttribute("data-orbit", "24");
    await closeViewer(page);
    await expect(card(page, "still-c")).toHaveAttribute("data-camera-orbit", "24deg 75deg 2m");
  });

  test("a card whose model is replaced opens on the new one's view and turns only it", async ({
    page,
  }) => {
    await loadLive(page);
    await turn(page, card(page, "live-a"), 32);
    await expect(card(page, "live-a")).toHaveAttribute("data-orbit", "32");
    // As a framework remounts it: a new element in the old one's place.
    await page.locator('#live [data-item="live-a"]').evaluate((button) => {
      const old = button.querySelector<HTMLElement>("model-viewer")!;
      window.__oldCard = old;
      const model = document.createElement("model-viewer");
      model.setAttribute("src", old.getAttribute("src")!);
      model.setAttribute("camera-controls", "");
      button.replaceChildren(model);
    });
    await expect(card(page, "live-a")).toHaveAttribute("data-orbit-at-load", "0");
    await turn(page, card(page, "live-a"), -24);
    await expect(card(page, "live-a")).toHaveAttribute("data-orbit", "-24");
    await openCard(page, "live-a");
    await expect(slideModel(page)).toHaveAttribute("data-orbit-at-load", "-24");
    await turn(page, slideModel(page), 80);
    await expect(slideModel(page)).toHaveAttribute("data-orbit", "56");
    await closeViewer(page);
    await expect(card(page, "live-a")).toHaveAttribute("data-camera-orbit", "56deg 75deg 2m");
    const old = await page.evaluate(() => ({
      orbit: window.__oldCard!.dataset.cameraOrbit ?? null,
      snapshots: window.__oldCard!.dataset.snapshots ?? null,
    }));
    expect(old).toEqual({ orbit: null, snapshots: null });
  });

  test("a model with textures from another origin still flies a snapshot, which can't be read back", async ({
    page,
  }) => {
    await page.addInitScript(() => (window.__modelViewerTainted = true));
    await loadLive(page);
    // The card's canvas has drawn the texture, so it is tainted.
    await expect
      .poll(() =>
        card(page, "live-a").evaluate((model) => {
          try {
            model.shadowRoot!.querySelector("canvas")!.toDataURL();
            return "readable";
          } catch (error) {
            return (error as DOMException).name;
          }
        }),
      )
      .toBe("SecurityError");
    await turn(page, card(page, "live-a"), -48);
    await expect(card(page, "live-a")).toHaveAttribute("data-orbit", "-48");
    await openCard(page, "live-a");
    await expect(slideModel(page)).toHaveAttribute("data-orbit-at-load", "-48");
    const unreadable = (page: Page) =>
      page.evaluate((shown) => {
        const snapshot = document.querySelector<HTMLCanvasElement>(
          `${shown} canvas[data-fluidbox-media-poster="snapshot"]`,
        );
        if (!snapshot) return "none";
        try {
          snapshot.getContext("2d")!.getImageData(0, 0, 1, 1);
          return "readable";
        } catch (error) {
          return (error as DOMException).name;
        }
      }, shown);
    expect(await unreadable(page)).toBe("SecurityError");
    await expect(page.locator(`${shown} model-viewer`)).toHaveCount(1);
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
    await turn(page, slideModel(page), 64);
    await expect(slideModel(page)).toHaveAttribute("data-orbit", "16");
    // The close carries a copy of the slide's view, as it starts.
    const closing = page.evaluate(
      (shown) =>
        new Promise<string>((resolve) => {
          const box = document.querySelector(`${shown} [data-fluidbox-model]`)!;
          const check = () => {
            const dialog = document.querySelector("[data-fluidbox-dialog]");
            if (dialog?.getAttribute("data-fluidbox-status") !== "closing") {
              requestAnimationFrame(check);
              return;
            }
            const snapshot = box.querySelector('[data-fluidbox-media-poster="snapshot"]');
            resolve(`${snapshot?.localName} ${getComputedStyle(snapshot!).visibility}`);
          };
          check();
        }),
      shown,
    );
    await page.evaluate(() => void window.liveFixture.fluidbox.close());
    expect(await closing).toBe("canvas visible");
    await expect(page.locator(dialog)).toHaveCount(0);
    await expect(card(page, "live-a")).toHaveAttribute("data-camera-orbit", "16deg 75deg 2m");
  });

  test("a model-viewer without its canvas flies a PNG of its view, with one warning", async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" && message.text().includes("no canvas")) {
        warnings.push(message.text());
      }
    });
    await page.addInitScript(() => (window.__modelViewerNoCanvas = true));
    await loadLive(page);
    await turn(page, card(page, "live-a"), -48);
    await expect(card(page, "live-a")).toHaveAttribute("data-orbit", "-48");
    await openCard(page, "live-a");
    await expect(page.locator(`${shown} img[data-fluidbox-media-poster="snapshot"]`)).toHaveCount(
      1,
    );
    expect(await snapshotOrbit(page)).toBe(-48);
    await expect(card(page, "live-a")).toHaveAttribute("data-snapshots", "1");
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
    await turn(page, slideModel(page), 64);
    await closeViewer(page);
    await expect(card(page, "live-a")).toHaveAttribute("data-camera-orbit", "16deg 75deg 2m");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("4.0.0");
  });

  test("a slide that leaves drops its snapshot, so it comes back on its own view", async ({
    page,
  }) => {
    await loadLive(page);
    await turn(page, card(page, "live-a"), -48);
    await expect(card(page, "live-a")).toHaveAttribute("data-orbit", "-48");
    await openCard(page, "live-a");
    await expect(page.locator(`${shown} [data-fluidbox-media-poster="snapshot"]`)).toHaveCount(1);
    await page.evaluate(() => window.liveFixture.fluidbox.next());
    await expect(page.locator(`${shown} model-viewer[src$="copy=b"]`)).toHaveCount(1);
    await page.evaluate(() => window.liveFixture.fluidbox.previous());
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
    await expect(page.locator(`${shown} [data-fluidbox-media-poster="snapshot"]`)).toHaveCount(0);
  });

  test("a model-viewer without .userInput keeps its focus and its name, with one warning", async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" && message.text().includes(".userInput")) {
        warnings.push(message.text());
      }
    });
    await page.addInitScript(() => {
      (window as { __modelViewerNoInput?: boolean }).__modelViewerNoInput = true;
    });
    await stubMedia(page);
    await page.goto("/media-live.html");
    await expect(card(page, "live-a")).toHaveAttribute("data-orbit-at-load", "0");
    await expect(card(page, "live-a")).not.toHaveAttribute("aria-hidden", /./);
    await expect(card(page, "live-b")).not.toHaveAttribute("aria-hidden", /./);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("4.0.0");
  });

  test("a click opens on the card's view: its first frame and the flight's snapshot", async ({
    page,
  }) => {
    await loadLive(page);
    await turn(page, card(page, "live-a"), -48);
    await expect(card(page, "live-a")).toHaveAttribute("data-orbit", "-48");
    await openCard(page, "live-a");
    await expect(slideModel(page)).toHaveAttribute("data-orbit-at-load", "-48");
    await expect(slideModel(page)).toHaveAttribute("data-camera-orbit", "-48deg 75deg 2m");
    // Unzoomed, the slide keeps its own field of view.
    await expect(slideModel(page)).toHaveAttribute("data-field-of-view", "auto");
    await expect(
      page.locator(`${shown} canvas[data-fluidbox-media-poster="snapshot"]`),
    ).toHaveCount(1);
    expect(await snapshotOrbit(page)).toBe(-48);
    // A copy of the card's pixels, with no picture encoded.
    await expect(card(page, "live-a")).not.toHaveAttribute("data-snapshots", /./);
  });

  test("a close turns the card to the view the slide was left at", async ({ page }) => {
    await loadLive(page);
    await openCard(page, "live-a");
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
    await turn(page, slideModel(page), 96);
    await expect(slideModel(page)).toHaveAttribute("data-orbit", "96");
    await closeViewer(page);
    await expect(card(page, "live-a")).toHaveAttribute("data-camera-orbit", "96deg 75deg 2m");
    await expect(card(page, "live-a")).toHaveAttribute("data-field-of-view", "auto");
    await expect(card(page, "live-b")).not.toHaveAttribute("data-camera-orbit", /./);
    // No element ever left the page and came back: the slide's went, the cards stayed.
    expect(await connections(page)).toEqual(["1", "1"]);
  });

  test("a zoom comes home, and the card's own field of view comes back unzoomed", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.use.hasTouch === true, "The fake zooms on a wheel.");
    await loadLive(page);
    await openCard(page, "live-a");
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
    await slideModel(page).hover();
    await page.mouse.wheel(0, -100);
    await expect(slideModel(page)).toHaveAttribute("data-zoom", "2.72");
    await closeViewer(page);
    const zoomed = await card(page, "live-a").getAttribute("data-field-of-view");
    expect(Number.parseFloat(zoomed!)).toBeCloseTo(30 / Math.E, 1);
    // Open on it again, zoomed, and close without zooming: the card's "auto" returns.
    await openCard(page, "live-a");
    await expect(slideModel(page)).toHaveAttribute("data-zoom", "2.72");
    await slideModel(page).hover();
    await page.mouse.wheel(0, 100);
    await expect(slideModel(page)).toHaveAttribute("data-zoom", "1.00");
    await closeViewer(page);
    await expect(card(page, "live-a")).toHaveAttribute("data-field-of-view", "auto");
  });

  test("a close after moving turns the card it lands on, and only that one", async ({ page }) => {
    await loadLive(page);
    await openCard(page, "live-a");
    await page.evaluate(() => window.liveFixture.fluidbox.next());
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
    await turn(page, slideModel(page), 80);
    await expect(slideModel(page)).toHaveAttribute("data-orbit", "80");
    await closeViewer(page);
    await expect(card(page, "live-b")).toHaveAttribute("data-camera-orbit", "80deg 75deg 2m");
    await expect(card(page, "live-a")).not.toHaveAttribute("data-camera-orbit", /./);

    // A close that lands on a still card turns no model.
    await openCard(page, "live-a");
    await page.evaluate(() => window.liveFixture.fluidbox.open("still-c"));
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
    await turn(page, slideModel(page), 40);
    await closeViewer(page);
    await expect(card(page, "live-a")).not.toHaveAttribute("data-camera-orbit", /./);
    await expect(card(page, "live-b")).toHaveAttribute("data-camera-orbit", "80deg 75deg 2m");
    expect(await connections(page)).toEqual(["1", "1"]);
  });

  test("a cold open flies on the card's snapshot at the cap, then shows the model on its view", async ({
    page,
  }) => {
    await loadLive(page);
    await turn(page, card(page, "live-a"), -40);
    await expect(card(page, "live-a")).toHaveAttribute("data-orbit", "-40");
    // The slide's model takes longer than the open waits.
    await page.evaluate(() => (window.__modelViewerDelay = 4500));
    const started = Date.now();
    await card(page, "live-a").click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open", {
      timeout: 6000,
    });
    const waited = Date.now() - started;
    expect(waited).toBeGreaterThan(2500);
    expect(waited).toBeLessThan(4500);
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(0);
    const snapshot = page.locator(`${shown} [data-fluidbox-media-poster="snapshot"]`);
    expect(await snapshotOrbit(page)).toBe(-40);
    await expect(snapshot).toBeVisible();
    // No poster shows through the snapshot's clear background.
    const posters = page.locator(
      `${shown} [data-fluidbox-media-poster]:not([data-fluidbox-media-poster="snapshot"])`,
    );
    expect(await posters.count()).toBeGreaterThan(0);
    expect(
      await posters.evaluateAll((images) =>
        images.map((image) => getComputedStyle(image).visibility),
      ),
    ).not.toContain("visible");
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1, {
      timeout: 4000,
    });
    await expect(slideModel(page)).toHaveAttribute("data-orbit-at-load", "-40");
    await expect(snapshot).toBeHidden();
  });
});
