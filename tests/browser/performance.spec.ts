import { expect, test } from "@playwright/test";

function median(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

test("indexed source open cost stays near constant with gallery size", async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(browserName !== "chromium", "The relative performance gate runs once on Chromium.");
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const measurements: Record<
    string,
    { openMs: number[]; maxViewerNodes: number; initialNodes: number; closedNodes: number[] }
  > = {};
  for (const count of [1000, 100000]) {
    await page.goto(`/harness.html?virtual&count=${count}`);
    const openMs: number[] = [];
    const initialNodes = await page.locator("*").count();
    const closedNodes: number[] = [];
    let maxViewerNodes = 0;
    for (let iteration = 0; iteration < 6; iteration++) {
      const elapsed = await page
        .locator("app-gallery")
        .evaluate((gallery: HTMLElement & { open(index: number): void }, target: number) => {
          const start = performance.now();
          gallery.open(target);
          return performance.now() - start;
        }, count - 10);
      await expect(page.locator("[data-lightbox-dialog]")).toBeVisible();
      maxViewerNodes = Math.max(
        maxViewerNodes,
        await page.locator("[data-lightbox-slide], [data-lightbox-filmstrip-item]").count(),
      );
      if (iteration > 0) openMs.push(elapsed);
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
      closedNodes.push(await page.locator("*").count());
    }
    measurements[String(count)] = { openMs, maxViewerNodes, initialNodes, closedNodes };
  }
  const small = median(measurements["1000"]!.openMs);
  const large = median(measurements["100000"]!.openMs);
  await testInfo.attach("open-scaling.json", {
    body: JSON.stringify(
      {
        browserVersion: page.context().browser()?.version(),
        smallMedianMs: small,
        largeMedianMs: large,
        measurements,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(measurements["100000"]!.maxViewerNodes).toBeLessThan(140);
  for (const run of Object.values(measurements)) {
    expect(run.closedNodes).toEqual(Array(6).fill(run.initialNodes));
  }
  expect(large).toBeLessThan(small * 4 + 50);
});
