import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmbeddedViewRef, NgZone } from "@angular/core";
import type { FluidboxSlide } from "@ogdakke/fluidbox";
import { holdForDeferred } from "../src/mount";

// Angular's view data as the binding reads it: a view's TView at 1, its first
// child at 12, a defer block's details in the TView's data and in the view.
const DEFER_SLOT = 30;

function view(
  defer?: { state: number; next?: number | null; loading?: number },
  child?: unknown[],
) {
  const data: unknown[] = [];
  const lView: unknown[] = [];
  lView[1] = { type: 2, data };
  lView[12] = child ?? null;
  if (defer) {
    data[DEFER_SLOT] = { primaryTmplIndex: 31, loadingState: defer.loading ?? 0 };
    lView[DEFER_SLOT] = [defer.next ?? null, defer.state];
  }
  return lView;
}

/** A container holding one view, as a child of a view. */
const container = (inner: unknown[]) => {
  const lContainer: unknown[] = [];
  lContainer[1] = true;
  lContainer[4] = null;
  lContainer[10] = inner;
  return lContainer;
};

const ref = (lView: unknown) => ({ _lView: lView }) as unknown as EmbeddedViewRef<unknown>;
const zone = { runOutsideAngular: <T>(run: () => T) => run() } as NgZone;

let frames: (() => void)[] = [];
const flush = () => {
  const due = frames;
  frames = [];
  for (const run of due) run();
};

function slide({ active = true, opening = true } = {}) {
  const controller = new AbortController();
  const waits: Promise<unknown>[] = [];
  const listeners = new Set<(active: boolean) => void>();
  const settled = new Set<Promise<unknown>>();
  const fake = {
    active,
    opening,
    signal: controller.signal,
    waitUntil: (promise: Promise<unknown>) => {
      waits.push(promise);
      void promise.then(() => settled.add(promise));
    },
    onActiveChange: (listener: (active: boolean) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    slide: fake as unknown as FluidboxSlide<any>,
    fake,
    waits,
    abort: () => controller.abort(),
    activate: () => {
      fake.active = true;
      for (const listener of listeners) listener(true);
    },
    /** Whether every waitUntil promise has settled, once pending callbacks ran. */
    released: async () => {
      await Promise.resolve();
      await Promise.resolve();
      return waits.every((promise) => settled.has(promise));
    },
  };
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (run: () => void) => frames.push(run));
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a slide's @defer hold", () => {
  it("holds nothing without a @defer, or once every block shows", () => {
    const held = slide();
    holdForDeferred(
      zone,
      () => [ref(view()), ref(view({ state: 2 })), ref(view({ state: 3 }))],
      held.slide,
    );
    expect(held.waits).toEqual([]);
    expect(frames).toEqual([]);
  });

  it("holds while a block loads, and stops checking once it shows", async () => {
    const lView = view({ state: 1 });
    const held = slide();
    holdForDeferred(zone, () => [ref(lView)], held.slide);
    expect(held.waits).toHaveLength(1);
    for (let frame = 0; frame < 5; frame++) flush();
    expect(await held.released()).toBe(false);
    (lView[DEFER_SLOT] as unknown[])[1] = 2;
    flush();
    expect(await held.released()).toBe(true);
    expect(frames).toEqual([]);
  });

  it("counts a block whose dependencies load, or whose next state is set, as loading", async () => {
    for (const defer of [
      { state: 0, loading: 1 },
      { state: 0, next: 1 },
      { state: -1, next: 2 },
    ]) {
      const held = slide();
      holdForDeferred(zone, () => [ref(view(defer))], held.slide);
      for (let frame = 0; frame < 5; frame++) flush();
      expect(await held.released()).toBe(false);
      held.abort();
    }
  });

  it("finds a block in a view nested in a container", async () => {
    const held = slide();
    holdForDeferred(zone, () => [ref(view(undefined, container(view({ state: 1 }))))], held.slide);
    for (let frame = 0; frame < 5; frame++) flush();
    expect(await held.released()).toBe(false);
  });

  it("lets go of a block still on its placeholder after two frames, which waits for something else", async () => {
    const held = slide();
    holdForDeferred(zone, () => [ref(view({ state: 0 }))], held.slide);
    expect(held.waits).toHaveLength(1);
    flush();
    flush();
    expect(await held.released()).toBe(false);
    flush();
    expect(await held.released()).toBe(true);
    expect(frames).toEqual([]);
  });

  it("checks a slide only while it is opening or on show", async () => {
    const lView = view({ state: 1 });
    const held = slide({ active: false, opening: false });
    holdForDeferred(zone, () => [ref(lView)], held.slide);
    flush();
    expect(frames).toEqual([]);
    held.activate();
    expect(frames).toHaveLength(1);
    (lView[DEFER_SLOT] as unknown[])[1] = 2;
    flush();
    expect(await held.released()).toBe(true);
  });

  it("lets go when the slide goes", async () => {
    const held = slide();
    holdForDeferred(zone, () => [ref(view({ state: 1 }))], held.slide);
    held.abort();
    expect(await held.released()).toBe(true);
  });

  it("warns in development, and holds nothing, for view data it can't read", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const held = slide();
    holdForDeferred(zone, () => [ref({ shape: "new" })], held.slide);
    expect(held.waits).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/can't read Angular .*'s view data/);
    expect(String(warn.mock.calls[0]![0])).toContain("waitUntil()");
  });
});
