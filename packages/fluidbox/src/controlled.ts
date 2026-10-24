import { idOf } from "./items";
import type {
  Fluidbox,
  FluidboxItem,
  FluidboxReason,
  FluidboxValue,
  FluidboxValueChangeDetails,
  FluidboxValueChangeEvent,
} from "./public-api";

/**
 * Make the function a binding calls with an app's controlled `value`. A value
 * is a request: one that differs from where the viewer is, or is going,
 * opens, moves or closes it there, so writing back the value the viewer just
 * reported does nothing. `undefined` leaves the viewer to itself, and an id the
 * items don't hold counts as null, with a warning in development.
 */
export function createFluidboxSync(fluidbox: Fluidbox<any>) {
  return (value?: FluidboxValue) => {
    if (value === undefined) return;
    const { status, value: current } = fluidbox.state;
    const shown = status === "open" || status === "opening";
    let index: number | null = null;
    if (value !== null) {
      index = fluidbox.items.indexOf?.(value) ?? null;
      if (index === null) {
        for (let at = 0; at < fluidbox.items.count; at++) {
          if (idOf(fluidbox.items.get(at)) === value) index = at;
        }
      }
      if (index === null || index < 0) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`Fluidbox value names no item: ${value}. It counts as null.`);
        }
        index = null;
      }
    }
    if (index === null) {
      if (shown) void fluidbox.close();
    } else if (!shown || value !== current) {
      void fluidbox.open(index);
    }
  };
}

/** The details a binding's value-change callback gets, over the before-event behind them. */
export function valueChangeDetails<TItem extends FluidboxItem>(
  event: FluidboxValueChangeEvent<TItem>,
): FluidboxValueChangeDetails<TItem> {
  return {
    reason: event.reason,
    action: event.action,
    index: event.index,
    item: event.item,
    previousValue: event.previousValue,
    event: undefined,
    cancel: () => event.preventDefault(),
    get isCanceled() {
      return event.defaultPrevented;
    },
  };
}

/**
 * Report the viewer's value as a binding's controlled callbacks want it, until
 * `signal` aborts: `value` before every open, move and close, where the
 * details can cancel it, and `complete` once its motion settled.
 */
export function watchFluidbox<TItem extends FluidboxItem = FluidboxItem>(
  fluidbox: Fluidbox<TItem>,
  report: {
    readonly value?: (value: FluidboxValue, details: FluidboxValueChangeDetails<TItem>) => void;
    readonly complete?: (value: FluidboxValue, details: FluidboxValueChangeDetails<TItem>) => void;
  },
  signal?: AbortSignal,
) {
  fluidbox.addEventListener(
    "beforevaluechange",
    (event) => report.value?.(event.value, valueChangeDetails(event)),
    { signal },
  );
  fluidbox.addEventListener(
    "valuechangecomplete",
    (event) => report.complete?.(event.value, valueChangeDetails(event)),
    { signal },
  );
}

/** What made a controlled `open` or `index` change. */
export interface FluidboxChangeDetails {
  readonly reason: FluidboxReason;
}

/**
 * Until the Vue, Solid and Angular bindings and the custom elements take a
 * `value`: the function they call with an app's `open` and `index` each time
 * either changes. It acts only on the one that changed: the app often hears of
 * an open before the move that came with it, and an index it hasn't caught up
 * on yet must not pull the viewer back. `undefined` leaves that one to the
 * viewer, and an index out of range is ignored, as a stale `?photo=` in a URL
 * would be.
 */
export function createOpenIndexSync(fluidbox: Fluidbox<any>) {
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
 * Until the Vue, Solid and Angular bindings take a `value`: report the viewer
 * opening, closing and moving as controlled `open` and `index` change
 * callbacks, until `signal` aborts.
 */
export function watchOpenIndex(
  fluidbox: Fluidbox<any>,
  report: {
    readonly open?: (open: boolean, details: FluidboxChangeDetails) => void;
    readonly index?: (index: number, details: FluidboxChangeDetails) => void;
  },
  signal?: AbortSignal,
) {
  fluidbox.addEventListener(
    "valuechange",
    ({ action, index, reason }: FluidboxValueChangeEvent) => {
      if (action !== "move") report.open?.(action === "open", { reason });
      if (index !== null) report.index?.(index, { reason });
    },
    { signal },
  );
}
