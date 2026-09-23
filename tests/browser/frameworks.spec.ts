import { expect, test } from "@playwright/test";

for (const framework of ["react", "solid", "vue", "angular"] as const) {
  test(`${framework} binding opens and navigates an indexed gallery`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:4174/${framework}.html`);
    await expect(
      page.getByRole("heading", {
        name: `${framework[0]!.toUpperCase()}${framework.slice(1)} gallery`,
      }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator("app-gallery")
          .evaluate((element) =>
            Boolean((element as HTMLElement & { source?: { count: number } }).source?.count === 3),
          ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Open gallery" }).click();
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
    await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
    await page.getByRole("button", { name: "Switch source" }).click();
    await expect
      .poll(() =>
        page
          .locator("app-gallery")
          .evaluate(
            (element) => (element as HTMLElement & { source?: { count: number } }).source?.count,
          ),
      )
      .toBe(2);
    await page.getByRole("button", { name: "Open gallery" }).click();
    await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
      "aria-label",
      "Item 1 of 2",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
