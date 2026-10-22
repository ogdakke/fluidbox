import { describe, expect, it } from "vitest";
import { createFluidbox } from "../src/create-fluidbox";
import { createFluidboxSync, unloadFluidbox } from "../src/kit";
import { createTrigger } from "../src/trigger";
import type { Fluidbox, FluidboxImageItem, FluidboxState } from "../src/public-api";

const items: FluidboxImageItem[] = [
  { id: "one", type: "img", src: "/one.jpg", alt: "One", width: 4, height: 3 },
  { id: "two", type: "img", src: "/two.jpg", alt: "Two", width: 4, height: 3 },
];

// There is no document here, as in a render on the server: a fluidbox that
// touched one would throw.
describe("a fluidbox before its viewer", () => {
  // First, before any test loads the entry.
  it("makes an add-on that loads while another update comes in", async () => {
    const fluidbox = createFluidbox({ items });
    fluidbox.update({ sheet: true });
    fluidbox.update({ controls: ["close"] });
    await import("../src/sheet-entry");
    await new Promise((resolve) => setTimeout(resolve));
    expect(fluidbox.sheet).not.toBeNull();
    fluidbox.destroy();
  });

  it("is made, updated and given items without a document", async () => {
    const fluidbox = createFluidbox({ items, labels: { close: "Shut" }, zoom: { max: 3 } });
    const states: FluidboxState<FluidboxImageItem>[] = [];
    fluidbox.subscribe((state) => states.push(state));
    fluidbox.update({ labels: { close: "Done" }, zoom: false, controls: ["close"] });
    await fluidbox.setItems(items.slice(0, 1));
    expect(fluidbox.items.count).toBe(1);
    expect(states.at(-1)).toMatchObject({ status: "closed", count: 1 });
    fluidbox.destroy();
  });

  it("turns add-ons on without their entries' imports", async () => {
    const fluidbox = createFluidbox({ items, filmstrip: true });
    expect(() => fluidbox.update({ sheet: true })).not.toThrow();
    // The fluidbox loads them itself; wait for the same modules.
    await Promise.all([import("../src/filmstrip-entry"), import("../src/sheet-entry")]);
    fluidbox.destroy();
  });

  it("unloads to closed and stays usable", () => {
    const fluidbox = createFluidbox({ items });
    unloadFluidbox(fluidbox);
    unloadFluidbox(fluidbox);
    expect(fluidbox.state.status).toBe("closed");
    expect(fluidbox.items.count).toBe(2);
    fluidbox.destroy();
  });
});

describe("createFluidboxSync", () => {
  const stub = (status: FluidboxState["status"], index: number | null) => {
    const calls: string[] = [];
    const fluidbox = {
      state: { status, index, count: 4 },
      open: (target: number) => void calls.push(`open ${target}`),
      close: () => void calls.push("close"),
    };
    return { fluidbox: fluidbox as unknown as Fluidbox<any>, calls };
  };

  it("opens on the index, and closes as open turns false", () => {
    const { fluidbox, calls } = stub("closed", null);
    const sync = createFluidboxSync(fluidbox);
    sync(true, 2);
    (fluidbox.state as { status: string }).status = "open";
    sync(false, 2);
    expect(calls).toEqual(["open 2", "close"]);
  });

  it("acts only on the value that changed", () => {
    // The viewer opened on 3 from a trigger. The app heard of the open first
    // and still holds its old index: that must not pull the viewer back.
    const { fluidbox, calls } = stub("closed", null);
    const sync = createFluidboxSync(fluidbox);
    sync(false, 0);
    Object.assign(fluidbox.state, { status: "opening", index: 3 });
    sync(true, 0);
    sync(true, 3);
    expect(calls).toEqual([]);
    // A new index from the app moves the open viewer.
    sync(true, 1);
    expect(calls).toEqual(["open 1"]);
  });

  it("ignores an index out of range, and leaves open undefined to the viewer", () => {
    const { fluidbox, calls } = stub("open", 1);
    const sync = createFluidboxSync(fluidbox);
    sync(undefined, 9);
    sync(undefined, 1.5);
    sync(undefined, 2);
    expect(calls).toEqual(["open 2"]);
  });
});

describe("a trigger", () => {
  it("does nothing on a press after its fluidbox is destroyed", () => {
    const fluidbox = createFluidbox({ items });
    const trigger = createTrigger(fluidbox, { target: "two" });
    fluidbox.destroy();
    const press = { defaultPrevented: false, isPrimary: true, button: 0 } as PointerEvent;
    expect(() => trigger.pointerDown(press)).not.toThrow();
    trigger.destroy();
  });
});
