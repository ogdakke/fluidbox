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
  expect(refused).toContain("TypeError: The src of fluidbox iframe item x is not");

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
  await expect
    .poll(() => errors.join("\n"))
    .toContain("The src of fluidbox iframe item bad is not");
  await page.locator("[data-test-bad]").click();
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  expect(await page.evaluate(() => "pwned" in window)).toBe(false);
});

test.describe("link triggers", () => {
  const dialog = '[data-fluidbox-dialog][data-fluidbox-status="open"]';

  test("a plain click opens the viewer and stays on the page", async ({ page }) => {
    await page.goto("/csp.html");
    await page.waitForFunction(() => window.cspViewer !== undefined);
    for (const trigger of [
      page.locator('a[data-photo="2"]'),
      page.locator('[data-csp-elements] a[slot="trigger"]'),
    ]) {
      await trigger.click();
      await expect(page.locator(dialog)).toHaveCount(1);
      expect(new URL(page.url()).pathname).toBe("/csp.html");
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
    }
  });

  test("a click with a modifier key is left to the link", async ({ page }) => {
    await page.goto("/csp.html");
    await page.waitForFunction(() => window.cspViewer !== undefined);
    const prevented = await page.evaluate(() =>
      ["metaKey", "ctrlKey", "shiftKey", "altKey"].map((key) => {
        let seen = true;
        // After the trigger's own listener; this one keeps the test on the page.
        const after = (event: Event) => {
          seen = event.defaultPrevented;
          event.preventDefault();
        };
        document.addEventListener("click", after, { once: true });
        document
          .querySelector('a[data-photo="2"]')!
          .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, [key]: true }));
        return seen;
      }),
    );
    expect(prevented).toEqual([false, false, false, false]);
    // An open would have started by the time the viewer's code is in.
    expect(await page.evaluate(() => window.cspViewer.load())).toBe(true);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    expect(await page.evaluate(() => window.cspViewer.state.status)).toBe("closed");
    await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  });

  test("a click prevented before the trigger's listener doesn't open", async ({ page }) => {
    await page.goto("/csp.html");
    await page.waitForFunction(() => window.cspViewer !== undefined);
    await page.evaluate(() =>
      document.addEventListener("click", (event) => event.preventDefault(), { capture: true }),
    );
    await page.locator('a[data-photo="2"]').click();
    await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/csp.html");
  });

  test("the link is followed when the viewer can't load", async ({ page }) => {
    await page.route("**/dom-viewer-driver*", (route) => route.abort());
    await page.goto("/csp.html");
    await page.waitForFunction(() => window.cspViewer !== undefined);
    await page.locator('a[data-photo="2"]').click();
    await page.waitForURL("**/art/dune.svg");
  });
});

test("a trigger that can't take focus warns in development", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.goto("/headless.html");
  await page.evaluate(() => {
    const button = document.createElement("button");
    const div = document.createElement("div");
    const named = document.createElement("div");
    named.role = "button";
    named.tabIndex = 0;
    document.body.append(button, div, named);
    for (const element of [button, div, named]) window.headlessViewer.bind(element, "one");
  });
  await expect
    .poll(() => warnings.filter((text) => text.includes("A fluidbox trigger needs to be")))
    .toHaveLength(1);
});
