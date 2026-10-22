import { describe, expect, it, vi } from "vitest";
import { FluidboxRuntime, type FluidboxRuntimeDriver } from "../src/create-fluidbox";
import { hostOf } from "../src/host";
import type {
  FluidboxItem,
  FluidboxItemChangeEvent,
  FluidboxZoomEvent,
  FluidboxOptions,
  FluidboxToggleEvent,
} from "../src/public-api";
import type { ViewerSessionCloseContext, ViewerSessionMotionContext } from "../src/runtime-types";

const items = [
  { id: "one", type: "img", src: "/one.jpg", alt: "One", width: 1200, height: 800 },
  { id: "two", type: "img", src: "/two.jpg", alt: "Two", width: 1200, height: 800 },
  { id: "three", type: "img", src: "/three.jpg", alt: "Three", width: 1200, height: 800 },
] as const satisfies readonly FluidboxItem[];

type Item = (typeof items)[number];

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

/** The viewer, without a viewer: it records each motion and finishes it when told. */
class TestDriver {
  readonly preparations: Array<{ item: Item; index: number; origin: null }> = [];
  preparationDisposed = false;
  readonly opens: ViewerSessionMotionContext<Item>[] = [];
  readonly selections: ViewerSessionMotionContext<Item>[] = [];
  readonly closes: AbortSignal[] = [];
  readonly closeOrigins: ViewerSessionCloseContext["origin"][] = [];
  readonly sourceUpdates: unknown[] = [];
  readonly steps: Deferred[] = [];
  destroyed = false;
  registerThumbnailOverlay: (...args: unknown[]) => void | (() => void) = () => {};
  controller: { zoomed?(scale: number, reason?: string): void } | undefined;
  readonly zooms: Array<{ scale: number; reason?: string; origin?: unknown }> = [];
  connect(controller: TestDriver["controller"]) {
    this.controller = controller;
  }
  zoomTo(scale: number, options: { reason?: string; origin?: unknown }) {
    this.zooms.push({ scale, reason: options.reason, origin: options.origin });
    // The zoom comes to rest at once, as with reduced motion.
    this.controller?.zoomed?.(scale, options.reason);
    return Promise.resolve(true);
  }
  setZoom() {}
  setLoop() {}
  relabel() {}
  setPortal() {}
  setExtensions() {}
  revealed() {}
  keepsThumbnail() {
    return false;
  }
  unload() {}

  setSource(source: unknown) {
    this.sourceUpdates.push(source);
  }

  prepare(context: { item: Item; index: number; origin: null }) {
    this.preparations.push(context);
    return () => {
      this.preparationDisposed = true;
    };
  }

  open(context: ViewerSessionMotionContext<Item>): Promise<void | boolean> {
    this.opens.push(context);
    return this.#step();
  }

  select(context: ViewerSessionMotionContext<Item>) {
    this.selections.push(context);
    return this.#step();
  }

  close({ signal, origin }: ViewerSessionCloseContext) {
    this.closes.push(signal);
    this.closeOrigins.push(origin);
    return this.#step();
  }

  destroy() {
    this.destroyed = true;
  }

  #step() {
    const step = deferred();
    this.steps.push(step);
    return step.promise;
  }
}

function make(driver: TestDriver, options: Partial<FluidboxOptions<Item>> = {}) {
  return new FluidboxRuntime<Item>(
    { items, ...options },
    driver as unknown as FluidboxRuntimeDriver<Item>,
  );
}

const eventTypes = ["beforetoggle", "toggle", "beforeitemchange", "itemchange", "settle"];

/** Each event the fluidbox dispatches, as `type` or `type:detail`. */
function record(fluidbox: EventTarget, into: string[]) {
  for (const type of eventTypes) {
    fluidbox.addEventListener(type, (event) => {
      if (event.type.endsWith("toggle")) {
        into.push(`${event.type}:${(event as FluidboxToggleEvent).newState}`);
      } else into.push(`${event.type}:${(event as FluidboxItemChangeEvent<Item>).id}`);
    });
  }
}

describe("the fluidbox runtime", () => {
  it("prepares a valid closed target without publishing state", () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);

    const dispose = fluidbox.preload("two");

    expect(driver.preparations).toEqual([{ item: items[1], index: 1, origin: null }]);
    expect(fluidbox.state).toMatchObject({ status: "closed", id: null });
    dispose();
    expect(driver.preparationDisposed).toBe(true);
    expect(() => fluidbox.preload("missing")).toThrow(RangeError);
  });

  it("publishes the open lifecycle and an immutable state", async () => {
    const driver = new TestDriver();
    const order: string[] = [];
    const revealOrigin = vi.fn();
    const fluidbox = make(driver, { origins: { getOrigin: () => null, revealOrigin } });
    record(fluidbox, order);
    fluidbox.subscribe((state) => order.push(`state:${state.status}:${state.id}`));

    const result = fluidbox.open("two");

    expect(Object.isFrozen(fluidbox.state)).toBe(true);
    expect(fluidbox.state).toMatchObject({
      status: "opening",
      id: "two",
      index: 1,
      item: items[1],
      hasPrevious: true,
      hasNext: true,
    });
    expect(order).toEqual([
      "beforetoggle:open",
      "state:opening:two",
      "toggle:open",
      "itemchange:two",
    ]);

    driver.steps[0]!.resolve();
    await expect(result).resolves.toBe(true);
    expect(order.slice(4)).toEqual(["state:open:two", "settle:two"]);
    expect(revealOrigin).toHaveBeenCalledWith("two", 1, expect.objectContaining({ phase: "open" }));
  });

  it("shares repeated pending commands and supersedes incompatible work", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);

    const first = fluidbox.open("one");
    const repeated = fluidbox.open("one");
    const replacement = fluidbox.open("three");
    await expect(first).resolves.toBe(false);
    await expect(repeated).resolves.toBe(false);
    expect(driver.opens).toHaveLength(2);
    expect(driver.opens[0]!.signal.aborted).toBe(true);
    expect(driver.opens[1]!.signal.aborted).toBe(false);

    driver.steps[1]!.resolve();
    await expect(replacement).resolves.toBe(true);
    expect(fluidbox.state).toMatchObject({ status: "open", id: "three" });
  });

  it("restores the state when a caller aborts a command", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);
    const controller = new AbortController();

    const opening = fluidbox.open("one", { signal: controller.signal });
    controller.abort();

    await expect(opening).resolves.toBe(false);
    expect(driver.opens[0]!.signal.aborted).toBe(true);
    expect(fluidbox.state).toMatchObject({ status: "closed", id: null });
  });

  it("rejects unknown targets and stops prevented commands before events or motion", async () => {
    const driver = new TestDriver();
    const events: string[] = [];
    const fluidbox = make(driver);
    fluidbox.addEventListener("beforetoggle", (event) => event.preventDefault());
    for (const type of ["toggle", "itemchange"]) {
      fluidbox.addEventListener(type, () => events.push(type));
    }

    await expect(fluidbox.open("missing")).rejects.toBeInstanceOf(RangeError);
    await expect(fluidbox.open(20)).rejects.toBeInstanceOf(RangeError);
    await expect(fluidbox.open("one")).resolves.toBe(false);
    expect(events).toEqual([]);
    expect(driver.opens).toEqual([]);
  });

  it("forwards overlay ownership and ignores stale registration cleanup", () => {
    const driver = new TestDriver();
    const firstDriverDispose = vi.fn();
    const secondDriverDispose = vi.fn();
    driver.registerThumbnailOverlay = vi
      .fn()
      .mockReturnValueOnce(firstDriverDispose)
      .mockReturnValueOnce(secondDriverDispose);
    const fluidbox = make(driver);
    const element = {} as HTMLElement;

    const disposeFirst = fluidbox.bindOverlay(element, "one");
    const disposeSecond = fluidbox.bindOverlay(element, "one");
    expect(firstDriverDispose).toHaveBeenCalledOnce();

    disposeFirst();
    expect(secondDriverDispose).not.toHaveBeenCalled();
    disposeSecond();
    expect(secondDriverDispose).toHaveBeenCalledOnce();
  });

  it("resolves a shared origin again after its close preview changes", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);
    const host = hostOf(fluidbox);
    const trigger = { isConnected: true } as HTMLElement;
    const thumbnail = {
      src: "/one.jpg",
      currentSrc: "",
      dataset: {},
      addEventListener() {},
    } as unknown as HTMLImageElement;
    const firstVisual = { isConnected: true } as HTMLElement;
    const secondVisual = { isConnected: true } as HTMLElement;
    let dispose = () => {};
    const onPreviewChange = vi.fn((item: FluidboxItem) => {
      thumbnail.src = item.type === "img" ? item.src : "";
      dispose();
      host.registerOrigin(["one", "two"], { trigger, visual: secondVisual, thumbnail });
    });
    dispose = host.registerOrigin(["one", "two"], {
      trigger,
      visual: firstVisual,
      thumbnail,
      onPreviewChange,
    });
    const opening = fluidbox.open("one");
    driver.steps[0]!.resolve();
    await opening;
    const selecting = fluidbox.next();
    driver.steps[1]!.resolve();
    await selecting;
    const closing = fluidbox.close();
    driver.steps[2]!.resolve();
    await closing;

    expect(onPreviewChange).toHaveBeenCalledWith(items[1], 1);
    expect(thumbnail.src).toBe("/two.jpg");
    expect(driver.closeOrigins[0]?.visual).toBe(secondVisual);
  });

  it("aborts host reveal on selection and closes without waiting for it", async () => {
    const driver = new TestDriver();
    const revealSignals: AbortSignal[] = [];
    const fluidbox = make(driver, {
      origins: {
        getOrigin: () => null,
        revealOrigin: (_id, _index, { signal }) => {
          revealSignals.push(signal);
          return new Promise(() => {});
        },
      },
    });

    const opening = fluidbox.open("one");
    driver.steps[0]!.resolve();
    await opening;
    expect(revealSignals[0]?.aborted).toBe(false);

    const selecting = fluidbox.next();
    expect(revealSignals[0]?.aborted).toBe(true);
    driver.steps[1]!.resolve();
    await selecting;
    expect(revealSignals[1]?.aborted).toBe(false);

    const closing = fluidbox.close();
    expect(revealSignals[1]?.aborted).toBe(true);
    expect(driver.closes).toHaveLength(1);
    driver.steps[2]!.resolve();
    await expect(closing).resolves.toBe(true);
  });

  it("follows an item through new items, clamps a removal, and closes on none", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);
    const opening = fluidbox.open("two");
    driver.steps[0]!.resolve();
    await opening;

    const preserving = fluidbox.setItems([items[1], items[0], items[2]]);
    driver.steps[1]!.resolve();
    await expect(preserving).resolves.toBe(true);
    expect(fluidbox.state).toMatchObject({ id: "two", index: 0 });

    const clamping = fluidbox.setItems([items[0], items[2]]);
    driver.steps[2]!.resolve();
    await expect(clamping).resolves.toBe(true);
    expect(fluidbox.state).toMatchObject({ id: "one", index: 0 });

    const closing = fluidbox.setItems([]);
    expect(driver.closes).toHaveLength(1);
    driver.steps[3]!.resolve();
    await expect(closing).resolves.toBe(true);
    expect(fluidbox.state).toMatchObject({ status: "closed", count: 0, id: null });
  });

  it("restarts an unfinished open when its items are replaced", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);

    const opening = fluidbox.open("two");
    const replacement = fluidbox.setItems([items[1], items[0]]);

    await expect(opening).resolves.toBe(false);
    expect(driver.opens).toHaveLength(2);
    expect(driver.opens[0]!.signal.aborted).toBe(true);
    driver.steps[1]!.resolve();
    await expect(replacement).resolves.toBe(true);
    expect(fluidbox.state).toMatchObject({ status: "open", id: "two", index: 0 });
  });

  it("keeps a close in progress when its items refresh", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);
    const opening = fluidbox.open("two");
    driver.steps[0]!.resolve();
    await opening;

    const closing = fluidbox.close();
    const update = fluidbox.setItems([...items]);

    await expect(update).resolves.toBe(true);
    expect(driver.closes).toHaveLength(1);
    expect(driver.closes[0]!.aborted).toBe(false);
    expect(driver.opens).toHaveLength(1);
    // The first came with the fluidbox.
    expect(driver.sourceUpdates).toHaveLength(1);
    driver.steps[1]!.resolve();
    await expect(closing).resolves.toBe(true);
    expect(driver.sourceUpdates).toHaveLength(2);
    expect(fluidbox.state).toMatchObject({ status: "closed", count: 3 });
  });

  it("rejects unexpected driver failures without leaving a pending command", async () => {
    const failure = new Error("motion failed");
    const driver = new TestDriver();
    driver.open = () => Promise.reject(failure);
    const fluidbox = make(driver);

    await expect(fluidbox.open("one")).rejects.toBe(failure);
    expect(fluidbox.state).toMatchObject({ status: "closed", id: null });
    await expect(fluidbox.close()).resolves.toBe(true);
  });

  it("aborts pending work on an idempotent destroy, and then does nothing", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);
    const opening = fluidbox.open("one");

    fluidbox.destroy();
    fluidbox.destroy();

    await expect(opening).resolves.toBe(false);
    expect(driver.opens[0]!.signal.aborted).toBe(true);
    expect(driver.destroyed).toBe(true);
    await expect(fluidbox.open("two")).resolves.toBe(false);
    expect(driver.opens).toHaveLength(1);
  });
});

describe("zoom", () => {
  async function opened(options: Partial<FluidboxOptions<Item>> = {}) {
    const driver = new TestDriver();
    const fluidbox = make(driver, options);
    const result = fluidbox.open("one");
    driver.steps[0]!.resolve();
    await result;
    return { driver, fluidbox };
  }

  it("has no zoom while closed, and resolves false", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);
    expect(fluidbox.state.zoom).toBeNull();
    await expect(fluidbox.zoomIn()).resolves.toBe(false);
    expect(driver.zooms).toEqual([]);
  });

  it("publishes the scale it rests at, once, with a zoomchange", async () => {
    const { driver, fluidbox } = await opened({ zoom: { max: 3 } });
    expect(fluidbox.state.zoom).toEqual({ scale: 1, min: 1, max: 3 });
    const events: string[] = [];
    fluidbox.addEventListener("zoomchange", (event) => {
      const { scale, reason } = event as FluidboxZoomEvent;
      events.push(`${scale}:${reason}`);
    });
    const states: number[] = [];
    fluidbox.subscribe((state) => states.push(state.zoom!.scale));

    await expect(fluidbox.zoomTo(2, { origin: { x: 10, y: 20 } })).resolves.toBe(true);
    await fluidbox.zoomIn();
    await fluidbox.zoomTo(9);
    await fluidbox.zoomOut();
    await fluidbox.resetZoom();

    expect(driver.zooms.map(({ scale }) => scale)).toEqual([2, 3, 3, 2, 1]);
    expect(driver.zooms[0]).toMatchObject({ reason: "api", origin: { x: 10, y: 20 } });
    expect(states).toEqual([2, 3, 2, 1]);
    expect(events).toEqual(["2:api", "3:api", "2:api", "1:api"]);
    await expect(fluidbox.zoomTo(Number.NaN)).rejects.toThrow(RangeError);
  });

  it("starts another item at fit, and has none with zoom off", async () => {
    const { fluidbox } = await opened();
    await fluidbox.zoomTo(2);
    expect(fluidbox.state.zoom?.scale).toBe(2);
    void fluidbox.next();
    expect(fluidbox.state).toMatchObject({ id: "two", zoom: { scale: 1 } });
    fluidbox.update({ zoom: false });
    expect(fluidbox.state.zoom).toBeNull();
    await expect(fluidbox.zoomIn()).resolves.toBe(false);
  });

  it("resolves false after destroy and with an aborted signal", async () => {
    const { driver, fluidbox } = await opened();
    await expect(fluidbox.zoomIn({ signal: AbortSignal.abort() })).resolves.toBe(false);
    fluidbox.destroy();
    await expect(fluidbox.zoomIn()).resolves.toBe(false);
    expect(driver.zooms).toEqual([]);
  });
});
