import type { FluidboxItem, FluidboxSlide } from "@ogdakke/fluidbox";

const none = (): never => {
  throw new Error("An add-on in a framework slide draws no built-in media.");
};

/**
 * The slide a plain-JS add-on draws into, from a framework slide's context:
 * an element of the component's own is its box. It doesn't zoom, holds no
 * open, and has no built-in media to draw.
 */
export function addonSlide<TItem extends FluidboxItem>(
  context: {
    readonly item: TItem;
    readonly index: number;
    readonly active: boolean;
    onActiveChange(listener: (active: boolean) => void): () => unknown;
  },
  media: HTMLElement,
  signal: AbortSignal,
): FluidboxSlide<TItem> {
  return {
    item: context.item,
    index: context.index,
    media,
    layer: media,
    signal,
    get active() {
      return context.active;
    },
    opening: false,
    onActiveChange: (listener) => {
      const stop = context.onActiveChange(listener);
      return () => void stop();
    },
    origin: null,
    returnPlayback: () => () => {},
    zoomable: () => {},
    onZoom: () => () => {},
    waitUntil: () => {},
    fail: () => {},
    drawImage: none,
    drawVideo: none,
    drawIframe: none,
  };
}
