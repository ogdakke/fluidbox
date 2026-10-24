import { describe, expect, it, vi } from "vitest";
import { createFluidbox } from "../src/create-fluidbox";
import { createFluidboxSync, unloadFluidbox } from "../src/kit";
import { createTrigger } from "../src/trigger";
import type { Fluidbox, FluidboxImageItem, FluidboxState } from "../src/public-api";

const items: FluidboxImageItem[] = [
  { id: "one", type: "image", src: "/one.jpg", alt: "One", width: 4, height: 3 },
  { id: "two", type: "image", src: "/two.jpg", alt: "Two", width: 4, height: 3 },
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
    const fluidbox = createFluidbox({ items, thumbnails: true });
    expect(() => fluidbox.update({ sheet: true })).not.toThrow();
    // The fluidbox loads them itself; wait for the same modules.
    await Promise.all([import("../src/thumbnails-entry"), import("../src/sheet-entry")]);
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
  const stub = (status: FluidboxState["status"], value: string | null) => {
    const calls: string[] = [];
    const fluidbox = {
      state: { status, value, count: 4 },
      items: { count: 4, get: (index: number) => ({ id: `item-${index}` }) },
      open: (target: number) => void calls.push(`open ${target}`),
      close: () => void calls.push("close"),
    };
    return { fluidbox: fluidbox as unknown as Fluidbox<any>, calls };
  };

  it("opens on the value's item, and closes on null", () => {
    const { fluidbox, calls } = stub("closed", null);
    const sync = createFluidboxSync(fluidbox);
    sync("item-2");
    Object.assign(fluidbox.state, { status: "open", value: "item-2" });
    sync(null);
    expect(calls).toEqual(["open 2", "close"]);
  });

  it("does nothing for the value the viewer is at or going to", () => {
    // The viewer opened on item-3 from a trigger and the app wrote it back.
    const { fluidbox, calls } = stub("opening", "item-3");
    const sync = createFluidboxSync(fluidbox);
    sync("item-3");
    sync(undefined);
    expect(calls).toEqual([]);
    // Another value moves the open viewer.
    sync("item-1");
    expect(calls).toEqual(["open 1"]);
  });

  it("counts an id the items don't hold as null, with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { fluidbox, calls } = stub("open", "item-1");
      const sync = createFluidboxSync(fluidbox);
      sync("missing");
      expect(calls).toEqual(["close"]);
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it("leaves a closed viewer closed on null", () => {
    const { fluidbox, calls } = stub("closed", null);
    createFluidboxSync(fluidbox)(null);
    expect(calls).toEqual([]);
  });
});

describe("a trigger", () => {
  it("does nothing on a press after its fluidbox is destroyed", () => {
    const fluidbox = createFluidbox({ items });
    const trigger = createTrigger(fluidbox, { value: "two" });
    fluidbox.destroy();
    const press = { defaultPrevented: false, isPrimary: true, button: 0 } as PointerEvent;
    expect(() => trigger.pointerDown(press)).not.toThrow();
    trigger.destroy();
  });
});
