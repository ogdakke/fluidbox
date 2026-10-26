import { afterEach, describe, expect, it, vi } from "vitest";
import type { FluidboxItem } from "../src/public-api";
import { ViewerSlideshow } from "../src/viewer-slideshow";

const items = ["one", "two", "three"].map(
  (id) => ({ id, type: "image", src: `/${id}.jpg`, alt: id, width: 1, height: 1 }) as FluidboxItem,
);

/** A slideshow on a stand-in viewer, open on the first of three items, whose moves fail. */
function setup() {
  const page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const dialog = Object.assign(new EventTarget(), { ownerDocument: page });
  const state = { status: "open", index: 0, count: 3, item: items[0] };
  const goTo = vi.fn(() => Promise.reject(new Error("the move failed")));
  const slideshow = new ViewerSlideshow({
    controller: () => ({ state, goTo, changed: () => {} }) as never,
    loops: () => false,
    ready: () => Promise.resolve(),
    slide: () => undefined,
    dialog: dialog as never,
    status: { setAttribute: () => {} } as never,
  });
  return { slideshow, goTo };
}

describe("ViewerSlideshow", () => {
  afterEach(() => vi.useRealTimers());

  it("waits another interval after a move that rejects, and stays playing", async () => {
    vi.useFakeTimers();
    const { slideshow, goTo } = setup();
    slideshow.play();
    await vi.advanceTimersByTimeAsync(5000);
    expect(goTo).toHaveBeenCalledTimes(1);
    expect(slideshow.playing).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(goTo).toHaveBeenCalledTimes(2);
    // A pause after it leaves nothing behind.
    slideshow.pause();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(goTo).toHaveBeenCalledTimes(2);
  });
});
