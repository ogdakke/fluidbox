import { expect, test, type Page } from "@playwright/test";

const viewerCode = /dom-viewer-driver/;
const dialog = "[data-fluidbox-dialog]";

/** Count the requests for the viewer's code from now on. */
function watchViewerCode(page: Page) {
  const seen = { count: 0 };
  page.on("request", (request) => {
    if (viewerCode.test(request.url())) seen.count++;
  });
  return seen;
}

async function open(page: Page, preload?: string) {
  await page.goto(`/harness.html?no-thumbnails${preload ? `&preload=${preload}` : ""}`);
  await page.waitForLoadState("networkidle");
  return page.locator('[data-test-index="0"] button');
}

test.describe("loading the viewer's code", () => {
  test.skip(({ isMobile }) => isMobile, "Hover needs a mouse.");

  test("a mouse resting on a trigger loads it, one passing over doesn't", async ({ page }) => {
    const trigger = await open(page);
    const seen = watchViewerCode(page);
    const box = (await trigger.boundingBox())!;
    // Onto the trigger and back off to its left, where no trigger is, in under 100 ms.
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x - 40, y);
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.move(box.x - 40, y);
    await page.waitForTimeout(300);
    expect(seen.count).toBe(0);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => seen.count).toBe(1);
  });

  test("focus on a trigger loads it", async ({ page }) => {
    const trigger = await open(page);
    const seen = watchViewerCode(page);
    await trigger.focus();
    await expect.poll(() => seen.count).toBe(1);
  });

  test("press mode waits for the press", async ({ page }) => {
    const trigger = await open(page, "press");
    const seen = watchViewerCode(page);
    await trigger.hover();
    await trigger.focus();
    await page.waitForTimeout(300);
    expect(seen.count).toBe(0);
    await trigger.click();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    expect(seen.count).toBe(1);
  });

  test("eager mode loads it once the page is idle", async ({ page }) => {
    const seen = watchViewerCode(page);
    await open(page, "eager");
    await expect.poll(() => seen.count).toBe(1);
  });

  test("load() loads it on any signal", async ({ page }) => {
    await open(page, "press");
    const seen = watchViewerCode(page);
    const loaded = await page.evaluate(() =>
      (
        document.querySelector("fluidbox-gallery") as unknown as { load(): Promise<boolean> }
      ).load(),
    );
    expect(loaded).toBe(true);
    expect(seen.count).toBe(1);
  });

  test("a press opens while the code is slow, and leaves the page alone until the click", async ({
    page,
  }) => {
    const trigger = await open(page, "press");
    await page.route(viewerCode, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });
    // The open puts its own overlay up once clicked; before that, nothing may change.
    await page.evaluate(() => {
      const record = window as unknown as { prepared: boolean };
      record.prepared = false;
      let clicked = false;
      document.addEventListener("click", () => (clicked = true), { capture: true });
      new MutationObserver(() => {
        if (!clicked && document.querySelector("[data-fluidbox-viewer]")) record.prepared = true;
      }).observe(document.body, { subtree: true, childList: true, attributes: true });
    });
    const box = (await trigger.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // The code arrives while the button is still held.
    await page.waitForTimeout(900);
    await page.mouse.up();
    await expect(page.locator(dialog)).toHaveAttribute("data-fluidbox-status", "open");
    expect(await page.evaluate(() => (window as unknown as { prepared: boolean }).prepared)).toBe(
      false,
    );
  });
});
