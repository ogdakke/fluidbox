import { expect, test, type Page } from "@playwright/test";

/**
 * apps/examples/elements-slides.html: a `<fluidbox-gallery>` with a viewer
 * template of parts and a `<template data-fluidbox-slide>`, and one whose
 * items the embed, spin and model add-ons read from markup.
 */
const dialog = "[data-fluidbox-dialog]";
const overlay = "[data-fluidbox-viewer]";
const shown = '[data-fluidbox-slide][aria-hidden="false"]';
const parts = "#parts";

async function load(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/elements-slides.html");
  await page.waitForFunction(() => customElements.get("fluidbox-gallery") !== undefined);
  return errors;
}

const status = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelector("[data-fluidbox-dialog]")?.getAttribute("data-fluidbox-status") ??
      "closed",
  );
const events = (page: Page) => page.evaluate(() => window.galleryEvents);

/** Whether the open is still waiting for its slide: mounted but not yet shown. */
const waiting = (page: Page) =>
  page.locator(overlay).evaluate((element) => element.hasAttribute("data-fluidbox-prepared"));

/** Hold requests for `url` until the returned function lets them through, or fails them. */
async function hold(page: Page, url: string) {
  let release!: (ok: boolean) => void;
  const released = new Promise<boolean>((resolve) => (release = resolve));
  await page.route(url, async (route) => {
    if (await released) await route.continue();
    else await route.fulfill({ status: 404, body: "" });
  });
  return release;
}

test("a slide template stamps its box and its layer, and the open waits for the box's image", async ({
  page,
}) => {
  const errors = await load(page);
  const release = await hold(page, "**/art/fjord.svg?note");
  await page.locator('[data-test="note"]').click();
  await expect(page.locator(overlay)).toHaveCount(1);
  await page.waitForTimeout(400);
  expect(await waiting(page)).toBe(true);
  release(true);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");

  const slide = page.locator(shown);
  // The box holds the template's media, with the attributes of `<fluidbox-media>`.
  await expect(
    slide.locator('[data-fluidbox-media].note-card [data-test="note-image"]'),
  ).toHaveCount(1);
  // The rest goes in the layer, outside the box, and follows the item.
  const title = slide.locator('[data-test="note-title"]');
  await expect(title).toHaveText("Field note");
  expect(await title.evaluate((element) => !!element.closest("[data-fluidbox-media]"))).toBe(false);
  await expect(slide.locator("fluidbox-media, fluidbox-image")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect.poll(() => status(page)).toBe("closed");
  expect(errors).toEqual([]);
});

test("the value attribute opens, moves and closes the viewer, and a canceled change stays put", async ({
  page,
}) => {
  await load(page);
  const gallery = page.locator(parts);
  await gallery.evaluate((element) => element.setAttribute("value", "canyon"));
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 1 of 3");

  await gallery.evaluate((element) => element.setAttribute("value", "note"));
  await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 3");
  expect(
    await gallery.evaluate((element: HTMLElement & { value: string | null }) => element.value),
  ).toBe("note");

  // A user's move doesn't write the attribute: the value is a request.
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 1 of 3");
  await expect(gallery).toHaveAttribute("value", "note");

  await gallery.evaluate((element) =>
    element.addEventListener("beforevaluechange", (event) => event.preventDefault(), {
      once: true,
    }),
  );
  await gallery.evaluate((element) => element.setAttribute("value", "broken"));
  await page.waitForTimeout(300);
  await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 1 of 3");

  await gallery.evaluate((element) => element.removeAttribute("value"));
  await expect.poll(() => status(page)).toBe("closed");
  expect(await events(page)).toContain("beforevaluechange broken");
});

test("the parts draw the controls, the counter and the caption", async ({ page }) => {
  await load(page);
  await page.locator('[data-test="canyon"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  const viewer = page.locator(dialog);

  const toolbar = viewer.locator("[data-fluidbox-toolbar]");
  await expect(toolbar).toHaveAttribute("role", "group");
  await expect(toolbar.getByRole("button")).toHaveText(["Previous", "Next", "Close"]);
  await expect(toolbar.locator("[data-fluidbox-default]")).toHaveCount(3);

  const zoom = viewer.locator("[data-fluidbox-zoom-controls]");
  await expect(zoom).toHaveAttribute("role", "group");
  await expect(zoom).toHaveAttribute("aria-label", /.+/);
  await expect(zoom.getByRole("button")).toHaveCount(3);

  await expect(viewer.locator("[data-fluidbox-counter]")).toHaveText(/1\D+3/);
  await expect(viewer.locator("[data-fluidbox-counter]")).toHaveAttribute("aria-hidden", "true");
  // Your own content is the control's, named by its label.
  const download = viewer.locator("a[data-fluidbox-download]");
  await expect(download).toHaveText("Save");
  await expect(download).toHaveAccessibleName(/download/i);
  await expect(viewer.locator("fluidbox-toolbar, fluidbox-counter, fluidbox-download")).toHaveCount(
    0,
  );

  // The caption shows for an item that has one, and describes the dialog.
  const caption = viewer.locator("[data-fluidbox-caption]");
  await expect(caption).toHaveText("Late light on the canyon walls");
  const describedBy = await viewer.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  expect(await caption.getAttribute("id")).toBe(describedBy);

  await toolbar.getByRole("button", { name: "Next" }).click();
  await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 3");
  await expect(viewer.locator("[data-fluidbox-caption]")).toHaveCount(0);
  await expect(viewer.locator("[data-fluidbox-counter]")).toHaveText(/2\D+3/);
});

test("loading and error parts show with the slide, and Retry loads it again", async ({ page }) => {
  await load(page);
  const release = await hold(page, "**/broken/dune.svg");
  await page.locator('[data-test="broken"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open", {
    timeout: 6000,
  });
  const viewer = page.locator(dialog);
  await expect(viewer.locator('[data-fluidbox-loading] [data-test="loading"]')).toHaveCount(1);
  await expect(viewer.locator("[data-fluidbox-error-content]")).toHaveCount(0);

  release(false);
  const error = viewer.locator('[data-fluidbox-error-content] [data-test="error"]');
  await expect(error).toContainText("Dune didn't load.");
  await expect(viewer.locator("[data-fluidbox-loading]")).toHaveCount(0);
  expect(await events(page)).toContain("mediaerror broken");

  await page.unroute("**/broken/dune.svg");
  await page.route("**/broken/dune.svg", (route) =>
    route.fulfill({ path: "apps/examples/public/art/dune.svg", contentType: "image/svg+xml" }),
  );
  await error.getByRole("button", { name: /retry/i }).click();
  await expect(viewer.locator("[data-fluidbox-error-content]")).toHaveCount(0);
  await expect(page.locator(`${shown} img[data-fluidbox-media]`)).toHaveJSProperty(
    "complete",
    true,
  );
});

test("dismiss and wheel options turn the backdrop and the wheel off", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A wheel needs a mouse.");
  await load(page);
  await page.locator(parts).evaluate((element: HTMLElement & { dismiss: unknown }) => {
    element.dismiss = { backdrop: false };
    element.setAttribute("wheel", "navigate");
  });
  await page.locator('[data-test="canyon"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await page.mouse.click(8, 8);
  await page.waitForTimeout(300);
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await page.mouse.move(400, 300);
  // Where the default wheel closes, "navigate" moves on.
  for (let step = 0; step < 10; step++) await page.mouse.wheel(0, 40);
  await expect(page.locator(shown)).not.toHaveAttribute("aria-label", "Item 1 of 3");
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
});

test("a gallery taken off the page closes, and opens again once it is back", async ({ page }) => {
  const errors = await load(page);
  await page.locator('[data-test="note"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await page.evaluate(() => {
    const gallery = document.querySelector("#parts")!;
    const parent = gallery.parentNode!;
    const next = gallery.nextSibling;
    gallery.remove();
    (window as { putBack?: () => void }).putBack = () => parent.insertBefore(gallery, next);
  });
  await expect.poll(() => status(page)).toBe("closed");
  await page.evaluate(() => (window as { putBack?: () => void }).putBack!());
  await page.locator('[data-test="note"]').click();
  await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  await expect(page.locator(`${shown} [data-test="note-title"]`)).toHaveText("Field note");
  await expect(page.locator(`${dialog} [data-fluidbox-toolbar]`)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test.describe("the add-ons read their markup", () => {
  test("a YouTube iframe opens as an embed on its poster", async ({ page }) => {
    await page.route(/youtube|ytimg|vimeo/, (route) => route.abort());
    await load(page);
    await page.locator('[data-test="film"]').click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator(`${shown} [data-fluidbox-embed]`)).toHaveCount(1);
    await expect(page.locator(`${shown} iframe`)).toHaveCount(0);
    await expect(page.locator(`${shown} [data-fluidbox-embed-play]`)).toHaveAccessibleName(/.+/);
  });

  test("an image with spin frames opens as a spin", async ({ page }) => {
    await load(page);
    await page.locator('[data-test="spin"]').click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator(`${shown} [data-fluidbox-spin]`)).toHaveCount(1);
  });

  test("model-viewer opens as a model once the page defines the element, with no load", async ({
    page,
  }) => {
    await load(page);
    await page.locator('[data-test="model"]').click();
    await expect(page.locator(overlay)).toHaveCount(1);
    await page.waitForTimeout(300);
    await expect(page.locator(`${shown} model-viewer`)).toHaveCount(0);
    await page.evaluate(() => window.defineModelViewer());
    const model = page.locator(`${shown} model-viewer`);
    await expect(model).toHaveAttribute("src", "/products/fjord-model.glb");
    await expect(model).toHaveAttribute("exposure", "1.2");
    await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
  });
});
