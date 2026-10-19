import {
  FluidboxItemChangeEvent,
  FluidboxSheetEvent,
  FluidboxToggleEvent,
  type FluidboxEventMap,
} from "./public-api";

/** The six event names, for bindings that forward them as props, emits or outputs. */
export const fluidboxEventTypes = [
  "beforetoggle",
  "toggle",
  "beforeitemchange",
  "itemchange",
  "settle",
  "sheetchange",
] as const satisfies readonly (keyof FluidboxEventMap)[];

/** A copy of a fluidbox event, to fire on another target. */
function copyOf(event: Event): Event | null {
  if (event instanceof FluidboxToggleEvent) {
    return new FluidboxToggleEvent(event.type as "toggle", {
      cancelable: event.cancelable,
      oldState: event.oldState,
      newState: event.newState,
      reason: event.reason,
    });
  }
  if (event instanceof FluidboxItemChangeEvent) {
    return new FluidboxItemChangeEvent(event.type as "itemchange", {
      cancelable: event.cancelable,
      id: event.id,
      index: event.index,
      item: event.item,
      reason: event.reason,
    });
  }
  if (event instanceof FluidboxSheetEvent) {
    return new FluidboxSheetEvent("sheetchange", { stop: event.stop, reason: event.reason });
  }
  return null;
}

/**
 * Fire each fluidbox event of `from` on `to` as well, until `signal` aborts.
 * Canceling the copy cancels the original.
 */
export function forwardEvents(from: EventTarget, to: EventTarget, signal: AbortSignal) {
  const forward = (event: Event) => {
    const copy = copyOf(event);
    if (copy && !to.dispatchEvent(copy)) event.preventDefault();
  };
  for (const type of fluidboxEventTypes) from.addEventListener(type, forward, { signal });
}
