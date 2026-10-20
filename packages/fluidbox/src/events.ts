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

const eventClasses: (new (type: any, init: any) => Event)[] = [
  FluidboxToggleEvent,
  FluidboxItemChangeEvent,
  FluidboxSheetEvent,
];

/** A copy of a fluidbox event, to fire on another target. */
function copyOf(event: Event): Event | null {
  const EventClass = eventClasses.find((each) => event instanceof each);
  // The event's own fields are its init; `cancelable` is a getter on Event.
  const init = Object.assign({}, event, { cancelable: event.cancelable });
  return EventClass ? new EventClass(event.type, init) : null;
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
