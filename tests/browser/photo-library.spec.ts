import { expect, test, type Page } from "@playwright/test";

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
      element.click();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const frame = document.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
      )!;
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
      const bounds = frame.getBoundingClientRect();
      for (const animation of document.getAnimations()) animation.play();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    });
    await testInfo.attach("deep-origin-geometry", {
      body: JSON.stringify({ index, origin, start }, null, 2),
      contentType: "application/json",
    });
    for (const dimension of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(start[dimension] - origin![dimension])).toBeLessThan(5);
    }
    await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      `Item ${index + 1} of ${count}`,
    );
    await expect(page.locator("[data-lightbox-filmstrip]")).toHaveCount(1);
    await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
      "data-lightbox-state",
      "open",
    );
    await expect(page.locator("[data-lightbox-filmstrip]")).toHaveCSS("pointer-events", "auto");
    await expect(image).toHaveAttribute("data-lightbox-thumbnail-hidden", "");
    await expect(image).toHaveCSS("visibility", "hidden");

    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight - element.clientHeight;
    });
    await expect(page.locator(`[data-photo-index="${index}"]`)).toHaveCount(0);
    const farIndex = count - 200;
    await page.locator("[data-lightbox-filmstrip-scroll]").evaluate((element, selectedIndex) => {
      const size = parseFloat(
        getComputedStyle(element.parentElement!).getPropertyValue("--lightbox-filmstrip-item-size"),
      );
      const gap = parseFloat(getComputedStyle(element).columnGap);
      const padding = parseFloat(getComputedStyle(element).paddingLeft);
      element.scrollTo({
        left: padding + selectedIndex * (size + gap) + size / 2 - element.clientWidth / 2,
        behavior: "instant",
      });
    }, farIndex);
    const filmstripGeometry = await page
      .locator("[data-lightbox-filmstrip-scroll]")
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
      `[data-lightbox-filmstrip-item][data-index="${farIndex}"]`,
    );
    await expect(filmstripTarget).toBeVisible();
    await expect
      .poll(() =>
        filmstripTarget.evaluate((element) => {
          const scroller = element
            .closest("[data-lightbox-filmstrip-scroll]")!
            .getBoundingClientRect();
          const bounds = element.getBoundingClientRect();
          return bounds.left >= scroller.left && bounds.right <= scroller.right;
        }),
      )
      .toBe(true);
    await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      `Item ${farIndex + 1} of ${count}`,
    );
    await expect(scroll.locator(`[data-photo-index="${farIndex}"]`)).toHaveCount(1);
    const farThumbnail = scroll.locator(`[data-photo-index="${farIndex}"] img`);
    await expect(farThumbnail).toHaveAttribute("data-lightbox-thumbnail-hidden", "");
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
    await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      `Item ${farIndex + 2} of ${count}`,
    );
    await expect(farThumbnail).not.toHaveAttribute("data-lightbox-thumbnail-hidden", "");
    const selectedIndex = count - 250;
    await page.locator("[data-lightbox-filmstrip-scroll]").evaluate((element, index) => {
      const size = parseFloat(
        getComputedStyle(element.parentElement!).getPropertyValue("--lightbox-filmstrip-item-size"),
      );
      const gap = parseFloat(getComputedStyle(element).columnGap);
      const padding = parseFloat(getComputedStyle(element).paddingLeft);
      element.scrollTo({
        left: padding + index * (size + gap) + size / 2 - element.clientWidth / 2,
        behavior: "instant",
      });
    }, selectedIndex);
    await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      `Item ${selectedIndex + 1} of ${count}`,
    );
    const selectedTile = scroll.locator(`[data-photo-index="${selectedIndex}"]`);
    await expect(selectedTile).toHaveCount(1);
    await expect(selectedTile.locator("img")).toHaveAttribute("data-lightbox-thumbnail-hidden", "");
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
    expect(await page.locator("[data-lightbox-slide]").count()).toBeLessThan(40);
    expect(await page.locator("*").count()).toBeLessThan(600);
    const selectedBounds = await selectedTile.boundingBox();
    expect(selectedBounds).not.toBeNull();
    const closingEnd = await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      const frame =
        document.querySelector<HTMLElement>("[data-lightbox-flight] [data-lightbox-frame]") ??
        document.querySelector<HTMLElement>(
          '[data-lightbox-slide][aria-hidden="false"] [data-lightbox-frame]',
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
    await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
    await expect(selectedTile.locator("img")).not.toHaveAttribute(
      "data-lightbox-thumbnail-hidden",
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

    const beforeResize = await firstVisiblePhotoIndex(page);
    await page.setViewportSize({ width: 420, height: 760 });
    await expect
      .poll(() =>
        scroll
          .locator(".library-photo-grid")
          .first()
          .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length),
      )
      .toBe(2);
    await expect.poll(() => firstVisiblePhotoIndex(page)).toBeGreaterThanOrEqual(beforeResize - 6);
    expect(await firstVisiblePhotoIndex(page)).toBeLessThanOrEqual(beforeResize + 6);
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
  await expect(page.locator("[data-lightbox-filmstrip]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Show filmstrip on next open" }).check();
  await page.locator(`[data-photo-index="${initialRange}"]`).click();
  await expect(page.locator("[data-lightbox-filmstrip]")).toHaveCount(1);
  await expect(page.locator("[data-library-count]")).toHaveAttribute("data-library-count", "10000");
  expect(await page.locator("[data-photo-index]").count()).toBeLessThan(100);
});

test("filmstrip scrubbing reveals the host only after touch settlement", async ({ page }) => {
  await page.goto("/photo-library.html?count=10000");
  await page.locator('[data-photo-index="0"]').click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  const selectedIndex = 5_000;
  const filmstrip = page.locator("[data-lightbox-filmstrip-scroll]");
  const provisional = await filmstrip.evaluate(async (element, index) => {
    const start = new Event("touchstart", { bubbles: true });
    Object.defineProperty(start, "touches", { value: [] });
    element.dispatchEvent(start);
    const size = parseFloat(
      getComputedStyle(element.parentElement!).getPropertyValue("--lightbox-filmstrip-item-size"),
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
        .querySelector('[data-lightbox-slide][aria-hidden="false"]')
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

test("opening remains active until the delayed filmstrip reveal settles", async ({ page }) => {
  await page.goto("/photo-library.html");
  await page.locator("[data-photo-index]").first().click();
  const dialog = page.locator("[data-lightbox-dialog]");
  const filmstrip = page.locator("[data-lightbox-filmstrip]");
  const paused = await filmstrip.evaluate(async (element) => {
    for (let frame = 0; frame < 60; frame += 1) {
      const animation = element
        .getAnimations()
        .find(
          (candidate) => (candidate as CSSAnimation).animationName === "lightbox-filmstrip-appear",
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
  await expect(dialog).toHaveAttribute("data-lightbox-state", "opening");
  await filmstrip.evaluate((element) => {
    element
      .getAnimations()
      .find(
        (candidate) => (candidate as CSSAnimation).animationName === "lightbox-filmstrip-appear",
      )
      ?.finish();
  });
  await expect(dialog).toHaveAttribute("data-lightbox-state", "open");
});
