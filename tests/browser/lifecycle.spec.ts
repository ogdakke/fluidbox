import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    fb: import("@ogdakke/fluidbox").Fluidbox;
  }
}

async function setup(page: Page, reducedMotion = false) {
  if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lifecycle.html");
  await page.waitForFunction(() => "lifecycleReady" in document.body.dataset);
  await page.evaluate(async () => {
    const { createFluidbox, items, origins } = window.lifecycle;
    window.fb = createFluidbox({ items, origins });
    for (const trigger of document.querySelectorAll<HTMLElement>("[data-photo-id]")) {
      window.fb.bind(trigger, trigger.dataset.photoId!);
    }
    await window.fb.load();
  });
}

/** What the page shows once the viewer is gone. */
function leftovers(page: Page) {
  return page.evaluate(() => ({
    inert: [...document.querySelectorAll("[inert]")].map((node) => node.tagName),
    overlays: document.querySelectorAll("[data-fluidbox-overlay]").length,
    flights: document.querySelectorAll("[data-fluidbox-flight]").length,
  }));
}

const clean = { inert: [], overlays: 0, flights: 0 };

for (const reducedMotion of [false, true]) {
  const motion = reducedMotion ? "with reduced motion" : "with motion";

  test(`an open destroyed before its slide is selected leaves the page usable ${motion}`, async ({
    page,
  }) => {
    await setup(page, reducedMotion);
    const result = await page.evaluate(async () => {
      const opening = window.fb.open(0);
      window.fb.destroy();
      return opening;
    });
    expect(result).toBe(false);
    await page.evaluate(() => document.body.append(document.createElement("aside")));
    expect(await leftovers(page)).toEqual(clean);
  });

  test(`an open closed before its slide is selected settles closed ${motion}`, async ({ page }) => {
    await setup(page, reducedMotion);
    const results = await page.evaluate(async () => {
      const opening = window.fb.open(0);
      const closing = window.fb.close();
      return Promise.allSettled([opening, closing]).then((all) =>
        all.map((each) => (each.status === "fulfilled" ? each.value : String(each.reason))),
      );
    });
    expect(results).toEqual([false, true]);
    expect(await page.evaluate(() => window.fb.state.status)).toBe("closed");
    expect(await leftovers(page)).toEqual(clean);
    // It still opens afterwards.
    expect(await page.evaluate(() => window.fb.open(1))).toBe(true);
    await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
      "data-fluidbox-status",
      "open",
    );
  });

  test(`an open emptied before its slide is selected settles closed ${motion}`, async ({
    page,
  }) => {
    await setup(page, reducedMotion);
    const results = await page.evaluate(async () => {
      const opening = window.fb.open(0);
      const emptying = window.fb.setItems([]);
      return Promise.allSettled([opening, emptying]).then((all) =>
        all.map((each) => (each.status === "fulfilled" ? each.value : String(each.reason))),
      );
    });
    expect(results).toEqual([false, true]);
    expect(await page.evaluate(() => window.fb.state.status)).toBe("closed");
    expect(await leftovers(page)).toEqual(clean);
  });
}

/**
 * Random sequences of commands, some issued in one task and some a microtask,
 * a frame or a moment apart. Whatever the order, every command settles, the
 * state ends where the page shows it, and a final close or destroy leaves
 * nothing behind. A failure names its seed; FLUIDBOX_FUZZ_SEED replays it.
 */
const seeds = (() => {
  // "13" replays one seed, "1-200" sweeps a range.
  const [first, last = first] = (process.env.FLUIDBOX_FUZZ_SEED ?? "").split("-").map(Number);
  if (!first) return [1, 2, 3, 5, 8, 13, 21, 34];
  return Array.from({ length: last! - first + 1 }, (_, index) => first + index);
})();

for (const reducedMotion of [false, true]) {
  for (const seed of seeds) {
    test(`random command sequences settle cleanly, seed ${seed}${reducedMotion ? ", reduced motion" : ""}`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await setup(page, reducedMotion);
      const report = await page.evaluate(
        async ({ seed, steps }) => {
          // mulberry32
          let state = seed >>> 0;
          const random = () => {
            state = (state + 0x6d2b79f5) >>> 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
          };
          const pick = <T>(choices: readonly T[]) =>
            choices[Math.floor(random() * choices.length)]!;
          const { createFluidbox, items, origins } = window.lifecycle;
          const make = () => {
            const fluidbox = createFluidbox({ items, origins });
            for (const trigger of document.querySelectorAll<HTMLElement>("[data-photo-id]")) {
              fluidbox.bind(trigger, trigger.dataset.photoId!);
            }
            return fluidbox;
          };
          let fluidbox = window.fb;
          const pending = new Map<number, string>();
          const promises: Promise<unknown>[] = [];
          const errors: string[] = [];
          const log: string[] = [];
          const track = (label: string, run: () => Promise<unknown>) => {
            const id = promises.length;
            pending.set(id, label);
            let promise: Promise<unknown>;
            try {
              promise = run();
            } catch (error) {
              promise = Promise.reject(error);
            }
            promises.push(
              promise.then(
                () => pending.delete(id),
                (error: unknown) => {
                  pending.delete(id);
                  // Unknown targets after new items are the caller's mistake, not the viewer's.
                  const unknown =
                    error instanceof RangeError &&
                    /^Fluidbox item index is out of range/.test(error.message);
                  if (!unknown) errors.push(`${label}: ${String(error)}`);
                },
              ),
            );
          };
          const subsets = [
            items,
            [items[1]!, items[0]!, items[2]!],
            [items[0]!],
            [items[2]!, items[1]!],
            [],
          ];
          for (let step = 0; step < steps; step++) {
            const roll = random();
            if (roll < 0.3) {
              const index = Math.floor(random() * 3);
              log.push(`open(${index})`);
              track(`open(${index})#${step}`, () => fluidbox.open(index));
            } else if (roll < 0.5) {
              log.push("close()");
              track(`close#${step}`, () => fluidbox.close());
            } else if (roll < 0.65) {
              log.push("next()");
              track(`next#${step}`, () => fluidbox.next());
            } else if (roll < 0.75) {
              log.push("previous()");
              track(`previous#${step}`, () => fluidbox.previous());
            } else if (roll < 0.92) {
              const next = pick(subsets);
              log.push(`setItems(${next.length})`);
              track(`setItems(${next.length})#${step}`, () => fluidbox.setItems([...next]));
            } else {
              log.push("destroy()");
              fluidbox.destroy();
              fluidbox = make();
              window.fb = fluidbox;
            }
            const wait = random();
            if (wait < 0.35) continue;
            if (wait < 0.6) {
              const ticks = 1 + Math.floor(random() * 4);
              log.push(`microtasks(${ticks})`);
              for (let tick = 0; tick < ticks; tick++) await Promise.resolve();
            } else if (wait < 0.8) {
              log.push("frame");
              await new Promise((resolve) => requestAnimationFrame(resolve));
            } else {
              const ms = Math.floor(random() * 400);
              log.push(`wait(${ms})`);
              await new Promise((resolve) => setTimeout(resolve, ms));
            }
          }
          const settle = (ms: number) =>
            Promise.race([
              Promise.allSettled(promises),
              new Promise((resolve) => setTimeout(resolve, ms)),
            ]);
          await settle(10_000);
          const unsettled = [...pending.values()];
          const status = fluidbox.state.status;
          const dialog = document.querySelector("[data-fluidbox-dialog]");
          const settled = `${status} ${fluidbox.state.index}, viewer ${dialog ? dialog.getAttribute("data-fluidbox-status") : "gone"}`;
          const consistent =
            status === "closed"
              ? !document.querySelector("[data-fluidbox-overlay]")
              : status === "open" && dialog?.getAttribute("data-fluidbox-status") === "open";
          const final = random() < 0.5 ? "close" : "destroy";
          log.push(final);
          let closed: unknown = true;
          if (final === "close") closed = await fluidbox.close();
          else fluidbox.destroy();
          await new Promise((resolve) => requestAnimationFrame(resolve));
          return {
            log: log.join(" "),
            unsettled,
            errors,
            settled,
            consistent,
            closed,
            finalStatus: fluidbox.state.status,
            inert: document.querySelectorAll("[inert]").length,
            overlays: document.querySelectorAll("[data-fluidbox-overlay]").length,
            flights: document.querySelectorAll("[data-fluidbox-flight]").length,
          };
        },
        { seed, steps: 40 },
      );
      expect(report, `${report.log}\n${report.settled}`).toMatchObject({
        unsettled: [],
        errors: [],
        consistent: true,
        closed: true,
        finalStatus: "closed",
        inert: 0,
        overlays: 0,
        flights: 0,
      });
    });
  }
}
