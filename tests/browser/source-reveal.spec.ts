import { expect, test } from "@playwright/test";

test("explicit and keyboard selection reclaim an unsettled filmstrip", async ({ page }) => {
  await page.goto("/harness.html?virtual&count=1000");
  const gallery = page.locator("fluidbox-gallery");
  await gallery.evaluate((element: HTMLElement & { open(target: number): Promise<boolean> }) =>
    element.open(10),
  );
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-state",
    "open",
  );
  const handoff = await gallery.evaluate(
    (element: HTMLElement & { open(target: number): Promise<boolean> }) => {
      const scroller = document.querySelector<HTMLElement>("[data-fluidbox-filmstrip-scroll]")!;
      const style = getComputedStyle(scroller);
      const filmstrip = scroller.closest<HTMLElement>("[data-fluidbox-filmstrip]")!;
      const size = Number.parseFloat(
        getComputedStyle(filmstrip).getPropertyValue("--fluidbox-filmstrip-item-size"),
      );
      const step = size + Number.parseFloat(style.columnGap);
      const selectedLabel = () =>
        document
          .querySelector('[data-fluidbox-slide][aria-hidden="false"]')
          ?.getAttribute("aria-label");
      const beginUnsettledScroll = () => {
        scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: -80 }));
        scroller.scrollTo({ left: 9 * step, behavior: "instant" });
      };
      beginUnsettledScroll();
      void element.open(10);
      scroller.dispatchEvent(new Event("scrollend"));
      const sameIndex = selectedLabel();
      beginUnsettledScroll();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      scroller.dispatchEvent(new Event("scrollend"));
      return { sameIndex, afterKeyboard: selectedLabel() };
    },
  );
  expect(handoff.sameIndex).toBe("Item 11 of 1000");
  expect(handoff.afterKeyboard).toBe("Item 11 of 1000");
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 12 of 1000",
  );
  // Filmstrip's native settle timer is 160ms; the new selection must survive it.
  await page.waitForTimeout(220);
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 12 of 1000",
  );
});

test("a mounted indexed origin follows selection inside its scroll container", async ({ page }) => {
  await page.goto("/harness.html?virtual&count=1000&no-filmstrip");
  await page.evaluate(() => {
    const gallery = document.querySelector("fluidbox-gallery")!;
    const scroller = document.createElement("div");
    scroller.id = "host-scroll";
    Object.assign(scroller.style, { height: "120px", width: "180px", overflow: "auto" });
    for (const button of gallery.querySelectorAll<HTMLElement>("[data-virtual-index]")) {
      Object.assign(button.style, { display: "block", height: "70px", width: "100%" });
      scroller.append(button);
    }
    gallery.prepend(scroller);
  });
  const gallery = page.locator("fluidbox-gallery");
  await gallery.evaluate((element: HTMLElement & { open(target: number): Promise<boolean> }) =>
    element.open(0),
  );
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-state",
    "open",
  );
  await gallery.evaluate((element: HTMLElement & { open(target: number): Promise<boolean> }) =>
    element.open(10),
  );
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 11 of 1000",
  );
  await expect
    .poll(() => page.locator("#host-scroll").evaluate((node) => node.scrollTop))
    .toBeGreaterThan(500);

  // A mounted origin outside a nested scrollport is not a usable close target.
  const close = await gallery.evaluate(
    async (element: HTMLElement & { close(): Promise<unknown> }) => {
      document.querySelector<HTMLElement>("#host-scroll")!.scrollTop = 0;
      const started = performance.now();
      await element.close();
      return {
        elapsed: performance.now() - started,
        flightMounted: !!document.querySelector("[data-fluidbox-flight]"),
      };
    },
  );
  expect(close.elapsed).toBeLessThan(1000);
  expect(close.flightMounted).toBe(false);
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  await expect(gallery.locator('[data-virtual-index="10"]')).toBeFocused();
});

test("stale async reveals abort on rapid selection and close never waits", async ({ page }) => {
  await page.goto("/harness.html?virtual&count=1000&no-filmstrip");
  await page.evaluate(() => {
    const gallery = document.querySelector<
      HTMLElement & {
        origins: {
          getOrigin(id: string): null;
          revealOrigin?: (
            id: string,
            index: number,
            context: { signal: AbortSignal; reason: "open" | "selection" },
          ) => Promise<void>;
        };
      }
    >("fluidbox-gallery")!;
    const events: {
      id: string;
      reason: string;
      aborted: boolean;
      completed: boolean;
      attempt(): void;
    }[] = [];
    Object.assign(window, { __revealEvents: events });
    gallery.origins = {
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
  const gallery = page.locator("fluidbox-gallery");
  await gallery.evaluate((element: HTMLElement & { open(target: number): Promise<boolean> }) =>
    element.open(0),
  );
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-state",
    "open",
  );
  await gallery.evaluate((element: HTMLElement & { open(target: number): Promise<boolean> }) => {
    void element.open(1);
    void element.open(0);
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
  const afterClose = await gallery.evaluate(
    async (element: HTMLElement & { close(): Promise<unknown> }) => {
      const started = performance.now();
      await element.close();
      return {
        elapsed: performance.now() - started,
        events: (
          window as unknown as { __revealEvents: { aborted: boolean }[] }
        ).__revealEvents.map((event) => event.aborted),
      };
    },
  );
  expect(afterClose.elapsed).toBeLessThan(1000);
  expect(afterClose.events[0]).toBe(true);
  expect(afterClose.events.at(-1)).toBe(true);
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
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

test("item replacement and disconnect abort pending origin reveals", async ({ page }) => {
  await page.goto("/harness.html?virtual&count=2&no-filmstrip");
  const events = await page.evaluate(async () => {
    const gallery = document.querySelector<
      HTMLElement & {
        items: {
          count: number;
          get(index: number): unknown;
          indexOf?(id: string): number;
        } | null;
        origins: {
          getOrigin(id: string): null;
          revealOrigin(
            id: string,
            index: number,
            context: { signal: AbortSignal; reason: "open" | "selection" },
          ): Promise<void>;
        };
        open(target: number): Promise<boolean>;
        close(): Promise<unknown>;
      }
    >("fluidbox-gallery")!;
    const original = gallery.items!;
    const events: { source: string; aborted: boolean }[] = [];
    Object.assign(window, { __swapEvents: events });
    const makeItems = () => ({
      count: original.count,
      get: (index: number) => original.get(index),
      indexOf: (id: string) => original.indexOf!(id),
    });
    const makeOrigins = (name: string) => ({
      getOrigin: () => null,
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
    gallery.origins = makeOrigins("old");
    gallery.items = makeItems();
    await Promise.resolve();
    await gallery.open(0);
    gallery.origins = makeOrigins("new");
    gallery.items = makeItems();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const oldAbortedOnReplace = events[0]?.aborted;
    if (events.length < 2) throw new Error("replacement items did not request an origin reveal");
    gallery.remove();
    return { oldAbortedOnReplace, events: events.map((event) => ({ ...event })) };
  });
  expect(events.oldAbortedOnReplace).toBe(true);
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  expect(events.events).toEqual([
    { source: "old", aborted: true },
    { source: "new", aborted: true },
  ]);
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
});

test("one-item indexed source handles reveal failures without leaking its session", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/harness.html?virtual&count=1&no-filmstrip");
  const gallery = page.locator("fluidbox-gallery");
  await gallery.evaluate((element: HTMLElement & { origins: unknown }) => {
    element.origins = {
      getOrigin: () => null,
      revealOrigin() {
        return Promise.reject(new Error("intentional reveal failure"));
      },
    };
  });
  await gallery.evaluate((element: HTMLElement & { open(target: number): Promise<boolean> }) =>
    element.open(0),
  );
  await expect(page.locator('[data-fluidbox-slide][aria-hidden="false"]')).toHaveAttribute(
    "aria-label",
    "Item 1 of 1",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  await gallery.evaluate((element: HTMLElement & { origins: unknown }) => {
    element.origins = {
      getOrigin: () => null,
      revealOrigin() {
        throw new Error("intentional synchronous reveal failure");
      },
    };
  });
  await gallery.evaluate((element: HTMLElement & { open(target: number): Promise<boolean> }) =>
    element.open(0),
  );
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveAttribute(
    "data-fluidbox-state",
    "open",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-fluidbox-dialog]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
