import type { FluidboxItem, FluidboxMediaErrorKind, FluidboxReason } from "./public-api";

// Fields are declared, as the constructors set them: a field would cost bytes.
/**
 * Fired when the image on show comes to rest at another zoom, back at 1 as
 * the viewer moves on or closes included. Never fired per frame. A pinch or a
 * double-tap has the reason "pointer", a ctrl-wheel or trackpad pinch
 * "wheel", the `+`, `-`, `0` and arrow keys "keyboard", and a command "api".
 */
export class FluidboxZoomEvent extends Event {
  /** The scale the image rests at. */
  declare readonly scale: number;
  declare readonly reason: FluidboxReason;

  constructor(type: "zoomchange", init: EventInit & { scale: number; reason: FluidboxReason }) {
    super(type, init);
    this.scale = init.scale;
    this.reason = init.reason;
  }
}

/**
 * Fired each time a slide enters its error state, neighbours too, and when a
 * zoom image fails to load (then no error shows). Not cancelable.
 */
export class FluidboxMediaErrorEvent<TItem extends FluidboxItem = FluidboxItem> extends Event {
  declare readonly value: string;
  declare readonly index: number;
  declare readonly item: TItem;
  declare readonly kind: FluidboxMediaErrorKind;
  /** The DOM event, the TypeError of a refused URL, or what `slide.fail` got. */
  declare readonly cause: unknown;

  constructor(
    type: "mediaerror",
    init: EventInit & {
      value: string;
      index: number;
      item: TItem;
      kind: FluidboxMediaErrorKind;
      cause?: unknown;
    },
  ) {
    super(type, init);
    this.value = init.value;
    this.index = init.index;
    this.item = init.item;
    this.kind = init.kind;
    this.cause = init.cause;
  }
}
