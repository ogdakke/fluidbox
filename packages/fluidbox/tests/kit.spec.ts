import { describe, expect, it, vi } from "vitest";
import { hostKey, type FluidboxHost } from "../src/host";
import { createDeferredFluidbox } from "../src/kit";
import { toList } from "../src/items";
import type { Fluidbox, FluidboxImageItem } from "../src/public-api";

const items: FluidboxImageItem[] = [
  { id: "one", type: "img", src: "/one.jpg", alt: "One", width: 4, height: 3 },
  { id: "two", type: "img", src: "/two.jpg", alt: "Two", width: 4, height: 3 },
];

/** A fluidbox with only what the stand-in reaches for, recording its commands. */
function fakeFluidbox() {
  const calls: string[] = [];
  const list = toList(items);
  const host: FluidboxHost = {
    items: list,
    registerOrigin: () => () => {},
    registerOverlay: () => () => {},
    preload: () => () => {},
    command: (name, target) => {
      calls.push(`host:${name}:${typeof target === "object" ? "item" : String(target)}`);
      return Promise.resolve(true);
    },
  };
  const fluidbox = Object.assign(new EventTarget(), {
    [hostKey]: host,
    items: list,
    state: {
      status: "closed",
      id: null,
      index: null,
      item: null,
      count: list.count,
      hasPrevious: false,
      hasNext: false,
    },
    sheet: null,
    open: vi.fn((target?: number | string | object) => {
      calls.push(`open:${typeof target === "object" ? "item" : String(target)}`);
      return Promise.resolve(true);
    }),
    close: vi.fn(() => {
      calls.push("close");
      return Promise.resolve(true);
    }),
    next: vi.fn(() => Promise.resolve(true)),
    previous: vi.fn(() => Promise.resolve(true)),
    update: vi.fn(),
    subscribe: () => () => {},
  });
  return {
    fluidbox: fluidbox as unknown as Fluidbox<FluidboxImageItem>,
    update: fluidbox.update,
    calls,
  };
}

describe("createDeferredFluidbox", () => {
  it("runs commands made before attach on the fluidbox, in order", async () => {
    const deferred = createDeferredFluidbox(items);
    const opened = deferred.fluidbox.open(items[1]);
    const closed = deferred.fluidbox.close();
    const fromPart = (deferred.fluidbox as unknown as { [hostKey]: FluidboxHost })[hostKey].command(
      "next",
      undefined,
      "pointer",
    );
    const { fluidbox, calls } = fakeFluidbox();
    expect(calls).toEqual([]);
    deferred.attach(fluidbox);
    await expect(opened).resolves.toBe(true);
    await expect(closed).resolves.toBe(true);
    await expect(fromPart).resolves.toBe(true);
    expect(calls).toEqual(["open:item", "close", "host:next:undefined"]);
  });

  it("runs commands at once while attached, and forwards update", async () => {
    const deferred = createDeferredFluidbox(items);
    const { fluidbox, update, calls } = fakeFluidbox();
    deferred.attach(fluidbox);
    await expect(deferred.fluidbox.open("two")).resolves.toBe(true);
    expect(calls).toEqual(["open:two"]);
    deferred.fluidbox.update({ zoom: false });
    expect(update).toHaveBeenCalledWith({ zoom: false });
  });

  it("keeps commands made after detach for the next fluidbox", async () => {
    const deferred = createDeferredFluidbox(items);
    const first = fakeFluidbox();
    deferred.attach(first.fluidbox);
    deferred.detach();
    const opened = deferred.fluidbox.open(0);
    const second = fakeFluidbox();
    deferred.attach(second.fluidbox);
    await expect(opened).resolves.toBe(true);
    expect(first.calls).toEqual([]);
    expect(second.calls).toEqual(["open:0"]);
  });
});
