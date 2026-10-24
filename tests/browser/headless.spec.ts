import { expect, test, type Route } from "@playwright/test";

test("plain runtime opens, navigates, composes controls, and closes without custom elements", async ({
  page,
}) => {
  await page.goto("/headless.html");

  await expect
    .poll(() => page.evaluate(() => customElements.get("fluidbox-item") === undefined))
    .toBe(true);
  const first = page.locator('[data-photo-id="one"]');
  await first.evaluate((trigger) => {
    trigger.style.setProperty("--fluidbox-backdrop-background", "rgb(12 34 56)");
    trigger.style.setProperty("--fluidbox-control-background", "rgb(78 90 123)");
  });
  await first.click();

  const overlay = page.locator("[data-fluidbox-overlay]");
  const activeMedia = page.locator(
    '[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]',
  );
  await expect(overlay).toHaveAttribute("data-fluidbox-status", "open");
  await expect(activeMedia).toHaveAttribute("alt", "Blue square study");
  await expect(
    page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-picture] source'),
  ).toHaveCount(1);
  await expect(activeMedia).toHaveAttribute(
    "srcset",
    "/photo-square.svg 400w, /photo-square.svg 800w",
  );
  await expect(activeMedia).toHaveAttribute("sizes", "min(100vw, 800px)");
  await expect(page.locator("[data-demo-caption]")).toHaveText("one");
  await expect(page.locator("[data-fluidbox-backdrop]")).toHaveCSS(
    "background-color",
    "rgb(12, 34, 56)",
  );
  await expect(overlay).toHaveCSS("--fluidbox-control-background", "rgb(78 90 123)");
  await expect(first).toHaveAttribute("aria-haspopup", "dialog");
  // A modal trigger is never "expanded"; aria-haspopup says what it opens.
  await expect(first).not.toHaveAttribute("aria-expanded", /.*/);
  await expect(first).toHaveAttribute("data-fluidbox-status", "open");

  await page.locator("[data-demo-next]").click();
  await expect(page.locator("[data-demo-caption]")).toHaveText("two");
  await expect(activeMedia).toHaveAttribute("alt", "Orange portrait study");
  await expect(
    page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-picture] source'),
  ).toHaveCount(0);
  await expect(activeMedia).not.toHaveAttribute("srcset", /.+/);
  await expect(activeMedia).not.toHaveAttribute("sizes", /.+/);
  await expect(first).toHaveAttribute("data-fluidbox-status", "closed");
  await expect(page.locator('[data-photo-id="two"]')).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );

  await page.locator("[data-demo-close]").click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="two"]')).toBeFocused();
  await expect(page.locator('[data-photo-id="two"]')).toHaveAttribute(
    "data-fluidbox-status",
    "closed",
  );
});

test("clicking the empty gallery slide closes the lightbox", async ({ page }, testInfo) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );

  const slide = page.locator('[data-fluidbox-slide][aria-hidden="false"]');
  const frame = slide.locator("[data-fluidbox-frame]");
  const slideBounds = await slide.boundingBox();
  const frameBounds = await frame.boundingBox();
  expect(slideBounds).not.toBeNull();
  expect(frameBounds).not.toBeNull();
  const x = slideBounds!.x + 12;
  const y = slideBounds!.y + 12;
  expect(
    x < frameBounds!.x ||
      x > frameBounds!.x + frameBounds!.width ||
      y < frameBounds!.y ||
      y > frameBounds!.y + frameBounds!.height,
  ).toBe(true);
  if (testInfo.project.use.isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
});

test("plain runtime contains focus, leaves Tab to the browser and keeps page keys from closing", async ({
  page,
}) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const overlay = page.locator("[data-fluidbox-overlay]");
  await expect(overlay).toHaveAttribute("data-fluidbox-status", "open");
  // A viewer of your own keeps the default Close, which takes focus.
  const close = page.locator("[data-fluidbox-dialog] [data-fluidbox-close]");
  await expect(close).toBeFocused();

  // Tab is the browser's: it walks the dialog in order, and the page behind is inert.
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-demo-next]")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();

  await page.locator("h1").evaluate((heading) => {
    heading.closest("main")!.removeAttribute("inert");
    heading.setAttribute("tabindex", "-1");
    (heading as HTMLElement).focus();
  });
  await expect(close).toBeFocused();

  await page.keyboard.press("PageDown");
  await expect(overlay).toHaveAttribute("data-fluidbox-status", "open");
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="one"]')).toBeFocused();
});

test("plain runtime returns focus to a virtualized origin host", async ({ page }) => {
  await page.goto("/headless.html");
  const gallery = page.locator(".headless-grid");
  await gallery.evaluate((element) => element.setAttribute("tabindex", "0"));
  await page.locator('[data-photo-id="one"]').click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );

  await page.locator('[data-photo-id="one"]').evaluate((element) => element.remove());
  await page.evaluate(() => void window.headlessViewer.close());

  await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(0);
  await expect(gallery).toBeFocused();
});

test("plain controllers hand body-level ownership to the newest viewer", async ({ page }) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );

  await page.evaluate(() => void window.headlessSecondaryViewer.open("two"));
  await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(1);
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await expect(
    page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]'),
  ).toHaveAttribute("alt", "Orange portrait study");
  const states = await page.evaluate(() => ({
    first: window.headlessViewer.state.status,
    second: window.headlessSecondaryViewer.state.status,
  }));
  expect(states).toEqual({ first: "closed", second: "open" });
  await page.evaluate(() => void window.headlessSecondaryViewer.close());
  await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(0);
});

test("active viewer ownership honors a prevented close", async ({ page }) => {
  await page.goto("/headless.html");
  await page.evaluate(() => void window.headlessProtectedViewer.open("one"));
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );

  const result = await page.evaluate(() => window.headlessSecondaryViewer.open("two"));

  expect(result).toBe(false);
  await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(1);
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await expect(
    page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]'),
  ).toHaveAttribute("alt", "Blue square study");
  const states = await page.evaluate(() => ({
    protected: window.headlessProtectedViewer.state.status,
    secondary: window.headlessSecondaryViewer.state.status,
  }));
  expect(states).toEqual({ protected: "open", secondary: "closed" });
  await page.evaluate(() => window.headlessProtectedViewer.destroy());
  await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(0);
});

test("plain runtime owns video and iframe media while custom renderers own descendants", async ({
  page,
}) => {
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setItems([
      {
        id: "custom",
        type: "demo",
        title: "Custom study",
        width: 800,
        height: 600,
      },
      {
        id: "video",
        type: "video",
        src: "/video/missing.mp4",
        title: "Video study",
        width: 800,
        height: 450,
      },
      {
        id: "iframe",
        type: "iframe",
        src: "/map-panel.html",
        title: "Iframe study",
        width: 800,
        height: 600,
        sandbox: "allow-scripts",
      },
    ]);
    void window.headlessViewer.open("custom");
  });
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator("[data-test-custom-media]")).toHaveText("Custom custom");

  await page.keyboard.press("ArrowRight");
  await expect(
    page.locator('[data-fluidbox-slide][aria-hidden="false"] video[data-fluidbox-media]'),
  ).toHaveAttribute("aria-label", "Video study");
  await page.keyboard.press("ArrowRight");
  await expect(
    page.locator('[data-fluidbox-slide][aria-hidden="false"] iframe[data-fluidbox-media]'),
  ).toHaveAttribute("title", "Iframe study");
  await expect(page.locator("body")).toHaveAttribute("data-custom-mounts", "1");
  await expect(page.locator("body")).toHaveAttribute("data-custom-aborts", "1");
  await expect(page.locator("body")).toHaveAttribute("data-custom-disposals", "1");

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(0);
});

test("destroy unloads mounted custom media before removing the viewer", async ({ page }) => {
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setItems([
      { id: "one", type: "demo", title: "Custom study", width: 800, height: 600 },
    ]);
    await window.headlessViewer.open("one");
    window.headlessViewer.destroy();
  });

  await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(0);
  await expect(page.locator("body")).toHaveAttribute("data-custom-mounts", "1");
  await expect(page.locator("body")).toHaveAttribute("data-custom-aborts", "1");
  await expect(page.locator("body")).toHaveAttribute("data-custom-disposals", "1");
});

test("custom media uses the document close flight and returns to its retained slide", async ({
  page,
}) => {
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setItems([
      { id: "one", type: "demo", title: "Custom study", width: 800, height: 600 },
    ]);
    await window.headlessViewer.open("one");
    void window.headlessViewer.close();
  });

  await expect(page.locator("[data-fluidbox-flight] [data-test-custom-media]")).toHaveText(
    "Custom one",
  );
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
  await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(0);

  await page.evaluate(() => void window.headlessViewer.open("one"));
  await expect(
    page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-test-custom-media]'),
  ).toHaveText("Custom one");
  await expect(page.locator("body")).toHaveAttribute("data-custom-mounts", "1");
  await page.evaluate(() => window.headlessViewer.destroy());
});

test("plain runtime does not take native horizontal swipe ownership", async ({ page }) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  await expect(page.locator("[data-fluidbox-overlay]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );

  const sample = await page.locator("[data-fluidbox-slides]").evaluate(async (scroller) => {
    const element = scroller as HTMLElement;
    const width = element.clientWidth;
    element.style.scrollSnapType = "none";
    const start = new Event("touchstart", { bubbles: true });
    Object.defineProperty(start, "touches", { value: [{}] });
    element.dispatchEvent(start);
    element.scrollLeft = width * 0.62;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const end = new Event("touchend", { bubbles: true });
    Object.defineProperty(end, "touches", { value: [] });
    element.dispatchEvent(end);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return {
      position: element.scrollLeft / width,
      selected: element
        .querySelector('[data-fluidbox-slide][aria-hidden="false"]')
        ?.getAttribute("aria-label"),
      snapOverride: element.style.scrollSnapType,
    };
  });

  expect(sample.selected).toBe("Item 2 of 2");
  expect(sample.position).toBeGreaterThan(0.55);
  expect(sample.position).toBeLessThan(0.8);
  expect(sample.snapOverride).toBe("none");
});

test("plain runtime reveals the selected mounted origin without a host callback", async ({
  page,
}) => {
  await page.goto("/headless.html");
  await page.evaluate(() => {
    const second = document.querySelector<HTMLElement>('[data-photo-id="two"]')!;
    second.scrollIntoView = () => {
      second.dataset.testRevealed = "";
    };
  });
  await page.locator('[data-photo-id="one"]').click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await page.locator("[data-demo-next]").click();
  const second = page.locator('[data-photo-id="two"]');
  await expect(second).toHaveAttribute("data-test-revealed", "");
  await expect(second.locator("img")).toHaveAttribute("data-fluidbox-thumbnail-hidden", "");
});

test("plain runtime keeps the preview painted until the full image can replace it", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let serveFull!: () => void;
  const fullHeld = new Promise<void>((resolve) => (serveFull = resolve));
  await page.route(
    (url) => url.search === "?full",
    async (route) => {
      await fullHeld;
      await route.continue();
    },
  );
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setItems([
      {
        id: "preview-test",
        type: "image",
        src: "/photo-square.svg?full",
        alt: "Preview handoff",
        width: 800,
        height: 800,
        thumbnail: { src: "/photo-portrait.svg", width: 240, height: 360 },
      },
    ]);
    void window.headlessViewer.open("preview-test");
  });
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "opening");
  const media = page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]');
  await expect(media).toHaveAttribute("src", "/photo-portrait.svg");
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  await expect(media).toHaveAttribute("src", "/photo-portrait.svg");
  serveFull();
  await expect(media).toHaveAttribute("src", "/photo-square.svg?full");
});

test("adjacent slides paint their placeholder while responsive images are pending", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/pending-slide-*.svg", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.abort();
  });
  await page.goto("/headless.html");
  const placeholder =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="teal"/></svg>',
    );
  await page.evaluate(async (src) => {
    await window.headlessViewer.setItems(
      [0, 1].map((index) => ({
        id: `pending-${index}`,
        type: "image" as const,
        src: `/pending-slide-full-${index}.svg`,
        alt: `Pending image ${index}`,
        width: 800,
        height: 800,
        placeholder: src,
        thumbnail: { src: `/pending-slide-preview-${index}.svg` },
      })),
    );
    await window.headlessViewer.open(0);
  }, placeholder);
  const neighbor = page.locator("[data-fluidbox-slide] [data-fluidbox-media]").nth(1);
  await expect(neighbor).toHaveAttribute("loading", "eager");
  // Mobile WebKit has no wheel input.
  if (testInfo.project.name === "iphone-15-pro" || testInfo.project.name === "ipad-pro-11") {
    await page.evaluate(() => window.headlessViewer.open(1));
  } else {
    const strip = page.locator("[data-fluidbox-slides]");
    const bounds = (await strip.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.wheel(bounds.width, 0);
  }
  const active = page.locator('[data-fluidbox-slide][aria-hidden="false"]');
  await expect(active.locator("[data-fluidbox-media]")).toHaveAttribute("alt", "Pending image 1");
  const fallback = active.locator("[data-fluidbox-slide-placeholder]");
  await expect(fallback).toHaveAttribute("src", placeholder);
  await expect
    .poll(() => fallback.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(8);
  await expect(active.locator("[data-fluidbox-media]")).toHaveCSS("visibility", "hidden");
});

test("plain runtime retains the last decoded origin when its next source is pending", async ({
  page,
}) => {
  let fullRequests = 0;
  let serveFull!: () => void;
  const fullHeld = new Promise<void>((resolve) => (serveFull = resolve));
  await page.route("**/pending-origin.svg", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await route.abort();
  });
  await page.route("**/deferred-full.svg", async (route) => {
    fullRequests += 1;
    await fullHeld;
    await route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="green"/></svg>',
    });
  });
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setItems([
      {
        id: "one",
        type: "image",
        src: "/deferred-full.svg",
        alt: "Deferred full image",
        width: 800,
        height: 800,
      },
    ]);
    const trigger = document.querySelector<HTMLElement>('[data-photo-id="one"]')!;
    const thumbnail = trigger.querySelector<HTMLImageElement>("img")!;
    await thumbnail.decode();
    // The fixture binds the trigger, so its thumbnail is the origin.
    thumbnail.src = "/pending-origin.svg";
    void window.headlessViewer.open("one");
  });

  const activeMedia = page.locator(
    '[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]',
  );
  // The full image loads from the start of the flight, behind the last decoded origin.
  await expect(activeMedia).toHaveAttribute("src", /photo-square\.svg/);
  await expect.poll(() => fullRequests).toBe(1);
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "opening",
  );
  serveFull();
  await expect(activeMedia).toHaveAttribute("src", "/deferred-full.svg");
});

test("plain runtime keeps the preview available while a failed full image is retried", async ({
  page,
}) => {
  const fullImageRoute = "**/retry-full.svg";
  await page.route(fullImageRoute, (route) => route.abort("failed"));
  const serveFullImage = (route: Route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="green"/></svg>',
    });
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setItems([
      {
        id: "retry-test",
        type: "image",
        src: "/retry-full.svg",
        alt: "Retry handoff",
        width: 800,
        height: 800,
        thumbnail: { src: "/photo-portrait.svg", width: 240, height: 360 },
      },
    ]);
    void window.headlessViewer.open("retry-test");
  });

  const slide = page.locator('[data-fluidbox-slide][aria-hidden="false"]');
  const media = slide.locator("[data-fluidbox-media]");
  const error = slide.locator("[data-fluidbox-error]");
  await expect(error).toBeVisible();
  await expect(media).toHaveAttribute("src", "/photo-portrait.svg");

  await page.unroute(fullImageRoute);
  await page.route(fullImageRoute, serveFullImage);
  await error.getByRole("button", { name: "Retry" }).focus();
  await page.keyboard.press("Enter");
  await expect(error).toBeHidden();
  await expect(media).toHaveAttribute("src", "/retry-full.svg");
});

test("plain runtime keeps focus that moved into the dialog during the opening", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/focus-full.svg", (route) => route.abort("failed"));
  await page.goto("/headless.html");
  const during = await page.evaluate(async () => {
    await window.headlessViewer.setItems([
      {
        id: "focus-test",
        type: "image",
        src: "/focus-full.svg",
        alt: "Focus",
        width: 800,
        height: 800,
        thumbnail: { src: "/photo-portrait.svg", width: 240, height: 360 },
      },
    ]);
    // Hold the opening so the failed slide's Retry can be focused before it settles.
    const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")!
      .value as Element["animate"];
    const held: Animation[] = [];
    Element.prototype.animate = function (this: Element, ...args) {
      const animation = animate.apply(this, args);
      animation.playbackRate = 1e-6;
      held.push(animation);
      return animation;
    };
    void window.headlessViewer.open("focus-test");
    const retry = () =>
      document.querySelector<HTMLElement>(
        '[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-error]:not([hidden]) button',
      );
    const painting = () =>
      document.querySelector("[data-fluidbox-overlay]:not([data-fluidbox-prepared])") && retry();
    for (let frames = 0; frames < 240 && !painting(); frames += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    Element.prototype.animate = animate;
    retry()!.focus();
    const state = {
      state: document.querySelector<HTMLElement>("[data-fluidbox-dialog]")?.dataset.fluidboxStatus,
      focused: document.activeElement === retry(),
    };
    for (const animation of held) animation.playbackRate = 1;
    return state;
  });
  expect(during).toEqual({ state: "opening", focused: true });
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await expect(page.locator("[data-fluidbox-error] button").first()).toBeFocused();
});

test("plain runtime settles immediately when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  const frame = page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-frame]');
  expect(await frame.evaluate((element) => element.getAnimations().length)).toBe(0);

  const behavior = await page.locator("[data-fluidbox-slides]").evaluate((slides) => {
    const element = slides as HTMLElement;
    let selected: ScrollBehavior | undefined;
    const original = element.scrollTo.bind(element);
    element.scrollTo = ((options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === "object") selected = options.behavior;
      if (typeof options === "number") original(options, y ?? 0);
      else original(options);
    }) as typeof element.scrollTo;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    return new Promise<ScrollBehavior | undefined>((resolve) =>
      requestAnimationFrame(() => resolve(selected)),
    );
  });
  expect(behavior).toBe("instant");
  await expect(page.locator("[data-demo-caption]")).toHaveText("two");

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(0);
  await expect(page.locator('[data-photo-id="two"]')).toBeFocused();
});

test("plain runtime keeps session height stable through mobile browser chrome changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const overlay = page.locator("[data-fluidbox-overlay]");
  await expect(overlay).toHaveAttribute("data-fluidbox-status", "open");
  await expect(overlay).toHaveCSS("--fluidbox-height", "700px");

  await page.setViewportSize({ width: 1000, height: 620 });
  await expect(overlay).toHaveCSS("--fluidbox-height", "700px");

  await page.setViewportSize({ width: 820, height: 620 });
  await expect(overlay).toHaveCSS("--fluidbox-height", "620px");
  await expect(overlay).toHaveAttribute("data-fluidbox-status", "open");
});

test("plain runtime preserves the painted frame when open and close reverse", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/headless.html");

  const samples = await page.evaluate(async () => {
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const bounds = () => {
      const frame =
        document.querySelector<HTMLElement>("[data-fluidbox-flight] [data-fluidbox-frame]") ??
        document.querySelector<HTMLElement>(
          '[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-frame]',
        )!;
      const rect = frame.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    };
    const setMotionTime = (time: number) => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = time;
      }
    };

    // The opening starts a frame or more after the call. Hold every animation
    // as it is created so a loaded browser cannot play past the times below.
    const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")!
      .value as Element["animate"];
    const held: Animation[] = [];
    Element.prototype.animate = function (this: Element, ...args) {
      const animation = animate.apply(this, args);
      animation.playbackRate = 1e-6;
      held.push(animation);
      return animation;
    };

    void window.headlessViewer.open("one");
    for (let frames = 0; frames < 240; frames += 1) {
      await nextFrame();
      if (held.length && !document.querySelector("[data-fluidbox-prepared]")) break;
    }
    setMotionTime(120);
    const openingBefore = bounds();
    void window.headlessViewer.close();
    const openingAfter = bounds();

    await nextFrame();
    setMotionTime(90);
    await nextFrame();
    const closingBefore = bounds();
    void window.headlessViewer.open("one");
    await Promise.resolve();
    await Promise.resolve();
    const closingAfter = bounds();
    Element.prototype.animate = animate;
    for (const animation of held) animation.playbackRate = 1;
    return { openingBefore, openingAfter, closingBefore, closingAfter };
  });

  for (const [before, after] of [
    [samples.openingBefore, samples.openingAfter],
    [samples.closingBefore, samples.closingAfter],
  ]) {
    for (const property of ["left", "top", "width", "height"] as const) {
      expect(Math.abs(before[property] - after[property])).toBeLessThan(4);
    }
  }
  await expect(page.locator("[data-fluidbox-overlay]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
});

test("plain runtime publishes drag state and dismisses from a touch pointer", async ({ page }) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const overlay = page.locator("[data-fluidbox-overlay]");
  await expect(overlay).toHaveAttribute("data-fluidbox-status", "open");

  const frame = page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-frame]');
  const center = await frame.boundingBox();
  expect(center).not.toBeNull();
  const x = center!.x + center!.width / 2;
  const y = center!.y + center!.height / 2;
  await frame.dispatchEvent("pointerdown", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y,
  });
  await frame.dispatchEvent("pointermove", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    clientX: x + 4,
    clientY: y + 120,
  });

  await expect(overlay).toHaveAttribute("data-dragging", "");
  await expect
    .poll(() =>
      overlay.evaluate((element) =>
        Number(element.style.getPropertyValue("--fluidbox-dismiss-progress")),
      ),
    )
    .toBeGreaterThan(0);

  await frame.dispatchEvent("pointerup", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    clientX: x + 4,
    clientY: y + 120,
  });
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="one"]')).toBeFocused();
});

test("plain runtime dismisses from a vertical trackpad wheel gesture", async ({ page }) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const overlay = page.locator("[data-fluidbox-overlay]");
  await expect(overlay).toHaveAttribute("data-fluidbox-status", "open");

  const frame = page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-frame]');
  const progress = await frame.evaluate(async (element) => {
    let maximum = 0;
    for (let index = 0; index < 3; index++) {
      element.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 40 }),
      );
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const overlay = document.querySelector<HTMLElement>("[data-fluidbox-overlay]")!;
      maximum = Math.max(
        maximum,
        Number(overlay.style.getPropertyValue("--fluidbox-dismiss-progress")),
      );
    }
    return maximum;
  });
  expect(progress).toBeGreaterThan(0);
  // A loaded browser can play the whole close before a poll sees it, and the
  // momentum tail only counts within a short quiet gap. Catch the closing as
  // it is published, hold it, and send the tail in the same turn.
  const closing = await frame.evaluate(
    (element) =>
      new Promise<{ state: string | undefined; tailPrevented: boolean }>((resolve) => {
        const overlay = document.querySelector<HTMLElement>("[data-fluidbox-overlay]")!;
        const observer = new MutationObserver(() => {
          if (overlay.dataset.fluidboxStatus !== "closing") return;
          observer.disconnect();
          document.getAnimations().forEach((animation) => animation.pause());
          const tail = new WheelEvent("wheel", { cancelable: true, deltaY: 20 });
          window.dispatchEvent(tail);
          resolve({ state: overlay.dataset.fluidboxStatus, tailPrevented: tail.defaultPrevented });
        });
        observer.observe(overlay, { attributeFilter: ["data-fluidbox-status"] });
        element.dispatchEvent(
          new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 160 }),
        );
      }),
  );
  expect(closing).toEqual({ state: "closing", tailPrevented: true });
  await page.waitForTimeout(130);
  const freshInputPrevented = await page.evaluate(() => {
    const event = new WheelEvent("wheel", { cancelable: true, deltaY: 20 });
    window.dispatchEvent(event);
    document.getAnimations().forEach((animation) => animation.play());
    return event.defaultPrevented;
  });
  expect(freshInputPrevented).toBe(false);
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="one"]')).toBeFocused();
});

test("plain runtime reuses pinch and double-click zoom interaction", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  const media = page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]');
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");

  await media.dblclick({ position: { x: 260, y: 260 } });
  const handoff = await media.evaluate(async (element) => {
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    let animation: Animation | undefined;
    for (let frame = 0; frame < 10 && !animation; frame += 1) {
      animation = element.getAnimations().find((candidate) => {
        const duration = Number(candidate.effect?.getComputedTiming().duration);
        return Number.isFinite(duration) && duration > 0;
      });
      if (!animation) await nextFrame();
    }
    if (!animation) return null;
    animation.pause();
    const duration = Number(animation.effect?.getComputedTiming().duration);
    animation.currentTime = Math.max(0, duration - 1);
    await nextFrame();
    const before = element.getBoundingClientRect();
    animation.finish();
    await Promise.resolve();
    await Promise.resolve();
    await nextFrame();
    const moved = document.querySelector<HTMLElement>(
      "[data-fluidbox-zoom-viewport] [data-fluidbox-media]",
    );
    const after = moved?.getBoundingClientRect();
    return {
      before: { x: before.x, y: before.y, width: before.width, height: before.height },
      after: after ? { x: after.x, y: after.y, width: after.width, height: after.height } : null,
    };
  });
  expect(handoff).not.toBeNull();
  expect(handoff?.after).not.toBeNull();
  for (const property of ["x", "y", "width", "height"] as const) {
    expect(Math.abs(handoff!.before[property] - handoff!.after![property])).toBeLessThan(3);
  }
  await expect(dialog).toHaveAttribute("data-zoomed", "");
  const zoomViewport = page.locator("[data-fluidbox-zoom-viewport]");
  await expect(zoomViewport).toHaveCount(1);
  const scale = await zoomViewport.locator("[data-fluidbox-media]").evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return new DOMMatrix(transform === "none" ? undefined : transform).a;
  });
  expect(scale).toBeGreaterThan(1.5);

  const zoomedMedia = zoomViewport.locator("[data-fluidbox-media]");
  const bounds = await zoomedMedia.boundingBox();
  expect(bounds).not.toBeNull();
  const x = bounds!.x + bounds!.width / 2;
  const y = bounds!.y + bounds!.height / 2;
  await zoomedMedia.dispatchEvent("pointerdown", {
    pointerId: 19,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y,
  });
  await zoomedMedia.dispatchEvent("pointermove", {
    pointerId: 19,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y + 140,
  });
  const wheelPrevented = await zoomedMedia.evaluate((element) => {
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 160 });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(wheelPrevented).toBe(false);
  await expect(dialog).not.toHaveAttribute("data-dragging", "");
  await expect(dialog).not.toHaveAttribute("data-dismissing", "");
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");

  await page.keyboard.press("0");
  await expect(dialog).not.toHaveAttribute("data-zoomed", "");
  await expect(page.locator("[data-fluidbox-zoom-viewport]")).toHaveCount(0);
  await expect(media).toBeVisible();

  await page.locator("[data-fluidbox-container]").evaluate((container) => {
    const gesture = (type: string, scale: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        scale: { value: scale },
        clientX: { value: innerWidth / 2 },
        clientY: { value: innerHeight / 2 },
      });
      container.dispatchEvent(event);
    };
    gesture("gesturestart", 1);
    gesture("gesturechange", 2);
    gesture("gestureend", 2);
  });
  await expect(dialog).toHaveAttribute("data-zoomed", "");
  await expect(page.locator("[data-fluidbox-zoom-viewport]")).toHaveCount(1);
  await page.keyboard.press("0");
  await expect(dialog).not.toHaveAttribute("data-zoomed", "");
});

test("plain runtime drives host and traveling thumbnail overlays through the painted motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/headless.html");
  await page.evaluate(() => {
    const host = document.createElement("span");
    host.dataset.testThumbnailOverlay = "";
    document.querySelector('[data-photo-id="one"]')!.append(host);
    window.headlessViewer.bindOverlay(host, "one", {
      frameLayer: host,
      travel({ target, item, signal }) {
        const badge = document.createElement("strong");
        badge.dataset.testTravelingOverlay = "";
        badge.textContent = `Traveling ${item.id}`;
        const actions = document.createElement("span");
        actions.dataset.fluidboxVideoActions = "";
        target.append(badge, actions);
        signal.addEventListener("abort", () => (host.dataset.rendererAborted = ""), {
          once: true,
        });
        return () => {
          host.dataset.rendererDisposed = "";
        };
      },
    });
  });

  const opening = await page.evaluate(async () => {
    // The opening starts a frame or two after the call, and a loaded WebKit
    // can stall longer than the whole motion. Hold every animation as it is
    // created so none finishes before it is measured.
    const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")!
      .value as Element["animate"];
    const held: Animation[] = [];
    Element.prototype.animate = function (this: Element, ...args) {
      const animation = animate.apply(this, args);
      animation.playbackRate = 1e-6;
      held.push(animation);
      return animation;
    };
    void window.headlessViewer.open("one");
    for (let frames = 0; frames < 240; frames += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (document.querySelector("[data-fluidbox-frame]")?.getAnimations().length) break;
    }
    Element.prototype.animate = animate;
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 120;
    }
    for (const animation of held) animation.playbackRate = 1;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const host = document.querySelector<HTMLElement>(
      "[data-test-thumbnail-overlay]:not([data-fluidbox-ghost])",
    )!;
    const travel = document.querySelector<HTMLElement>("[data-fluidbox-transition-content]")!;
    return {
      hostPhase: host.dataset.fluidboxPhase,
      hostProgress: Number(getComputedStyle(host).getPropertyValue("--fluidbox-closed")),
      travelPhase: travel.dataset.fluidboxPhase,
      travelProgress: Number(getComputedStyle(travel).getPropertyValue("--fluidbox-closed")),
      travelTransform: getComputedStyle(travel).transform,
      frameRect: document
        .querySelector<HTMLElement>("[data-fluidbox-frame]")!
        .getBoundingClientRect()
        .toJSON(),
      travelRect: travel.getBoundingClientRect().toJSON(),
      text: travel.textContent,
      layerInFrame: host.parentElement?.hasAttribute("data-fluidbox-frame"),
      controlsDelay: getComputedStyle(travel).getPropertyValue("--fluidbox-controls-reveal-delay"),
      hasControlsReveal: document
        .getAnimations()
        .some(
          (animation) =>
            (animation as CSSAnimation).animationName === "fluidbox-video-actions-reveal",
        ),
    };
  });
  expect(opening.hostPhase).toBe("opening");
  expect(opening.travelPhase).toBe("opening");
  expect(opening.hostProgress).toBeGreaterThan(0);
  expect(opening.hostProgress).toBeLessThan(1);
  expect(opening.travelProgress).toBeCloseTo(opening.hostProgress, 2);
  expect(opening.travelTransform).not.toBe("none");
  expect(opening.travelRect.x).toBeCloseTo(opening.frameRect.x, 0);
  expect(opening.travelRect.y).toBeCloseTo(opening.frameRect.y, 0);
  expect(opening.travelRect.width).toBeCloseTo(opening.frameRect.width, 0);
  expect(opening.travelRect.height).toBeCloseTo(opening.frameRect.height, 0);
  expect(opening.text).toBe("Traveling one");
  expect(opening.layerInFrame).toBe(true);
  expect(opening.controlsDelay).toMatch(/ms$/);
  expect(opening.hasControlsReveal).toBe(true);

  await page.evaluate(() =>
    document
      .getAnimations()
      .filter(
        (animation) =>
          (animation as CSSAnimation).animationName !== "fluidbox-video-actions-reveal",
      )
      .forEach((animation) => animation.finish()),
  );
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "opening",
  );
  await page.evaluate(() =>
    document
      .getAnimations()
      .find(
        (animation) =>
          (animation as CSSAnimation).animationName === "fluidbox-video-actions-reveal",
      )
      ?.finish(),
  );
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  await expect(page.locator("[data-test-thumbnail-overlay]")).toHaveAttribute(
    "data-fluidbox-phase",
    "open",
  );
  await expect(page.locator("[data-fluidbox-transition-content]")).toHaveCSS(
    "--fluidbox-closed",
    "0",
  );

  await page.evaluate(() => void window.headlessViewer.close());
  await page.locator("[data-fluidbox-flight]").waitFor();
  const closing = await page.evaluate(async () => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 120;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const frame = document.querySelector<HTMLElement>(
      "[data-fluidbox-flight] [data-fluidbox-frame]",
    )!;
    const travel = document.querySelector<HTMLElement>("[data-fluidbox-transition-content]")!;
    return {
      frameRect: frame.getBoundingClientRect().toJSON(),
      travelRect: travel.getBoundingClientRect().toJSON(),
      layerInFlight: frame.contains(document.querySelector("[data-test-thumbnail-overlay]")),
    };
  });
  expect(closing.layerInFlight).toBe(true);
  expect(closing.travelRect.x).toBeCloseTo(closing.frameRect.x, 0);
  expect(closing.travelRect.y).toBeCloseTo(closing.frameRect.y, 0);
  expect(closing.travelRect.width).toBeCloseTo(closing.frameRect.width, 0);
  expect(closing.travelRect.height).toBeCloseTo(closing.frameRect.height, 0);
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
  await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(0);
  await expect(page.locator("[data-fluidbox-transition-content]")).toHaveCount(0);
  const host = page.locator("[data-test-thumbnail-overlay]");
  await expect(host).toHaveAttribute("data-fluidbox-phase", "idle");
  await expect(host).toHaveCSS("--fluidbox-closed", "1");
  await expect(host).toHaveAttribute("data-renderer-aborted", "");
  await expect(host).toHaveAttribute("data-renderer-disposed", "");
  await expect(page.locator('[data-photo-id="one"] [data-test-thumbnail-overlay]')).toHaveCount(1);
});

test("an open overlay stays parked while another slide is selected", async ({ page }) => {
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    const host = document.createElement("span");
    host.dataset.testParkedLayer = "";
    document.querySelector('[data-photo-id="one"]')!.append(host);
    window.headlessViewer.bindOverlay(host, "one", {
      returns: ["two"],
      frameLayer: host,
      travel({ target }) {
        host.dataset.mounts = String(Number(host.dataset.mounts ?? 0) + 1);
        target.textContent = "Overlay";
      },
    });
    await window.headlessViewer.open("one");
    await window.headlessViewer.open("two");
  });
  const parked = await page.evaluate(() => {
    const layer = document.querySelector<HTMLElement>("[data-test-parked-layer]")!;
    return {
      slide: [...document.querySelectorAll("[data-fluidbox-slide]")].indexOf(
        layer.closest("[data-fluidbox-slide]")!,
      ),
      mounts: layer.dataset.mounts,
      selected: window.headlessViewer.state.value,
    };
  });
  expect(parked).toEqual({ slide: 0, mounts: "1", selected: "two" });
  await page.evaluate(() => window.headlessViewer.close());
  await expect(page.locator('[data-photo-id="one"] [data-test-parked-layer]')).toHaveCount(1);
});

test("native gallery scrolling is never corrected by the runtime", async ({ page }) => {
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setItems(
      Array.from({ length: 6 }, (_, index) => ({
        id: `slide-${index}`,
        type: "image" as const,
        src: "/photo-square.svg",
        alt: `Slide ${index}`,
        width: 800,
        height: 800,
      })),
    );
    await window.headlessViewer.open(0);
  });
  const offsets = await page
    .locator("[data-fluidbox-slides]")
    .evaluate(async (strip: HTMLElement) => {
      // Disable CSS snapping only to reveal any competing JS scroll correction.
      strip.style.scrollSnapType = "none";
      strip.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: 24 }));
      strip.scrollTo({ left: strip.clientWidth * 3 + 24, behavior: "instant" });
      await new Promise<void>((resolve) => setTimeout(resolve, 220));
      strip.dispatchEvent(new Event("scrollend"));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const whileOwned = strip.scrollLeft - strip.clientWidth * 3;
      strip.scrollTo({ left: strip.clientWidth * 3 + 35, behavior: "instant" });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return [whileOwned, strip.scrollLeft - strip.clientWidth * 3];
    });
  expect(offsets[0]).toBeCloseTo(24, 0);
  expect(offsets[1]).toBeCloseTo(35, 0);
});

test("plain runtime keeps a 100k source bounded without custom elements", async ({ page }) => {
  await page.goto("/headless.html");
  await page.evaluate(() => {
    const count = 100_000;
    void window.headlessViewer.setItems({
      count,
      get: (index) => ({
        id: `large-${index}`,
        type: "image",
        src: "/photo-square.svg",
        alt: `Large item ${index + 1}`,
        width: 800,
        height: 800,
      }),
      indexOf(id: string) {
        const index = Number(String(id).replace("large-", ""));
        return Number.isInteger(index) && index >= 0 && index < count ? index : -1;
      },
    });
    void window.headlessViewer.open(90_000);
  });

  const active = page.locator('[data-fluidbox-slide][aria-hidden="false"]');
  await expect(active).toHaveAttribute("aria-label", "Item 90001 of 100000");
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-status",
    "open",
  );
  expect(await page.locator("[data-fluidbox-slide]").count()).toBeLessThanOrEqual(31);
  expect(await page.locator("[data-fluidbox-media][src]").count()).toBeLessThanOrEqual(3);

  await page.keyboard.press("ArrowRight");
  await expect(active).toHaveAttribute("aria-label", "Item 90002 of 100000");
  expect(await page.locator("[data-fluidbox-slide]").count()).toBeLessThanOrEqual(31);
  expect(await page.locator("[data-fluidbox-media][src]").count()).toBeLessThanOrEqual(3);

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(0);
});

test("the filmstrip option docks thumbnails that navigate the viewer", async ({ page }) => {
  await page.goto("/headless.html");
  await page.evaluate(() => void window.headlessFilmstripViewer.open("one"));

  const dialog = page.locator("[data-fluidbox-dialog]");
  // The strip is viewer content: it mounts in the viewer's layer.
  await expect(
    dialog.locator("[data-fluidbox-addons] > [data-fluidbox-filmstrip-dock]"),
  ).toHaveCount(1);
  const items = page.locator("[data-fluidbox-filmstrip-item]");
  await expect(items.first()).toBeVisible();
  await expect(page.locator("[data-fluidbox-filmstrip]")).toHaveAttribute(
    "aria-label",
    "Gallery filmstrip",
  );

  await page.locator('[data-fluidbox-filmstrip-item][data-index="1"]').click();
  await expect.poll(() => page.evaluate(() => window.headlessFilmstripViewer.state.index)).toBe(1);

  await page.evaluate(() => void window.headlessFilmstripViewer.close());
  await expect(page.locator("[data-fluidbox-overlay]")).toHaveCount(0);
});

test("bindings follow setItems, by index and by an id that arrives later", async ({ page }) => {
  await page.goto("/headless.html");
  const errors = await page.evaluate(async () => {
    const item = (name: string) => ({
      type: "image" as const,
      src: `/art/${name}.svg`,
      alt: name,
      width: 1200,
      height: 800,
    });
    const viewer = window.headlessViewer;
    await viewer.setItems([item("dune"), item("canyon")]);
    const byIndex = document.body.appendChild(document.createElement("button"));
    const later = document.body.appendChild(document.createElement("button"));
    const badge = byIndex.appendChild(document.createElement("span"));
    viewer.bind(byIndex, 1);
    viewer.bindOverlay(badge, 1);
    viewer.bind(later, "/art/coast.svg");
    const thrown: string[] = [];
    try {
      await viewer.setItems([item("coast"), item("meadow"), item("alpine")]);
    } catch (error) {
      thrown.push(String(error));
    }
    return { thrown, count: viewer.state.count, items: viewer.items.count };
  });
  expect(errors).toEqual({ thrown: [], count: 3, items: 3 });
});

test("an aborted open changes the value back to null", async ({ page }) => {
  await page.goto("/headless.html");
  const events = await page.evaluate(async () => {
    const viewer = window.headlessViewer;
    const seen: string[] = [];
    viewer.addEventListener("valuechange", (event) => seen.push(event.action));
    const controller = new AbortController();
    const opening = viewer.open(0, { signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 30));
    controller.abort();
    const result = await opening;
    return { seen, result, status: viewer.state.status };
  });
  expect(events).toEqual({ seen: ["open", "close"], result: false, status: "closed" });
});

test("update changes labels, controls, zoom and the filmstrip while the viewer stays open", async ({
  page,
}) => {
  await page.goto("/headless.html");
  await page.evaluate(() => window.headlessSecondaryViewer.open("one"));
  const overlay = page.locator("[data-fluidbox-overlay]");
  const close = page.locator("[data-fluidbox-portal] [data-fluidbox-close]");
  await expect(overlay).toHaveAttribute("data-fluidbox-status", "open");
  await expect(close).toHaveAttribute("aria-label", "Close");

  await page.evaluate(() =>
    window.headlessSecondaryViewer.update({
      labels: { close: "Sulje", position: (index, count) => `Kuva ${index + 1}/${count}` },
    }),
  );
  await expect(close).toHaveAttribute("aria-label", "Sulje");
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    /^Kuva 1\//,
  );

  await page.evaluate(() => window.headlessSecondaryViewer.update({ controls: ["close"] }));
  await expect(page.locator("[data-fluidbox-portal] [data-fluidbox-next]")).toHaveCount(0);
  await expect(close).toHaveCount(1);

  await page.evaluate(() => window.headlessSecondaryViewer.update({ filmstrip: true }));
  await expect(page.locator("[data-fluidbox-filmstrip]")).toHaveCount(1);
  await page.locator("[data-fluidbox-filmstrip-item]").nth(1).click();
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    /^Kuva 2\//,
  );
  await page.evaluate(() => window.headlessSecondaryViewer.update({ filmstrip: undefined }));
  await expect(page.locator("[data-fluidbox-filmstrip]")).toHaveCount(0);

  // Turning zoom off zooms the photo back out, and the next double-click doesn't zoom.
  const media = page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-media]');
  const dialog = page.locator("[data-fluidbox-dialog]");
  await media.dblclick();
  await expect(dialog).toHaveAttribute("data-zoomed", "");
  await page.evaluate(() => window.headlessSecondaryViewer.update({ zoom: false }));
  await expect(dialog).not.toHaveAttribute("data-zoomed", "");
  await media.dblclick();
  await page.waitForTimeout(400);
  await expect(dialog).not.toHaveAttribute("data-zoomed", "");

  // Nothing above closed it or opened it again.
  expect(await page.evaluate(() => window.headlessSecondaryViewer.state.status)).toBe("open");
});

test("update adds a sheet to the open viewer, and takes it away again", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.loadSheet();
    const viewer = window.headlessSecondaryViewer;
    const events: string[] = [];
    viewer.addEventListener("sheetchange", (event) => events.push(`${event.stop}:${event.reason}`));
    Object.assign(window, { sheetEvents: events });
    await viewer.open("one");
    viewer.update({
      sheet: {
        snapPoints: ["50%", "90%"],
        render: ({ item, target }) => {
          const text = document.createElement("p");
          text.className = "sheet-text";
          text.textContent = item.id ?? "";
          target.append(text);
        },
      },
    });
  });
  const dialog = page.locator("[data-fluidbox-dialog]");
  const sheet = page.locator("section[data-fluidbox-sheet]");
  // Rendered for the item on show, with no item change to wait for.
  await expect(sheet.locator(".sheet-text")).toHaveText("one");

  await page.evaluate(() => window.headlessSecondaryViewer.sheet!.set(1));
  await expect(dialog).toHaveAttribute("data-sheet", "1");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveAttribute("data-sheet", "0");
  const events = () =>
    page.evaluate(() => (window as unknown as { sheetEvents: string[] }).sheetEvents);
  expect(await events()).toEqual(["1:api", "0:keyboard"]);

  // A raised sheet that goes announces its return to rest once.
  await page.evaluate(() => window.headlessSecondaryViewer.sheet!.set(1));
  await expect(dialog).toHaveAttribute("data-sheet", "1");
  await page.evaluate(() => window.headlessSecondaryViewer.update({ sheet: undefined }));
  await expect(sheet).toHaveCount(0);
  expect(await events()).toEqual(["1:api", "0:keyboard", "1:api", "0:api"]);
  await expect(dialog).not.toHaveAttribute("data-sheet");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    /2 of/,
  );
  expect(await page.evaluate(() => window.headlessSecondaryViewer.state.status)).toBe("open");
});

test("a pinch that lands on a drag starts from where the finger took the photo", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "pixel-7", "Multi-touch goes through Chromium's CDP.");
  await page.goto("/javascript/");
  await expect(page.locator("html")).toHaveAttribute("data-patterns-ready", "");
  await page.locator('[data-pattern="zoom"] [data-test="trigger"]').nth(2).click();
  const dialog = page.locator("[data-fluidbox-dialog]");
  const slide = page.locator('[data-fluidbox-slide][aria-hidden="false"]');
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  await expect(slide).toHaveAttribute("aria-label", "Item 3 of 4");
  const session = await page.context().newCDPSession(page);
  type Point = { x: number; y: number; id: number };
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", touchPoints: Point[]) =>
    session.send("Input.dispatchTouchEvent", { type, touchPoints });
  const media = slide.locator("[data-fluidbox-media]");
  const { width, height } = page.viewportSize()!;
  const x = width / 2;
  const y = height / 2;
  await touch("touchStart", [{ x, y, id: 1 }]);
  for (let step = 4; step <= 60; step += 4) await touch("touchMove", [{ x, y: y + step, id: 1 }]);
  await page.waitForTimeout(200);
  const dragged = (await media.boundingBox())!;
  await touch("touchStart", [
    { x, y: y + 60, id: 1 },
    { x: x + 60, y, id: 2 },
  ]);
  const caught = (await media.boundingBox())!;
  expect(Math.abs(caught.y - dragged.y), "the photo stays where the finger took it").toBeLessThan(
    1,
  );
  expect(Math.abs(caught.width - dragged.width)).toBeLessThan(1);
  for (let step = 1; step <= 10; step++) {
    await touch("touchMove", [
      { x: x - step * 6, y: y + 60 + step * 6, id: 1 },
      { x: x + 60 + step * 6, y: y - step * 6, id: 2 },
    ]);
  }
  await expect(dialog).toHaveAttribute("data-zoomed", "");
  await expect(slide).toHaveAttribute("aria-label", "Item 3 of 4");
  await touch("touchEnd", []);
  await expect(slide).toHaveAttribute("aria-label", "Item 3 of 4");
});
