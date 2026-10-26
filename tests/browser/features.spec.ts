import { expect, test, type Page } from "@playwright/test";
import type { Fluidbox, FluidboxItem } from "@ogdakke/fluidbox";

declare global {
  interface Window {
    featuresFixture: {
      fluidbox: Fluidbox;
      modal: Fluidbox;
      items: FluidboxItem[];
      log: string[];
    };
    shared?: { title?: string; url?: string }[];
    copied?: string[];
    revoked?: string[];
  }
}

const dialog = "[data-fluidbox-dialog]";
const shown = '[data-fluidbox-slide][aria-hidden="false"]';

async function load(page: Page, query = "") {
  await page.goto(`/features.html${query}`);
  await expect(page.locator("#features button")).toHaveCount(5);
}

async function open(page: Page, id: string, grid = "#features") {
  await page.locator(`${grid} [data-item="${id}"]`).click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
}

const log = (page: Page) => page.evaluate(() => window.featuresFixture.log);

/** The status of the page's viewer, or the quick view's: a closed viewer leaves the document. */
const status = (page: Page, box: "fluidbox" | "modal" = "fluidbox") =>
  page.evaluate((box) => window.featuresFixture[box].state.status, box);

test.describe("the new controls", () => {
  test("count, and download and share what the item has", async ({ page }) => {
    await load(page);
    await open(page, "one");
    const counter = page.locator(`${dialog} [data-fluidbox-counter]`);
    await expect(counter).toHaveText("1 / 5");
    await expect(counter).toHaveAttribute("aria-hidden", "true");
    const download = page.locator(`${dialog} a[data-fluidbox-download]`);
    await expect(download).toHaveText("Download");
    await expect(download).toHaveAttribute("download", "photo-square.svg");
    await expect(download).toHaveAttribute("href", "/photo-square.svg");
    await expect(page.locator(`${dialog} [data-fluidbox-share]`)).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(counter).toHaveText("2 / 5");
    await expect(download).toHaveAttribute("download", "portrait.svg");
    await page.keyboard.press("ArrowRight");
    // `download: false` has no file.
    await expect(download).toBeHidden();
  });

  test("hide Share without a link", async ({ page }) => {
    await load(page, "?noshare");
    await open(page, "one");
    await expect(page.locator(`${dialog} [data-fluidbox-share]`)).toBeHidden();
    expect(await page.evaluate(() => window.featuresFixture.fluidbox.share())).toBe(false);
  });
});

test.describe("headless controls", () => {
  test("show their labels as text, or your icon named by the label", async ({ page }) => {
    await load(page);
    await open(page, "one");
    const close = page.locator(`${dialog} [data-fluidbox-close]`);
    await expect(close).toHaveText("Close");
    await expect(close).toHaveAttribute("data-fluidbox-default", "");
    await expect(close).not.toHaveAttribute("aria-label");
    await expect(close.locator("svg")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();

    await load(page, "?icons");
    await open(page, "one");
    await expect(close.locator('[data-test="close-icon"]')).toHaveCount(1);
    await expect(close).toHaveAttribute("aria-label", "Close");
    await expect(close).not.toHaveAttribute("data-fluidbox-default");
    // The others still show text.
    await expect(page.locator(`${dialog} [data-fluidbox-next]`)).toHaveText("Next");
  });

  test("switch the full screen label as text", async ({ page, isMobile }) => {
    test.skip(isMobile, "The desktop engines take an element fullscreen.");
    await load(page);
    await open(page, "one");
    const control = page.locator(`${dialog} [data-fluidbox-fullscreen]`);
    await expect(control).toHaveText("Enter full screen");
    await expect(control).not.toHaveAttribute("data-active");
    await control.click();
    await expect(control).toHaveText("Exit full screen");
    await expect(control).toHaveAttribute("data-active", "");
    await expect(page.locator("[data-fluidbox-viewer]")).toHaveAttribute("data-fullscreen", "");
    await control.click();
    await expect(control).toHaveText("Enter full screen");
    await expect(control).not.toHaveAttribute("data-active");
  });

  test("bindControl makes the page's own elements controls", async ({ page }) => {
    await load(page);
    const counter = page.locator("#page-counter");
    const next = page.locator("#page-next");
    await expect(counter).toHaveAttribute("data-fluidbox-counter", "");
    await expect(counter).toHaveText("");
    // Closed, there is nowhere to go.
    await expect(next).toBeDisabled();
    await open(page, "one");
    await expect(counter).toHaveText("1 / 5");
    // Its own name stays.
    await expect(next).toHaveAttribute("aria-label", "Forward");
    // The viewer covers the page; a click from a keyboard or script still reaches it.
    await next.evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 5");
    await expect(counter).toHaveText("2 / 5");
    await expect(page.locator("#page-retry")).toHaveAttribute("aria-label", "Retry");
  });

  test("a Retry of your own loads the failed slide again", async ({ page }) => {
    await load(page);
    await open(page, "broken");
    const slide = page.locator(shown);
    await expect(slide).toHaveAttribute("data-error", "");
    await expect(slide).not.toHaveAttribute("data-busy");
    await expect(slide.locator("[data-fluidbox-error] [data-fluidbox-retry]")).toHaveText("Retry");
    const count = async () =>
      (await log(page)).filter((entry) => entry.startsWith("mediaerror broken")).length;
    await expect.poll(count).toBe(1);
    await page.locator("#page-retry").evaluate((button: HTMLButtonElement) => button.click());
    await expect.poll(count).toBe(2);
    await expect(slide).toHaveAttribute("data-error", "");
  });
});

test.describe("download", () => {
  test("saves a same-origin file under its own name", async ({ page }) => {
    await load(page);
    await open(page, "one");
    const saved = page.waitForEvent("download");
    await page.locator(`${dialog} [data-fluidbox-download]`).click();
    expect((await saved).suggestedFilename()).toBe("photo-square.svg");
  });

  test("fetches a cross-origin file with CORS and saves it from a blob", async ({ page }) => {
    await page.addInitScript(() => {
      window.revoked = [];
      const revoke = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = (url) => {
        window.revoked!.push(url);
        revoke(url);
      };
    });
    await page.route("https://files.example/two.svg", (route) =>
      route.fulfill({
        body: "<svg xmlns='http://www.w3.org/2000/svg'/>",
        contentType: "image/svg+xml",
        headers: { "access-control-allow-origin": "*" },
      }),
    );
    await load(page);
    await open(page, "two");
    const saved = page.waitForEvent("download");
    await page.locator(`${dialog} [data-fluidbox-download]`).click();
    expect((await saved).suggestedFilename()).toBe("portrait.svg");
    await expect.poll(() => page.evaluate(() => window.revoked!.length)).toBe(1);
    expect(await page.evaluate(() => window.revoked![0]!.startsWith("blob:"))).toBe(true);
  });

  test("opens a cross-origin file without CORS in a new tab", async ({ page, context }) => {
    // A fulfilled response passes the CORS check, so the fetch fails as a network error does.
    await context.route("https://files.example/two.svg", (route) =>
      route.request().resourceType() === "fetch"
        ? route.abort()
        : route.fulfill({ body: "<svg xmlns='http://www.w3.org/2000/svg'/>" }),
    );
    await load(page);
    await open(page, "two");
    const tab = context.waitForEvent("page");
    await page.locator(`${dialog} [data-fluidbox-download]`).click();
    expect((await tab).url()).toBe("https://files.example/two.svg");
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  });

  test("stops fetching on a move", async ({ page }) => {
    let requested!: () => void;
    const request = new Promise<void>((resolve) => (requested = resolve));
    await page.route("https://files.example/two.svg", () => requested());
    await load(page);
    await open(page, "two");
    const result = page.evaluate(() => window.featuresFixture.fluidbox.download());
    await request;
    await expect(page.locator(`${dialog} [data-fluidbox-download]`)).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await page.keyboard.press("ArrowRight");
    expect(await result).toBe(false);
    await expect(page.locator(`${dialog} [data-fluidbox-download]`)).not.toHaveAttribute(
      "aria-busy",
    );
  });
});

test.describe("share", () => {
  test("shares the item's title and link", async ({ page }) => {
    await page.addInitScript(() => {
      window.shared = [];
      Object.assign(navigator, {
        share: (data: { title?: string; url?: string }) => {
          window.shared!.push(data);
          return Promise.resolve();
        },
        canShare: () => true,
      });
    });
    await load(page);
    await open(page, "one");
    await page.locator(`${dialog} [data-fluidbox-share]`).click();
    await expect.poll(() => page.evaluate(() => window.shared!.length)).toBe(1);
    const [data] = await page.evaluate(() => window.shared!);
    expect(data!.title).toBe("Photo one");
    expect(new URL(data!.url!).pathname + new URL(data!.url!).hash).toBe("/features.html#one");
  });

  test("does nothing when the share sheet is cancelled", async ({ page }) => {
    await page.addInitScript(() => {
      window.copied = [];
      Object.assign(navigator, {
        share: () => Promise.reject(new DOMException("Cancelled", "AbortError")),
        canShare: () => true,
      });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: (text: string) => void window.copied!.push(text) },
      });
    });
    await load(page);
    await open(page, "one");
    expect(await page.evaluate(() => window.featuresFixture.fluidbox.share())).toBe(false);
    expect(await page.evaluate(() => window.copied)).toEqual([]);
  });

  test("copies the link and says so without a share sheet", async ({ page }) => {
    await page.addInitScript(() => {
      window.copied = [];
      Object.defineProperty(navigator, "share", { value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: (text: string) => {
            window.copied!.push(text);
            return Promise.resolve();
          },
        },
      });
    });
    await load(page);
    await open(page, "one");
    const share = page.locator(`${dialog} [data-fluidbox-share]`);
    await share.click();
    await expect(share).toHaveAttribute("data-copied", "");
    await expect(page.locator(`${dialog} [data-fluidbox-announcer]`)).toHaveText("Link copied");
    expect(await page.evaluate(() => window.copied!.map((url) => new URL(url).hash))).toEqual([
      "#one",
    ]);
    await expect(share).not.toHaveAttribute("data-copied", "", { timeout: 4000 });
  });
});

test.describe("mediaerror", () => {
  test("fires as an image fails, and again when Retry fails", async ({ page }) => {
    await load(page);
    await open(page, "broken");
    const error = page.locator(`${shown} [data-fluidbox-error]`);
    await expect(error).toBeVisible();
    await expect.poll(() => log(page)).toContain("mediaerror broken 3 image");
    const count = (entries: string[]) => entries.filter((entry) => entry.includes("broken")).length;
    expect(count(await log(page))).toBe(1);
    await error.getByRole("button", { name: "Retry" }).click();
    await expect.poll(async () => count(await log(page))).toBe(2);
  });

  test("names the item where it is now, after new items", async ({ page }) => {
    await load(page);
    await open(page, "broken");
    await expect.poll(() => log(page)).toContain("mediaerror broken 3 image");
    // The same items backwards: the broken photo, still on show, is now second.
    await page.evaluate(() =>
      window.featuresFixture.fluidbox.setItems([...window.featuresFixture.items].reverse()),
    );
    await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 5");
    await page
      .locator(`${shown} [data-fluidbox-error]`)
      .getByRole("button", { name: "Retry" })
      .click();
    await expect.poll(() => log(page)).toContain("mediaerror broken 1 image");
  });

  test("fires for a neighbour that fails", async ({ page }) => {
    await load(page);
    await open(page, "off");
    await expect.poll(() => log(page)).toContain("mediaerror broken 3 image");
    await expect(page.locator(`${shown}`)).toHaveAttribute("aria-label", "Item 3 of 5");
  });

  test("fires as a slide fails itself, and Retry renders it again", async ({ page }) => {
    await load(page);
    await open(page, "flaky");
    const error = page.locator(`${shown} [data-fluidbox-error]`);
    await expect(error).toBeVisible();
    await expect.poll(() => log(page)).toContain("mediaerror flaky 4 custom");
    await error.getByRole("button", { name: "Retry" }).click();
    await expect(page.locator(`${shown} [data-fluidbox-media]`)).toHaveText("Flaky, working now");
    await expect(error).toBeHidden();
    expect(await log(page)).toContain("render flaky 2");
  });
});

test.describe("item data", () => {
  test("goes on the slide, and a reused slide drops what its item no longer has", async ({
    page,
  }) => {
    await load(page);
    await open(page, "one");
    const slide = page.locator(shown);
    await expect(slide).toHaveAttribute("data-tone", "light");
    await expect(slide).toHaveAttribute("data-kind", "product");
    await page.evaluate(() => {
      const { fluidbox, items } = window.featuresFixture;
      void fluidbox.setItems([
        { ...items[0]!, data: { tone: "dark" } } as FluidboxItem,
        ...items.slice(1),
      ]);
    });
    await expect(slide).toHaveAttribute("data-tone", "dark");
    await expect(slide).not.toHaveAttribute("data-kind");
  });
});

test("item data goes on the item's thumbnail", async ({ page }) => {
  await load(page, "?thumbnails");
  await open(page, "two");
  const thumbnail = page.locator("[data-fluidbox-thumbnails-item][data-index='0']");
  await expect(thumbnail).toHaveAttribute("data-tone", "light");
  await expect(thumbnail).toHaveAttribute("data-kind", "product");
  await expect(page.locator("[data-fluidbox-thumbnails-item][data-index='1']")).toHaveAttribute(
    "data-tone",
    "dark",
  );
});

test.describe("turning gestures off", () => {
  test("a backdrop tap does nothing, and Escape still closes", async ({ page }) => {
    await load(page, "?nobackdrop");
    await open(page, "one");
    await page.mouse.click(8, 8);
    await page.waitForTimeout(300);
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await page.keyboard.press("Escape");
    await expect.poll(() => status(page)).toBe("closed");
  });

  test("a drag down springs back", async ({ page }) => {
    await load(page, "?nodrag");
    await open(page, "one");
    const media = page.locator(`${shown} [data-fluidbox-media]`);
    const box = (await media.boundingBox())!;
    const pointer = { pointerId: 7, pointerType: "touch", isPrimary: true, buttons: 1 };
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await media.dispatchEvent("pointerdown", { ...pointer, clientX: x, clientY: y });
    for (let step = 1; step <= 12; step++) {
      await media.dispatchEvent("pointermove", { ...pointer, clientX: x, clientY: y + step * 30 });
    }
    // The media follows a short way only.
    const moved = (await media.boundingBox())!;
    expect(moved.y + moved.height / 2 - y).toBeLessThan(60);
    await media.dispatchEvent("pointerup", { ...pointer, clientX: x, clientY: y + 360 });
    await page.waitForTimeout(400);
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator(dialog)).not.toHaveAttribute("data-dragging");
  });

  for (const [mode, expected] of [
    ["none", "open"],
    ["dismiss", "closed"],
  ] as const) {
    test(`wheel "${mode}"`, async ({ page, isMobile }) => {
      test.skip(isMobile, "A wheel needs a mouse.");
      await load(page, `?wheel=${mode}`);
      await open(page, "one");
      await page.mouse.move(400, 300);
      for (let step = 0; step < 8; step++) await page.mouse.wheel(0, 60);
      await page.waitForTimeout(600);
      await expect.poll(() => status(page)).toBe(expected);
      if (mode === "none") {
        await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 1 of 5");
      }
    });
  }

  test('wheel "navigate" moves once per gesture', async ({ page, isMobile }) => {
    test.skip(isMobile, "A wheel needs a mouse.");
    await load(page, "?wheel=navigate");
    await open(page, "one");
    await page.mouse.move(400, 300);
    // One gesture with its inertia: events less than 150 ms apart, sent from
    // the page, as a loaded browser can space the test's own wheels wider.
    await page.locator("[data-fluidbox-slides]").evaluate(async (strip) => {
      for (let step = 0; step < 10; step++) {
        strip.dispatchEvent(
          new WheelEvent("wheel", { deltaY: 40, bubbles: true, cancelable: true }),
        );
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    });
    await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 5");
    await page.waitForTimeout(400);
    await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 5");
    await page.mouse.wheel(0, -40);
    await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 1 of 5");
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  });

  test('wheel "navigate" leaves the move a gesture started to finish, through its inertia', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "A wheel needs a mouse.");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await load(page, "?wheel=navigate");
    await open(page, "one");
    // The gesture's inertia, 30 ms apart, while its move still scrolls.
    const values = await page.locator("[data-fluidbox-slides]").evaluate(async (strip) => {
      const values: (string | null)[] = [];
      window.featuresFixture.fluidbox.addEventListener("valuechange", () =>
        values.push(window.featuresFixture.fluidbox.state.value),
      );
      for (let step = 0; step < 10; step++) {
        strip.dispatchEvent(
          new WheelEvent("wheel", { deltaY: 40, bubbles: true, cancelable: true }),
        );
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      return values;
    });
    await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 5");
    expect(values).toHaveLength(1);
  });

  test('wheel "zoom" zooms with a plain wheel', async ({ page, isMobile }) => {
    test.skip(isMobile, "A wheel needs a mouse.");
    await load(page, "?wheel=zoom");
    await open(page, "one");
    const media = page.locator(`${shown} [data-fluidbox-media]`);
    const box = (await media.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let step = 0; step < 6; step++) await page.mouse.wheel(0, -60);
    await expect(page.locator(dialog)).toHaveAttribute("data-zoomed", "");
    await expect
      .poll(() => page.evaluate(() => window.featuresFixture.fluidbox.state.zoom?.scale ?? 1))
      .toBeGreaterThan(1);
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  });
});

test.describe("full screen", () => {
  test.skip(({ isMobile }) => isMobile, "The desktop engines take an element fullscreen.");

  const fullscreen = (page: Page) =>
    page.evaluate(() => document.fullscreenElement?.matches("[data-fluidbox-viewer]") ?? false);

  test("enters and leaves from the control", async ({ page }) => {
    await load(page);
    await open(page, "one");
    const control = page.locator(`${dialog} [data-fluidbox-fullscreen]`);
    await expect(control).toHaveText("Enter full screen");
    await control.click();
    await expect.poll(() => fullscreen(page)).toBe(true);
    await expect(control).toHaveText("Exit full screen");
    expect(await page.evaluate(() => window.featuresFixture.fluidbox.state.fullscreen)).toBe(true);
    // A move keeps it.
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 5");
    expect(await fullscreen(page)).toBe(true);
    await control.click();
    await expect.poll(() => fullscreen(page)).toBe(false);
    await expect(control).toHaveText("Enter full screen");
    expect(await page.evaluate(() => window.featuresFixture.fluidbox.state.fullscreen)).toBe(false);
  });

  test("is hidden where the document can't go fullscreen", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false });
      Object.defineProperty(Document.prototype, "webkitFullscreenEnabled", { get: () => false });
    });
    await load(page);
    await open(page, "one");
    await expect(page.locator(`${dialog} [data-fluidbox-fullscreen]`)).toBeHidden();
    expect(await page.evaluate(() => window.featuresFixture.fluidbox.setFullscreen(true))).toBe(
      false,
    );
  });

  test("leaves fullscreen before the close measures, and the flight lands on the trigger", async ({
    page,
  }) => {
    await load(page);
    await open(page, "one");
    await page.locator(`${dialog} [data-fluidbox-fullscreen]`).click();
    await expect.poll(() => fullscreen(page)).toBe(true);
    await page.evaluate(() => {
      const target = document.querySelector("[data-fluidbox-dialog]")!;
      const seen: boolean[] = [];
      Object.assign(window, { closingInFullscreen: seen });
      new MutationObserver(() => {
        if (target.getAttribute("data-fluidbox-status") === "closing") {
          seen.push(!!document.fullscreenElement);
        }
      }).observe(target, { attributeFilter: ["data-fluidbox-status"] });
    });
    await page.locator(`${dialog} [data-fluidbox-close]`).click();
    await expect.poll(() => status(page)).toBe("closed");
    expect(
      await page.evaluate(
        () => (window as never as { closingInFullscreen: boolean[] }).closingInFullscreen,
      ),
    ).toEqual([false]);
    await expect(page.locator('#features [data-item="one"]')).toBeFocused();
  });

  test("leaving fullscreen keeps the viewer open, and Escape then closes", async ({ page }) => {
    await load(page);
    await open(page, "one");
    await page.locator(`${dialog} [data-fluidbox-fullscreen]`).click();
    await expect.poll(() => fullscreen(page)).toBe(true);
    // The browser takes a real Escape out of fullscreen; a synthetic one reaches the page.
    await page.evaluate(() => document.exitFullscreen());
    await expect.poll(() => fullscreen(page)).toBe(false);
    await expect
      .poll(() => page.evaluate(() => window.featuresFixture.fluidbox.state.fullscreen))
      .toBe(false);
    expect(await status(page)).toBe("open");
    await page.keyboard.press("Escape");
    await expect.poll(() => status(page)).toBe("closed");
  });

  test("over a modal dialog, enters, leaves and closes above it", async ({ page }) => {
    await load(page);
    await page.locator("#quick-view").click();
    await open(page, "one", "#quick-grid");
    const viewer = page.locator("#quick [data-fluidbox-viewer]");
    await expect(viewer).toHaveAttribute("popover", "manual");
    // On top: the middle of the screen is the viewer's.
    const onTop = () =>
      page.evaluate(() => {
        const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
        return !!hit?.closest("[data-fluidbox-viewer]");
      });
    await page.locator(`${dialog} [data-fluidbox-fullscreen]`).click();
    await expect.poll(() => fullscreen(page)).toBe(true);
    expect(await onTop()).toBe(true);
    await page.locator(`${dialog} [data-fluidbox-fullscreen]`).click();
    await expect.poll(() => fullscreen(page)).toBe(false);
    await expect
      .poll(() => viewer.evaluate((element) => element.matches(":popover-open")))
      .toBe(true);
    expect(await onTop()).toBe(true);
    await page.locator(`${dialog} [data-fluidbox-fullscreen]`).click();
    await expect.poll(() => fullscreen(page)).toBe(true);
    await page.locator(`${dialog} [data-fluidbox-close]`).click();
    await expect.poll(() => status(page, "modal")).toBe("closed");
    expect(await fullscreen(page)).toBe(false);
    await expect(page.locator("#quick")).toHaveAttribute("open", "");
    await expect(page.locator('#quick-grid [data-item="one"]')).toBeFocused();
  });
});
