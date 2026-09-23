import { expect, test } from "@playwright/test";

test("plain runtime opens, navigates, composes controls, and closes without custom elements", async ({
  page,
}) => {
  await page.goto("/headless.html");

  await expect
    .poll(() => page.evaluate(() => customElements.get("app-lightbox") === undefined))
    .toBe(true);
  const first = page.locator('[data-photo-id="one"]');
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

  await page.locator("[data-demo-next]").click();
  await expect(page.locator("[data-demo-caption]")).toHaveText("two");
  await expect(activeMedia).toHaveAttribute("alt", "Orange portrait study");
  await expect(
    page.locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-picture] source'),
  ).toHaveCount(0);
  await expect(activeMedia).not.toHaveAttribute("srcset", /.+/);
  await expect(activeMedia).not.toHaveAttribute("sizes", /.+/);

  await page.locator("[data-demo-close]").click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-photo-id="two"]')).toBeFocused();
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
    element.scrollLeft = width * 0.62;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
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

test("plain runtime keeps the preview available while a failed full image is retried", async ({
  page,
}) => {
  let serveFullImage = false;
  await page.route("**/retry-full.svg", async (route) => {
    if (!serveFullImage) {
      await route.abort("failed");
      return;
    }
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

  serveFullImage = true;
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
  await expect(dialog).toHaveAttribute("data-zoomed", "");
  const zoomViewport = page.locator("[data-lightbox-zoom-viewport]");
  await expect(zoomViewport).toHaveCount(1);
  const scale = await zoomViewport.locator("[data-lightbox-media]").evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return new DOMMatrix(transform === "none" ? undefined : transform).a;
  });
  expect(scale).toBeGreaterThan(1.5);

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
          target.append(badge);
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
    };
  });
  expect(opening.hostPhase).toBe("opening");
  expect(opening.travelPhase).toBe("opening");
  expect(opening.hostProgress).toBeGreaterThan(0);
  expect(opening.hostProgress).toBeLessThan(1);
  expect(opening.travelProgress).toBeCloseTo(opening.hostProgress, 2);
  expect(opening.travelTransform).not.toBe("none");
  expect(opening.text).toBe("Traveling one");

  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
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
