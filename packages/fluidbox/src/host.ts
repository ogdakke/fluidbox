import type { Fluidbox, FluidboxItem, FluidboxReason, FluidboxTarget } from "./public-api";
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
  /**
   * Open at `index` with no motion, showing the viewer once its image has
   * decoded, to take over from a copy of it that the server rendered.
   */
  takeOver(index: number): Promise<boolean>;
  /** Drop the viewer and close at once, keeping the bindings, as a binding's unmount does. */
  unload(): void;
}

export const hostKey = Symbol.for("@ogdakke/fluidbox/host");

export function hostOf(fluidbox: Fluidbox<any>): FluidboxHost {
  const host = (fluidbox as unknown as { [hostKey]?: FluidboxHost })[hostKey];
  if (!host) throw new TypeError("Expected a fluidbox from createFluidbox.");
  return host;
}

export type { FluidboxItem };
