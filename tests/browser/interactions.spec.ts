import { expect, test } from "@playwright/test";

test("playground opens both the DOM gallery and indexed source", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Open, swipe, zoom, explore." })).toBeVisible();
  await page.locator(".photo-grid app-lightbox").first().click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 1 of 2",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  await expect(page.locator("#virtual-gallery .virtual-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
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
      ? page.locator("#fixture").locator("app-gallery")
      : page.locator("app-gallery");
    await gallery.locator("app-lightbox").first().click();
    const dialog = page.locator("[data-lightbox-dialog]");
    await expect(dialog).toBeVisible();
    await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      "Item 1 of 3",
    );
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      "Item 2 of 3",
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}

test("filmstrip selects a distant item", async ({ page }) => {
  await page.goto("/harness.html?count=30");
  await page.locator("app-lightbox").first().click();
  await expect(page.locator("[data-lightbox-filmstrip]")).toHaveCSS("pointer-events", "auto");
  await page.locator("[data-lightbox-filmstrip-scroll]").evaluate((scroller: HTMLElement) => {
    const size = parseFloat(
      getComputedStyle(scroller.parentElement!).getPropertyValue("--lightbox-filmstrip-item-size"),
    );
    const gap = parseFloat(getComputedStyle(scroller).columnGap);
    scroller.scrollTo({ left: 20 * (size + gap), behavior: "instant" });
  });
  await page.locator('[data-lightbox-filmstrip-item][data-index="20"]').click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 21 of 30",
  );
});

test("opening frame is visually stable", async ({ page }) => {
  await page.goto("/harness.html");
  await page.locator("app-lightbox").first().click();
  await expect(page.locator("[data-lightbox-dialog]")).toBeVisible();
  await expect(page).toHaveScreenshot("opened-gallery.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixels: 16,
  });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 2 of 3",
  );
  await expect(page).toHaveScreenshot("next-gallery.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixels: 16,
  });
});

test("filmstrip DOM stays bounded while scrolling a large gallery", async ({ page }) => {
  await page.goto("/harness.html?count=1000");
  await page.locator("app-lightbox").first().click();
  await expect(page.locator("[data-lightbox-filmstrip]")).toHaveCSS("pointer-events", "auto");
  const buttons = page.locator("[data-lightbox-filmstrip-item]");
  expect(await buttons.count()).toBeLessThan(100);
  expect(await page.locator("[data-lightbox-slide]").count()).toBeLessThan(40);
  await page.locator("[data-lightbox-filmstrip-scroll]").evaluate((scroller: HTMLElement) => {
    const size = parseFloat(
      getComputedStyle(scroller.parentElement!).getPropertyValue("--lightbox-filmstrip-item-size"),
    );
    const gap = parseFloat(getComputedStyle(scroller).columnGap);
    scroller.scrollTo({ left: 900 * (size + gap), behavior: "instant" });
  });
  const target = page.locator('[data-lightbox-filmstrip-item][data-index="900"]');
  await expect(target).toBeVisible();
  await target.click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 901 of 1000",
  );
  expect(await buttons.count()).toBeLessThan(100);
  expect(await page.locator("[data-lightbox-slide]").count()).toBeLessThan(40);
});

test("indexed source survives host thumbnail recycling", async ({ page }) => {
  await page.goto("/harness.html?virtual&count=10000");
  await expect(page.locator("[data-virtual-index]")).toHaveCount(12);
  expect(await page.locator("*").count()).toBeLessThan(100);
  await page.locator('[data-virtual-index="0"]').click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 1 of 10000",
  );
  await page.evaluate(() => {
    (window as unknown as { __renderVirtualWindow: (start: number) => void }).__renderVirtualWindow(
      500,
    );
  });
  await page
    .locator("app-gallery")
    .evaluate((gallery: HTMLElement & { open(index: number): void }) => gallery.open(501));
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 502 of 10000",
  );
  await page
    .locator("app-gallery")
    .evaluate((gallery: HTMLElement & { open(index: number): void }) => gallery.open(9000));
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 9001 of 10000",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 9002 of 10000",
  );
  expect(await page.locator("[data-lightbox-slide]").count()).toBeLessThan(40);
  expect(await page.locator("[data-lightbox-filmstrip-item]").count()).toBeLessThan(100);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  await expect(page.locator("app-gallery")).toBeFocused();
});

test("100k indexed items retain a bounded viewer DOM", async ({ page }) => {
  await page.goto("/harness.html?virtual&count=100000");
  await page
    .locator("app-gallery")
    .evaluate((gallery: HTMLElement & { open(index: number): void }) => gallery.open(99990));
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 99991 of 100000",
  );
  expect(await page.locator("[data-lightbox-slide]").count()).toBeLessThan(40);
  expect(await page.locator("[data-lightbox-filmstrip-item]").count()).toBeLessThan(100);
  expect(await page.locator("*").count()).toBeLessThan(600);
});

test("iframe content survives slide window eviction", async ({ page }) => {
  await page.goto("/harness.html?count=40&iframe");
  await page.locator("app-lightbox").first().click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 2 of 40",
  );
  const frame = page.frameLocator('[data-lightbox-slide][aria-hidden="false"] iframe');
  await expect(frame.getByRole("button", { name: "Inside iframe" })).toBeVisible();
  await page.locator("[data-lightbox-filmstrip-scroll]").evaluate((scroller: HTMLElement) => {
    const size = parseFloat(
      getComputedStyle(scroller.parentElement!).getPropertyValue("--lightbox-filmstrip-item-size"),
    );
    const gap = parseFloat(getComputedStyle(scroller).columnGap);
    scroller.scrollTo({ left: 35 * (size + gap), behavior: "instant" });
  });
  await expect(page.locator("[data-lightbox-filmstrip]")).toHaveCSS("pointer-events", "auto");
  await page.locator('[data-lightbox-filmstrip-item][data-index="35"]').click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 36 of 40",
  );
  await expect(
    page.locator('app-lightbox[data-test-index="1"] [slot="content"] iframe'),
  ).toHaveCount(1);
});

test("custom iframe media mounts only near the active slide", async ({ page }) => {
  await page.goto("/harness.html?count=100&iframes");
  await page.locator("app-lightbox").first().click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"] iframe')).toHaveCount(1);
  await expect.poll(() => page.locator("[data-lightbox-slide] iframe").count()).toBeLessThan(4);
  await expect(page.locator("[data-lightbox-filmstrip]")).toHaveCSS("pointer-events", "auto");
  await page.locator("[data-lightbox-filmstrip-scroll]").evaluate((scroller: HTMLElement) => {
    const size = parseFloat(
      getComputedStyle(scroller.parentElement!).getPropertyValue("--lightbox-filmstrip-item-size"),
    );
    const gap = parseFloat(getComputedStyle(scroller).columnGap);
    scroller.scrollTo({ left: 80 * (size + gap), behavior: "instant" });
  });
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 81 of 100",
  );
  expect(await page.locator("[data-lightbox-slide] iframe").count()).toBeLessThan(4);
});

test("indexed source works inside a shadow root", async ({ page }) => {
  await page.goto("/harness.html?virtual&shadow&count=10000");
  const gallery = page.locator("#fixture").locator("app-gallery");
  await gallery.locator('[data-virtual-index="0"]').click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 1 of 10000",
  );
  await gallery.evaluate((element: HTMLElement & { open(index: number): void }) =>
    element.open(5000),
  );
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 5001 of 10000",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
});

test("filmstrip keeps focus on a retained item while its window moves", async ({ page }) => {
  await page.goto("/harness.html?count=1000");
  await page.locator("app-lightbox").first().click();
  await expect(page.locator("[data-lightbox-filmstrip]")).toHaveCSS("pointer-events", "auto");
  const scroller = page.locator("[data-lightbox-filmstrip-scroll]");
  const scrollToIndex = (index: number) =>
    scroller.evaluate((element: HTMLElement, target: number) => {
      const size = parseFloat(
        getComputedStyle(element.parentElement!).getPropertyValue("--lightbox-filmstrip-item-size"),
      );
      const gap = parseFloat(getComputedStyle(element).columnGap);
      element.scrollTo({ left: target * (size + gap), behavior: "instant" });
    }, index);
  await scrollToIndex(10);
  const retained = page.locator('[data-lightbox-filmstrip-item][data-index="10"]');
  await expect(retained).toBeVisible();
  await retained.focus();
  await scrollToIndex(20);
  await expect(retained).toBeFocused();
});

test("native slide window rebases through sequential navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/harness.html?count=100");
  await page.locator("app-lightbox").first().click();
  for (let index = 1; index <= 45; index++) {
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      `Item ${index + 1} of 100`,
    );
  }
  expect(await page.locator("[data-lightbox-slide]").count()).toBeLessThan(40);
});

test("animated navigation crosses the slide window boundary", async ({ page, browserName }) => {
  test.skip(
    browserName !== "chromium",
    "Motion boundary is sampled on Chromium; instant navigation runs on all engines.",
  );
  test.setTimeout(60_000);
  await page.goto("/harness.html?count=70");
  await page.locator("app-lightbox").first().click();
  for (let index = 1; index <= 35; index++) {
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      `Item ${index + 1} of 70`,
    );
  }
  expect(await page.locator("[data-lightbox-slide]").count()).toBeLessThan(40);
});
