import type {
  Fluidbox,
  FluidboxItem,
  FluidboxItemList,
  FluidboxReason,
  FluidboxTarget,
} from "./public-api";
import type {
  FluidboxOrigin as RuntimeOrigin,
  FluidboxThumbnailOverlayRegistration,
  FluidboxItem as RuntimeItem,
} from "./runtime-types";

/**
 * What the binding kit reaches behind a fluidbox: commands with a reason, and
 * the registrations triggers and overlays make. A symbol keeps it off the API.
 */
export interface FluidboxHost {
  readonly items: FluidboxItemList;
  registerOrigin(ids: readonly string[], origin: RuntimeOrigin): () => void;
  registerOverlay(
    id: string,
    registration: FluidboxThumbnailOverlayRegistration<RuntimeItem>,
  ): () => void;
  preload(target: FluidboxTarget): () => void;
  command(
    name: "open" | "close" | "next" | "previous",
    target: FluidboxTarget | undefined,
    reason: FluidboxReason,
  ): Promise<boolean>;
}

export const hostKey = Symbol.for("@ogdakke/fluidbox/host");

export function hostOf(fluidbox: Fluidbox<any>): FluidboxHost {
  const host = (fluidbox as unknown as { [hostKey]?: FluidboxHost })[hostKey];
  if (!host) throw new TypeError("Expected a fluidbox from createFluidbox.");
  return host;
}

export type { FluidboxItem };
