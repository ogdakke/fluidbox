import { expect, test } from "@playwright/test";

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
  await page.locator('[data-lightbox-filmstrip-item][data-index="20"]').click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 21 of 30",
  );
});

test("opening frame is visually stable", async ({ page }, testInfo) => {
  test.skip(
    !["chromium", "firefox", "pixel-7"].includes(testInfo.project.name),
    "WebKit snapshots will be added after capture on the pinned CI runner.",
  );
  await page.goto("/harness.html");
  await page.locator("app-lightbox").first().click();
  await expect(page.locator("[data-lightbox-dialog]")).toBeVisible();
  await expect(page).toHaveScreenshot("opened-gallery.png", {
    animations: "disabled",
    caret: "hide",
  });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 2 of 3",
  );
  await expect(page).toHaveScreenshot("next-gallery.png", {
    animations: "disabled",
    caret: "hide",
  });
});
