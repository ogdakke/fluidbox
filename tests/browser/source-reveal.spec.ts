import { expect, test } from "@playwright/test";

test("explicit and keyboard selection reclaim an unsettled filmstrip", async ({ page }) => {
  await page.goto("/harness.html?virtual&count=1000");
  const gallery = page.locator("app-gallery");
  await gallery.evaluate((element: HTMLElement & { open(index: number): void }) =>
    element.open(10),
  );
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  const handoff = await gallery.evaluate((element: HTMLElement & { open(index: number): void }) => {
    const scroller = document.querySelector<HTMLElement>("[data-lightbox-filmstrip-scroll]")!;
    const style = getComputedStyle(scroller);
    const filmstrip = scroller.closest<HTMLElement>("[data-lightbox-filmstrip]")!;
    const size = Number.parseFloat(
      getComputedStyle(filmstrip).getPropertyValue("--lightbox-filmstrip-item-size"),
    );
    const step = size + Number.parseFloat(style.columnGap);
    const selectedLabel = () =>
      document
        .querySelector('[data-lightbox-slide][aria-hidden="false"]')
        ?.getAttribute("aria-label");
    const beginUnsettledScroll = () => {
      scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: -80 }));
      scroller.scrollTo({ left: 9 * step, behavior: "instant" });
    };
    beginUnsettledScroll();
    element.open(10);
    scroller.dispatchEvent(new Event("scrollend"));
    const sameIndex = selectedLabel();
    beginUnsettledScroll();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    scroller.dispatchEvent(new Event("scrollend"));
    return { sameIndex, afterKeyboard: selectedLabel() };
  });
  expect(handoff.sameIndex).toBe("Item 11 of 1000");
  expect(handoff.afterKeyboard).toBe("Item 11 of 1000");
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 12 of 1000",
  );
  // Filmstrip's native settle timer is 160ms; the new selection must survive it.
  await page.waitForTimeout(220);
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 12 of 1000",
  );
});

test("a mounted indexed origin follows selection inside its scroll container", async ({ page }) => {
  await page.goto("/harness.html?virtual&count=1000&no-filmstrip");
  await page.evaluate(() => {
    const gallery = document.querySelector("app-gallery")!;
    const scroller = document.createElement("div");
    scroller.id = "host-scroll";
    Object.assign(scroller.style, { height: "120px", width: "180px", overflow: "auto" });
    for (const button of gallery.querySelectorAll<HTMLElement>("[data-virtual-index]")) {
      Object.assign(button.style, { display: "block", height: "70px", width: "100%" });
      scroller.append(button);
    }
    gallery.prepend(scroller);
  });
  const gallery = page.locator("app-gallery");
  await gallery.evaluate((element: HTMLElement & { open(index: number): void }) => element.open(0));
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await gallery.evaluate((element: HTMLElement & { open(index: number): void }) =>
    element.open(10),
  );
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 11 of 1000",
  );
  await expect
    .poll(() => page.locator("#host-scroll").evaluate((node) => node.scrollTop))
    .toBeGreaterThan(500);

  // A mounted origin outside a nested scrollport is not a usable close target.
  const close = await gallery.evaluate(() => {
    document.querySelector<HTMLElement>("#host-scroll")!.scrollTop = 0;
    const controller = document.querySelector<HTMLElement & { close(): void }>(
      "[data-lightbox-source-controller]",
    )!;
    controller.close();
    const flight = document.querySelector<HTMLElement>(
      "[data-lightbox-flight] > [data-lightbox-frame]",
    )!;
    const animation = flight.getAnimations()[0]!;
    const duration = Number(animation.effect?.getComputedTiming().duration);
    for (const track of document.getAnimations()) {
      track.pause();
      track.currentTime = duration - 1;
    }
    const endOpacity = Number(getComputedStyle(flight).opacity);
    for (const track of document.getAnimations()) track.play();
    return endOpacity;
  });
  expect(close).toBeLessThan(0.1);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  await expect(gallery).toBeFocused();
});

test("stale async reveals abort on rapid selection and close never waits", async ({ page }) => {
  await page.goto("/harness.html?virtual&count=1000&no-filmstrip");
  await page.evaluate(() => {
    const gallery = document.querySelector<
      HTMLElement & {
        source: {
          count: number;
          getItem(index: number): { id: string; src: string };
          getOrigin?(id: string): HTMLElement | null;
          revealOrigin?: (
            id: string,
            index: number,
            context: { signal: AbortSignal; reason: "open" | "selection" },
          ) => Promise<void>;
        };
      }
    >("app-gallery")!;
    const original = gallery.source;
    const events: {
      id: string;
      reason: string;
      aborted: boolean;
      completed: boolean;
      attempt(): void;
    }[] = [];
    Object.assign(window, { __revealEvents: events });
    gallery.source = {
      count: original.count,
      getItem: (index) => original.getItem(index),
      getOrigin: () => null,
      revealOrigin(id, _index, { signal, reason }) {
        return new Promise<void>((resolve) => {
          const event = {
            id,
            reason,
            aborted: false,
            completed: false,
            attempt() {
              if (!signal.aborted) event.completed = true;
              resolve();
            },
          };
          events.push(event);
          signal.addEventListener(
            "abort",
            () => {
              event.aborted = true;
              resolve();
            },
            { once: true },
          );
        });
      },
    };
  });
  const gallery = page.locator("app-gallery");
  await gallery.evaluate((element: HTMLElement & { open(index: number): void }) => element.open(0));
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await gallery.evaluate((element: HTMLElement & { open(index: number): void }) => {
    element.open(1);
    element.open(0);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { __revealEvents: { id: string; reason: string }[] }
          ).__revealEvents.filter((event) => event.id === "0" && event.reason === "selection")
            .length,
      ),
    )
    .toBe(1);
  const afterClose = await gallery.evaluate(() => {
    const controller = document.querySelector<HTMLElement & { close(): void }>(
      "[data-lightbox-source-controller]",
    )!;
    controller.close();
    const frame = document.querySelector<HTMLElement>(
      "[data-lightbox-flight] > [data-lightbox-frame]",
    )!;
    const duration = Number(frame.getAnimations()[0]?.effect?.getComputedTiming().duration);
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = duration - 1;
    }
    const fallbackEndOpacity = Number(getComputedStyle(frame).opacity);
    for (const animation of document.getAnimations()) animation.play();
    return {
      flightMounted: !!document.querySelector("[data-lightbox-flight]"),
      fallbackEndOpacity,
      events: (window as unknown as { __revealEvents: { aborted: boolean }[] }).__revealEvents.map(
        (event) => event.aborted,
      ),
    };
  });
  expect(afterClose.flightMounted).toBe(true);
  expect(afterClose.fallbackEndOpacity).toBeLessThan(0.1);
  expect(afterClose.events[0]).toBe(true);
  expect(afterClose.events.at(-1)).toBe(true);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  const events = await page.evaluate(() => {
    const events = (
      window as unknown as {
        __revealEvents: {
          id: string;
          reason: string;
          aborted: boolean;
          completed: boolean;
          attempt(): void;
        }[];
      }
    ).__revealEvents;
    for (const event of events) event.attempt();
    return events.map(({ id, reason, aborted, completed }) => ({ id, reason, aborted, completed }));
  });
  expect(events.every((event) => !event.completed)).toBe(true);
});

test("source replacement and teardown abort reveals; a new session uses the new source", async ({
  page,
}) => {
  await page.goto("/harness.html?virtual&count=2&no-filmstrip");
  const events = await page.evaluate(() => {
    const gallery = document.querySelector<
      HTMLElement & {
        source: {
          count: number;
          getItem(index: number): { id: string; src: string };
          getOrigin?(id: string): HTMLElement | null;
          revealOrigin?: (
            id: string,
            index: number,
            context: { signal: AbortSignal; reason: "open" | "selection" },
          ) => Promise<void>;
        } | null;
        open(index: number): void;
      }
    >("app-gallery")!;
    const original = gallery.source!;
    const events: { source: string; aborted: boolean }[] = [];
    Object.assign(window, { __swapEvents: events });
    const makeSource = (name: string) => ({
      count: original.count,
      getItem: (index: number) => original.getItem(index),
      getOrigin: (id: string) => original.getOrigin?.(id) ?? null,
      revealOrigin(_id: string, _index: number, { signal }: { signal: AbortSignal }) {
        const event = { source: name, aborted: false };
        events.push(event);
        return new Promise<void>((resolve) => {
          signal.addEventListener(
            "abort",
            () => {
              event.aborted = true;
              resolve();
            },
            { once: true },
          );
        });
      },
    });
    gallery.source = makeSource("old");
    gallery.open(0);
    gallery.source = makeSource("new");
    const oldAbortedOnReplace = events[0]?.aborted;
    const controller = gallery.querySelector<HTMLElement & { close(): void }>(
      "[data-lightbox-source-controller]",
    )!;
    controller.close();
    return { oldAbortedOnReplace, events };
  });
  expect(events.oldAbortedOnReplace).toBe(true);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  const gallery = page.locator("app-gallery");
  await gallery.evaluate((element: HTMLElement & { open(index: number): void }) => element.open(0));
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  const state = await gallery.evaluate((element: HTMLElement & { source: unknown }) => {
    const controller = element.querySelector<HTMLElement>("[data-lightbox-source-controller]")!;
    element.source = null;
    return {
      controllerConnected: controller.isConnected,
      events: (window as unknown as { __swapEvents: { source: string; aborted: boolean }[] })
        .__swapEvents,
    };
  });
  expect(state.controllerConnected).toBe(false);
  expect(state.events).toEqual([
    { source: "old", aborted: true },
    { source: "new", aborted: true },
  ]);
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
});

test("one-item indexed source handles reveal failures without leaking its session", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/harness.html?virtual&count=1&no-filmstrip");
  const gallery = page.locator("app-gallery");
  await gallery.evaluate((element: HTMLElement & { source: unknown }) => {
    const original = element.source as {
      count: number;
      getItem(index: number): { id: string; src: string };
      getOrigin?(id: string): HTMLElement | null;
    };
    element.source = {
      count: original.count,
      getItem: (index: number) => original.getItem(index),
      getOrigin: (id: string) => original.getOrigin?.(id) ?? null,
      revealOrigin() {
        return Promise.reject(new Error("intentional reveal failure"));
      },
    };
  });
  await gallery.evaluate((element: HTMLElement & { open(index: number): void }) => element.open(0));
  await expect(page.locator('[data-lightbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 1 of 1",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  await gallery.evaluate((element: HTMLElement & { source: unknown }) => {
    const original = element.source as {
      count: number;
      getItem(index: number): { id: string; src: string };
      getOrigin?(id: string): HTMLElement | null;
    };
    element.source = {
      count: original.count,
      getItem: (index: number) => original.getItem(index),
      getOrigin: (id: string) => original.getOrigin?.(id) ?? null,
      revealOrigin() {
        throw new Error("intentional synchronous reveal failure");
      },
    };
  });
  await gallery.evaluate((element: HTMLElement & { open(index: number): void }) => element.open(0));
  await expect(page.locator("[data-lightbox-dialog]")).toHaveAttribute(
    "data-lightbox-state",
    "open",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-lightbox-dialog]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
