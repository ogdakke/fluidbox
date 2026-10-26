import { describe, expect, it, vi } from "vitest";
import { allControlNames } from "../src/controls";
import {
  controlNameList,
  FluidboxRuntime,
  type FluidboxRuntimeDriver,
} from "../src/create-fluidbox";
import { hostOf } from "../src/host";
import { createItemList } from "../src/items";
import { reachEnd } from "../src/reach-end-event";
import type {
  FluidboxImageItem,
  FluidboxItem,
  FluidboxReachEndEvent,
  FluidboxValueChangeEvent,
  FluidboxZoomEvent,
  FluidboxOptions,
} from "../src/public-api";
import type {
  SessionController,
  ViewerSessionCloseContext,
  ViewerSessionMotionContext,
} from "../src/runtime-types";

const items = [
  { id: "one", type: "image", src: "/one.jpg", alt: "One", width: 1200, height: 800 },
  { id: "two", type: "image", src: "/two.jpg", alt: "Two", width: 1200, height: 800 },
  { id: "three", type: "image", src: "/three.jpg", alt: "Three", width: 1200, height: 800 },
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
  /** The scale a zoom under way is heading to, as the zoom engine reports it. */
  goal: number | undefined;
  connect(controller: TestDriver["controller"]) {
    this.controller = controller;
  }
  zoomTo(scale: number, options: { reason?: string; origin?: unknown }) {
    this.zooms.push({ scale, reason: options.reason, origin: options.origin });
    // The zoom comes to rest at once, as with reduced motion.
    this.controller?.zoomed?.(scale, options.reason);
    return Promise.resolve(true);
  }
  zoomGoal() {
    return this.goal;
  }
  zoomable() {
    return undefined;
  }
  setZoom() {}
  loop = false;
  setLoop(loop: boolean) {
    this.loop = loop;
  }
  setGestures() {}
  setFullscreen() {
    return Promise.resolve(false);
  }
  download() {
    return Promise.resolve(false);
  }
  share() {
    return Promise.resolve(false);
  }
  relabel() {}
  setPortal() {}
  setExtensions() {}
  revealed() {}
  keepsThumbnail() {
    return false;
  }
  unload() {}

  setSource(source: { count: number }) {
    // A new count re-arms reachend, as in the DOM viewer.
    const last = this.sourceUpdates.at(-1) as { count: number } | undefined;
    if (source.count !== last?.count) this.reachedEnd = false;
    this.sourceUpdates.push(source);
  }

  reachedEnd = false;
  reachEnd() {
    if (this.controller && !this.reachedEnd && !this.loop) {
      this.reachedEnd = true;
      if (!reachEnd(this.controller as SessionController<any>)) this.reachedEnd = false;
    }
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

const eventTypes = ["beforevaluechange", "valuechange", "valuechangecomplete"];

/** Each value event the fluidbox dispatches, as `type:action:value`. */
function record(fluidbox: EventTarget, into: string[]) {
  for (const type of eventTypes) {
    fluidbox.addEventListener(type, (event) => {
      const { action, value } = event as FluidboxValueChangeEvent<Item>;
      into.push(`${event.type}:${action}:${value}`);
    });
  }
}

describe("the fluidbox runtime", () => {
  it("knows every control's name before the control code loads", () => {
    expect(controlNameList).toEqual(allControlNames);
    const fluidbox = make(new TestDriver());
    const button = { setAttribute() {} } as unknown as HTMLElement;
    expect(() => fluidbox.bindControl(button, "slideshow" as never)).toThrow(
      new TypeError('Fluidbox has no control named "slideshow".'),
    );
  });

  it("prepares a valid closed target without publishing state", () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);

    const dispose = fluidbox.preload("two");

    expect(driver.preparations).toEqual([{ item: items[1], index: 1, origin: null }]);
    expect(fluidbox.state).toMatchObject({ status: "closed", value: null });
    dispose();
    expect(driver.preparationDisposed).toBe(true);
    expect(() => fluidbox.preload("missing")).toThrow(RangeError);
  });

  it("publishes the open lifecycle and an immutable state", async () => {
    const driver = new TestDriver();
    const order: string[] = [];
    const revealTrigger = vi.fn();
    const fluidbox = make(driver, { findTrigger: () => null, revealTrigger });
    record(fluidbox, order);
    fluidbox.subscribe((state) => order.push(`state:${state.status}:${state.value}`));

    const result = fluidbox.open("two");

    expect(Object.isFrozen(fluidbox.state)).toBe(true);
    expect(fluidbox.state).toMatchObject({
      status: "opening",
      value: "two",
      index: 1,
      item: items[1],
      hasPrevious: true,
      hasNext: true,
    });
    expect(order).toEqual([
      "beforevaluechange:open:two",
      "state:opening:two",
      "valuechange:open:two",
    ]);

    driver.steps[0]!.resolve();
    await expect(result).resolves.toBe(true);
    expect(order.slice(3)).toEqual(["state:open:two", "valuechangecomplete:open:two"]);
    expect(revealTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ id: "two" }),
      1,
      expect.objectContaining({ phase: "open" }),
    );
  });

  it("reports moves and closes with the value they go to and the one they leave", async () => {
    const driver = new TestDriver();
    const order: string[] = [];
    const fluidbox = make(driver);
    record(fluidbox, order);
    const previous: unknown[] = [];
    fluidbox.addEventListener("valuechangecomplete", (event) =>
      previous.push((event as FluidboxValueChangeEvent<Item>).previousValue),
    );

    const opening = fluidbox.open("one");
    driver.steps[0]!.resolve();
    await opening;
    const moving = fluidbox.next();
    driver.steps[1]!.resolve();
    await expect(moving).resolves.toBe(true);
    const closing = fluidbox.close();
    driver.steps[2]!.resolve();
    await expect(closing).resolves.toBe(true);

    expect(order).toEqual([
      "beforevaluechange:open:one",
      "valuechange:open:one",
      "valuechangecomplete:open:one",
      "beforevaluechange:move:two",
      "valuechange:move:two",
      "valuechangecomplete:move:two",
      "beforevaluechange:close:null",
      "valuechange:close:null",
      "valuechangecomplete:close:null",
    ]);
    expect(previous).toEqual([null, "one", "two"]);
  });

  it("lets a beforevaluechange listener cancel a move or a close", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);
    const opening = fluidbox.open("one");
    driver.steps[0]!.resolve();
    await opening;
    const changes: string[] = [];
    fluidbox.addEventListener("valuechange", (event) => changes.push(event.type));
    fluidbox.addEventListener("beforevaluechange", (event) => event.preventDefault());

    await expect(fluidbox.next()).resolves.toBe(false);
    await expect(fluidbox.close()).resolves.toBe(false);

    expect(changes).toEqual([]);
    expect(driver.selections).toEqual([]);
    expect(driver.closes).toEqual([]);
    expect(fluidbox.state).toMatchObject({ status: "open", value: "one" });
  });

  it("can't cancel a close the items force", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);
    const opening = fluidbox.open("one");
    driver.steps[0]!.resolve();
    await opening;
    const seen: Array<[string, boolean, string]> = [];
    fluidbox.addEventListener("beforevaluechange", (event) => {
      seen.push([event.type, event.cancelable, (event as FluidboxValueChangeEvent<Item>).reason]);
      event.preventDefault();
    });
    fluidbox.addEventListener("valuechange", (event) =>
      seen.push([event.type, false, (event as FluidboxValueChangeEvent<Item>).action]),
    );

    const emptying = fluidbox.setItems([]);
    driver.steps.at(-1)?.resolve();
    await emptying;

    expect(seen).toEqual([
      ["beforevaluechange", false, "items"],
      ["valuechange", false, "close"],
    ]);
    expect(fluidbox.state).toMatchObject({ value: null });
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
    expect(fluidbox.state).toMatchObject({ status: "open", value: "three" });
  });

  it("restores the state when a caller aborts a command", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);
    const controller = new AbortController();

    const opening = fluidbox.open("one", { signal: controller.signal });
    controller.abort();

    await expect(opening).resolves.toBe(false);
    expect(driver.opens[0]!.signal.aborted).toBe(true);
    expect(fluidbox.state).toMatchObject({ status: "closed", value: null });
  });

  it("rejects unknown targets and stops prevented commands before events or motion", async () => {
    const driver = new TestDriver();
    const events: string[] = [];
    const fluidbox = make(driver);
    fluidbox.addEventListener("beforevaluechange", (event) => event.preventDefault());
    for (const type of ["valuechange", "valuechangecomplete"]) {
      fluidbox.addEventListener(type, () => events.push(type));
    }

    await expect(fluidbox.open("missing")).rejects.toBeInstanceOf(RangeError);
    await expect(fluidbox.open(20)).rejects.toBeInstanceOf(RangeError);
    await expect(fluidbox.open("one")).resolves.toBe(false);
    expect(events).toEqual([]);
    expect(driver.opens).toEqual([]);
  });

  it("keeps overlays on one item side by side, each released by its own cleanup", () => {
    const driver = new TestDriver();
    const firstDriverDispose = vi.fn();
    const secondDriverDispose = vi.fn();
    driver.registerThumbnailOverlay = vi
      .fn()
      .mockReturnValueOnce(firstDriverDispose)
      .mockReturnValueOnce(secondDriverDispose);
    const fluidbox = make(driver);
    const element = {} as HTMLElement;

    const disposeFirst = fluidbox.bindOverlay(element, "one", { flight: "frame" });
    const disposeSecond = fluidbox.bindOverlay(element, "one");
    expect(firstDriverDispose).not.toHaveBeenCalled();

    disposeFirst();
    disposeFirst();
    expect(firstDriverDispose).toHaveBeenCalledOnce();
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
      thumbnail.src = item.type === "image" ? item.src : "";
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
      findTrigger: () => null,
      revealTrigger: (_item, _index, { signal }) => {
        revealSignals.push(signal);
        return new Promise(() => {});
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
    expect(fluidbox.state).toMatchObject({ value: "two", index: 0 });

    const clamping = fluidbox.setItems([items[0], items[2]]);
    driver.steps[2]!.resolve();
    await expect(clamping).resolves.toBe(true);
    expect(fluidbox.state).toMatchObject({ value: "one", index: 0 });

    const closing = fluidbox.setItems([]);
    expect(driver.closes).toHaveLength(1);
    driver.steps[3]!.resolve();
    await expect(closing).resolves.toBe(true);
    expect(fluidbox.state).toMatchObject({ status: "closed", count: 0, value: null });
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
    expect(fluidbox.state).toMatchObject({ status: "open", value: "two", index: 0 });
  });

  it("keeps a close in progress when its items refresh", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);
    const opening = fluidbox.open("two");
    driver.steps[0]!.resolve();
    await opening;

    const closing = fluidbox.close();
    const update = fluidbox.setItems([
      { ...items[0], src: "/one-again.jpg" } as unknown as Item,
      items[1],
      items[2],
    ]);

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

  it("ignores an array of items equal to its own", async () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);
    const opening = fluidbox.open("two");
    driver.steps[0]!.resolve();
    await opening;
    const selecting = fluidbox.next();

    // Fresh copies, as a binding that maps its data on every render makes.
    const copies = items.map((item) => ({ ...item }));
    await expect(fluidbox.setItems(copies)).resolves.toBe(false);
    expect(driver.selections[0]!.signal.aborted).toBe(false);
    expect(driver.sourceUpdates).toHaveLength(1);
    driver.steps[1]!.resolve();
    await expect(selecting).resolves.toBe(true);
    expect(fluidbox.items.get(0)).toBe(items[0]);

    // A changed field is a change.
    const changed = fluidbox.setItems([
      items[0],
      { ...items[1], width: 600 } as unknown as Item,
      items[2],
    ]);
    expect(driver.sourceUpdates).toHaveLength(2);
    driver.steps[2]!.resolve();
    await changed;
  });

  it("rejects unexpected driver failures without leaving a pending command", async () => {
    const failure = new Error("motion failed");
    const driver = new TestDriver();
    driver.open = () => Promise.reject(failure);
    const fluidbox = make(driver);

    await expect(fluidbox.open("one")).rejects.toBe(failure);
    expect(fluidbox.state).toMatchObject({ status: "closed", value: null });
    await expect(fluidbox.close()).resolves.toBe(true);
  });

  it("settles commands, value events and later subscribers when a subscriber throws", async () => {
    const reported: unknown[] = [];
    vi.stubGlobal("reportError", (error: unknown) => reported.push(error));
    try {
      const driver = new TestDriver();
      const fluidbox = make(driver);
      const failure = new Error("binding failed");
      const seen: string[] = [];
      fluidbox.subscribe(() => {
        throw failure;
      });
      fluidbox.subscribe((state) => seen.push(state.status));
      const toggles: string[] = [];
      fluidbox.addEventListener("valuechange", (event) =>
        toggles.push((event as FluidboxValueChangeEvent<Item>).action),
      );

      const opening = fluidbox.open("one");
      driver.steps[0]!.resolve();
      await expect(opening).resolves.toBe(true);
      const closing = fluidbox.close();
      driver.steps[1]!.resolve();
      await expect(closing).resolves.toBe(true);

      expect(seen).toEqual(["opening", "open", "closing", "closed"]);
      expect(toggles).toEqual(["open", "close"]);
      expect(reported).toEqual([failure, failure, failure, failure]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("lets a command issued as another's motion ends take over", async () => {
    for (let ticks = 0; ticks < 6; ticks++) {
      const driver = new TestDriver();
      const fluidbox = make(driver);
      const opening = fluidbox.open("one");
      driver.steps[0]!.resolve();
      await opening;

      const closing = fluidbox.close();
      driver.steps[1]!.resolve();
      for (let tick = 0; tick < ticks; tick++) await Promise.resolve();
      const reopening = fluidbox.open("two");
      await closing;
      for (let tick = 0; tick < 6; tick++) await Promise.resolve();
      // The close that finished first does not settle over the open that took over.
      expect(fluidbox.state, `after ${ticks} microtasks`).toMatchObject({
        status: "opening",
        value: "two",
      });
      driver.steps.at(-1)!.resolve();
      await expect(reopening).resolves.toBe(true);
      expect(fluidbox.state).toMatchObject({ status: "open", value: "two" });
    }
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

  it("throws an InvalidStateError for anything that would hold on to it after destroy", () => {
    const driver = new TestDriver();
    const fluidbox = make(driver);
    fluidbox.destroy();
    // A stand-in element: a call that got as far as binding it would fail on it.
    const element = {} as HTMLElement;
    for (const call of [
      () => fluidbox.setItems([items[0]]),
      () => fluidbox.preload("one"),
      () => fluidbox.bind(element, "one"),
      () => fluidbox.bindOverlay(element, "one"),
      () => fluidbox.subscribe(() => {}),
    ]) {
      expect(call).toThrow(expect.objectContaining({ name: "InvalidStateError" }));
    }
    expect(() => fluidbox.preload("missing")).toThrow(
      expect.objectContaining({ name: "InvalidStateError" }),
    );
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
    await fluidbox.zoomReset();

    expect(driver.zooms.map(({ scale }) => scale)).toEqual([2, 3, 3, 2, 1]);
    expect(driver.zooms[0]).toMatchObject({ reason: "api", origin: { x: 10, y: 20 } });
    expect(states).toEqual([2, 3, 2, 1]);
    expect(events).toEqual(["2:api", "3:api", "2:api", "1:api"]);
    await expect(fluidbox.zoomTo(Number.NaN)).rejects.toThrow(RangeError);
  });

  it("steps from the scale a zoom under way is heading to", async () => {
    const { driver, fluidbox } = await opened({ zoom: { max: 6 } });
    // Zoom in, and press again while the first zoom is still on its way to 1.5.
    driver.goal = 1.5;
    await fluidbox.zoomIn();
    driver.goal = 1.5 * 1.5;
    await fluidbox.zoomOut();
    driver.goal = undefined;
    await fluidbox.zoomIn();
    expect(driver.zooms.map(({ scale }) => scale)).toEqual([2.25, 1.5, 2.25]);
  });

  it("starts another item at fit, and has none with zoom off", async () => {
    const { fluidbox } = await opened();
    await fluidbox.zoomTo(2);
    expect(fluidbox.state.zoom?.scale).toBe(2);
    void fluidbox.next();
    expect(fluidbox.state).toMatchObject({ value: "two", zoom: { scale: 1 } });
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

describe("reachend", () => {
  const photo = (index: number): FluidboxImageItem => ({
    type: "image",
    id: `photo-${index}`,
    src: `/photos/${index}.jpg`,
    alt: `Photo ${index + 1}`,
    width: 4,
    height: 3,
  });

  /** A fluidbox over a lazy list whose motions finish at once, and the reachend events it fires. */
  function lazy(
    count: number,
    options: Partial<FluidboxOptions<FluidboxImageItem>> = {},
    land = true,
  ) {
    const list = createItemList({ count, item: photo, index: (id) => Number(id.slice(6)) });
    const driver = new TestDriver();
    const step = driver.steps.push.bind(driver.steps);
    // Every motion lands at once, unless the test lands them.
    driver.steps.push = (...steps) => {
      if (land) for (const deferred of steps) deferred.resolve();
      return step(...steps);
    };
    const fluidbox = new FluidboxRuntime<FluidboxImageItem>(
      { items: list, ...options },
      driver as unknown as FluidboxRuntimeDriver<FluidboxImageItem>,
    );
    const reached: Array<[string, number, number]> = [];
    fluidbox.addEventListener("reachend", (event) => {
      const { value, index, count } = event as FluidboxReachEndEvent;
      reached.push([value, index, count]);
    });
    return { list, fluidbox, reached, driver };
  }

  it("fires as the open item comes within the threshold, once per count", async () => {
    const { fluidbox, reached } = lazy(10);
    await fluidbox.open(5);
    expect(reached).toEqual([]);
    await fluidbox.open(7);
    expect(reached).toEqual([["photo-7", 7, 10]]);
    await fluidbox.open(9);
    await fluidbox.open(6);
    await fluidbox.open(8);
    await fluidbox.close();
    await fluidbox.open(9);
    expect(reached).toHaveLength(1);
  });

  it("fires on an open that starts near the end", async () => {
    const { fluidbox, reached } = lazy(10);
    await fluidbox.open(8);
    expect(reached).toEqual([["photo-8", 8, 10]]);
  });

  it("re-arms when setItems changes the count, keeping the open value", async () => {
    const { list, fluidbox, reached } = lazy(10);
    await fluidbox.open(9);
    const changes: string[] = [];
    record(fluidbox, changes);
    await fluidbox.setItems(list.withCount(20));
    expect(fluidbox.state).toMatchObject({ status: "open", value: "photo-9", index: 9 });
    expect(changes).toEqual([]);
    expect(reached).toEqual([["photo-9", 9, 10]]);
    await fluidbox.open(17);
    expect(reached.at(-1)).toEqual(["photo-17", 17, 20]);
    // Already within the threshold of the new end: it fires at once.
    await fluidbox.setItems(list.withCount(19));
    expect(reached.at(-1)).toEqual(["photo-17", 17, 19]);
    expect(reached).toHaveLength(3);
  });

  it("fires once a move settles, so new items from the handler don't interrupt it", async () => {
    const { list, fluidbox, reached } = lazy(10);
    fluidbox.addEventListener("reachend", (event) => {
      void fluidbox.setItems(list.withCount((event as FluidboxReachEndEvent).count + 10));
    });
    const changes: string[] = [];
    record(fluidbox, changes);
    await fluidbox.open(6);
    changes.length = 0;
    await expect(fluidbox.next()).resolves.toBe(true);
    expect(reached).toEqual([["photo-7", 7, 10]]);
    expect(changes).toEqual([
      "beforevaluechange:move:photo-7",
      "valuechange:move:photo-7",
      "valuechangecomplete:move:photo-7",
    ]);
    await Promise.resolve();
    expect(fluidbox.state).toMatchObject({ status: "open", value: "photo-7", count: 20 });
    // The new count re-armed it, though it came during the dispatch.
    await fluidbox.open(17);
    expect(reached).toEqual([
      ["photo-7", 7, 10],
      ["photo-17", 17, 20],
    ]);
  });

  it("doesn't count an open that never settled", async () => {
    const { fluidbox, reached, driver } = lazy(10, {}, false);
    const opening = fluidbox.open(9);
    const closing = fluidbox.close();
    for (const step of driver.steps) step.resolve();
    await opening;
    await closing;
    for (const step of driver.steps) step.resolve();
    expect(reached).toEqual([]);
    const reopening = fluidbox.open(9);
    for (const step of driver.steps) step.resolve();
    await reopening;
    expect(reached).toEqual([["photo-9", 9, 10]]);
  });

  it("re-arms when the count goes down and back up", async () => {
    const { list, fluidbox, reached } = lazy(10);
    await fluidbox.open(9);
    await fluidbox.setItems(list.withCount(5));
    expect(reached.at(-1)).toEqual(["photo-4", 4, 5]);
    await fluidbox.setItems(list.withCount(10));
    await fluidbox.open(9);
    expect(reached).toEqual([
      ["photo-9", 9, 10],
      ["photo-4", 4, 5],
      ["photo-9", 9, 10],
    ]);
  });

  it("takes a numeric string for the threshold, and the default for one that isn't a number", async () => {
    const { fluidbox, reached } = lazy(10, { reachEndThreshold: "4" as unknown as number });
    await fluidbox.open(5);
    expect(reached).toEqual([["photo-5", 5, 10]]);
    const nan = lazy(10, { reachEndThreshold: Number.NaN });
    await nan.fluidbox.open(0);
    await nan.fluidbox.open(6);
    expect(nan.reached).toEqual([]);
    await nan.fluidbox.open(7);
    expect(nan.reached).toEqual([["photo-7", 7, 10]]);
  });

  it("never fires with loop", async () => {
    const { fluidbox, reached } = lazy(10, { loop: true });
    await fluidbox.open(9);
    await fluidbox.next();
    await fluidbox.previous();
    expect(reached).toEqual([]);
  });

  it("follows reachEndThreshold, and its update", async () => {
    const { fluidbox, reached } = lazy(10, { reachEndThreshold: 0 });
    await fluidbox.open(8);
    expect(reached).toEqual([]);
    fluidbox.update({ reachEndThreshold: 4 });
    await fluidbox.open(5);
    expect(reached).toEqual([["photo-5", 5, 10]]);
  });
});
