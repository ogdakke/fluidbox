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
        // Development builds only; a page without a bundler has no process.
        try {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`Fluidbox value names no item: ${value}. It counts as null.`);
          }
        } catch {}
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
