import { expect, test } from "@playwright/test";

const sitePages: [path: string, openers: string[]][] = [
  ["/", ["#mosaic app-lightbox [slot=trigger]"]],
  ["/elements/", ["#mosaic app-lightbox [slot=trigger]", "#virtual-gallery .virtual-card"]],
  ["/headless/", ["#headless-grid .headless-thumb"]],
  ["/react/", [".product", ".map", ".album", ".cover", ".library-photo"]],
  ["/solid/", ["#gallery-root .fb-thumb", "#indexed-root .virtual-card"]],
  ["/vue/", ["#gallery-root .fb-thumb", "#indexed-root .virtual-card"]],
  ["/angular/", ["#gallery-root .fb-thumb", "#indexed-root .virtual-card"]],
];

for (const [path, openers] of sitePages) {
  test(`site page ${path} mounts its demos and each one opens a viewer`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(path);
    await expect(page.locator("[aria-busy]")).toHaveCount(0, { timeout: 15_000 });
    for (const selector of openers) {
      const opener = page.locator(selector).first();
      await opener.scrollIntoViewIfNeeded();
      await opener.click();
      await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
        "data-lightbox-state",
        "open",
      );
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
}

test("React binding opens and navigates without custom elements", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/react.html");
  await expect(page.getByRole("heading", { name: "React gallery" })).toBeVisible();
  expect(await page.evaluate(() => customElements.get("app-gallery"))).toBeUndefined();
  await page.getByRole("button", { name: "Open gallery" }).click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 1 of 3",
  );
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 2 of 3",
  );
  const opacityAnimations = await page
    .locator('[data-lightbox-slide][aria-hidden="false"] [data-lightbox-media]')
    .evaluate((media) =>
      media
        .getAnimations()
        .map((animation) => (animation.effect as KeyframeEffect | null)?.getKeyframes() ?? [])
        .filter((keyframes) => keyframes.some((keyframe) => keyframe.opacity === "0.35")),
    );
  expect(opacityAnimations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  await page.getByRole("button", { name: "Switch source" }).click();
  await page.getByRole("button", { name: "Open gallery" }).click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 1 of 2",
  );
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("React origin prototypes open image, iframe, and text-only galleries", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/react.html");

  await page.getByRole("button", { name: "View the Coral Runner shoe" }).click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"] img')).toBeVisible();
  await page.locator("[data-lightbox-dialog] [data-lightbox-close]").click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);

  await page.getByRole("button", { name: "Open the store map" }).click();
  const map = page.frameLocator('[data-lightbox-slide][aria-hidden="false"] iframe');
  await map.getByRole("button", { name: "Pan map" }).click();
  await expect(map.locator("#status")).toHaveText("Map panned east");
  await page.locator("[data-lightbox-dialog] [data-lightbox-close]").click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);

  await page.getByRole("button", { name: "Open the collection" }).click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 1 of 4",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 2 of 4",
  );
  await page.locator("[data-lightbox-dialog] [data-lightbox-close]").click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("React shared trigger closes every selected slide to its current preview", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/react.html");
  const trigger = page.getByRole("button", { name: "Open the preview gallery" });
  const preview = trigger.locator("img");
  await expect(preview).toHaveAttribute("src", "/first.svg");
  await trigger.click();
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await page.getByRole("button", { name: "Next" }).last().click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 2 of 4",
  );
  await expect(preview).toHaveAttribute("src", "/second.svg");
  await page.locator("[data-lightbox-dialog] [data-lightbox-close]").click();
  await expect(page.locator("[data-lightbox-flight]")).toHaveCount(1);
  const landing = await page.evaluate(() => {
    const preview = document.querySelector<HTMLElement>(".gallery-card__preview")!;
    const badge = preview.querySelector<HTMLElement>(".gallery-card__count")!;
    const frame = document.querySelector<HTMLElement>(
      "[data-lightbox-flight] [data-lightbox-frame]",
    )!;
    for (const animation of document.getAnimations()) {
      animation.pause();
      const duration = Number(animation.effect?.getTiming().duration) || 0;
      animation.currentTime = Math.max(0, duration - 1);
    }
    const origin = preview.getBoundingClientRect();
    const flight = frame.getBoundingClientRect();
    return {
      origin: { width: origin.width, height: origin.height },
      flight: { width: flight.width, height: flight.height },
      badgeProgress: Number(getComputedStyle(badge).getPropertyValue("--lightbox-progress")),
    };
  });
  expect(landing.flight.width).toBeCloseTo(landing.origin.width, 0);
  expect(landing.flight.height).toBeCloseTo(landing.origin.height, 0);
  expect(landing.origin.height).toBeGreaterThan(0);
  expect(landing.badgeProgress).toBeGreaterThan(0.9);
});

for (const framework of ["solid", "vue", "angular"] as const) {
  test(`${framework} binding opens and navigates an indexed gallery`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/${framework}.html`);
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
