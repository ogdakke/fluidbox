import { expect, test, type Page } from "@playwright/test";
import { holdMotion } from "./support/hold-motion";

async function firstVisiblePhotoIndex(page: Page, includeWindow = true): Promise<number> {
  return page.locator(".library-scroll [data-photo-index]").evaluateAll((buttons, checkWindow) => {
    const viewport = document.querySelector(".library-scroll")!.getBoundingClientRect();
    const visible = buttons.find((button) => {
      const bounds = button.getBoundingClientRect();
      return (
        bounds.top >= (checkWindow ? Math.max(viewport.top, 0) : viewport.top) - 1 &&
        bounds.bottom <=
          (checkWindow ? Math.min(viewport.bottom, innerHeight) : viewport.bottom) + 1
      );
    });
    return Number(visible?.getAttribute("data-photo-index") ?? -1);
  }, includeWindow);
}

test("React trigger prepares on pointerdown and discards a cancelled open", async ({ page }) => {
  await page.goto("/photo-library.html?count=100");
  const trigger = page.locator("[data-photo-index]").first();
  await trigger.dispatchEvent("pointerdown", { button: 0, isPrimary: true, pointerId: 1 });
  const prepared = page.locator("[data-fluidbox-overlay][data-fluidbox-prepared]");
  await expect(prepared).toHaveCount(1);
  await expect(prepared).toHaveCSS("visibility", "hidden");
  await expect(trigger).not.toHaveAttribute("data-open", "");
  await expect(trigger.locator("img")).not.toHaveAttribute("data-fluidbox-thumbnail-hidden", "");

  await trigger.dispatchEvent("pointercancel", { button: 0, isPrimary: true, pointerId: 1 });
  await expect(prepared).toHaveCount(0);

  const reuse = await trigger.evaluate((element: HTMLElement) => {
    element.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0, isPrimary: true, pointerId: 2 }),
    );
    const preparedAnimations = document.getAnimations();
    const paused = preparedAnimations.every(
      (animation) => animation.playState === "paused" && animation.currentTime === 0,
    );
    element.click();
    const openingAnimations = document.getAnimations();
    return {
      count: preparedAnimations.length,
      paused,
      reused: preparedAnimations.every((animation) => openingAnimations.includes(animation)),
    };
  });
  expect(reuse.count).toBeGreaterThan(0);
  expect(reuse).toMatchObject({ paused: true, reused: true });
  await expect(page.locator("[data-fluidbox-dialog][data-fluidbox-state='open']")).toBeVisible();
});

for (const count of [10_000, 100_000]) {
  test(`TanStack host scrolls and Fluidbox resolves stable origins across ${count} items`, async ({
    page,
  }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`/photo-library.html?count=${count}`);
    const scroll = page.locator(".library-scroll");
    await expect(page.locator("[data-library-count]")).toHaveAttribute(
      "data-library-count",
      String(count),
    );
    await expect.poll(() => page.locator("[data-photo-index]").count()).toBeGreaterThan(0);
    const scrollHeight = await scroll.evaluate((element) => element.scrollHeight);
    expect(scrollHeight).toBeGreaterThan(100_000);
    expect(scrollHeight).toBeLessThan(12_000_000);
    expect(await page.locator("[data-photo-index]").count()).toBeLessThan(100);

    await scroll.evaluate((element) => {
      element.scrollTop = Math.min(element.scrollHeight / 3, 1_000_000);
    });
    await expect
      .poll(async () =>
        Number(await page.locator("[data-photo-index]").first().getAttribute("data-photo-index")),
      )
      .toBeGreaterThan(100);
    await scroll.evaluate((element) => {
      element.scrollIntoView({ block: "start", behavior: "instant" });
    });
    const index = await firstVisiblePhotoIndex(page);
    expect(index).toBeGreaterThan(100);
    const originButton = scroll.locator(`[data-photo-index="${index}"]`);
    const image = originButton.locator("img");
    await image.evaluate((element: HTMLImageElement) => element.decode());
    const origin = await originButton.boundingBox();
    expect(origin).not.toBeNull();

    const start = await originButton.evaluate(async (element: HTMLElement) => {
      // A loaded WebKit can stall longer than the whole opening, so a live
      // animation may already be over when it is measured. Hold every
      // animation near its start as it is created, measure, then let it run.
      const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")!
        .value as Element["animate"];
      const held: Animation[] = [];
      Element.prototype.animate = function (
        this: Element,
        ...args: Parameters<Element["animate"]>
      ) {
        const animation = animate.apply(this, args);
        animation.playbackRate = 1e-6;
        held.push(animation);
        return animation;
      };
      try {
        element.click();
        for (let frames = 0; frames < 120; frames += 1) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const overlay = document.querySelector("[data-fluidbox-overlay]");
          if (overlay && !overlay.hasAttribute("data-fluidbox-prepared") && held.length) break;
        }
      } finally {
        Element.prototype.animate = animate;
      }
      const frame = document.querySelector<HTMLElement>(
        '[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-frame]',
      )!;
      for (const animation of held) {
        animation.pause();
        animation.currentTime = 0;
      }
      const bounds = frame.getBoundingClientRect();
      for (const animation of held) {
        animation.playbackRate = 1;
        animation.play();
      }
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    });
    await testInfo.attach("deep-origin-geometry", {
      body: JSON.stringify({ index, origin, start }, null, 2),
      contentType: "application/json",
    });
    for (const dimension of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(start[dimension] - origin![dimension])).toBeLessThan(5);
    }
    await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      `Item ${index + 1} of ${count}`,
    );
    await expect(page.locator("[data-fluidbox-filmstrip]")).toHaveCount(1);
    await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
      "data-fluidbox-state",
      "open",
    );
    await expect(page.locator("[data-fluidbox-filmstrip]")).toHaveCSS("pointer-events", "auto");
    await expect(image).toHaveAttribute("data-fluidbox-thumbnail-hidden", "");
    await expect(image).toHaveCSS("visibility", "hidden");

    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight - element.clientHeight;
    });
    await expect(page.locator(`[data-photo-index="${index}"]`)).toHaveCount(0);
    const farIndex = count - 200;
    await page
      .locator("[data-fluidbox-filmstrip-scroll]")
      .evaluate(async (element, selectedIndex) => {
        const start = new Event("touchstart", { bubbles: true });
        Object.defineProperty(start, "touches", { value: [{}] });
        element.dispatchEvent(start);
        const size = parseFloat(
          getComputedStyle(element.parentElement!).getPropertyValue(
            "--fluidbox-filmstrip-item-size",
          ),
        );
        const gap = parseFloat(getComputedStyle(element).columnGap);
        const padding = parseFloat(getComputedStyle(element).paddingLeft);
        // A finger is still down while the strip scrolls, so lift it only
        // after the strip has reported the scroll, as a real touch would.
        const scrolled = new Promise((resolve) =>
          element.addEventListener("scroll", resolve, { once: true }),
        );
        element.scrollTo({
          left: padding + selectedIndex * (size + gap) + size / 2 - element.clientWidth / 2,
          behavior: "instant",
        });
        await scrolled;
        const end = new Event("touchend", { bubbles: true });
        Object.defineProperty(end, "touches", { value: [] });
        element.dispatchEvent(end);
      }, farIndex);
    const filmstripGeometry = await page
      .locator("[data-fluidbox-filmstrip-scroll]")
      .evaluate((element) => ({
        scrollLeft: element.scrollLeft,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        gap: getComputedStyle(element).columnGap,
        trackWidth: getComputedStyle(element.firstElementChild!).width,
        rendered: [...element.querySelectorAll<HTMLElement>("[data-index]")].map(
          (item) => item.dataset.index,
        ),
      }));
    await testInfo.attach("far-filmstrip-geometry", {
      body: JSON.stringify(filmstripGeometry, null, 2),
      contentType: "application/json",
    });
    const filmstripTarget = page.locator(
      `[data-fluidbox-filmstrip-item][data-index="${farIndex}"]`,
    );
    await expect(filmstripTarget).toBeVisible();
    await expect
      .poll(() =>
        filmstripTarget.evaluate((element) => {
          const scroller = element
            .closest("[data-fluidbox-filmstrip-scroll]")!
            .getBoundingClientRect();
          const bounds = element.getBoundingClientRect();
          return bounds.left >= scroller.left && bounds.right <= scroller.right;
        }),
      )
      .toBe(true);
    await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      `Item ${farIndex + 1} of ${count}`,
    );
    await expect(scroll.locator(`[data-photo-index="${farIndex}"]`)).toHaveCount(1);
    const farThumbnail = scroll.locator(`[data-photo-index="${farIndex}"] img`);
    await expect(farThumbnail).toHaveAttribute("data-fluidbox-thumbnail-hidden", "");
    await expect
      .poll(() =>
        scroll.locator(`[data-photo-index="${farIndex}"]`).evaluate((element) => {
          const scroller = element.closest(".library-scroll")!.getBoundingClientRect();
          const bounds = element.getBoundingClientRect();
          return (
            bounds.top >= Math.max(scroller.top, 0) - 1 &&
            bounds.bottom <= Math.min(scroller.bottom, innerHeight) + 1
          );
        }),
      )
      .toBe(true);
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      `Item ${farIndex + 2} of ${count}`,
    );
    await expect(farThumbnail).not.toHaveAttribute("data-fluidbox-thumbnail-hidden", "");
    const selectedIndex = count - 250;
    await page.locator("[data-fluidbox-filmstrip-scroll]").evaluate(async (element, index) => {
      const start = new Event("touchstart", { bubbles: true });
      Object.defineProperty(start, "touches", { value: [{}] });
      element.dispatchEvent(start);
      const size = parseFloat(
        getComputedStyle(element.parentElement!).getPropertyValue("--fluidbox-filmstrip-item-size"),
      );
      const gap = parseFloat(getComputedStyle(element).columnGap);
      const padding = parseFloat(getComputedStyle(element).paddingLeft);
      // A finger is still down while the strip scrolls, so lift it only
      // after the strip has reported the scroll, as a real touch would.
      const scrolled = new Promise((resolve) =>
        element.addEventListener("scroll", resolve, { once: true }),
      );
      element.scrollTo({
        left: padding + index * (size + gap) + size / 2 - element.clientWidth / 2,
        behavior: "instant",
      });
      await scrolled;
      const end = new Event("touchend", { bubbles: true });
      Object.defineProperty(end, "touches", { value: [] });
      element.dispatchEvent(end);
    }, selectedIndex);
    await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      `Item ${selectedIndex + 1} of ${count}`,
    );
    const selectedTile = scroll.locator(`[data-photo-index="${selectedIndex}"]`);
    await expect(selectedTile).toHaveCount(1);
    await expect(selectedTile.locator("img")).toHaveAttribute("data-fluidbox-thumbnail-hidden", "");
    await expect
      .poll(() =>
        selectedTile.evaluate((element) => {
          const scroller = element.closest(".library-scroll")!.getBoundingClientRect();
          const bounds = element.getBoundingClientRect();
          return (
            bounds.top >= Math.max(scroller.top, 0) - 1 &&
            bounds.bottom <= Math.min(scroller.bottom, innerHeight) + 1
          );
        }),
      )
      .toBe(true);
    expect(await page.locator("[data-photo-index]").count()).toBeLessThan(100);
    expect(await page.locator("[data-fluidbox-slide]").count()).toBeLessThan(40);
    expect(await page.locator("*").count()).toBeLessThan(600);
    const selectedBounds = await selectedTile.boundingBox();
    expect(selectedBounds).not.toBeNull();
    const closingEnd = await page.evaluate(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const frame =
        document.querySelector<HTMLElement>("[data-fluidbox-flight] [data-fluidbox-frame]") ??
        document.querySelector<HTMLElement>(
          '[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-frame]',
        )!;
      const animations = document.getAnimations();
      for (const animation of animations) {
        animation.pause();
        const duration = Number(animation.effect?.getComputedTiming().duration);
        if (Number.isFinite(duration)) animation.currentTime = Math.max(0, duration - 1);
      }
      const bounds = frame.getBoundingClientRect();
      for (const animation of animations) animation.play();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    });
    await testInfo.attach("selected-origin-closing-geometry", {
      body: JSON.stringify({ selectedIndex, selectedBounds, closingEnd }, null, 2),
      contentType: "application/json",
    });
    for (const dimension of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(closingEnd[dimension] - selectedBounds![dimension])).toBeLessThan(5);
    }
    await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
    await expect(selectedTile.locator("img")).not.toHaveAttribute(
      "data-fluidbox-thumbnail-hidden",
      "",
    );
    await expect(selectedTile.locator("img")).toHaveCSS("visibility", "visible");
    await expect(selectedTile).toBeFocused();
    await scroll.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(selectedTile).toHaveCount(0);
    await page.getByRole("button", { name: "Reveal last viewed" }).click();
    const revealed = scroll.locator(`[data-photo-index="${selectedIndex}"]`);
    await expect(revealed).toHaveCount(1);
    await expect
      .poll(() =>
        revealed.evaluate((element) => {
          const viewport = element.closest(".library-scroll")!.getBoundingClientRect();
          const bounds = element.getBoundingClientRect();
          return bounds.top >= viewport.top && bounds.bottom <= viewport.bottom;
        }),
      )
      .toBe(true);

    // Clicking the reveal button scrolls the window to it, which can leave too
    // little of the scroller on screen for a whole tile. The anchor that a
    // resize keeps is the scroller's own first visible tile.
    const beforeResize = await firstVisiblePhotoIndex(page, false);
    expect(beforeResize).toBeGreaterThanOrEqual(0);
    await page.setViewportSize({ width: 420, height: 760 });
    await expect
      .poll(() =>
        scroll
          .locator(".library-photo-grid")
          .first()
          .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length),
      )
      .toBe(2);
    await expect
      .poll(() => firstVisiblePhotoIndex(page, false))
      .toBeGreaterThanOrEqual(beforeResize - 6);
    expect(await firstVisiblePhotoIndex(page, false)).toBeLessThanOrEqual(beforeResize + 6);
    expect(await page.locator("[data-photo-index]").count()).toBeLessThan(100);
    expect(await scroll.evaluate((element) => element.scrollHeight)).toBeLessThan(12_000_000);
    expect(pageErrors).toEqual([]);
  });
}

test("filmstrip preference applies to the next open", async ({ page }) => {
  await page.goto("/photo-library.html");
  await expect(page.locator("[data-library-count]")).toHaveAttribute("data-library-count", "10000");
  const initialRange = await page
    .locator("[data-photo-index]")
    .first()
    .getAttribute("data-photo-index");
  await page.getByRole("checkbox", { name: "Show filmstrip on next open" }).uncheck();
  await page.locator("[data-photo-index]").first().click();
  await expect(page.locator("[data-fluidbox-filmstrip]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Show filmstrip on next open" }).check();
  await page.locator(`[data-photo-index="${initialRange}"]`).click();
  await expect(page.locator("[data-fluidbox-filmstrip]")).toHaveCount(1);
  await expect(page.locator("[data-library-count]")).toHaveAttribute("data-library-count", "10000");
  expect(await page.locator("[data-photo-index]").count()).toBeLessThan(100);
});

test("opening centers the filmstrip once without changing gallery selection", async ({ page }) => {
  await page.goto("/photo-library.html?count=10000");
  await page.getByLabel("Photo number").fill("5001");
  await page.getByRole("button", { name: "Open number" }).click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  const filmstrip = page.locator("[data-fluidbox-filmstrip-scroll]");
  await expect(dialog).toHaveAttribute("data-fluidbox-state", "open");
  await expect(
    page.locator('[data-fluidbox-filmstrip-item][aria-selected="true"]'),
  ).toHaveAttribute("data-index", "5000");
  const initial = await filmstrip.evaluate((element) => element.scrollLeft);
  await page.waitForTimeout(400);
  expect(await filmstrip.evaluate((element) => element.scrollLeft)).toBeCloseTo(initial, 0);
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 5001 of 10000",
  );
});

test("opening scrolled virtual origins fills and centers the filmstrip", async ({ page }) => {
  await page.goto("/photo-library.html?count=10000");
  const host = page.locator(".library-scroll");

  for (const ratio of [0.08, 0.37, 0.81]) {
    await host.evaluate((element, nextRatio) => {
      element.scrollTop = nextRatio * (element.scrollHeight - element.clientHeight);
    }, ratio);
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    const visible = page.locator("[data-photo-index]").filter({ visible: true });
    const count = await visible.count();
    const trigger = visible.nth(Math.floor(count / 2));
    const expected = Number(await trigger.getAttribute("data-photo-index"));
    await trigger.click();
    await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
      "data-fluidbox-state",
      "open",
    );

    const geometry = await page.locator("[data-fluidbox-filmstrip-scroll]").evaluate((element) => {
      const scroller = element.getBoundingClientRect();
      const rendered = [...element.querySelectorAll<HTMLElement>("[data-index]")];
      const selected = element.querySelector<HTMLElement>('[aria-selected="true"]')!;
      const selectedBounds = selected.getBoundingClientRect();
      const first = rendered[0]!.getBoundingClientRect();
      const last = rendered.at(-1)!.getBoundingClientRect();
      return {
        selected: Number(selected.dataset.index),
        centerError: Math.abs(
          selectedBounds.left + selectedBounds.width / 2 - (scroller.left + scroller.width / 2),
        ),
        leftGap: Math.max(0, first.left - scroller.left),
        rightGap: Math.max(0, scroller.right - last.right),
        rendered: rendered.map((item) => Number(item.dataset.index)),
      };
    });
    expect(geometry.selected).toBe(expected);
    expect(geometry.centerError).toBeLessThan(2);
    expect(geometry.leftGap).toBe(0);
    expect(geometry.rightGap).toBe(0);
    expect(geometry.rendered).toContain(expected - 1);
    expect(geometry.rendered).toContain(expected + 1);
    await expect
      .poll(() =>
        page.locator("[data-fluidbox-filmstrip-scroll]").evaluate((element) => {
          const viewport = element.getBoundingClientRect();
          return [...element.querySelectorAll<HTMLImageElement>("img")]
            .filter((image) => {
              const bounds = image.getBoundingClientRect();
              return bounds.right > viewport.left && bounds.left < viewport.right;
            })
            .filter((image) => !image.complete || image.naturalWidth === 0).length;
        }),
      )
      .toBe(0);

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  }
});

test("full-size strip rejects delayed programmatic drift", async ({ page }) => {
  await page.goto("/photo-library.html?count=10000");
  await page.getByLabel("Photo number").fill("5001");
  await page.getByRole("button", { name: "Open number" }).click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-state",
    "open",
  );
  const slides = page.locator("[data-fluidbox-slides]");
  await slides.evaluate((element) => {
    element.scrollLeft += element.clientWidth * 0.72;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect
    .poll(() => slides.evaluate((element) => element.scrollLeft % element.clientWidth))
    .toBe(0);
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 5001 of 10000",
  );
});

test("stateful virtual-gallery interactions preserve one selected item", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/photo-library.html?count=10000");
  const host = page.locator(".library-scroll");
  let seed = 0x51de;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };

  for (let step = 0; step < 8; step += 1) {
    const ratio = random() * 0.95;
    await host.evaluate((element, nextRatio) => {
      element.scrollTop = nextRatio * (element.scrollHeight - element.clientHeight);
    }, ratio);
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    const visible = await page.locator("[data-photo-index]").evaluateAll((elements) => {
      const viewport = document.querySelector(".library-scroll")!.getBoundingClientRect();
      return elements
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.top >= viewport.top && bounds.bottom <= viewport.bottom;
        })
        .map((element) => Number(element.getAttribute("data-photo-index")));
    });
    expect(visible.length).toBeGreaterThan(0);
    let expected = visible[Math.floor(random() * visible.length)]!;
    await page.locator(`[data-photo-index="${expected}"]`).click();
    await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
      "data-fluidbox-state",
      "open",
    );

    if (random() > 0.35) {
      expected = Math.max(0, Math.min(9_999, expected + Math.floor(random() * 17) - 8));
      const filmstrip = page.locator("[data-fluidbox-filmstrip-scroll]");
      await filmstrip.evaluate(async (element, index) => {
        const touch = new Event("touchstart", { bubbles: true });
        Object.defineProperty(touch, "touches", { value: [{}] });
        element.dispatchEvent(touch);
        const size = parseFloat(
          getComputedStyle(element.parentElement!).getPropertyValue(
            "--fluidbox-filmstrip-item-size",
          ),
        );
        const gap = parseFloat(getComputedStyle(element).columnGap);
        const padding = parseFloat(getComputedStyle(element).paddingLeft);
        element.scrollTo({
          left: padding + index * (size + gap) + size / 2 - element.clientWidth / 2,
          behavior: "instant",
        });
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        const release = new Event("touchend", { bubbles: true });
        Object.defineProperty(release, "touches", { value: [] });
        element.dispatchEvent(release);
      }, expected);
    }

    await expect
      .poll(() =>
        page.evaluate(() => {
          const label = document
            .querySelector('[data-fluidbox-slide][aria-hidden="false"]')
            ?.getAttribute("aria-label");
          const selected = document
            .querySelector('[data-fluidbox-filmstrip-item][aria-selected="true"]')
            ?.getAttribute("data-index");
          const hidden = document
            .querySelector("[data-fluidbox-thumbnail-hidden]")
            ?.closest("[data-photo-index]")
            ?.getAttribute("data-photo-index");
          return {
            active: Number(label?.match(/^Item (\d+) of/)?.[1] ?? 0) - 1,
            selected: Number(selected ?? -1),
            hidden: Number(hidden ?? -1),
          };
        }),
      )
      .toEqual({ active: expected, selected: expected, hidden: expected });
    await page.waitForTimeout(250);
    const stable = await page.evaluate(() => {
      const label = document
        .querySelector('[data-fluidbox-slide][aria-hidden="false"]')
        ?.getAttribute("aria-label");
      const selected = document
        .querySelector('[data-fluidbox-filmstrip-item][aria-selected="true"]')
        ?.getAttribute("data-index");
      const hidden = document
        .querySelector("[data-fluidbox-thumbnail-hidden]")
        ?.closest("[data-photo-index]")
        ?.getAttribute("data-photo-index");
      return {
        active: Number(label?.match(/^Item (\d+) of/)?.[1] ?? 0) - 1,
        selected: Number(selected ?? -1),
        hidden: Number(hidden ?? -1),
      };
    });
    expect(stable).toEqual({ active: expected, selected: expected, hidden: expected });

    if (step % 2 === 0) {
      await page.locator("[data-fluidbox-close]").click();
    } else {
      await page.keyboard.press("Escape");
    }
    await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
    await expect(page.locator("[data-fluidbox-thumbnail-hidden]")).toHaveCount(0);
  }
});

test("filmstrip scrubbing reveals the host only after touch settlement", async ({ page }) => {
  await page.goto("/photo-library.html?count=10000");
  await page.locator('[data-photo-index="0"]').click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-state",
    "open",
  );
  const selectedIndex = 5_000;
  const filmstrip = page.locator("[data-fluidbox-filmstrip-scroll]");
  const provisional = await filmstrip.evaluate(async (element, index) => {
    const start = new Event("touchstart", { bubbles: true });
    Object.defineProperty(start, "touches", { value: [] });
    element.dispatchEvent(start);
    const size = parseFloat(
      getComputedStyle(element.parentElement!).getPropertyValue("--fluidbox-filmstrip-item-size"),
    );
    const gap = parseFloat(getComputedStyle(element).columnGap);
    const padding = parseFloat(getComputedStyle(element).paddingLeft);
    element.scrollTo({
      left: padding + index * (size + gap) + size / 2 - element.clientWidth / 2,
      behavior: "instant",
    });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return {
      activeLabel: document
        .querySelector('[data-fluidbox-slide][aria-hidden="false"]')
        ?.getAttribute("aria-label"),
      hostMounted: document.querySelector(`[data-photo-index="${index}"]`) !== null,
    };
  }, selectedIndex);

  expect(provisional).toEqual({
    activeLabel: `Item ${selectedIndex + 1} of 10000`,
    hostMounted: false,
  });
  await filmstrip.evaluate((element) => {
    const event = new Event("touchend", { bubbles: true });
    Object.defineProperty(event, "touches", { value: [] });
    element.dispatchEvent(event);
  });
  await expect(page.locator(`[data-photo-index="${selectedIndex}"]`)).toHaveCount(1);
});

test("delayed programmatic filmstrip scrolling cannot take navigation ownership", async ({
  page,
}) => {
  await page.goto("/photo-library.html?count=10000");
  await page.locator('[data-photo-index="0"]').click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-state", "open");

  const filmstrip = page.locator("[data-fluidbox-filmstrip-scroll]");
  await filmstrip.evaluate(async (element) => {
    const size = parseFloat(
      getComputedStyle(element.parentElement!).getPropertyValue("--fluidbox-filmstrip-item-size"),
    );
    const gap = parseFloat(getComputedStyle(element).columnGap);
    const padding = parseFloat(getComputedStyle(element).paddingLeft);
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
    element.scrollLeft = padding + 80 * (size + gap) + size / 2 - element.clientWidth / 2;
    element.dispatchEvent(new Event("scroll", { bubbles: false }));
    await new Promise<void>((resolve) => setTimeout(resolve, 220));
  });

  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 1 of 10000",
  );
  await expect(dialog).toHaveAttribute("data-fluidbox-state", "open");
});

test("a pointer gesture without scrolling releases filmstrip ownership", async ({ page }) => {
  await page.goto("/photo-library.html?count=10000");
  await page.getByLabel("Photo number").fill("5001");
  await page.getByRole("button", { name: "Open number" }).click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-state",
    "open",
  );

  const filmstrip = page.locator("[data-fluidbox-filmstrip-scroll]");
  await filmstrip.evaluate(async (element) => {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    element.scrollLeft += 40 * 57;
    element.dispatchEvent(new Event("scroll"));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });

  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 5001 of 10000",
  );
  await page.waitForTimeout(300);
  await expect(
    page.locator('[data-fluidbox-filmstrip-item][aria-selected="true"]'),
  ).toHaveAttribute("data-index", "5000");
});

test("filmstrip input and programmatic sync settle without an event storm", async ({ page }) => {
  await page.goto("/photo-library.html?count=10000");
  await page.getByLabel("Photo number").fill("5001");
  await page.getByRole("button", { name: "Open number" }).click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-state",
    "open",
  );

  const filmstrip = page.locator("[data-fluidbox-filmstrip-scroll]");
  const selectedIndex = await filmstrip.evaluate(async (element) => {
    let scrollEvents = 0;
    element.addEventListener("scroll", () => (scrollEvents += 1));
    for (let step = 0; step < 24; step += 1) {
      const start = new Event("touchstart", { bubbles: true });
      Object.defineProperty(start, "touches", { value: [{}] });
      element.dispatchEvent(start);
      element.scrollLeft += step % 2 ? -73 : 131;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const end = new Event("touchend", { bubbles: true });
      Object.defineProperty(end, "touches", { value: [] });
      element.dispatchEvent(end);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    const settledEvents = scrollEvents;
    await new Promise<void>((resolve) => setTimeout(resolve, 400));
    return {
      active: document
        .querySelector('[data-fluidbox-slide][aria-hidden="false"]')
        ?.getAttribute("aria-label"),
      selected: document
        .querySelector('[data-fluidbox-filmstrip-item][aria-selected="true"]')
        ?.getAttribute("data-index"),
      extraEvents: scrollEvents - settledEvents,
    };
  });
  expect(selectedIndex.extraEvents).toBe(0);
  expect(selectedIndex.active).toBe(`Item ${Number(selectedIndex.selected) + 1} of 10000`);
});

test("a vertical wheel burst scrolls and settles the filmstrip once", async ({ page }) => {
  await page.goto("/photo-library.html?count=10000");
  await page.getByLabel("Photo number").fill("5001");
  await page.getByRole("button", { name: "Open number" }).click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-state",
    "open",
  );

  const filmstrip = page.locator("[data-fluidbox-filmstrip-scroll]");
  await filmstrip.evaluate((element) => {
    for (const deltaY of [90, 120, 0]) {
      element.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY }));
    }
  });
  await expect
    .poll(() =>
      page
        .locator('[data-fluidbox-filmstrip-item][aria-selected="true"]')
        .getAttribute("data-index"),
    )
    .not.toBe("5000");
  const selected = Number(
    await page
      .locator('[data-fluidbox-filmstrip-item][aria-selected="true"]')
      .getAttribute("data-index"),
  );
  await expect(page.locator(`[data-photo-index="${selected}"]`)).toHaveCount(1);
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    `Item ${selected + 1} of 10000`,
  );
});

test("native gallery swiping reveals the virtualized origin only after settlement", async ({
  page,
}) => {
  await page.goto("/photo-library.html?count=10000");
  await page.locator('[data-photo-index="0"]').click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-state",
    "open",
  );
  await page.locator(".library-scroll").evaluate((element) => {
    element.scrollTop = element.scrollHeight - element.clientHeight;
  });
  await expect(page.locator('[data-photo-index="1"]')).toHaveCount(0);

  const slides = page.locator("[data-fluidbox-slides]");
  const provisional = await slides.evaluate(async (element) => {
    const start = new Event("touchstart", { bubbles: true });
    Object.defineProperty(start, "touches", { value: [{}] });
    element.dispatchEvent(start);
    element.scrollLeft = element.clientWidth;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return {
      activeLabel: element
        .querySelector('[data-fluidbox-slide][aria-hidden="false"]')
        ?.getAttribute("aria-label"),
      hostMounted: document.querySelector('[data-photo-index="1"]') !== null,
    };
  });
  expect(provisional).toEqual({ activeLabel: "Item 2 of 10000", hostMounted: false });

  await slides.evaluate((element) => {
    const end = new Event("touchend", { bubbles: true });
    Object.defineProperty(end, "touches", { value: [] });
    element.dispatchEvent(end);
    element.dispatchEvent(new Event("scrollend"));
  });
  await expect(page.locator('[data-photo-index="1"]')).toHaveCount(1);
});

test("native slide swiping survives the browser pointer-cancel handoff", async ({ page }) => {
  await page.goto("/photo-library.html?count=10000");
  await page.locator('[data-photo-index="0"]').click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-state",
    "open",
  );

  const slides = page.locator("[data-fluidbox-slides]");
  await slides.evaluate(async (element) => {
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
      }),
    );
    element.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
      }),
    );
    element.scrollLeft = element.clientWidth;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });

  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 2 of 10000",
  );
});

test("opening remains active until the delayed filmstrip reveal settles", async ({ page }) => {
  await page.goto("/photo-library.html");
  await page.locator("[data-photo-index]").first().click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  const filmstrip = page.locator("[data-fluidbox-filmstrip]");
  const paused = await filmstrip.evaluate(async (element) => {
    for (let frame = 0; frame < 60; frame += 1) {
      const animation = element
        .getAnimations()
        .find(
          (candidate) => (candidate as CSSAnimation).animationName === "fluidbox-filmstrip-appear",
        );
      if (animation) {
        animation.pause();
        return true;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return false;
  });
  expect(paused).toBe(true);
  await page.waitForTimeout(600);
  await expect(dialog).toHaveAttribute("data-fluidbox-state", "opening");
  await filmstrip.evaluate((element) => {
    element
      .getAnimations()
      .find(
        (candidate) => (candidate as CSSAnimation).animationName === "fluidbox-filmstrip-appear",
      )
      ?.finish();
  });
  await expect(dialog).toHaveAttribute("data-fluidbox-state", "open");
});

test("filmstrip reveal runs one monotonic fade", async ({ page }) => {
  await page.goto("/photo-library.html");
  await page.evaluate(() => {
    const measurements = { starts: 0 };
    Object.assign(window, { __filmstripRevealMeasurements: measurements });
    document.addEventListener(
      "animationstart",
      (event) => {
        if ((event as AnimationEvent).animationName === "fluidbox-filmstrip-appear") {
          measurements.starts += 1;
        }
      },
      true,
    );
    // The fade is a CSS animation that starts with the reveal attribute, and
    // a stalled frame can play it out unseen, so pause it in that same task.
    new MutationObserver(() => {
      if (document.querySelector("[data-filmstrip-revealing]")) window.__motion.freeze();
    }).observe(document.body, {
      attributes: true,
      attributeFilter: ["data-filmstrip-revealing"],
      subtree: true,
    });
  });
  await holdMotion(page);
  await page.locator("[data-photo-index]").first().click();
  const measurements = await page.evaluate(async () => {
    const end = await window.__motion.ready();
    const filmstrip = document.querySelector<HTMLElement>("[data-fluidbox-filmstrip]")!;
    const fade = filmstrip
      .getAnimations()
      .find(
        (candidate) => (candidate as CSSAnimation).animationName === "fluidbox-filmstrip-appear",
      )!;
    const fadeEnd = Number(fade.effect!.getComputedTiming().endTime);
    const opacity: number[] = [];
    for (let time = 0; time <= Math.max(end, fadeEnd); time += 8) {
      window.__motion.seek(time);
      if (getComputedStyle(filmstrip).visibility === "visible") {
        opacity.push(Number(getComputedStyle(filmstrip).opacity));
      }
    }
    window.__motion.release();
    return opacity;
  });
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-state",
    "open",
  );
  const { starts } = await page.evaluate(
    () =>
      (window as unknown as { __filmstripRevealMeasurements: { starts: number } })
        .__filmstripRevealMeasurements,
  );
  expect(starts).toBe(1);
  expect(measurements.some((opacity) => opacity > 0 && opacity < 1)).toBe(true);
  for (let index = 1; index < measurements.length; index += 1) {
    expect(measurements[index]!).toBeGreaterThanOrEqual(measurements[index - 1]! - 0.01);
  }
});
