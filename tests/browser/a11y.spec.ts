import { expect, test, type Page } from "@playwright/test";

/** Keyboard-only and assistive-technology behaviour of the viewer. Fixture: apps/examples/a11y.html. */

const dialog = (page: Page) => page.locator("[data-fluidbox-dialog]");
const activeSlide = (page: Page) => page.locator('[data-fluidbox-slide][aria-hidden="false"]');

async function load(page: Page, query = "") {
  await page.goto(`/a11y.html${query}`);
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  await page.evaluate(() => (window as any).a11yFluidbox.load());
}

/** Open an item from its trigger with the keyboard, and wait for the viewer to settle. */
async function open(page: Page, index: number) {
  await page.locator(`[data-test="trigger-${index}"]`).focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
}

/** A description of the focused element, through open shadow roots. */
function focused(page: Page) {
  return page.evaluate(() => {
    let element = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    if (!element || element === document.body) return "body";
    const test = element.getAttribute("data-test");
    if (test) return test;
    for (const name of ["close", "previous", "next", "slides", "dialog"]) {
      if (element.hasAttribute(`data-fluidbox-${name}`)) return name;
    }
    return element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName;
  });
}

test.describe("keyboard", () => {
  test.beforeEach(({ browserName, isMobile }) => {
    test.skip(isMobile, "keyboard-only behaviour is checked on desktop");
    // WebKit only tabs to buttons with full keyboard access turned on.
    test.skip(browserName === "webkit", "WebKit's Tab skips buttons by default");
  });

  test("Tab runs natively past a hidden input and hidden elements, into editable and shadow content", async ({
    page,
  }) => {
    await load(page);
    await open(page, 3);
    // From the dialog's first stop: past the last, Firefox tabs out to its own
    // toolbar, as from a modal <dialog>, where Chromium wraps to the page.
    await dialog(page).locator("[data-fluidbox-slides]").focus();
    const order: string[] = [];
    for (let step = 0; step < 14; step++) {
      await page.keyboard.press("Tab");
      order.push(await focused(page));
    }
    expect(order).toContain("add");
    expect(order).toContain("note");
    expect(order).toContain("Inside shadow");
    expect(order).toContain("size-s");
    // A roving tabindex keeps its other radios out of the order.
    expect(order).not.toContain("size-m");
    expect(order).not.toContain("Hidden button");
    expect(order).not.toContain("Invisible button");
    // Every press moves on: nothing stalls on the hidden input.
    const add = order.indexOf("add");
    expect(order[add + 1]).toBe("note");
  });

  test("a focused video owns the arrow keys, and Tab reaches it", async ({ page, browserName }) => {
    await load(page);
    await open(page, 2);
    const video = activeSlide(page).locator("video");
    await expect(video).toHaveAttribute("controls", "");
    await dialog(page).locator("[data-fluidbox-slides]").focus();
    let reached = false;
    for (let step = 0; step < 8 && !reached; step++) {
      await page.keyboard.press("Tab");
      reached = await video.evaluate((element) => element === document.activeElement);
    }
    expect(reached).toBe(true);
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]) {
      await page.keyboard.press(key);
    }
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 3 of 4");
    test.skip(browserName === "firefox", "Firefox gives a focused video no key events");
  });

  test("Escape goes first to a menu and a nested dialog in the content", async ({ page }) => {
    await load(page);
    await open(page, 3);
    const slide = activeSlide(page);
    await slide.locator("[data-test=menu-button]").click();
    await expect(slide.locator("[data-test=menu-item]")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(slide.locator("[data-test=menu]")).toBeHidden();
    await expect(slide.locator("[data-test=menu-button]")).toBeFocused();
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");

    await slide.locator("[data-test=details]").click();
    await expect(slide.locator("[data-test=nested]")).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(slide.locator("[data-test=nested]")).not.toHaveAttribute("open", "");
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");

    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("page keys don't close a gallery; Home and End go to its ends", async ({ page }) => {
    await load(page);
    await open(page, 1);
    for (const key of ["ArrowUp", "ArrowDown", "PageUp", "PageDown"]) {
      await page.keyboard.press(key);
      await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
    }
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 2 of 4");
    await page.keyboard.press("End");
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 4 of 4");
    await page.keyboard.press("Home");
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 1 of 4");
  });

  test("arrow keys with a modifier, and in a field, leave the slide alone", async ({ page }) => {
    await load(page);
    await open(page, 0);
    const index = () => page.evaluate(() => (window as any).a11yFluidbox.state.index);
    for (const key of [
      "Alt+ArrowRight",
      "Control+ArrowRight",
      "Meta+ArrowRight",
      "Shift+ArrowRight",
    ]) {
      await page.keyboard.press(key);
      // A move starts on the key press, so the state says at once.
      expect(await index()).toBe(0);
    }
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
    await page.keyboard.press("ArrowRight");
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 2 of 4");
  });

  test("the strip of slides takes focus, and the arrow keys move through it there", async ({
    page,
  }) => {
    await load(page);
    await open(page, 0);
    const strip = page.locator("[data-fluidbox-slides]");
    await expect(strip).toHaveAttribute("tabindex", "0");
    await strip.focus();
    await page.keyboard.press("ArrowRight");
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 2 of 4");
    await expect(strip).toBeFocused();
  });

  test("a Previous that disables itself at the start hands focus to Next", async ({ page }) => {
    await load(page);
    await open(page, 1);
    const previous = dialog(page).locator("[data-fluidbox-previous]");
    await previous.focus();
    await page.keyboard.press("Enter");
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "Item 1 of 4");
    await expect(previous).toBeDisabled();
    await expect(dialog(page).locator("[data-fluidbox-next]")).toBeFocused();
  });

  test("focus is in the dialog while the opening still flies", async ({ page }) => {
    await load(page);
    await page.locator('[data-test="trigger-0"]').focus();
    const during = await page.evaluate(async () => {
      const trigger = document.querySelector<HTMLElement>('[data-test="trigger-0"]')!;
      trigger.click();
      const samples: string[] = [];
      for (let frame = 0; frame < 6; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const dialog = document.querySelector("[data-fluidbox-dialog]");
        if (dialog?.getAttribute("data-fluidbox-status") !== "opening") continue;
        samples.push(dialog.contains(document.activeElement) ? "inside" : "outside");
      }
      return samples;
    });
    expect(during.length).toBeGreaterThan(0);
    expect(new Set(during)).toEqual(new Set(["inside"]));
  });
});

test.describe("modality", () => {
  test("a viewer opened from a modal dialog is above it, usable, and leaves it open", async ({
    page,
    isMobile,
  }) => {
    await load(page);
    await page.locator("[data-test=quick-view]").click();
    const quick = page.locator("[data-test=quick]");
    await expect(quick).toHaveAttribute("open", "");
    await page.locator('[data-test="quick-trigger-0"]').click();
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(quick).not.toHaveAttribute("inert", "");
    const close = dialog(page).locator("[data-fluidbox-close]");
    const hit = await close.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return !!top && element.contains(top);
    });
    expect(hit).toBe(true);
    const inside = await page.evaluate(() =>
      document.querySelector("[data-fluidbox-dialog]")!.contains(document.activeElement),
    );
    expect(inside).toBe(true);
    if (!isMobile) {
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toHaveCount(0);
      await expect(quick).toHaveAttribute("open", "");
      await expect(page.locator('[data-test="quick-trigger-0"]')).toBeFocused();
    } else {
      await close.click();
      await expect(dialog(page)).toHaveCount(0);
      await expect(quick).toHaveAttribute("open", "");
    }
  });

  test("a toast the page adds while open is not inert, and keeps focus", async ({ page }) => {
    await load(page);
    await page.evaluate(() => (window as any).a11yFluidbox.open(3));
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
    // What was there at open is inert, except live regions and what is marked exempt.
    await expect(page.locator("main#fixture")).toHaveAttribute("inert", "");
    await expect(page.locator("[data-test=live]")).not.toHaveAttribute("inert", "");
    await expect(page.locator("[data-test=exempt]")).not.toHaveAttribute("inert", "");
    await activeSlide(page).locator("[data-test=add]").click();
    const toast = page.locator("[data-test=toast]");
    await expect(toast).toHaveText(/Added to cart/);
    expect(await toast.evaluate((element) => !!element.closest("[inert]"))).toBe(false);
    await expect(page.getByRole("status").filter({ hasText: "Added to cart" })).toBeVisible();
    const undo = toast.getByRole("button", { name: "Undo" });
    await undo.focus();
    await expect(undo).toBeFocused();
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
  });

  test("closing gives back only the inert it set", async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
      const already = document.createElement("div");
      already.dataset.test = "already";
      already.inert = true;
      document.body.append(already);
    });
    await page.evaluate(() => (window as any).a11yFluidbox.open(0));
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
    // The page adds a drawer while the viewer is open, and makes it inert itself.
    await page.evaluate(async () => {
      const drawer = document.createElement("div");
      drawer.dataset.test = "drawer";
      document.body.append(drawer);
      await new Promise((resolve) => setTimeout(resolve));
      drawer.inert = true;
    });
    await page.evaluate(() => (window as any).a11yFluidbox.close());
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator("[data-test=already]")).toHaveAttribute("inert", "");
    await expect(page.locator("[data-test=drawer]")).toHaveAttribute("inert", "");
    await expect(page.locator("main#fixture")).not.toHaveAttribute("inert", "");
  });
});

test.describe("semantics", () => {
  test("off-screen slides are inert as well as hidden", async ({ page }) => {
    await load(page);
    await page.evaluate(() => (window as any).a11yFluidbox.open(2));
    await expect(dialog(page)).toHaveAttribute("data-fluidbox-status", "open");
    const slides = page.locator("[data-fluidbox-slide]");
    await expect(slides).toHaveCount(4);
    for (let index = 0; index < 4; index++) {
      const slide = slides.nth(index);
      const shown = index === 2;
      await expect(slide).toHaveAttribute("aria-hidden", String(!shown));
      expect(await slide.evaluate((element) => (element as HTMLElement).inert)).toBe(!shown);
      await expect(slide).toHaveAttribute("aria-roledescription", "slide");
    }
    const strip = page.locator("[data-fluidbox-slides]");
    await expect(strip).toHaveAttribute("role", "region");
    await expect(strip).toHaveAttribute("aria-roledescription", "carousel");
  });

  test("the viewer announces the item it moves to, after it is in the page", async ({ page }) => {
    await load(page);
    await page.evaluate(() => (window as any).a11yFluidbox.open(0));
    const status = page.locator("[data-fluidbox-announcer]");
    await expect(status).toHaveText("Item 1 of 4");
    await page.evaluate(() => (window as any).a11yFluidbox.next());
    await expect(status).toHaveText("Blue study, 2 of 4");
    await expect(dialog(page)).toHaveAttribute("aria-label", "Blue study");
  });

  test("a video gets its caption tracks", async ({ page }) => {
    await load(page);
    await page.evaluate(() => (window as any).a11yFluidbox.open(2));
    const track = activeSlide(page).locator("video > track");
    await expect(track).toHaveCount(1);
    await expect(track).toHaveAttribute("kind", "captions");
    await expect(track).toHaveAttribute("srclang", "en");
    await expect(track).toHaveAttribute("label", "English");
    await expect(track).toHaveAttribute("default", "");
  });

  test("an element marked data-fluidbox-description describes the dialog", async ({ page }) => {
    await load(page);
    await page.evaluate(() => (window as any).a11yFluidbox.open(3));
    const description = activeSlide(page).locator("[data-test=description]");
    const id = await description.getAttribute("id");
    expect(id).toBeTruthy();
    await expect(dialog(page)).toHaveAttribute("aria-describedby", id!);
    await page.evaluate(() => (window as any).a11yFluidbox.previous());
    await expect(dialog(page)).not.toHaveAttribute("aria-describedby", /./);
  });

  test("your own viewer keeps a default Close", async ({ page }) => {
    await load(page, "?viewer");
    await page.evaluate(() => (window as any).a11yFluidbox.open(0));
    await expect(dialog(page).locator("[data-test=caption]")).toBeVisible();
    await expect(dialog(page).locator("[data-fluidbox-close]")).toBeVisible();
  });

  test("a filmstrip thumbnail without alt text is named by its place, and the selected one is marked by shape", async ({
    page,
  }) => {
    await load(page, "?filmstrip&unnamed");
    await page.evaluate(() => (window as any).a11yFluidbox.open(1));
    const thumbnails = page.locator("[data-fluidbox-filmstrip-item]");
    await expect(thumbnails.nth(1)).toHaveAttribute("aria-label", "Item 2 of 4");
    await expect(thumbnails.nth(0)).toHaveAttribute("aria-label", "Red study");
    const bar = (index: number) =>
      thumbnails
        .nth(index)
        .evaluate((element) => getComputedStyle(element, "::after").borderTopStyle);
    expect(await bar(1)).toBe("solid");
    expect(await bar(0)).toBe("none");
  });

  test("an error raised on a hidden slide is announced again as it arrives", async ({ page }) => {
    await load(page, "?broken");
    await page.evaluate(() => (window as any).a11yFluidbox.open(0));
    const error = page.locator("[data-fluidbox-slide]").nth(1).locator("[data-fluidbox-error]");
    await expect(error).toBeAttached();
    await expect(error).not.toHaveAttribute("hidden", "");
    await expect(page.locator("[data-fluidbox-slide]").nth(1)).not.toHaveAttribute(
      "aria-busy",
      /./,
    );
    await page.evaluate(() => {
      const target = document
        .querySelectorAll("[data-fluidbox-slide]")[1]!
        .querySelector("[data-fluidbox-error]")!;
      (window as any).alertChanges = 0;
      new MutationObserver(() => (window as any).alertChanges++).observe(target, {
        subtree: true,
        characterData: true,
        childList: true,
      });
    });
    await page.evaluate(() => (window as any).a11yFluidbox.next());
    await expect.poll(() => page.evaluate(() => (window as any).alertChanges)).toBeGreaterThan(0);
    await expect(error).toContainText("Unable to load media.");
  });

  test("forced colours give the controls an edge", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await load(page);
    await page.evaluate(() => (window as any).a11yFluidbox.open(1));
    const close = dialog(page).locator("[data-fluidbox-close]");
    await expect(close).toHaveCSS("border-top-style", "solid");
  });

  test("the controls' focus ring has a dark edge", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard focus");
    await load(page);
    await open(page, 1);
    const close = dialog(page).locator("[data-fluidbox-close]");
    await expect(close).toBeFocused();
    await expect(close).toHaveCSS("outline-width", "2px");
    await expect(close).toHaveCSS("box-shadow", /rgb\(0, 0, 0\) 0px 0px 0px 2px/);
  });
});
