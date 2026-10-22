import { expect, test } from "@playwright/test";

const activeIframe = '[data-fluidbox-slide][aria-hidden="false"] iframe[data-fluidbox-media]';

test("iframe items refuse script URLs and get a default sandbox", async ({ page }) => {
  await page.goto("/headless.html");
  const refused = await page.evaluate(async () => {
    try {
      await window.headlessViewer.setItems([
        {
          id: "x",
          type: "iframe",
          src: "javascript:parent.pwned=document.domain",
          title: "x",
          width: 4,
          height: 3,
        },
      ]);
      return "";
    } catch (error) {
      return String(error);
    }
  });
  expect(refused).toContain("TypeError: The src of fluidbox iframe item x must be");

  // A list of one's own skips the array check; the slide refuses it instead.
  await page.evaluate(async () => {
    const items = [
      { id: "safe", type: "iframe", src: "/map-panel.html", title: "Map", width: 4, height: 3 },
      {
        id: "bad",
        type: "iframe",
        src: " JaVa\tScRiPt:parent.pwned=1",
        title: "x",
        width: 4,
        height: 3,
      },
    ] as const;
    await window.headlessViewer.setItems({ count: items.length, get: (index) => items[index]! });
    await window.headlessViewer.open("safe");
  });
  await expect(page.locator(activeIframe)).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    /2 of 2/,
  );
  await expect(
    page.locator('[data-fluidbox-slide][aria-hidden="false"] [data-fluidbox-error]'),
  ).toBeVisible();
  await expect(page.locator(activeIframe)).not.toHaveAttribute("src", /.+/);
  expect(await page.evaluate(() => "pwned" in window)).toBe(false);
});

test("<fluidbox-item> refuses an iframe with a script URL", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/elements/");
  await expect(page.locator("html")).toHaveAttribute("data-patterns-ready", "");
  await page.evaluate(() => {
    const gallery = document.createElement("fluidbox-gallery");
    const item = document.createElement("fluidbox-item");
    item.setAttribute("item-id", "bad");
    const trigger = document.createElement("button");
    trigger.slot = "trigger";
    trigger.dataset.testBad = "";
    trigger.textContent = "Open";
    const template = document.createElement("template");
    template.slot = "content";
    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", "javascript:parent.pwned=document.domain");
    iframe.width = "400";
    iframe.height = "300";
    template.content.append(iframe);
    item.append(trigger, template);
    gallery.append(item);
    document.body.append(gallery);
  });
  await expect.poll(() => errors.join("\n")).toContain("The src of fluidbox iframe item bad");
  await page.locator("[data-test-bad]").click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  expect(await page.evaluate(() => "pwned" in window)).toBe(false);
});
