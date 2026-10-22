import { expect, test, type Page } from "@playwright/test";
import type { Fluidbox } from "@ogdakke/fluidbox";
import { holdMotion } from "./support/hold-motion";
import { playerMessages, stubMedia } from "./support/media";

declare global {
  interface Window {
    mediaFixture: {
      fluidbox: Fluidbox;
      log: string[];
    };
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
  const model = "/products/fjord-model.glb";

  test("loads model-viewer only once its slide is on show, and shows its poster till then", async ({
    page,
  }) => {
    const requests = await load(page);
    await open(page, "/products/spin/fjord-00.webp");
    // The neighbour shows its poster, and nothing loads for it.
    const poster = page.locator('[data-fluidbox-model] [data-fluidbox-media-poster="poster"]');
    await expect(poster).toHaveAttribute("src", "/products/fjord-model.webp");
    await page.waitForTimeout(200);
    expect(requests.modelViewer).toEqual([]);
    await expect(page.locator("model-viewer")).toHaveCount(0);

    await page.evaluate(() => window.mediaFixture.fluidbox.next());
    const element = page.locator(`${shown} model-viewer`);
    await expect(element).toHaveCount(1);
    expect(requests.modelViewer).toHaveLength(1);
    for (const [name, value] of [
      ["src", model],
      ["alt", "Framed print in 3D"],
      ["camera-controls", ""],
      ["touch-action", "none"],
      ["ar", ""],
      ["ar-modes", "webxr quick-look"],
      ["ios-src", "/products/fjord-model.usdz"],
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

  test("a swipe on the model turns it; one beside it still moves the viewer", async ({
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
    // Under the model, the strip still swipes.
    const below = { x: box.x + box.width * 0.8, y: box.y + box.height + 40 };
    expect(below.y).toBeLessThan(page.viewportSize()!.height);
    await swipe(below, -box.width * 0.6);
    await expect.poll(() => index(page)).toBe(7);
  });
});
