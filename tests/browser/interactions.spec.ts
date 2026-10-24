import { expect, test } from "@playwright/test";
import type { FluidboxGalleryElement, FluidboxItemElement } from "@ogdakke/fluidbox/elements";

test("custom gallery exposes fluidbox readiness and cancels a disconnected waiter", async ({
  page,
}) => {
  await page.goto("/harness.html");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  const result = await page.evaluate(async () => {
    const existing = document.querySelector<FluidboxGalleryElement>("fluidbox-gallery")!;
    const fluidbox = await existing.whenReady();
    const pending = document.createElement("fluidbox-gallery") as FluidboxGalleryElement;
    document.body.append(pending);
    const cancelled = pending.whenReady().catch((error: DOMException) => error.name);
    pending.remove();
    return { count: fluidbox.state.count, cancelled: await cancelled };
  });
  expect(result).toEqual({ count: 3, cancelled: "AbortError" });
});

test("changes inside a trigger don't re-read the items; changes to an item do", async ({
  page,
}) => {
  await page.goto("/harness.html");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  const calls = await page.evaluate(async () => {
    const gallery = document.querySelector<FluidboxGalleryElement>("fluidbox-gallery")!;
    const fluidbox = await gallery.whenReady();
    const original = fluidbox.setItems.bind(fluidbox);
    let refreshes = 0;
    fluidbox.setItems = (items) => {
      refreshes++;
      return original(items);
    };
    const preview = gallery.querySelector<FluidboxItemElement>("fluidbox-item")!;
    // An album cover swapping its picture, as a close flight lands on another item.
    const image = preview.trigger!.querySelector("img")!;
    image.src = "/art/canyon.svg";
    image.alt = "Updated preview";
    const layer = document.createElement("span");
    preview.trigger!.append(layer);
    layer.remove();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const dynamic = refreshes;
    gallery.querySelectorAll("fluidbox-item")[1]!.setAttribute("aria-label", "Second photo");
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return { dynamic, source: refreshes };
  });
  expect(calls.dynamic).toBe(0);
  expect(calls.source).toBeGreaterThan(0);
});

test("declarative items carry placeholder images into neighboring slides", async ({ page }) => {
  await page.goto("/harness.html");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  const placeholder =
    "data:image/svg+xml," +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>');
  await page.evaluate((src) => {
    document.querySelectorAll("fluidbox-item")[1]!.setAttribute("placeholder", src);
  }, placeholder);
  await page.locator("fluidbox-item").first().click();
  await expect(
    page.locator("[data-fluidbox-slide] [data-fluidbox-slide-placeholder]").nth(0),
  ).toHaveAttribute("src", placeholder);
});

test("a viewer template replaces the default controls but Close", async ({ page }) => {
  await page.goto("/harness.html?viewer-template");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  await page.locator("fluidbox-item").first().click();
  await expect(page.locator("[data-fluidbox-dialog] [data-fluidbox-close]")).toHaveCount(1);
  await expect(page.locator("[data-fluidbox-dialog] [data-fluidbox-previous]")).toHaveCount(0);
  await page.locator("[data-fluidbox-dialog] [data-test-next]").click();
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 2 of 3",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
});

test("viewer selectors stay isolated and honor stylesheet order", async ({ page }) => {
  await page.goto("/harness.html?no-thumbnails");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  await page.evaluate(() => {
    const lookalike = document.createElement("div");
    lookalike.id = "outside-fluidbox-lookalike";
    lookalike.dataset.fluidboxDialog = "";
    const frame = document.createElement("div");
    frame.dataset.fluidboxFrame = "";
    lookalike.append(frame);
    document.body.append(lookalike);

    const earlyOverride = document.createElement("style");
    earlyOverride.textContent =
      "[data-fluidbox-close] { width: 41px; } fluidbox-item { --fluidbox-background: rgb(12 34 56); }";
    document.head.prepend(earlyOverride);
  });
  await expect(page.locator("#outside-fluidbox-lookalike")).toHaveCSS("position", "static");
  await expect(page.locator("#outside-fluidbox-lookalike [data-fluidbox-frame]")).toHaveCSS(
    "overflow",
    "visible",
  );

  await page.locator("fluidbox-item").first().click();
  const overlay = page.locator("[data-fluidbox-viewer]");
  const close = overlay.locator("[data-fluidbox-close]").first();
  await expect(overlay).toHaveCSS("position", "absolute");
  await expect(overlay.locator("[data-fluidbox-container]")).toHaveCSS("position", "absolute");
  await expect(overlay.locator("[data-fluidbox-backdrop]")).toHaveCSS("position", "absolute");
  await expect(overlay.locator("[data-fluidbox-backdrop]")).toHaveCSS(
    "background-color",
    "rgb(12, 34, 56)",
  );
  await expect(overlay.locator("[data-fluidbox-frame]").first()).toHaveCSS("overflow", "hidden");
  // The site's viewer theme loads after the package CSS and sizes the close control to 40px.
  await expect(close).toHaveCSS("width", "40px");

  await page.addStyleTag({ content: "[data-fluidbox-close] { width: 41px; }" });
  await expect(close).toHaveCSS("width", "41px");
});

test("backdrop covers the document while the viewer stays in the viewport", async ({ page }) => {
  await page.goto("/harness.html?no-thumbnails");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  await page.evaluate(() => {
    const before = document.createElement("div");
    before.style.height = "1200px";
    document.body.prepend(before);
    const after = document.createElement("div");
    after.style.height = "1800px";
    document.body.append(after);
  });
  await page.locator("fluidbox-item").first().click();
  await expect(page.locator("[data-fluidbox-viewer]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  const geometry = await page.evaluate(() => {
    const backdrop = document.querySelector<HTMLElement>("[data-fluidbox-backdrop]")!;
    const container = document.querySelector<HTMLElement>("[data-fluidbox-container]")!;
    const backdropBounds = backdrop.getBoundingClientRect();
    return {
      scrollY: window.scrollY,
      pageHeight: document.documentElement.scrollHeight,
      backdropHeight: backdropBounds.height,
      backdropTop: backdropBounds.top,
      backdropBottom: backdropBounds.bottom,
      containerTop: container.getBoundingClientRect().top,
      viewportHeight: window.innerHeight,
    };
  });
  expect(geometry.scrollY).toBeGreaterThan(0);
  expect(geometry.backdropHeight).toBeGreaterThanOrEqual(geometry.pageHeight - 1);
  expect(geometry.backdropTop).toBeLessThanOrEqual(0);
  expect(geometry.backdropBottom).toBeGreaterThanOrEqual(geometry.viewportHeight);
  expect(Math.abs(geometry.containerTop)).toBeLessThanOrEqual(1);
});

test("playground opens both the DOM gallery and indexed source", async ({ page }) => {
  await page.goto("/playground.html");
  await expect(page.getByRole("heading", { name: "Open, swipe, zoom, explore." })).toBeVisible();
  await page.locator(".photo-grid fluidbox-item").first().click();
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 1 of 2",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  await expect(page.locator("#virtual-gallery .virtual-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 50000 of 100000",
  );
  await expect(page.locator("#virtual-gallery .virtual-card")).toHaveCount(12);
});

for (const shadow of [false, true]) {
  test(`opens, navigates, and closes ${shadow ? "in shadow DOM" : "in light DOM"}`, async ({
    page,
  }) => {
    await page.goto(`/harness.html${shadow ? "?shadow" : ""}`);
    await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
    const gallery = shadow
      ? page.locator("#fixture").locator("fluidbox-gallery")
      : page.locator("fluidbox-gallery");
    await gallery.locator("fluidbox-item").first().click();
    const dialog = page.locator("[data-fluidbox-dialog]");
    await expect(dialog).toBeVisible();
    await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      "Item 1 of 3",
    );
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      "Item 2 of 3",
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}

test("picture content stays within the viewport after placeholder replacement", async ({
  page,
}) => {
  await page.goto("/harness.html?pictures");
  await page.locator("fluidbox-item").first().click();
  const active = page.locator('[data-fluidbox-slide][aria-hidden="false"]');
  await expect(active).toHaveAttribute("aria-label", "Item 1 of 3");
  await page.keyboard.press("ArrowRight");
  await expect(active).toHaveAttribute("aria-label", "Item 2 of 3");
  const picture = active.locator("[data-fluidbox-picture]");
  await expect(picture).toBeVisible();
  await expect(picture.locator("source")).toHaveAttribute("type", "image/svg+xml");
  await expect(picture.locator("source")).toHaveAttribute("srcset", /1x, .*\?large 2x/);
  await expect(picture.locator("img")).toHaveAttribute("srcset", /1x, .*\?large 2x/);
  const { width, height } = await picture
    .locator("img")
    .boundingBox()
    .then((box) => box!);
  const viewport = page.viewportSize()!;
  expect(width).toBeLessThanOrEqual(viewport.width);
  expect(height).toBeLessThanOrEqual(viewport.height);
  expect(width / height).toBeCloseTo(3024 / 4032, 2);
});

test("gallery controls reveal with the backdrop and arrow selection does not fade", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/harness.html");
  await page.locator("fluidbox-item").first().click({ noWaitAfter: true });

  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-revealing", "");
  const next = dialog.locator("[data-fluidbox-next]");
  const close = dialog.locator("[data-fluidbox-close]");
  await expect(next).toHaveCSS("pointer-events", "none");
  await expect(close).toHaveCSS("pointer-events", "none");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  await expect(next).toHaveCSS("pointer-events", "auto");
  await expect(close).toHaveCSS("pointer-events", "auto");

  await next.click();
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 2 of 3",
  );
  const opacityAnimations = await page
    .locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]')
    .evaluate((media) =>
      media
        .getAnimations()
        .map((animation) => (animation.effect as KeyframeEffect | null)?.getKeyframes() ?? [])
        .filter((keyframes) => keyframes.some((keyframe) => keyframe.opacity === "0.35")),
    );
  expect(opacityAnimations).toEqual([]);
});

test("thumbnails selects a distant item", async ({ page }) => {
  await page.goto("/harness.html?count=30");
  await page.locator("fluidbox-item").first().click();
  await expect(page.locator("[data-fluidbox-thumbnails]")).toHaveCSS("pointer-events", "auto");
  await page.locator("[data-fluidbox-thumbnails-scroll]").evaluate((scroller: HTMLElement) => {
    const size = parseFloat(
      getComputedStyle(scroller.parentElement!).getPropertyValue("--fluidbox-thumbnails-item-size"),
    );
    const gap = parseFloat(getComputedStyle(scroller).columnGap);
    scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: size + gap }));
    scroller.scrollTo({ left: 20 * (size + gap), behavior: "instant" });
  });
  await page.locator('[data-fluidbox-thumbnails-item][data-index="20"]').click();
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 21 of 30",
  );
});

test("settled gallery frame matches its visual baseline", async ({ page }) => {
  await page.goto("/harness.html");
  await page.locator("fluidbox-item").first().click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  await page
    .locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]')
    .evaluate((image: HTMLImageElement) => image.decode());
  await expect(page).toHaveScreenshot("opened-gallery.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixels: 16,
  });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 2 of 3",
  );
  await page
    .locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]')
    .evaluate((image: HTMLImageElement) => image.decode());
  await expect(page).toHaveScreenshot("next-gallery.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixels: 16,
  });
});

test("thumbnails DOM stays bounded while scrolling a large gallery", async ({ page }) => {
  await page.goto("/harness.html?count=1000");
  await page.locator("fluidbox-item").first().click();
  await expect(page.locator("[data-fluidbox-thumbnails]")).toHaveCSS("pointer-events", "auto");
  const buttons = page.locator("[data-fluidbox-thumbnails-item]");
  expect(await buttons.count()).toBeLessThan(100);
  expect(await page.locator("[data-fluidbox-slide]").count()).toBeLessThan(40);
  await page.locator("[data-fluidbox-thumbnails-scroll]").evaluate((scroller: HTMLElement) => {
    const size = parseFloat(
      getComputedStyle(scroller.parentElement!).getPropertyValue("--fluidbox-thumbnails-item-size"),
    );
    const gap = parseFloat(getComputedStyle(scroller).columnGap);
    scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: size + gap }));
    scroller.scrollTo({ left: 900 * (size + gap), behavior: "instant" });
  });
  const target = page.locator('[data-fluidbox-thumbnails-item][data-index="900"]');
  await expect(target).toBeVisible();
  await target.click();
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 901 of 1000",
  );
  expect(await buttons.count()).toBeLessThan(100);
  expect(await page.locator("[data-fluidbox-slide]").count()).toBeLessThan(40);
});

test("indexed source survives host thumbnail recycling", async ({ page }) => {
  await page.goto("/harness.html?virtual&count=10000");
  await expect(page.locator("[data-virtual-index]")).toHaveCount(12);
  expect(await page.locator("*").count()).toBeLessThan(100);
  await page.locator('[data-virtual-index="0"]').click();
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 1 of 10000",
  );
  await page.evaluate(() => {
    (window as unknown as { __renderVirtualWindow: (start: number) => void }).__renderVirtualWindow(
      500,
    );
  });
  await page
    .locator("fluidbox-gallery")
    .evaluate((gallery: HTMLElement & { open(target: number): Promise<boolean> }) =>
      gallery.open(501),
    );
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 502 of 10000",
  );
  await page
    .locator("fluidbox-gallery")
    .evaluate((gallery: HTMLElement & { open(target: number): Promise<boolean> }) =>
      gallery.open(9000),
    );
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 9001 of 10000",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 9002 of 10000",
  );
  expect(await page.locator("[data-fluidbox-slide]").count()).toBeLessThan(40);
  expect(await page.locator("[data-fluidbox-thumbnails-item]").count()).toBeLessThan(100);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  await expect(page.locator("fluidbox-gallery")).toBeFocused();
});

test("100k indexed items retain a bounded viewer DOM", async ({ page }) => {
  await page.goto("/harness.html?virtual&count=100000");
  await page
    .locator("fluidbox-gallery")
    .evaluate((gallery: HTMLElement & { open(target: number): Promise<boolean> }) =>
      gallery.open(99990),
    );
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 99991 of 100000",
  );
  expect(await page.locator("[data-fluidbox-slide]").count()).toBeLessThan(40);
  expect(await page.locator("[data-fluidbox-thumbnails-item]").count()).toBeLessThan(100);
  expect(await page.locator("*").count()).toBeLessThan(600);
});

test("iframe content survives slide window eviction", async ({ page }) => {
  await page.goto("/harness.html?count=40&iframe");
  await page.locator("fluidbox-item").first().click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 2 of 40",
  );
  const frame = page.frameLocator('[data-fluidbox-slide][aria-hidden="false"] iframe');
  await expect(frame.getByRole("button", { name: "Inside iframe" })).toBeVisible();
  await page.locator("[data-fluidbox-thumbnails-scroll]").evaluate((scroller: HTMLElement) => {
    const size = parseFloat(
      getComputedStyle(scroller.parentElement!).getPropertyValue("--fluidbox-thumbnails-item-size"),
    );
    const gap = parseFloat(getComputedStyle(scroller).columnGap);
    scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: size + gap }));
    scroller.scrollTo({ left: 35 * (size + gap), behavior: "instant" });
  });
  await expect(page.locator("[data-fluidbox-thumbnails]")).toHaveCSS("pointer-events", "auto");
  await page.locator('[data-fluidbox-thumbnails-item][data-index="35"]').click();
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 36 of 40",
  );
  await expect(
    page.locator('fluidbox-item[data-test-index="1"] template[slot="content"]'),
  ).toHaveCount(1);
});

test("custom iframe media mounts only near the active slide", async ({ page }) => {
  await page.goto("/harness.html?count=100&iframes");
  await page.locator("fluidbox-item").first().click();
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"] iframe')).toHaveCount(1);
  await expect.poll(() => page.locator("[data-fluidbox-slide] iframe").count()).toBeLessThan(4);
  await expect(page.locator("[data-fluidbox-thumbnails]")).toHaveCSS("pointer-events", "auto");
  await page.locator("[data-fluidbox-thumbnails-scroll]").evaluate((scroller: HTMLElement) => {
    const size = parseFloat(
      getComputedStyle(scroller.parentElement!).getPropertyValue("--fluidbox-thumbnails-item-size"),
    );
    const gap = parseFloat(getComputedStyle(scroller).columnGap);
    scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: size + gap }));
    scroller.scrollTo({ left: 80 * (size + gap), behavior: "instant" });
  });
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 81 of 100",
  );
  expect(await page.locator("[data-fluidbox-slide] iframe").count()).toBeLessThan(4);
});

test("indexed source works inside a shadow root", async ({ page }) => {
  await page.goto("/harness.html?virtual&shadow&count=10000");
  const gallery = page.locator("#fixture").locator("fluidbox-gallery");
  await gallery.locator('[data-virtual-index="0"]').click();
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 1 of 10000",
  );
  await gallery.evaluate((element: HTMLElement & { open(target: number): Promise<boolean> }) =>
    element.open(5000),
  );
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 5001 of 10000",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
});

test("thumbnails keeps focus on a retained item while its window moves", async ({ page }) => {
  await page.goto("/harness.html?count=1000");
  await page.locator("fluidbox-item").first().click();
  await expect(page.locator("[data-fluidbox-thumbnails]")).toHaveCSS("pointer-events", "auto");
  const scroller = page.locator("[data-fluidbox-thumbnails-scroll]");
  const scrollToIndex = (index: number) =>
    scroller.evaluate((element: HTMLElement, target: number) => {
      const size = parseFloat(
        getComputedStyle(element.parentElement!).getPropertyValue(
          "--fluidbox-thumbnails-item-size",
        ),
      );
      const gap = parseFloat(getComputedStyle(element).columnGap);
      element.scrollTo({ left: target * (size + gap), behavior: "instant" });
    }, index);
  await scrollToIndex(10);
  const retained = page.locator('[data-fluidbox-thumbnails-item][data-index="10"]');
  await expect(retained).toBeVisible();
  await retained.focus();
  await scrollToIndex(20);
  await expect(retained).toBeFocused();
});

test("native slide window rebases through sequential navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/harness.html?count=100");
  await page.locator("fluidbox-item").first().click();
  for (let index = 1; index <= 45; index++) {
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      `Item ${index + 1} of 100`,
    );
  }
  expect(await page.locator("[data-fluidbox-slide]").count()).toBeLessThan(40);
});

test("animated navigation crosses the slide window boundary", async ({ page, browserName }) => {
  test.skip(
    browserName !== "chromium",
    "Motion boundary is sampled on Chromium; instant navigation runs on all engines.",
  );
  test.setTimeout(60_000);
  await page.goto("/harness.html?count=70");
  await page.locator("fluidbox-item").first().click();
  for (let index = 1; index <= 35; index++) {
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      `Item ${index + 1} of 70`,
    );
  }
  expect(await page.locator("[data-fluidbox-slide]").count()).toBeLessThan(40);
});

test("gallery options change on the open viewer without a rebuild", async ({ page }) => {
  await page.goto("/harness.html");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  await page.locator("fluidbox-item").first().click();
  await expect(page.locator("[data-fluidbox-viewer]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await page.evaluate(() => {
    const gallery = document.querySelector("fluidbox-gallery")!;
    Object.assign(window, { __fluidbox: gallery.fluidbox });
    gallery.labels = { close: "Sulje" };
    gallery.toggleAttribute("nozoom", true);
  });
  await expect(page.locator("[data-fluidbox-portal] [data-fluidbox-close]")).toHaveAttribute(
    "aria-label",
    "Sulje",
  );
  const result = await page.evaluate(() => {
    const gallery = document.querySelector("fluidbox-gallery")!;
    return {
      status: gallery.state.status,
      same: gallery.fluidbox === (window as unknown as { __fluidbox: unknown }).__fluidbox,
      overlays: document.querySelectorAll("[data-fluidbox-viewer]").length,
    };
  });
  expect(result).toEqual({ status: "open", same: true, overlays: 1 });
});
