import type { FluidboxImageItem, FluidboxReachEndEvent } from "@ogdakke/fluidbox";

/**
 * The gallery each slides fixture grows on reachend: four photos, four more
 * each time the viewer nears the end. The tests read what it heard and set
 * its count and threshold through `window.growth`.
 */
export const growth = {
  /** Each reachend heard: its value, index and count. */
  reachEnds: [] as [string, number, number][],
  /** Whether a reachend appends four photos. */
  grows: true,
  /** Show the first `count` photos. Each fixture sets it. */
  setCount: (_count: number) => {},
  /** Change the reachEndThreshold after mount. Each fixture sets it. */
  setThreshold: (_threshold: number) => {},
};

declare global {
  interface Window {
    growth: typeof growth;
  }
}
window.growth = growth;

const grown: FluidboxImageItem[] = [];

/** The first `count` photos, the same objects each time. */
export function growingPhotos(count: number): FluidboxImageItem[] {
  for (let index = grown.length; index < count; index++) {
    const src = index % 2 ? "/photo-portrait.svg" : "/photo-square.svg";
    grown.push({
      type: "image",
      id: `grow-${index}`,
      src,
      alt: `Photo grow-${index}`,
      width: 800,
      height: index % 2 ? 1200 : 800,
    });
  }
  return grown.slice(0, count);
}

/** Note a reachend; the count to grow to, or null. */
export function reached({ value, index, count }: FluidboxReachEndEvent): number | null {
  growth.reachEnds.push([value, index, count]);
  return growth.grows ? count + 4 : null;
}
