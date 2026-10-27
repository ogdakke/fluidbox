import { describe, expect, it } from "vitest";
import { hotspotLayer } from "../src/hotspots";

/**
 * A media box with an image in it, and the window's observer and frames,
 * enough for the hotspots' layout: there is no document here.
 */
function fakeBox() {
  const frames: (() => void)[] = [];
  const observed: unknown[] = [];
  const unobserved: unknown[] = [];
  const revived: unknown[] = [];
  const resized: (() => void)[] = [];
  let off = false;
  class Observer {
    constructor(callback: () => void) {
      resized.push(callback);
    }
    observe(target: unknown) {
      (off ? revived : observed).push(target);
    }
    unobserve(target: unknown) {
      unobserved.push(target);
    }
    disconnect() {
      off = true;
    }
  }
  const makeImage = () => ({
    getClientRects: () => [{}],
    getAttribute: () => null,
    naturalWidth: 1600,
    naturalHeight: 1600,
    offsetLeft: 0,
    offsetTop: 0,
    offsetParent: null as unknown,
  });
  let image = makeImage();
  const inBox = new Set<unknown>();
  const media = {
    ownerDocument: {
      defaultView: {
        ResizeObserver: Observer,
        requestAnimationFrame: (frame: () => void) => frames.push(frame),
        getComputedStyle: () => ({
          width: "100px",
          height: "100px",
          objectFit: "contain",
          objectPosition: "50% 50%",
        }),
      },
    },
    clientWidth: 100,
    clientHeight: 100,
    querySelector: () => image,
    querySelectorAll: () => [image],
    addEventListener: () => {},
    contains: (node: unknown) => inBox.has(node),
  };
  image.offsetParent = media;
  const button = {
    style: {} as Record<string, string>,
    toggleAttribute: () => {},
    textContent: "Books",
    offsetParent: null as unknown,
    isConnected: true,
    querySelector: () => null,
    getAttribute: () => null,
  };
  button.offsetParent = media;
  inBox.add(button);
  /** A new image in the box, as a slide that draws another has. */
  const swapImage = () => {
    image = makeImage();
    image.offsetParent = media;
  };
  return { media, button, frames, observed, unobserved, revived, resized, inBox, swapImage };
}

describe("hotspots", () => {
  it("place a pin on its point a frame after it is placed", () => {
    const { media, button, frames } = fakeBox();
    const place = hotspotLayer(media as never, () => ({}), new AbortController().signal);
    place(button as never, { x: "25%", y: 800 });
    for (const frame of frames.splice(0)) frame();
    expect([button.style.left, button.style.top]).toEqual(["25%", "50%"]);
  });

  it("leave their observer off when a frame comes after the slide went", () => {
    const { media, button, frames, observed, revived } = fakeBox();
    const slide = new AbortController();
    const place = hotspotLayer(media as never, () => ({}), slide.signal);
    place(button as never, { x: "25%", y: "50%" });
    slide.abort();
    for (const frame of frames.splice(0)) frame();
    expect(observed).toEqual([media]);
    expect(revived).toEqual([]);
    expect(button.style.left).toBeUndefined();
  });

  it("let go of a pin taken out of the box", () => {
    const { media, button, frames, resized, inBox } = fakeBox();
    const place = hotspotLayer(media as never, () => ({}), new AbortController().signal);
    place(button as never, { x: "25%", y: "50%" });
    inBox.delete(button);
    for (const frame of frames.splice(0)) frame();
    // Back in the box without being placed again: a resize no longer places it.
    inBox.add(button);
    resized[0]!();
    expect(button.style.left).toBeUndefined();
    // Placed again, it is.
    place(button as never, { x: "25%", y: "50%" });
    for (const frame of frames.splice(0)) frame();
    expect(button.style.left).toBe("25%");
  });

  it("observe the box's image, and stop observing one it no longer shows", () => {
    const { media, button, frames, observed, unobserved, resized, swapImage } = fakeBox();
    const place = hotspotLayer(media as never, () => ({}), new AbortController().signal);
    place(button as never, { x: "25%", y: "50%" });
    for (const frame of frames.splice(0)) frame();
    const [, first] = observed;
    swapImage();
    resized[0]!();
    expect(observed).toHaveLength(3);
    expect(unobserved).toEqual([first]);
  });
});
