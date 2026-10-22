import { hostOf } from "./host";
import type { FluidboxLabels } from "./labels";
import type { Fluidbox, FluidboxControlName, FluidboxState } from "./public-api";

/** The label, disabled state and command of each default viewer control. */
export interface FluidboxControl {
  /** The data attribute the viewer styles and finds the control by. */
  readonly attribute: `data-fluidbox-${string}`;
  readonly label: (labels: FluidboxLabels) => string;
  readonly disabled: (state: FluidboxState<any>) => boolean;
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

/** Each default control's attribute, label, disabled rule and command. */
export const fluidboxControls: Readonly<Record<FluidboxControlName, FluidboxControl>> = {
  previous: control("previous", (state) => !state.hasPrevious),
  next: control("next", (state) => !state.hasNext),
  close: control("close", (state) => state.status === "closed"),
  zoomIn: zoomControl("zoomIn", "data-fluidbox-zoom-in", (zoom) => zoom.scale >= zoom.max),
  zoomOut: zoomControl("zoomOut", "data-fluidbox-zoom-out", (zoom) => zoom.scale <= zoom.min),
  zoomReset: zoomControl("zoomReset", "data-fluidbox-zoom-reset", (zoom) => zoom.scale <= zoom.min),
};

/** The default controls, in the order they render. */
export const controlNames: readonly FluidboxControlName[] = ["previous", "next", "close"];

/** The zoom controls, shown when `controls` lists them. */
export const zoomControlNames: readonly FluidboxControlName[] = ["zoomIn", "zoomOut", "zoomReset"];

/** Every control a button can be marked as. */
export const allControlNames: readonly FluidboxControlName[] = [
  ...controlNames,
  ...zoomControlNames,
];
