import type { Fluidbox, FluidboxItem, FluidboxReason, FluidboxTarget } from "./public-api";
import type { FluidboxLabels } from "./labels";
import type { FluidboxOrigin as RuntimeOrigin } from "./runtime-types";

/**
 * What the binding kit reaches behind a fluidbox: commands with a reason, and
 * the origins triggers register. A symbol keeps it off the API.
 */
export interface FluidboxHost {
  registerOrigin(ids: readonly string[], origin: RuntimeOrigin): () => void;
  /** A trigger is likely to be pressed: the pointer rests on it, it's touched or focused. */
  intend(): void;
  command(
    name: "open" | "close" | "next" | "previous",
    target: FluidboxTarget | undefined,
    reason: FluidboxReason,
  ): Promise<boolean>;
  /** Run a zoom control with a reason. */
  zoom(
    name: "zoomIn" | "zoomOut" | "zoomReset",
    reason: "api" | "keyboard" | "pointer",
  ): Promise<boolean>;
  /**
   * Open at `index` with no motion, showing the viewer once its image has
   * decoded, to take over from a copy of it that the server rendered.
   */
  takeOver(value: string): Promise<boolean>;
  /** The link Share shares for an item, or undefined. */
  shareLink(item: FluidboxItem): string | undefined;
  /** Load the slide on show again if it failed. False when it hadn't. */
  retry(): Promise<boolean>;
  /** The labels the viewer uses now. */
  readonly labels: FluidboxLabels;
  /** Drop the viewer and close at once, keeping the bindings, as a binding's unmount does. */
  unload(): void;
}

export const hostKey = Symbol.for("@ogdakke/fluidbox/host");

export function hostOf(fluidbox: Fluidbox<any>): FluidboxHost {
  const host = (fluidbox as unknown as { [hostKey]?: FluidboxHost })[hostKey];
  if (!host)
    throw new TypeError(
      process.env.NODE_ENV === "production"
        ? "fluidbox"
        : "Expected a fluidbox from createFluidbox.",
    );
  return host;
}

export type { FluidboxItem };
