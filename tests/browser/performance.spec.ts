import { expect, test } from "@playwright/test";

function median(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "The relative performance gate runs once on Chromium.",
);

test("indexed source open cost stays near constant with gallery size", async ({
  page,
}, testInfo) => {
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
        .locator("fluidbox-gallery")
        .evaluate(
          (gallery: HTMLElement & { open(target: number): Promise<boolean> }, target: number) => {
            const start = performance.now();
            void gallery.open(target);
            return performance.now() - start;
          },
          count - 10,
        );
      await expect(page.locator("[data-fluidbox-dialog]")).toBeVisible();
      maxViewerNodes = Math.max(
        maxViewerNodes,
        await page.locator("[data-fluidbox-slide], [data-fluidbox-thumbnails-item]").count(),
      );
      if (iteration > 0) openMs.push(elapsed);
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
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

test("a photo's open flies as soon as before: waiting for slides adds no frame", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "The latency gate runs once on Chromium.");
  await page.goto("/slides.html");
  const photo = page.locator('#slides [data-item="photo"]');
  const dialog = page.locator("[data-fluidbox-dialog]");
  // The first open loads the viewer's code; time the ones after it.
  await photo.click();
  await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const runs: { frames: number; ms: number }[] = [];
  for (let run = 0; run < 7; run++) {
    runs.push(
      await photo.evaluate(
        (button: HTMLElement) =>
          new Promise<{ frames: number; ms: number }>((resolve) => {
            const start = performance.now();
            let frames = 0;
            const count = () => {
              const overlay = document.querySelector("[data-fluidbox-viewer]");
              // The flight starts as the overlay stops being merely prepared.
              if (overlay && !overlay.hasAttribute("data-fluidbox-prepared")) {
                resolve({ frames, ms: performance.now() - start });
                return;
              }
              frames += 1;
              requestAnimationFrame(count);
            };
            button.click();
            requestAnimationFrame(count);
          }),
      ),
    );
    await expect(dialog).toHaveAttribute("data-fluidbox-status", "open");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
  const frames = median(runs.map((run) => run.frames));
  console.log(`photo open: ${frames} frames, ${median(runs.map((run) => run.ms)).toFixed(1)} ms`);
  // The open waits one frame to stage the viewer, as it did before slides could hold it.
  expect(frames).toBeLessThanOrEqual(2);
});

for (const [article, binding] of [
  ["a", "React"],
  ["a", "Vue"],
  ["an", "Angular"],
  ["a", "Solid"],
]) {
  test(`${article} ${binding} slide that draws the image opens as soon as the built-in image, on a first open`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "The latency gate runs once on Chromium.");
    test.setTimeout(90_000);
    /**
     * The frames and time from a press to the start of the opening flight, as
     * the photo test counts them, on a fresh page: the slide mounts and commits
     * for the first time.
     */
    const firstOpen = async (selector: string) => {
      await page.goto(`/${binding.toLowerCase()}-slides.html`);
      const trigger = page.locator(selector);
      await expect(trigger).toBeVisible();
      // The viewer's code is loaded, so only the slide's first mount differs.
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
      const run = await trigger.evaluate(
        (button: HTMLElement) =>
          new Promise<{ frames: number; ms: number }>((resolve) => {
            const start = performance.now();
            let frames = 0;
            const count = () => {
              const overlay = document.querySelector("[data-fluidbox-viewer]");
              if (overlay && !overlay.hasAttribute("data-fluidbox-prepared")) {
                resolve({ frames, ms: performance.now() - start });
                return;
              }
              frames += 1;
              requestAnimationFrame(count);
            };
            button.click();
            requestAnimationFrame(count);
          }),
      );
      await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
        "data-fluidbox-status",
        "open",
      );
      return run;
    };
    const builtin: { frames: number; ms: number }[] = [];
    const custom: { frames: number; ms: number }[] = [];
    // Taken in turns, so a slow moment of the machine falls on both.
    for (let run = 0; run < 7; run++) {
      builtin.push(await firstOpen('#builtin [data-item="one"]'));
      custom.push(await firstOpen('#custom [data-item="one"]'));
    }
    const frames = (runs: typeof builtin) => median(runs.map((run) => run.frames));
    const ms = (runs: typeof builtin) => median(runs.map((run) => run.ms));
    console.log(
      `${binding} image first open: built in ${frames(builtin)} frames, ${ms(builtin).toFixed(1)} ms; through a slide ${frames(custom)} frames, ${ms(custom).toFixed(1)} ms`,
    );
    // A first open varies by a frame from page to page, so each median may sit
    // one frame above the built-in image's, in frames and in time.
    expect(frames(custom)).toBeLessThanOrEqual(frames(builtin) + 1);
    expect(ms(custom)).toBeLessThanOrEqual(ms(builtin) + 1000 / 60);
  });
}
