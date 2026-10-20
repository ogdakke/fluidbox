import type {
  Fluidbox,
  FluidboxItemChangeEvent,
  FluidboxReason,
  FluidboxToggleEvent,
} from "./public-api";

/** What made a controlled `open` or `index` change. */
export interface FluidboxChangeDetails {
  readonly reason: FluidboxReason;
}

/**
 * Make the function a binding calls with an app's `open` and `index` each
 * time either changes. It acts only on the one that changed: the app often
 * hears of an open before the move that came with it, and an index it hasn't
 * caught up on yet must not pull the viewer back. `undefined` leaves that one
 * to the viewer, and an index out of range is ignored, as a stale `?photo=`
 * in a URL would be.
 */
export function createFluidboxSync(fluidbox: Fluidbox<any>) {
  let lastOpen: boolean | undefined;
  let lastIndex: number | undefined;
  let first = true;
  return (open?: boolean, index?: number) => {
    const opens = first || open !== lastOpen;
    const moves = first || index !== lastIndex;
    first = false;
    lastOpen = open;
    lastIndex = index;
    const { status, index: current, count } = fluidbox.state;
    const target = Number.isInteger(index) && index! >= 0 && index! < count ? index : undefined;
    const shown = status === "open" || status === "opening";
    if (open === false) {
      if (opens && shown) void fluidbox.close();
    } else if (open && opens && !shown) {
      void fluidbox.open(target ?? current ?? 0);
    } else if (moves && shown && target !== undefined && target !== current) {
      void fluidbox.open(target);
    }
  };
}

/**
 * Report the viewer opening, closing and moving, as controlled `open` and
 * `index` change callbacks, until `signal` aborts.
 */
export function watchFluidbox(
  fluidbox: Fluidbox<any>,
  report: {
    readonly open?: (open: boolean, details: FluidboxChangeDetails) => void;
    readonly index?: (index: number, details: FluidboxChangeDetails) => void;
  },
  signal?: AbortSignal,
) {
  fluidbox.addEventListener(
    "toggle",
    ({ newState, reason }: FluidboxToggleEvent) => report.open?.(newState === "open", { reason }),
    { signal },
  );
  fluidbox.addEventListener(
    "itemchange",
    ({ index, reason }: FluidboxItemChangeEvent) => report.index?.(index, { reason }),
    { signal },
  );
}
