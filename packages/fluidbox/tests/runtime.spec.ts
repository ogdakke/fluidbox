import { describe, expect, it, vi } from "vitest";
import { FluidboxRuntime, type FluidboxRuntimeDriver } from "../src/create-fluidbox";
import { hostOf } from "../src/host";
import type {
  FluidboxItem,
  FluidboxItemChangeEvent,
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
  connect() {}
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

  it("ignores items equal to its own, in a new array or the same list", async () => {
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

    const list = { count: 1, get: () => items[0] };
    const replacing = fluidbox.setItems(list);
    driver.steps[3]?.resolve();
    await replacing;
    expect(driver.sourceUpdates).toHaveLength(3);
    await expect(fluidbox.setItems(list)).resolves.toBe(false);
    expect(driver.sourceUpdates).toHaveLength(3);
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

  it("settles commands, toggles and later subscribers when a subscriber throws", async () => {
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
      fluidbox.addEventListener("toggle", (event) =>
        toggles.push((event as FluidboxToggleEvent).newState),
      );

      const opening = fluidbox.open("one");
      driver.steps[0]!.resolve();
      await expect(opening).resolves.toBe(true);
      const closing = fluidbox.close();
      driver.steps[1]!.resolve();
      await expect(closing).resolves.toBe(true);

      expect(seen).toEqual(["opening", "open", "closing", "closed"]);
      expect(toggles).toEqual(["open", "closed"]);
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
        id: "two",
      });
      driver.steps.at(-1)!.resolve();
      await expect(reopening).resolves.toBe(true);
      expect(fluidbox.state).toMatchObject({ status: "open", id: "two" });
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
