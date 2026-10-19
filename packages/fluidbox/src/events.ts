import { FluidboxChangeEvent, FluidboxToggleEvent, type FluidboxEventMap } from "./public-api";

export const fluidboxEventTypes = [
  "beforetoggle",
  "toggle",
  "beforeitemchange",
  "itemchange",
  "settle",
] as const satisfies readonly (keyof FluidboxEventMap)[];

/**
 * Fire each fluidbox event of `from` on `to` as well, until `signal` aborts.
 * Canceling the copy cancels the original.
 */
export function forwardEvents(from: EventTarget, to: EventTarget, signal: AbortSignal) {
  const forward = (event: Event) => {
    const copy =
      event instanceof FluidboxToggleEvent
        ? new FluidboxToggleEvent(event.type as "toggle", {
            cancelable: event.cancelable,
            oldState: event.oldState,
            newState: event.newState,
            reason: event.reason,
          })
        : event instanceof FluidboxChangeEvent
          ? new FluidboxChangeEvent(event.type as "itemchange", {
              cancelable: event.cancelable,
              id: event.id,
              index: event.index,
              item: event.item,
              reason: event.reason,
            })
          : null;
    if (copy && !to.dispatchEvent(copy)) event.preventDefault();
  };
  for (const type of fluidboxEventTypes) from.addEventListener(type, forward, { signal });
}
