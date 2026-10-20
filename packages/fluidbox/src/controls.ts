import { hostOf } from "./host";
import type { FluidboxLabels } from "./labels";
import type { Fluidbox, FluidboxControlName, FluidboxState } from "./public-api";

/** The label, disabled state and command of each default viewer control. */
export interface FluidboxControl {
  /** The data attribute the viewer styles and finds the control by. */
  readonly attribute: `data-fluidbox-${FluidboxControlName}`;
  readonly label: (labels: FluidboxLabels) => string;
  readonly disabled: (state: FluidboxState<any>) => boolean;
  /** Run the command. Pass the click, so its events tell a key from a pointer. */
  readonly run: (fluidbox: Fluidbox<any>, click?: { readonly detail: number }) => Promise<boolean>;
}

const control = (
  name: FluidboxControlName,
  disabled: (state: FluidboxState<any>) => boolean,
): FluidboxControl => ({
  attribute: `data-fluidbox-${name}`,
  label: (labels) => labels[name],
  disabled,
  run: (fluidbox, click) =>
    hostOf(fluidbox).command(
      name,
      undefined,
      click ? (click.detail === 0 ? "keyboard" : "pointer") : "api",
    ),
});

/** Each default control's attribute, label, disabled rule and command. */
export const fluidboxControls: Readonly<Record<FluidboxControlName, FluidboxControl>> = {
  previous: control("previous", (state) => !state.hasPrevious),
  next: control("next", (state) => !state.hasNext),
  close: control("close", (state) => state.status === "closed"),
};

/** The default controls, in the order they render. */
export const controlNames: readonly FluidboxControlName[] = ["previous", "next", "close"];
