import { describe, expect, it } from "vitest";
import { forwardEvents } from "../src/events";
import { FluidboxMediaErrorEvent, FluidboxZoomEvent } from "../src/public-api";
import { FluidboxReachEndEvent } from "../src/reach-end-event";

describe("forwardEvents", () => {
  it("copies each event as its own class, fields included, and passes a cancel back", () => {
    const from = new EventTarget();
    const to = new EventTarget();
    const heard: Event[] = [];
    const forwarding = new AbortController();
    forwardEvents(from, to, forwarding.signal);
    for (const type of ["reachend", "zoomchange", "mediaerror"]) {
      to.addEventListener(type, (event) => heard.push(event));
    }
    from.dispatchEvent(new FluidboxReachEndEvent("reachend", { value: "a", index: 8, count: 10 }));
    expect(heard[0]).toBeInstanceOf(FluidboxReachEndEvent);
    expect(heard[0]).toMatchObject({ type: "reachend", value: "a", index: 8, count: 10 });
    from.dispatchEvent(new FluidboxZoomEvent("zoomchange", { scale: 2, reason: "api" } as never));
    expect(heard[1]).toBeInstanceOf(FluidboxZoomEvent);
    expect(heard[1]).toMatchObject({ scale: 2 });
    to.addEventListener("mediaerror", (event) => event.preventDefault());
    const error = new FluidboxMediaErrorEvent("mediaerror", {
      cancelable: true,
      value: "a",
      index: 0,
      item: { type: "image", id: "a", src: "/a.jpg", alt: "", width: 1, height: 1 },
      kind: "load",
    } as never);
    expect(from.dispatchEvent(error)).toBe(false);
    expect(heard[2]).toBeInstanceOf(FluidboxMediaErrorEvent);
    forwarding.abort();
    from.dispatchEvent(new FluidboxReachEndEvent("reachend", { value: "b", index: 9, count: 10 }));
    expect(heard).toHaveLength(3);
  });
});
