import type { FluidboxItem } from "./public-api";
import type { SessionController } from "./runtime-types";

// The item type keeps it in step with the other events, which carry the item.
/** The open item came within `reachEndThreshold` of the last: time to load more. */
export class FluidboxReachEndEvent<_TItem extends FluidboxItem = FluidboxItem> extends Event {
  // Declared, as the constructor sets them: a field would cost bytes in every entry.
  declare readonly value: string;
  declare readonly index: number;
  /** The item count it fired for. It fires once per count. */
  declare readonly count: number;

  constructor(type: "reachend", init: EventInit & { value: string; index: number; count: number }) {
    super(type, init);
    this.value = init.value;
    this.index = init.index;
    this.count = init.count;
  }
}

/**
 * Fire `reachend` if the item the viewer settled on is within the threshold
 * of the end. True when it fired. The viewer calls it once per item count,
 * and never with a loop.
 */
export function reachEnd(controller: SessionController<any>): boolean {
  const { status, value, index, count } = controller.state;
  // A threshold that isn't a number from 0 up, or a numeric string, is the default.
  const given = controller.reachEndThreshold?.();
  const number = given === "" || given == null ? NaN : Number(given);
  const threshold = number >= 0 && number < Infinity ? number : 2;
  if (status !== "open" || value === null || index === null || index < count - 1 - threshold) {
    return false;
  }
  controller.reachEnd?.(new FluidboxReachEndEvent("reachend", { value, index, count }));
  return true;
}
