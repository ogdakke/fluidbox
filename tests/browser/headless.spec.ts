import { expect, test } from "@playwright/test";

test("plain runtime opens, navigates, composes controls, and closes without custom elements", async ({
  page,
}) => {
  await page.goto("/headless.html");

  await expect
    .poll(() => page.evaluate(() => customElements.get("app-lightbox") === undefined))
    .toBe(true);
  const first = page.locator('[data-photo-id="one"]');
  await first.evaluate((trigger) => {
    trigger.style.setProperty("--lightbox-backdrop-background", "rgb(12 34 56)");
    trigger.style.setProperty("--accent", "rgb(78 90 123)");
  });
  await first.click();

  const overlay = page.locator("[data-lightbox-overlay]");
  const activeMedia = page.locator(
    '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]',
  );
  await expect(overlay).toHaveAttribute("data-lightbox-state", "open");
  await expect(activeMedia).toHaveAttribute("alt", "Blue square study");
  await expect(
    page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-picture] source'),
  ).toHaveCount(1);
  await expect(activeMedia).toHaveAttribute(
    "srcset",
    "/photo-square.svg 400w, /photo-square.svg 800w",
  );
  await expect(activeMedia).toHaveAttribute("sizes", "min(100vw, 800px)");
  await expect(page.locator("[data-demo-caption]")).toHaveText("one");
  await expect(page.locator("[data-lightbox-backdrop]")).toHaveCSS(
    "background-color",
    "rgb(12, 34, 56)",
  );
  await expect(overlay).toHaveCSS("--accent", "rgb(78 90 123)");
  await expect(first).toHaveAttribute("aria-haspopup", "dialog");
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(first).toHaveAttribute("data-lightbox-state", "open");

  await page.locator("[data-demo-next]").click();
  await expect(page.locator("[data-demo-caption]")).toHaveText("two");
  await expect(activeMedia).toHaveAttribute("alt", "Orange portrait study");
  await expect(
    page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-picture] source'),
  ).toHaveCount(0);
  await expect(activeMedia).not.toHaveAttribute("srcset", /.+/);
  await expect(activeMedia).not.toHaveAttribute("sizes", /.+/);
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('[data-photo-id="two"]')).toHaveAttribute("aria-expanded", "true");

  await page.locator("[data-demo-close]").click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="two"]')).toBeFocused();
  await expect(page.locator('[data-photo-id="two"]')).toHaveAttribute("aria-expanded", "false");
});

test("plain runtime contains focus and applies the established gallery keyboard policy", async ({
  page,
}) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const overlay = page.locator("[data-lightbox-overlay]");
  await expect(overlay).toHaveAttribute("data-lightbox-state", "open");
  await expect(page.locator("[data-lightbox-dialog]")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.locator("[data-demo-next]")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("[data-demo-close]")).toBeFocused();

  await page.locator("h1").evaluate((heading) => {
    heading.closest("main")!.removeAttribute("inert");
    heading.setAttribute("tabindex", "-1");
    (heading as HTMLElement).focus();
  });
  await expect(page.locator("[data-lightbox-dialog]")).toBeFocused();

  await page.keyboard.press("PageDown");
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="one"]')).toBeFocused();
});

test("plain runtime returns focus to a virtualized origin host", async ({ page }) => {
  await page.goto("/headless.html");
  const gallery = page.locator(".headless-grid");
  await gallery.evaluate((element) => element.setAttribute("tabindex", "0"));
  await page.locator('[data-photo-id="one"]').click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  await page.locator('[data-photo-id="one"]').evaluate((element) => element.remove());
  await page.evaluate(() => void window.headlessViewer.close());

  await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(0);
  await expect(gallery).toBeFocused();
});

test("plain controllers hand body-level ownership to the newest viewer", async ({ page }) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  await page.evaluate(() => void window.headlessSecondaryViewer.open({ id: "two" }));
  await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(1);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await expect(
    page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]'),
  ).toHaveAttribute("alt", "Orange portrait study");
  const states = await page.evaluate(() => ({
    first: window.headlessViewer.state.status,
    second: window.headlessSecondaryViewer.state.status,
  }));
  expect(states).toEqual({ first: "closed", second: "open" });
  await page.evaluate(() => void window.headlessSecondaryViewer.close());
  await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(0);
});

test("active viewer ownership honors a prevented close", async ({ page }) => {
  await page.goto("/headless.html");
  await page.evaluate(() => void window.headlessProtectedViewer.open({ id: "one" }));
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  const result = await page.evaluate(() => window.headlessSecondaryViewer.open({ id: "two" }));

  expect(result).toEqual({ status: "prevented" });
  await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(1);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await expect(
    page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]'),
  ).toHaveAttribute("alt", "Blue square study");
  const states = await page.evaluate(() => ({
    protected: window.headlessProtectedViewer.state.status,
    secondary: window.headlessSecondaryViewer.state.status,
  }));
  expect(states).toEqual({ protected: "open", secondary: "closed" });
  await page.evaluate(() => window.headlessProtectedViewer.destroy());
  await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(0);
});

test("plain runtime owns video and iframe media while custom renderers own descendants", async ({
  page,
}) => {
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setSource({
      count: 3,
      getItem(index) {
        return (
          [
            {
              id: "custom",
              media: {
                type: "custom",
                renderer: "demo",
                title: "Custom study",
                width: 800,
                height: 600,
              },
            },
            {
              id: "video",
              media: {
                type: "video",
                src: "data:video/mp4;base64,",
                title: "Video study",
                width: 800,
                height: 450,
              },
            },
            {
              id: "iframe",
              media: {
                type: "iframe",
                src: "about:blank",
                title: "Iframe study",
                width: 800,
                height: 600,
                sandbox: "allow-scripts",
              },
            },
          ] as const
        )[index]!;
      },
      getIndex(id) {
        const ids = ["custom", "video", "iframe"];
        const index = ids.indexOf(id);
        return index < 0 ? null : index;
      },
    });
    void window.headlessViewer.open({ id: "custom" });
  });
  const dialog = page.locator("[data-lightbox-dialog]");
  await expect(dialog).toHaveAttribute("data-lightbox-state", "open");
  await expect(page.locator("[data-test-custom-media]")).toHaveText("Custom custom");

  await page.keyboard.press("ArrowRight");
  await expect(
    page.locator('[data-lightbox-slide][aria-hidden="false"] video[data-lightbox-media]'),
  ).toHaveAttribute("aria-label", "Video study");
  await page.keyboard.press("ArrowRight");
  await expect(
    page.locator('[data-lightbox-slide][aria-hidden="false"] iframe[data-lightbox-media]'),
  ).toHaveAttribute("title", "Iframe study");
  await expect(page.locator("body")).toHaveAttribute("data-custom-mounts", "1");
  await expect(page.locator("body")).toHaveAttribute("data-custom-aborts", "1");
  await expect(page.locator("body")).toHaveAttribute("data-custom-disposals", "1");

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(0);
});

test("destroy unloads mounted custom media before removing the viewer", async ({ page }) => {
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setSource({
      count: 1,
      getItem() {
        return {
          id: "one",
          media: {
            type: "custom",
            renderer: "demo",
            title: "Custom study",
            width: 800,
            height: 600,
          },
        };
      },
      getIndex(id) {
        return id === "one" ? 0 : null;
      },
    });
    await window.headlessViewer.open({ id: "one" });
    window.headlessViewer.destroy();
  });

  await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(0);
  await expect(page.locator("body")).toHaveAttribute("data-custom-mounts", "1");
  await expect(page.locator("body")).toHaveAttribute("data-custom-aborts", "1");
  await expect(page.locator("body")).toHaveAttribute("data-custom-disposals", "1");
});

test("custom media uses the document close flight and returns to its retained slide", async ({
  page,
}) => {
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setSource({
      count: 1,
      getItem() {
        return {
          id: "one",
          media: {
            type: "custom",
            renderer: "demo",
            title: "Custom study",
            width: 800,
            height: 600,
          },
        };
      },
      getIndex(id) {
        return id === "one" ? 0 : null;
      },
    });
    await window.headlessViewer.open({ id: "one" });
    void window.headlessViewer.close();
  });

  await expect(page.locator("[data-lightbox-flight] [data-test-custom-media]")).toHaveText(
    "Custom one",
  );
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
  await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(0);

  await page.evaluate(() => void window.headlessViewer.open({ id: "one" }));
  await expect(
    page.locator('[data-lightbox-slide][aria-hidden="false"] [data-test-custom-media]'),
  ).toHaveText("Custom one");
  await expect(page.locator("body")).toHaveAttribute("data-custom-mounts", "1");
  await page.evaluate(() => window.headlessViewer.destroy());
});

test("plain runtime does not take native horizontal swipe ownership", async ({ page }) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  await expect(page.locator("[data-lightbox-overlay]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );

  const sample = await page.locator("[data-lightbox-slides]").evaluate(async (scroller) => {
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
        .querySelector('[data-lightbox-slide][aria-hidden="false"]')
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
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await page.locator("[data-demo-next]").click();
  const second = page.locator('[data-photo-id="two"]');
  await expect(second).toHaveAttribute("data-test-revealed", "");
  await expect(second.locator("img")).toHaveAttribute("data-lightbox-thumbnail-hidden", "");
});

test("plain runtime keeps the preview painted until the full image can replace it", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setSource({
      count: 1,
      getItem() {
        return {
          id: "preview-test",
          preview: { src: "/photo-portrait.svg", width: 240, height: 360 },
          media: {
            type: "image",
            src: "/photo-square.svg",
            alt: "Preview handoff",
            width: 800,
            height: 800,
          },
        };
      },
      getIndex(id) {
        return id === "preview-test" ? 0 : null;
      },
    });
    void window.headlessViewer.open({ id: "preview-test" });
  });
  const dialog = page.locator("[data-lightbox-dialog]");
  await expect(dialog).toHaveAttribute("data-lightbox-state", "opening");
  const media = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]');
  await expect(media).toHaveAttribute("src", "/photo-portrait.svg");
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
  await expect(dialog).toHaveAttribute("data-lightbox-state", "open");
  await expect(media).toHaveAttribute("src", "/photo-square.svg");
});

test("plain runtime retains the last decoded origin when its next source is pending", async ({
  page,
}) => {
  let fullRequests = 0;
  await page.route("**/pending-origin.svg", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await route.abort();
  });
  await page.route("**/deferred-full.svg", async (route) => {
    fullRequests += 1;
    await route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="green"/></svg>',
    });
  });
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setSource({
      count: 1,
      getItem() {
        return {
          id: "one",
          media: {
            type: "image",
            src: "/deferred-full.svg",
            alt: "Deferred full image",
            width: 800,
            height: 800,
          },
        };
      },
      getIndex(id) {
        return id === "one" ? 0 : null;
      },
    });
    const trigger = document.querySelector<HTMLElement>('[data-photo-id="one"]')!;
    const thumbnail = trigger.querySelector<HTMLImageElement>("img")!;
    await thumbnail.decode();
    window.headlessViewer.registerOrigin("one", { trigger, visual: thumbnail, thumbnail });
    thumbnail.src = "/pending-origin.svg";
    void window.headlessViewer.open({ id: "one" });
  });

  const activeMedia = page.locator(
    '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]',
  );
  await expect(activeMedia).toHaveAttribute("src", /photo-square\.svg/);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "opening",
  );
  expect(fullRequests).toBe(0);
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await expect.poll(() => fullRequests).toBe(1);
  await expect(activeMedia).toHaveAttribute("src", "/deferred-full.svg");
});

test("plain runtime keeps the preview available while a failed full image is retried", async ({
  page,
}) => {
  const fullImageRoute = "**/retry-full.svg";
  await page.route(fullImageRoute, (route) => route.abort("failed"));
  const serveFullImage = (route: import("@playwright/test").Route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="green"/></svg>',
    });
  await page.goto("/headless.html");
  await page.evaluate(async () => {
    await window.headlessViewer.setSource({
      count: 1,
      getItem() {
        return {
          id: "retry-test",
          preview: { src: "/photo-portrait.svg", width: 240, height: 360 },
          media: {
            type: "image",
            src: "/retry-full.svg",
            alt: "Retry handoff",
            width: 800,
            height: 800,
          },
        };
      },
      getIndex(id) {
        return id === "retry-test" ? 0 : null;
      },
    });
    void window.headlessViewer.open({ id: "retry-test" });
  });

  const slide = page.locator('[data-lightbox-slide][aria-hidden="false"]');
  const media = slide.locator("[data-lightbox-media]");
  const error = slide.locator("[data-lightbox-error]");
  await expect(error).toBeVisible();
  await expect(media).toHaveAttribute("src", "/photo-portrait.svg");

  await page.unroute(fullImageRoute);
  await page.route(fullImageRoute, serveFullImage);
  await error.getByRole("button", { name: "Retry" }).focus();
  await page.keyboard.press("Enter");
  await expect(error).toBeHidden();
  await expect(media).toHaveAttribute("src", "/retry-full.svg");
});

test("plain runtime settles immediately when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const dialog = page.locator("[data-lightbox-dialog]");
  await expect(dialog).toHaveAttribute("data-lightbox-state", "open");
  const frame = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]');
  expect(await frame.evaluate((element) => element.getAnimations().length)).toBe(0);

  const behavior = await page.locator("[data-lightbox-slides]").evaluate((slides) => {
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
  await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(0);
  await expect(page.locator('[data-photo-id="two"]')).toBeFocused();
});

test("plain runtime keeps session height stable through mobile browser chrome changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const overlay = page.locator("[data-lightbox-overlay]");
  await expect(overlay).toHaveAttribute("data-lightbox-state", "open");
  await expect(overlay).toHaveCSS("--lightbox-height", "700px");

  await page.setViewportSize({ width: 1000, height: 620 });
  await expect(overlay).toHaveCSS("--lightbox-height", "700px");

  await page.setViewportSize({ width: 820, height: 620 });
  await expect(overlay).toHaveCSS("--lightbox-height", "620px");
  await expect(overlay).toHaveAttribute("data-lightbox-state", "open");
});

test("plain runtime preserves the painted frame when open and close reverse", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/headless.html");

  const samples = await page.evaluate(async () => {
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const bounds = () => {
      const frame =
        document.querySelector<HTMLElement>("[data-lightbox-flight] [data-lightbox-frame]") ??
        document.querySelector<HTMLElement>(
          '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
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

    void window.headlessViewer.open({ id: "one" });
    await nextFrame();
    setMotionTime(120);
    const openingBefore = bounds();
    void window.headlessViewer.close();
    const openingAfter = bounds();

    await nextFrame();
    setMotionTime(90);
    await nextFrame();
    const closingBefore = bounds();
    void window.headlessViewer.open({ id: "one" });
    await Promise.resolve();
    await Promise.resolve();
    const closingAfter = bounds();
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
  await expect(page.locator("[data-lightbox-overlay]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
});

test("plain runtime publishes drag state and dismisses from a touch pointer", async ({ page }) => {
  await page.goto("/headless.html");
  await page.locator('[data-photo-id="one"]').click();
  const overlay = page.locator("[data-lightbox-overlay]");
  await expect(overlay).toHaveAttribute("data-lightbox-state", "open");

  const frame = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]');
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
        Number(element.style.getPropertyValue("--lightbox-dismiss-progress")),
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
  const overlay = page.locator("[data-lightbox-overlay]");
  await expect(overlay).toHaveAttribute("data-lightbox-state", "open");

  const frame = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]');
  const progress = await frame.evaluate(async (element) => {
    let maximum = 0;
    for (let index = 0; index < 3; index++) {
      element.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 40 }),
      );
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const overlay = document.querySelector<HTMLElement>("[data-lightbox-overlay]")!;
      maximum = Math.max(
        maximum,
        Number(overlay.style.getPropertyValue("--lightbox-dismiss-progress")),
      );
    }
    return maximum;
  });
  expect(progress).toBeGreaterThan(0);
  await frame.dispatchEvent("wheel", {
    deltaX: 0,
    deltaY: 160,
    deltaMode: 0,
  });
  await expect(overlay).toHaveAttribute("data-lightbox-state", "closing");
  const tailPrevented = await page.evaluate(() => {
    document.getAnimations().forEach((animation) => animation.pause());
    const event = new WheelEvent("wheel", { cancelable: true, deltaY: 20 });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(tailPrevented).toBe(true);
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
  const dialog = page.locator("[data-lightbox-dialog]");
  const media = page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]');
  await expect(dialog).toHaveAttribute("data-lightbox-state", "open");

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
      "[data-lightbox-zoom-viewport] [data-lightbox-media]",
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
  const zoomViewport = page.locator("[data-lightbox-zoom-viewport]");
  await expect(zoomViewport).toHaveCount(1);
  const scale = await zoomViewport.locator("[data-lightbox-media]").evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return new DOMMatrix(transform === "none" ? undefined : transform).a;
  });
  expect(scale).toBeGreaterThan(1.5);

  const zoomedMedia = zoomViewport.locator("[data-lightbox-media]");
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
  await expect(dialog).toHaveAttribute("data-lightbox-state", "open");

  await page.keyboard.press("0");
  await expect(dialog).not.toHaveAttribute("data-zoomed", "");
  await expect(page.locator("[data-lightbox-zoom-viewport]")).toHaveCount(0);
  await expect(media).toBeVisible();

  await page.locator("[data-lightbox-container]").evaluate((container) => {
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
  await expect(page.locator("[data-lightbox-zoom-viewport]")).toHaveCount(1);
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
    window.headlessViewer.registerThumbnailOverlay("one", {
      behavior: "travel",
      element: host,
      renderer: {
        mount({ target, item, signal }) {
          const badge = document.createElement("strong");
          badge.dataset.testTravelingOverlay = "";
          badge.textContent = `Traveling ${item.id}`;
          const actions = document.createElement("span");
          actions.dataset.lightboxVideoActions = "";
          target.append(badge, actions);
          signal.addEventListener("abort", () => (host.dataset.rendererAborted = ""), {
            once: true,
          });
          return () => (host.dataset.rendererDisposed = "");
        },
      },
    });
  });

  const opening = await page.evaluate(async () => {
    void window.headlessViewer.open({ id: "one" });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 120;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const host = document.querySelector<HTMLElement>("[data-test-thumbnail-overlay]")!;
    const travel = document.querySelector<HTMLElement>("[data-lightbox-transition-content]")!;
    return {
      hostPhase: host.dataset.lightboxPhase,
      hostProgress: Number(getComputedStyle(host).getPropertyValue("--lightbox-progress")),
      travelPhase: travel.dataset.lightboxPhase,
      travelProgress: Number(getComputedStyle(travel).getPropertyValue("--lightbox-progress")),
      travelTransform: getComputedStyle(travel).transform,
      text: travel.textContent,
      controlsDelay: getComputedStyle(travel).getPropertyValue("--lightbox-controls-reveal-delay"),
      hasControlsReveal: document
        .getAnimations()
        .some(
          (animation) =>
            (animation as CSSAnimation).animationName === "lightbox-video-actions-reveal",
        ),
    };
  });
  expect(opening.hostPhase).toBe("opening");
  expect(opening.travelPhase).toBe("opening");
  expect(opening.hostProgress).toBeGreaterThan(0);
  expect(opening.hostProgress).toBeLessThan(1);
  expect(opening.travelProgress).toBeCloseTo(opening.hostProgress, 2);
  expect(opening.travelTransform).not.toBe("none");
  expect(opening.text).toBe("Traveling one");
  expect(opening.controlsDelay).toMatch(/ms$/);
  expect(opening.hasControlsReveal).toBe(true);

  await page.evaluate(() =>
    document
      .getAnimations()
      .filter(
        (animation) =>
          (animation as CSSAnimation).animationName !== "lightbox-video-actions-reveal",
      )
      .forEach((animation) => animation.finish()),
  );
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "opening",
  );
  await page.evaluate(() =>
    document
      .getAnimations()
      .find(
        (animation) =>
          (animation as CSSAnimation).animationName === "lightbox-video-actions-reveal",
      )
      ?.finish(),
  );
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await expect(page.locator("[data-test-thumbnail-overlay]")).toHaveAttribute(
    "data-lightbox-phase",
    "open",
  );
  await expect(page.locator("[data-lightbox-transition-content]")).toHaveCSS(
    "--lightbox-progress",
    "0",
  );

  await page.evaluate(() => void window.headlessViewer.close());
  await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(0);
  await expect(page.locator("[data-lightbox-transition-content]")).toHaveCount(0);
  const host = page.locator("[data-test-thumbnail-overlay]");
  await expect(host).toHaveAttribute("data-lightbox-phase", "preview");
  await expect(host).toHaveCSS("--lightbox-progress", "1");
  await expect(host).toHaveAttribute("data-renderer-aborted", "");
  await expect(host).toHaveAttribute("data-renderer-disposed", "");
});

test("plain runtime keeps a 100k source bounded without custom elements", async ({ page }) => {
  await page.goto("/headless.html");
  await page.evaluate(() => {
    const count = 100_000;
    void window.headlessViewer.setSource({
      count,
      getItem(index) {
        return {
          id: `large-${index}`,
          media: {
            type: "image",
            src: "/photo-square.svg",
            alt: `Large item ${index + 1}`,
            width: 800,
            height: 800,
          },
        };
      },
      getIndex(id) {
        const index = Number(String(id).replace("large-", ""));
        return Number.isInteger(index) && index >= 0 && index < count ? index : null;
      },
    });
    void window.headlessViewer.open({ index: 90_000 });
  });

  const active = page.locator('[data-lightbox-slide][aria-hidden="false"]');
  await expect(active).toHaveAttribute("aria-label", "Item 90001 of 100000");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  expect(await page.locator("[data-lightbox-slide]").count()).toBeLessThanOrEqual(31);
  expect(await page.locator("[data-lightbox-media][src]").count()).toBeLessThanOrEqual(3);

  await page.keyboard.press("ArrowRight");
  await expect(active).toHaveAttribute("aria-label", "Item 90002 of 100000");
  expect(await page.locator("[data-lightbox-slide]").count()).toBeLessThanOrEqual(31);
  expect(await page.locator("[data-lightbox-media][src]").count()).toBeLessThanOrEqual(3);

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-overlay]")).toHaveCount(0);
});
