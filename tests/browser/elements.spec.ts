import { expect, test, type Page } from "@playwright/test";
import { stubMedia } from "./support/media";
import { expectSlideshowPart } from "./support/slideshow-part";

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

  test("a model never joins the page twice: not on a gallery's redraw, nor on a reopen", async ({
    page,
  }) => {
    await stubMedia(page);
    await load(page);
    // The page loads <model-viewer> with its own script; the slide has no load.
    await page.addScriptTag({
      url: "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js",
    });
    const gallery = page.locator("#media");
    const model = page.locator(`${shown} model-viewer`);
    for (let round = 0; round < 2; round++) {
      await page.locator('[data-test="model"]').click();
      await expect(page.locator(`${shown} [data-fluidbox-model-ready]`)).toHaveCount(1);
      await expect(model).toHaveAttribute("data-connections", "1");
      // Reading the items again, and new options, leave the element where it is.
      await gallery.evaluate((element, round) => {
        const item = element.querySelector("fluidbox-item")!.cloneNode(true) as HTMLElement;
        item.setAttribute("value", `film-${round}`);
        element.append(item);
        element.setAttribute("zoom-max", String(4 + round));
      }, round);
      await page.waitForTimeout(300);
      await expect(model).toHaveCount(1);
      await expect(model).toHaveAttribute("data-connections", "1");
      await page.keyboard.press("Escape");
      await expect.poll(() => status(page)).toBe("closed");
    }
  });

  test("an iframe stamped from a slide template loads once, through a re-read and moves", async ({
    page,
  }) => {
    await load(page);
    await page.locator('button[data-test="frame"]').click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect
      .poll(() => page.evaluate(() => (window as { frameLoads?: number }).frameLoads))
      .toBe(1);
    // Reading the items again, and new options, keep the slide and its frame.
    await page.locator("#media").evaluate((element) => {
      const item = element.querySelector("fluidbox-item")!.cloneNode(true) as HTMLElement;
      item.setAttribute("value", "film-again");
      element.prepend(item);
      element.setAttribute("zoom-max", "5");
    });
    await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 5 of 5");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(`${shown} iframe[data-test="frame"]`)).toHaveCount(1);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as { frameLoads?: number }).frameLoads)).toBe(1);
  });
});

test.describe("the value", () => {
  test("a starting value waits for items set later, and opens them", async ({ page }) => {
    await load(page);
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") warnings.push(message.text());
    });
    await page.evaluate(() => {
      const gallery = document.createElement("fluidbox-gallery");
      gallery.id = "late";
      gallery.setAttribute("value", "b");
      document.querySelector("main")!.append(gallery);
      setTimeout(() => {
        gallery.items = ["a", "b"].map((id) => ({
          type: "image" as const,
          id,
          src: "/art/canyon.svg",
          alt: `Photo ${id}`,
          width: 800,
          height: 600,
        }));
      }, 100);
    });
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator(shown)).toHaveAttribute("aria-label", "Item 2 of 2");
    expect(warnings.filter((text) => text.includes("names no item"))).toEqual([]);
  });

  test("a gallery moved in the page keeps the viewer as it was", async ({ page }) => {
    await load(page);
    const gallery = page.locator(parts);
    const move = () =>
      gallery.evaluate((element) => document.querySelector("main")!.append(element));
    // A value already used, then closed with Escape, doesn't open again.
    await gallery.evaluate((element) => element.setAttribute("value", "canyon"));
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await page.keyboard.press("Escape");
    await expect.poll(() => status(page)).toBe("closed");
    await move();
    await page.waitForTimeout(500);
    await expect(page.locator(dialog)).toHaveCount(0);

    // A canceled value isn't asked again.
    await gallery.evaluate((element) =>
      element.addEventListener("beforevaluechange", (event) => event.preventDefault(), {
        once: true,
      }),
    );
    await gallery.evaluate((element) => element.setAttribute("value", "broken"));
    await page.waitForTimeout(300);
    await move();
    await page.waitForTimeout(500);
    await expect(page.locator(dialog)).toHaveCount(0);
    expect((await events(page)).filter((each) => each === "beforevaluechange broken")).toHaveLength(
      1,
    );
  });
});

test.describe("slides and parts", () => {
  test("controls of a viewer property stay the elements it made, and its parts expand", async ({
    page,
  }) => {
    await load(page);
    await page.evaluate(() => {
      const state = ((window as { made?: { buttons: HTMLButtonElement[]; clicks: number } }).made =
        { buttons: [] as HTMLButtonElement[], clicks: 0 });
      const gallery = document.querySelector("#typed") as HTMLElementTagNameMap["fluidbox-gallery"];
      gallery.viewer = ({ target }) => {
        const button = document.createElement("button");
        button.setAttribute("data-fluidbox-close", "");
        button.addEventListener("click", () => (state.clicks += 1));
        state.buttons.push(button);
        target.append(button, document.createElement("fluidbox-counter"));
      };
    });
    // Let the parts arrive, so the viewer draws once.
    await page.waitForTimeout(300);
    await page.locator('[data-test="print"]').click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator(`${dialog} [data-fluidbox-counter]`)).toHaveText(/1\D+1/);
    const made = () =>
      page.evaluate(() => {
        const { buttons, clicks } = (
          window as unknown as { made: { buttons: HTMLButtonElement[]; clicks: number } }
        ).made;
        return { count: buttons.length, connected: buttons.at(-1)!.isConnected, clicks };
      });
    expect(await made()).toEqual({ count: 1, connected: true, clicks: 0 });
    const close = page.locator(`${dialog} button[data-fluidbox-close]`);
    await expect(close).toHaveCount(1);
    await expect(close).toHaveText("Close");
    await close.click();
    await expect.poll(() => status(page)).toBe("closed");
    expect((await made()).clicks).toBe(1);
  });

  test("a typed item takes its type's slide, which draws the content's image", async ({ page }) => {
    await load(page);
    await page.locator('[data-test="print"]').click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator(`${shown} [data-test="slide-from"]`)).toHaveText("template");
    await expect(page.locator(`${shown} img[data-fluidbox-drawn]`)).toHaveAttribute(
      "src",
      /\/art\/meadow\.svg$/,
    );
  });

  test("<fluidbox-image field> draws the item's field", async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
      const gallery = document.createElement("fluidbox-gallery");
      gallery.innerHTML = `<template data-fluidbox-slide="product">
        <fluidbox-media><fluidbox-image field="photo"></fluidbox-image></fluidbox-media>
        <p data-test="product-title" data-fluidbox-text="title"></p>
      </template>`;
      gallery.items = [
        {
          type: "product",
          id: "chair",
          title: "Fjord chair",
          width: 800,
          height: 800,
          photo: {
            type: "image",
            id: "chair-photo",
            src: "/art/fjord.svg",
            alt: "Fjord chair",
            width: 800,
            height: 800,
          },
        } as never,
      ];
      gallery.value = "chair";
      document.querySelector("main")!.append(gallery);
    });
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator(`${shown} img[data-fluidbox-drawn]`)).toHaveAttribute(
      "src",
      /\/art\/fjord\.svg$/,
    );
    await expect(page.locator(`${shown} [data-test="product-title"]`)).toHaveText("Fjord chair");
  });

  test("the slides property comes before a template, and a template before the registry", async ({
    page,
  }) => {
    await load(page);
    const gallery = page.locator("#typed");
    const from = async () => {
      await page.locator('[data-test="print"]').click();
      await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
      const text = await page.locator(`${shown} [data-test="slide-from"]`).textContent();
      await page.keyboard.press("Escape");
      await expect.poll(() => status(page)).toBe("closed");
      return text?.trim();
    };
    const slideFrom = (label: string) =>
      `({ layer }) => { const p = document.createElement("p"); p.dataset.test = "slide-from"; p.textContent = "${label}"; layer.append(p); }`;
    // Registered after the gallery connected.
    await page.evaluate(async (renderer) => {
      const { defineSlide } = await import("/@id/@ogdakke/fluidbox/elements" as string);
      defineSlide("print", eval(renderer));
    }, slideFrom("registry"));
    expect(await from()).toBe("template");
    await gallery.evaluate(
      (element, renderer) =>
        ((element as HTMLElement & { slides: object }).slides = { print: eval(renderer) }),
      slideFrom("property"),
    );
    expect(await from()).toBe("property");
    await gallery.evaluate(
      (element) => ((element as HTMLElement & { slides: object }).slides = {}),
    );
    await gallery.evaluate((element) =>
      element.querySelector("template[data-fluidbox-slide]")!.remove(),
    );
    expect(await from()).toBe("registry");
  });

  test("a markup reader registered after the gallery connected reads its items again", async ({
    page,
  }) => {
    await load(page);
    await page.evaluate(() => {
      const item = document.createElement("fluidbox-item");
      item.setAttribute("value", "aside");
      item.innerHTML = `<button slot="trigger" type="button" data-test="aside">Aside</button>
        <template slot="content"><aside data-kind="print" data-src="/art/coast.svg" width="800" height="600">Coast</aside></template>`;
      document.querySelector("#typed")!.append(item);
    });
    await page.evaluate(async () => {
      const { defineMarkup } = await import("/@id/@ogdakke/fluidbox/elements" as string);
      defineMarkup("aside[data-kind]", (content: HTMLElement, { id }: { id: string }) => ({
        type: content.dataset.kind,
        id,
        src: content.dataset.src,
        alt: content.textContent,
        width: 800,
        height: 600,
      }));
    });
    await page.locator('[data-test="aside"]').click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator(`${shown} [data-test="slide-from"]`)).toHaveText("template");
    await expect(page.locator(`${shown} img[data-fluidbox-drawn]`)).toHaveAttribute(
      "src",
      /\/art\/coast\.svg$/,
    );
  });

  test("a caption of your own shows without an item caption, and an icon keeps its control's label", async ({
    page,
  }) => {
    await load(page);
    await page.evaluate(() => {
      const gallery = document.createElement("fluidbox-gallery");
      gallery.innerHTML = `<template slot="viewer">
        <fluidbox-caption><span data-test="own-caption">Own words</span></fluidbox-caption>
        <button data-fluidbox-close data-fluidbox-default data-test="icon-close"><svg width="10" height="10"></svg></button>
      </template>`;
      gallery.items = [
        { type: "image", id: "dune", src: "/art/dune.svg", alt: "Dune", width: 800, height: 600 },
      ];
      gallery.value = "dune";
      document.querySelector("main")!.append(gallery);
    });
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    await expect(page.locator(`${dialog} [data-test="own-caption"]`)).toHaveText("Own words");
    const close = page.locator(`${dialog} [data-test="icon-close"]`);
    await expect(close.locator("svg")).toHaveCount(1);
    await expect(close).toHaveAccessibleName("Close");
  });
});

test("<fluidbox-slideshow> plays and pauses, named by its content or its label", async ({
  page,
}) => {
  await load(page);
  await expectSlideshowPart(page, "#slideshow", { trigger: '[slot="trigger"]', managed: false });
});
