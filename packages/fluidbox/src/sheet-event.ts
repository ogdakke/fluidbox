import type { FluidboxReason } from "./public-api";

/**
 * Fired when the sheet comes to rest at another stop. A swipe or a scroll of the
 * sheet has the reason "pointer", a wheel "wheel", Escape or a key on a stop
 * button "keyboard", and `setSnap()` or the viewer opening and closing "api".
 */
export class FluidboxSheetEvent extends Event {
  /** The snap the sheet rests at: 0 at rest, then one per snap point. */
  declare readonly snap: number;
  declare readonly reason: FluidboxReason;

  constructor(type: "sheetchange", init: EventInit & { snap: number; reason: FluidboxReason }) {
    super(type, init);
    this.snap = init.snap;
    this.reason = init.reason;
  }
}
