import { describe, expect, it, vi } from "vitest";
import { arraySource } from "../src/array-source";
import type { FluidboxCommandResult, FluidboxEvent, FluidboxItem } from "../src/public-api";
import {
  ViewerSession,
  type ViewerSessionCloseContext,
  type ViewerSessionDriver,
  type ViewerSessionMotionContext,
} from "../src/viewer-session";

const items = [
  {
    id: "one",
    media: { type: "image", src: "/one.jpg", alt: "One", width: 1200, height: 800 },
  },
  {
    id: "two",
    media: { type: "image", src: "/two.jpg", alt: "Two", width: 1200, height: 800 },
  },
  {
    id: "three",
    media: { type: "image", src: "/three.jpg", alt: "Three", width: 1200, height: 800 },
  },
] as const satisfies readonly FluidboxItem[];

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

class TestDriver implements ViewerSessionDriver<(typeof items)[number]> {
  readonly preparations: Array<{
    item: (typeof items)[number];
    index: number;
    origin: null;
  }> = [];
  preparationDisposed = false;
  readonly opens: ViewerSessionMotionContext<(typeof items)[number]>[] = [];
  readonly selections: ViewerSessionMotionContext<(typeof items)[number]>[] = [];
  readonly closes: AbortSignal[] = [];
  readonly closeOrigins: ViewerSessionCloseContext["origin"][] = [];
  readonly sourceUpdates: unknown[] = [];
  readonly steps: Deferred[] = [];
  destroyed = false;
  registerThumbnailOverlay: NonNullable<
    ViewerSessionDriver<(typeof items)[number]>["registerThumbnailOverlay"]
  > = () => {};

  setSource(source: unknown) {
    this.sourceUpdates.push(source);
  }

  prepare(context: { item: (typeof items)[number]; index: number; origin: null }) {
    this.preparations.push(context);
    return () => {
      this.preparationDisposed = true;
    };
  }

  open(context: ViewerSessionMotionContext<(typeof items)[number]>) {
    this.opens.push(context);
    const step = deferred();
    this.steps.push(step);
    return step.promise;
  }

  select(context: ViewerSessionMotionContext<(typeof items)[number]>) {
    this.selections.push(context);
    const step = deferred();
    this.steps.push(step);
    return step.promise;
  }

  close({ signal, origin }: ViewerSessionCloseContext) {
    this.closes.push(signal);
    this.closeOrigins.push(origin);
    const step = deferred();
    this.steps.push(step);
    return step.promise;
  }

  destroy() {
    this.destroyed = true;
  }
}

function eventLabel(event: FluidboxEvent) {
  if (event.type === "status-change") return `${event.type}:${event.status}`;
  if (event.type === "selection-change" || event.type === "selection-settle") {
    return `${event.type}:${event.id}`;
  }
  return event.type;
}

describe("ViewerSession", () => {
  it("prepares a valid closed target without publishing state", () => {
    const driver = new TestDriver();
    const session = new ViewerSession({ source: arraySource(items) }, driver);

    const dispose = session.prepare({ id: "two" });

    expect(driver.preparations).toEqual([{ item: items[1], index: 1, origin: null }]);
    expect(session.state).toMatchObject({ status: "closed", activeId: null });
    dispose();
    expect(driver.preparationDisposed).toBe(true);
    expect(() => session.prepare({ id: "missing" })).toThrow(RangeError);
  });

  it("publishes the specified open lifecycle and immutable state", async () => {
    const driver = new TestDriver();
    const order: string[] = [];
    const revealOrigin = vi.fn();
    const session = new ViewerSession(
      {
        source: arraySource(items),
        origins: { getOrigin: () => null, revealOrigin },
        onBeforeCommand: () => order.push("before"),
        onEvent: (event) => order.push(eventLabel(event)),
      },
      driver,
    );
    session.subscribe((state) => order.push(`state:${state.status}:${state.activeId}`));

    const result = session.open({ id: "two" }, { reason: "trigger" });

    expect(Object.isFrozen(session.state)).toBe(true);
    expect(session.state).toMatchObject({
      status: "opening",
      activeId: "two",
      activeIndex: 1,
      requestedId: "two",
      canPrevious: true,
      canNext: true,
    });
    expect(order).toEqual([
      "before",
      "open-request",
      "state:opening:two",
      "status-change:opening",
      "selection-change:two",
    ]);

    driver.steps[0]!.resolve();
    await expect(result).resolves.toEqual({ status: "completed", changed: true });
    expect(order).toEqual([
      "before",
      "open-request",
      "state:opening:two",
      "status-change:opening",
      "selection-change:two",
      "state:open:two",
      "status-change:open",
      "selection-settle:two",
    ]);
    expect(revealOrigin).toHaveBeenCalledWith(
      "two",
      1,
      expect.objectContaining({ reason: "open" }),
    );
  });

  it("shares repeated pending commands and supersedes incompatible work", async () => {
    const driver = new TestDriver();
    const session = new ViewerSession({ source: arraySource(items) }, driver);

    const first = session.open({ id: "one" });
    const repeated = session.open({ id: "one" });
    expect(repeated).toBe(first);

    const replacement = session.open({ id: "three" });
    await expect(first).resolves.toEqual({ status: "superseded" });
    expect(driver.opens[0]!.signal.aborted).toBe(true);
    expect(driver.opens[1]!.signal.aborted).toBe(false);

    driver.steps[1]!.resolve();
    await expect(replacement).resolves.toEqual({ status: "completed", changed: true });
    expect(session.state).toMatchObject({ status: "open", activeId: "three" });
  });

  it("restores committed state when a caller aborts a command", async () => {
    const driver = new TestDriver();
    const session = new ViewerSession({ source: arraySource(items) }, driver);
    const controller = new AbortController();

    const opening = session.open({ id: "one" }, { signal: controller.signal });
    controller.abort();

    await expect(opening).resolves.toEqual({ status: "aborted" });
    expect(driver.opens[0]!.signal.aborted).toBe(true);
    expect(session.state).toMatchObject({ status: "closed", activeId: null });
  });

  it("validates targets synchronously and prevents commands before events or motion", async () => {
    const driver = new TestDriver();
    const events: FluidboxEvent[] = [];
    const session = new ViewerSession(
      {
        source: arraySource(items),
        onBeforeCommand(event) {
          event.preventDefault();
        },
        onEvent: (event) => events.push(event),
      },
      driver,
    );

    expect(() => session.open({ id: "missing" })).toThrow(RangeError);
    expect(() => session.open({ index: 20 })).toThrow(RangeError);
    await expect(session.open({ id: "one" })).resolves.toEqual({ status: "prevented" });
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
    const session = new ViewerSession({ source: arraySource(items) }, driver);
    const element = {} as HTMLElement;

    const disposeFirst = session.registerThumbnailOverlay("one", { element });
    const disposeSecond = session.registerThumbnailOverlay("one", { element });
    expect(firstDriverDispose).toHaveBeenCalledOnce();

    disposeFirst();
    expect(secondDriverDispose).not.toHaveBeenCalled();
    disposeSecond();
    expect(secondDriverDispose).toHaveBeenCalledOnce();
  });

  it("resolves a shared origin again after its close preview changes", async () => {
    const driver = new TestDriver();
    const session = new ViewerSession({ source: arraySource(items) }, driver);
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
    const prepareClose = vi.fn((item: FluidboxItem) => {
      thumbnail.src = item.media.type === "image" ? item.media.src : "";
      dispose();
      session.registerOrigin(["one", "two"], {
        trigger,
        visual: secondVisual,
        thumbnail,
      });
    });
    dispose = session.registerOrigin(["one", "two"], {
      trigger,
      visual: firstVisual,
      thumbnail,
      prepareClose,
    });
    const opening = session.open({ id: "one" });
    driver.steps[0]!.resolve();
    await opening;
    const selecting = session.goTo({ id: "two" });
    driver.steps[1]!.resolve();
    await selecting;
    const closing = session.close();
    driver.steps[2]!.resolve();
    await closing;

    expect(prepareClose).toHaveBeenCalledWith(items[1], 1);
    expect(thumbnail.src).toBe("/two.jpg");
    expect(driver.closeOrigins[0]?.visual).toBe(secondVisual);
  });

  it("aborts host reveal on selection and closes without waiting for it", async () => {
    const driver = new TestDriver();
    const revealSignals: AbortSignal[] = [];
    const session = new ViewerSession(
      {
        source: arraySource(items),
        origins: {
          getOrigin: () => null,
          revealOrigin: (_id, _index, { signal }) => {
            revealSignals.push(signal);
            return new Promise(() => {});
          },
        },
      },
      driver,
    );

    const opening = session.open({ id: "one" });
    driver.steps[0]!.resolve();
    await opening;
    expect(revealSignals[0]?.aborted).toBe(false);

    const selecting = session.goTo({ id: "two" });
    expect(revealSignals[0]?.aborted).toBe(true);
    driver.steps[1]!.resolve();
    await selecting;
    expect(revealSignals[1]?.aborted).toBe(false);

    const closing = session.close();
    expect(revealSignals[1]?.aborted).toBe(true);
    expect(driver.closes).toHaveLength(1);
    driver.steps[2]!.resolve();
    await expect(closing).resolves.toEqual({ status: "completed", changed: true });
  });

  it("reconciles source identity, clamps removal, and closes an empty source", async () => {
    const driver = new TestDriver();
    const session = new ViewerSession({ source: arraySource(items) }, driver);
    const opening = session.open({ id: "two" });
    driver.steps[0]!.resolve();
    await opening;

    const reordered = arraySource([items[1], items[0], items[2]]);
    const preserving = session.setSource(reordered);
    driver.steps[1]!.resolve();
    await expect(preserving).resolves.toEqual({ status: "completed", changed: true });
    expect(session.state).toMatchObject({ activeId: "two", activeIndex: 0 });

    const removed = arraySource([items[0], items[2]]);
    const clamping = session.setSource(removed);
    driver.steps[2]!.resolve();
    await expect(clamping).resolves.toEqual({ status: "completed", changed: true });
    expect(session.state).toMatchObject({ activeId: "one", activeIndex: 0 });

    const closing = session.setSource(arraySource([]));
    expect(driver.closes).toHaveLength(1);
    driver.steps[3]!.resolve();
    await expect(closing).resolves.toEqual({ status: "completed", changed: true });
    expect(session.state).toMatchObject({ status: "closed", count: 0, activeId: null });
  });

  it("restarts an unfinished open when its source is replaced", async () => {
    const driver = new TestDriver();
    const session = new ViewerSession({ source: arraySource(items) }, driver);

    const opening = session.open({ id: "two" });
    const replacement = session.setSource(arraySource([items[1], items[0]]));

    await expect(opening).resolves.toEqual({ status: "superseded" });
    expect(driver.opens).toHaveLength(2);
    expect(driver.opens[0]!.signal.aborted).toBe(true);
    driver.steps[1]!.resolve();
    await expect(replacement).resolves.toEqual({ status: "completed", changed: true });
    expect(session.state).toMatchObject({ status: "open", activeId: "two", activeIndex: 0 });
  });

  it("keeps a close in progress when its source refreshes", async () => {
    const driver = new TestDriver();
    const session = new ViewerSession({ source: arraySource(items) }, driver);
    const opening = session.open({ id: "two" });
    driver.steps[0]!.resolve();
    await opening;

    const closing = session.close();
    const update = session.setSource(arraySource([...items]));

    await expect(update).resolves.toEqual({ status: "completed", changed: false });
    expect(driver.closes).toHaveLength(1);
    expect(driver.closes[0]!.aborted).toBe(false);
    expect(driver.opens).toHaveLength(1);
    expect(driver.sourceUpdates).toHaveLength(1);
    driver.steps[1]!.resolve();
    await expect(closing).resolves.toEqual({ status: "completed", changed: true });
    expect(driver.sourceUpdates).toHaveLength(2);
    expect(session.state).toMatchObject({ status: "closed", count: 3 });
  });

  it("rejects unexpected driver failures without leaving a pending command", async () => {
    const failure = new Error("motion failed");
    const driver: ViewerSessionDriver<(typeof items)[number]> = {
      open: () => Promise.reject(failure),
      select: () => {},
      close: () => {},
      destroy: () => {},
    };
    const session = new ViewerSession({ source: arraySource(items) }, driver);

    await expect(session.open({ id: "one" })).rejects.toBe(failure);
    expect(session.state).toMatchObject({ status: "closed", activeId: null });
    await expect(session.close()).resolves.toEqual({ status: "completed", changed: false });
  });

  it("aborts pending work and rejects further use after idempotent destruction", async () => {
    const driver = new TestDriver();
    const session = new ViewerSession({ source: arraySource(items) }, driver);
    const opening: Promise<FluidboxCommandResult> = session.open({ id: "one" });

    session.destroy();
    session.destroy();

    await expect(opening).resolves.toEqual({ status: "aborted" });
    expect(driver.opens[0]!.signal.aborted).toBe(true);
    expect(driver.destroyed).toBe(true);
    expect(() => session.close()).toThrowError(
      expect.objectContaining({ name: "InvalidStateError" }),
    );
  });
});
