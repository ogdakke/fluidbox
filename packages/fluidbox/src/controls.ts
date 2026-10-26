import { hostOf } from "./host";
import { canGoFullscreen, canShare, fileOf } from "./item-file";
import type { FluidboxLabels } from "./labels";
import type { Fluidbox, FluidboxControlName, FluidboxState } from "./public-api";

/** The label, disabled state and command of each default viewer control. */
export interface FluidboxControl {
  /** The data attribute the viewer styles and finds the control by. */
  readonly attribute: `data-fluidbox-${string}`;
  /** Its name, or for the counter its text, which can follow the state. */
  readonly label: (labels: FluidboxLabels, state?: FluidboxState<any>) => string;
  readonly disabled: (state: FluidboxState<any>) => boolean;
  /**
   * It can't work on this device or for this item, so it hides rather than
   * sit in the tab order disabled.
   */
  readonly hidden?: (fluidbox: Fluidbox<any>, state: FluidboxState<any>) => boolean;
  /** For a control that switches, as Slideshow does: whether it is on, shown as `data-active`. */
  readonly active?: (state: FluidboxState<any>) => boolean;
  /** Run the command. Pass the click, so its events tell a key from a pointer. */
  readonly run: (fluidbox: Fluidbox<any>, click?: { readonly detail: number }) => Promise<boolean>;
}

const reasonOf = (click?: { readonly detail: number }) =>
  click ? (click.detail === 0 ? ("keyboard" as const) : ("pointer" as const)) : ("api" as const);

const control = (
  name: "previous" | "next" | "close",
  disabled: (state: FluidboxState<any>) => boolean,
): FluidboxControl => ({
  attribute: `data-fluidbox-${name}`,
  label: (labels) => labels[name],
  disabled,
  run: (fluidbox, click) => hostOf(fluidbox).command(name, undefined, reasonOf(click)),
});

const zoomControl = (
  name: "zoomIn" | "zoomOut" | "zoomReset",
  attribute: `data-fluidbox-${string}`,
  disabled: (zoom: NonNullable<FluidboxState<any>["zoom"]>) => boolean,
): FluidboxControl => ({
  attribute,
  label: (labels) => labels[name],
  disabled: (state) => !state.zoom || disabled(state.zoom),
  run: (fluidbox, click) => hostOf(fluidbox).zoom(name, reasonOf(click)),
});

const closed = (state: FluidboxState<any>) => state.status === "closed";

const action = (
  attribute:
    | "data-fluidbox-fullscreen"
    | "data-fluidbox-download"
    | "data-fluidbox-share"
    | "data-fluidbox-slideshow",
  label: FluidboxControl["label"],
  hidden: NonNullable<FluidboxControl["hidden"]>,
  run: (fluidbox: Fluidbox<any>) => Promise<boolean>,
  active?: FluidboxControl["active"],
): FluidboxControl => ({
  attribute,
  label,
  disabled: closed,
  hidden,
  run,
  active,
});

/** Each default control's attribute, label, disabled rule and command. */
export const fluidboxControls: Readonly<Record<FluidboxControlName, FluidboxControl>> = {
  previous: control("previous", (state) => !state.hasPrevious),
  next: control("next", (state) => !state.hasNext),
  close: control("close", (state) => state.status === "closed"),
  zoomIn: zoomControl("zoomIn", "data-fluidbox-zoom-in", (zoom) => zoom.scale >= zoom.max),
  zoomOut: zoomControl("zoomOut", "data-fluidbox-zoom-out", (zoom) => zoom.scale <= zoom.min),
  zoomReset: zoomControl("zoomReset", "data-fluidbox-zoom-reset", (zoom) => zoom.scale <= zoom.min),
  // Text, not a button: the dialog's name and the announcer already say where you are.
  counter: {
    attribute: "data-fluidbox-counter",
    label: (labels, state) =>
      state?.index == null ? "" : labels.counter(state.index, state.count),
    disabled: () => false,
    run: () => Promise.resolve(false),
  },
  fullscreen: action(
    "data-fluidbox-fullscreen",
    (labels, state) => (state?.fullscreen ? labels.exitFullscreen : labels.enterFullscreen),
    () => !canGoFullscreen(),
    (fluidbox) => fluidbox.setFullscreen(),
    (state) => state.fullscreen,
  ),
  download: action(
    "data-fluidbox-download",
    (labels) => labels.download,
    (_, state) => !state.item || !fileOf(state.item),
    (fluidbox) => fluidbox.download(),
  ),
  share: action(
    "data-fluidbox-share",
    (labels) => labels.share,
    (fluidbox, state) => !state.item || !canShare() || !hostOf(fluidbox).shareLink(state.item),
    (fluidbox) => fluidbox.share(),
  ),
  slideshow: action(
    "data-fluidbox-slideshow",
    // The defaults live here, so only a page with the control carries them.
    (labels, state) =>
      state?.playing
        ? (labels.pauseSlideshow ?? "Pause slideshow")
        : (labels.playSlideshow ?? "Play slideshow"),
    // Without the option it hides, but never while it plays: it is how to stop.
    (fluidbox, state) => !state.playing && !hostOf(fluidbox).slideshow(),
    (fluidbox) => {
      if (fluidbox.state.playing) fluidbox.pause();
      else fluidbox.play();
      return Promise.resolve(true);
    },
    (state) => state.playing,
  ),
  // For an error of your own: it loads the slide on show again.
  retry: {
    attribute: "data-fluidbox-retry",
    label: (labels) => labels.retry,
    disabled: closed,
    run: (fluidbox) => hostOf(fluidbox).retry(),
  },
};

/** The default controls, in the order they render. */
export const controlNames = ["previous", "next", "close"] as const;

/** The zoom controls, shown when `controls` lists them. */
export const zoomControlNames = ["zoomIn", "zoomOut", "zoomReset"] as const;

/** One of the default controls or the zoom controls. */
export type FluidboxIconControlName =
  | (typeof controlNames)[number]
  | (typeof zoomControlNames)[number];

/** Every control a button can be marked as. */
export const allControlNames: readonly FluidboxControlName[] = [
  ...controlNames,
  ...zoomControlNames,
  "counter",
  "fullscreen",
  "download",
  "share",
  "slideshow",
  "retry",
];
