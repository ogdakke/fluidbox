import { describe, expect, it } from "vitest";
import { createFluidbox } from "../src/create-fluidbox";
import { unloadFluidbox } from "../src/kit";
import type { FluidboxImageItem, FluidboxState } from "../src/public-api";

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
