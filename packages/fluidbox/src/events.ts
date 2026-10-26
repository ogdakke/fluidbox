import type { FluidboxEventMap } from "./public-api";

/** The seven event names, for bindings that forward them as props, emits or outputs. */
export const fluidboxEventTypes = [
  "beforevaluechange",
  "valuechange",
  "valuechangecomplete",
  "sheetchange",
  "zoomchange",
  "mediaerror",
  "reachend",
] as const satisfies readonly (keyof FluidboxEventMap)[];

/**
 * A copy of a fluidbox event, to fire on another target: made by the event's
 * own class, so no class is imported here.
 */
function copyOf(event: Event): Event {
  // The event's own fields are its init; `cancelable` is a getter on Event.
  const init = Object.assign({}, event, { cancelable: event.cancelable });
  return new (event.constructor as new (type: string, init: object) => Event)(event.type, init);
}

/**
 * Fire each fluidbox event of `from` on `to` as well, until `signal` aborts.
 * Canceling the copy cancels the original.
 */
export function forwardEvents(from: EventTarget, to: EventTarget, signal: AbortSignal) {
  const forward = (event: Event) => {
    if (!to.dispatchEvent(copyOf(event))) event.preventDefault();
  };
  for (const type of fluidboxEventTypes) from.addEventListener(type, forward, { signal });
}
