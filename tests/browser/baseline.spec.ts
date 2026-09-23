import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type CDPSession } from "@playwright/test";

const capture = !!process.env.BASELINE_CAPTURE;
const baselineRoot = resolve(process.env.BASELINE_OUTPUT || "test-results/capture");

test.use({ video: "on", trace: "on" });

test("current gallery motion and appearance", async ({ page, browserName }, testInfo) => {
  test.skip(
    !capture,
    "Run bun run test:browser:baseline to capture the pre-virtualization baseline.",
  );
  const folder = resolve(baselineRoot, testInfo.project.name);
  await mkdir(folder, { recursive: true });
  await page.goto("/harness.html?count=30");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  await page.screenshot({ path: resolve(folder, "closed.png"), animations: "disabled" });
  await page.evaluate(() => {
    const samples: Array<Record<string, number | string | null>> = [];
    const longTasks: number[] = [];
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration);
      }).observe({ type: "longtask" });
    }
    let previous = performance.now();
    let active = true;
    function sample(now: number) {
      const slide = document.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"]',
      );
      const media = slide?.querySelector<HTMLElement>(
        "[data-lightbox-media], [data-lightbox-item-content]",
      );
      const rect = media?.getBoundingClientRect();
      samples.push({
        time: Math.round(now),
        frameGap: Math.round((now - previous) * 100) / 100,
        slide: slide?.getAttribute("aria-label") ?? null,
        x: rect ? Math.round(rect.x * 100) / 100 : null,
        y: rect ? Math.round(rect.y * 100) / 100 : null,
        width: rect ? Math.round(rect.width * 100) / 100 : null,
        height: rect ? Math.round(rect.height * 100) / 100 : null,
        scrollLeft:
          document.querySelector<HTMLElement>("[data-lightbox-slides]")?.scrollLeft ?? null,
      });
      previous = now;
      if (active) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
    Object.assign(window, {
      __lightboxProbe: { samples, longTasks, stop: () => (active = false) },
    });
  });
  let cdp: CDPSession | undefined;
  let cpuBefore: Record<string, number> | undefined;
  if (browserName === "chromium") {
    cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const result = await cdp.send("Performance.getMetrics");
    cpuBefore = Object.fromEntries(
      result.metrics.map((metric: { name: string; value: number }) => [metric.name, metric.value]),
    );
  }
  const openStart = await page.evaluate(() => performance.now());
  await page.locator("app-lightbox").first().click();
  await expect(page.locator("[data-lightbox-dialog]")).toBeVisible();
  await page.waitForTimeout(500);
  const openMs = (await page.evaluate(() => performance.now())) - openStart;
  await page.screenshot({ path: resolve(folder, "open.png"), animations: "disabled" });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 2 of 30",
  );
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(folder, "next.png"), animations: "disabled" });
  await page.locator('[data-lightbox-filmstrip-item][data-index="20"]').click();
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 21 of 30",
  );
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  const cpuAfter = cdp
    ? Object.fromEntries(
        (await cdp.send("Performance.getMetrics")).metrics.map(
          (metric: { name: string; value: number }) => [metric.name, metric.value],
        ),
      )
    : undefined;
  const probe = await page.evaluate(() => {
    const value = (
      window as Window & {
        __lightboxProbe?: { samples: unknown[]; longTasks: number[]; stop: () => void };
      }
    ).__lightboxProbe!;
    value.stop();
    return { samples: value.samples, longTasks: value.longTasks };
  });
  const navigation = await page.evaluate(() =>
    performance.getEntriesByType("navigation")[0]?.toJSON(),
  );
  const gaps = probe.samples
    .map((entry) => (entry as { frameGap: number }).frameGap)
    .filter((gap) => gap > 0);
  const sorted = gaps.toSorted((a, b) => a - b);
  const cpu =
    cpuAfter && cpuBefore
      ? Object.fromEntries(
          ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration"].map((key) => [
            key,
            (cpuAfter[key] ?? 0) - (cpuBefore[key] ?? 0),
          ]),
        )
      : null;
  await writeFile(
    resolve(folder, "metrics.json"),
    JSON.stringify(
      {
        browser: testInfo.project.name,
        browserVersion: page.context().browser()?.version(),
        viewport: page.viewportSize(),
        scenario: "30 DOM-backed images; open, next, filmstrip item 21, close",
        openMs: Math.round(openMs),
        frameCount: gaps.length,
        p95FrameGapMs: sorted[Math.floor(sorted.length * 0.95)] ?? null,
        maxFrameGapMs: Math.max(...gaps),
        gapsOver50Ms: gaps.filter((gap) => gap > 50).length,
        longTasksMs: probe.longTasks,
        cpuSeconds: cpu,
        navigation,
        samples: probe.samples,
      },
      null,
      2,
    ),
  );
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(resolve(folder, "interactions.webm"));
});

test("current large gallery allocation", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(
    !capture || testInfo.project.name !== "chromium",
    "The pre-virtualization stress baseline runs once in Chromium.",
  );
  const folder = resolve(baselineRoot, testInfo.project.name);
  const count = Number(process.env.STRESS_COUNT || 1000);
  await mkdir(folder, { recursive: true });
  const start = Date.now();
  await page.goto(`/harness.html?count=${count}`, { timeout: 120_000 });
  await expect(page.locator("html")).toHaveAttribute("data-fixture-ready", "");
  const fixtureMs = Date.now() - start;
  const openStart = Date.now();
  await page
    .locator("app-lightbox")
    .first()
    .locator("img")
    .evaluate((element: HTMLElement) => element.click());
  await expect(page.locator("[data-lightbox-dialog]")).toBeVisible({ timeout: 120_000 });
  const openMs = Date.now() - openStart;
  const allocation = await page.evaluate(() => ({
    sourceElements: document.querySelectorAll("app-lightbox").length,
    slides: document.querySelectorAll("[data-lightbox-slide]").length,
    filmstripButtons: document.querySelectorAll("[data-lightbox-filmstrip-item]").length,
    domNodes: document.querySelectorAll("*").length,
  }));
  await writeFile(
    resolve(folder, `stress-${count}.json`),
    JSON.stringify({ fixtureMs, openMs, ...allocation }, null, 2),
  );
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(resolve(folder, `stress-${count}.webm`));
});

test("current shadow DOM appearance", async ({ page }, testInfo) => {
  test.skip(
    !capture,
    "Run bun run test:browser:baseline to capture the pre-virtualization baseline.",
  );
  const folder = resolve(baselineRoot, testInfo.project.name);
  await mkdir(folder, { recursive: true });
  await page.goto("/harness.html?shadow");
  await page.locator("#fixture app-lightbox").first().click();
  await expect(page.locator("[data-lightbox-dialog]")).toBeVisible();
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(folder, "shadow-open.png"), animations: "disabled" });
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(resolve(folder, "shadow.webm"));
});

test("timecoded transition diagnostic", async ({ page }, testInfo) => {
  test.skip(
    !capture || testInfo.project.name !== "chromium",
    "One Chromium run records a readable clock in each video frame.",
  );
  const folder = resolve(baselineRoot, testInfo.project.name);
  await mkdir(folder, { recursive: true });
  await page.goto("/harness.html?count=30");
  await page.evaluate(() => {
    const clock = document.createElement("output");
    clock.id = "lightbox-frame-clock";
    clock.style.cssText =
      "position:fixed;z-index:2147483647;left:8px;top:8px;padding:4px 6px;background:#000;color:#fff;font:12px monospace;pointer-events:none";
    document.body.append(clock);
    const samples: Array<{
      time: number;
      phase: string;
      slide: string | null;
      x: number | null;
      y: number | null;
    }> = [];
    let phase = "idle";
    let active = true;
    function frame(now: number) {
      const slide = document.querySelector<HTMLElement>(
        '[data-lightbox-slide][aria-hidden="false"]',
      );
      const media = slide?.querySelector<HTMLElement>(
        "[data-lightbox-media], [data-lightbox-item-content]",
      );
      const rect = media?.getBoundingClientRect();
      const time = Math.round(now);
      clock.textContent = `${time}ms ${phase}`;
      samples.push({
        time,
        phase,
        slide: slide?.getAttribute("aria-label") ?? null,
        x: rect?.x ?? null,
        y: rect?.y ?? null,
      });
      if (active) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    Object.assign(window, {
      __diagnostic: {
        samples,
        setPhase: (next: string) => (phase = next),
        stop: () => (active = false),
      },
    });
  });
  const setPhase = (phase: string) =>
    page.evaluate((next) => {
      (
        window as unknown as { __diagnostic: { setPhase: (value: string) => void } }
      ).__diagnostic.setPhase(next);
    }, phase);
  await setPhase("opening");
  await page.locator("app-lightbox").first().click();
  await page.waitForTimeout(550);
  await setPhase("next");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(450);
  await setPhase("filmstrip-21");
  await page.locator('[data-lightbox-filmstrip-item][data-index="20"]').click();
  await page.waitForTimeout(350);
  await setPhase("closing");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  const samples = await page.evaluate(() => {
    const diagnostic = (
      window as unknown as { __diagnostic: { samples: unknown[]; stop: () => void } }
    ).__diagnostic;
    diagnostic.stop();
    return diagnostic.samples;
  });
  await writeFile(resolve(folder, "diagnostic-frames.json"), JSON.stringify(samples, null, 2));
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(resolve(folder, "diagnostic.webm"));
});

test("indexed source timing and frame capture", async ({ page, browserName }, testInfo) => {
  test.skip(!capture, "Run bun run test:browser:baseline to capture performance telemetry.");
  const folder = resolve(baselineRoot, testInfo.project.name);
  await mkdir(folder, { recursive: true });
  await page.goto("/harness.html?virtual&count=100000");
  const initialNodes = await page.locator("*").count();
  await page.evaluate(() => {
    const samples: Array<{ time: number; gapMs: number; active: string | null }> = [];
    let previous = performance.now();
    let active = true;
    function frame(now: number) {
      samples.push({
        time: Math.round(now),
        gapMs: Math.round((now - previous) * 100) / 100,
        active:
          document
            .querySelector('[data-lightbox-slide][aria-hidden="false"]')
            ?.getAttribute("aria-label") ?? null,
      });
      previous = now;
      if (active) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    Object.assign(window, { __sourcePerf: { samples, stop: () => (active = false) } });
  });
  let cdp: CDPSession | undefined;
  let before: Record<string, number> | undefined;
  if (browserName === "chromium") {
    cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    before = Object.fromEntries(
      (await cdp.send("Performance.getMetrics")).metrics.map(
        (metric: { name: string; value: number }) => [metric.name, metric.value],
      ),
    );
  }
  const openMs = await page
    .locator("app-gallery")
    .evaluate((gallery: HTMLElement & { open(index: number): void }) => {
      const start = performance.now();
      gallery.open(99_990);
      return performance.now() - start;
    });
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 99991 of 100000",
  );
  await page.waitForTimeout(400);
  const openedNodes = await page.locator("*").count();
  const slides = await page.locator("[data-lightbox-slide]").count();
  const thumbnails = await page.locator("[data-lightbox-filmstrip-item]").count();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 99992 of 100000",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  const closedNodes = await page.locator("*").count();
  const after = cdp
    ? Object.fromEntries(
        (await cdp.send("Performance.getMetrics")).metrics.map(
          (metric: { name: string; value: number }) => [metric.name, metric.value],
        ),
      )
    : undefined;
  const samples = await page.evaluate(() => {
    const probe = (window as Window & { __sourcePerf?: { samples: unknown[]; stop: () => void } })
      .__sourcePerf!;
    probe.stop();
    return probe.samples;
  });
  const gaps = samples
    .map((sample) => (sample as { gapMs: number }).gapMs)
    .filter((gap) => gap > 0)
    .toSorted((a, b) => a - b);
  const cpu =
    before && after
      ? Object.fromEntries(
          ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration"].map(
            (name) => [name, (after[name] ?? 0) - (before[name] ?? 0)],
          ),
        )
      : null;
  await writeFile(
    resolve(folder, "source-100k-metrics.json"),
    JSON.stringify(
      {
        browser: testInfo.project.name,
        browserVersion: page.context().browser()?.version(),
        scenario: "100k indexed items; open near end, navigate once, close",
        openCallMs: Math.round(openMs * 100) / 100,
        initialNodes,
        openedNodes,
        closedNodes,
        slides,
        thumbnails,
        p95FrameGapMs: gaps[Math.floor(gaps.length * 0.95)] ?? null,
        maxFrameGapMs: Math.max(...gaps),
        gapsOver50Ms: gaps.filter((gap) => gap > 50).length,
        cpuSeconds: cpu,
        samples,
      },
      null,
      2,
    ),
  );
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(resolve(folder, "source-100k.webm"));
});
