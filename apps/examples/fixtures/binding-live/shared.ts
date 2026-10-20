/**
 * The binding live-options fixture: one album cover whose travelling count
 * holds a frame layer, with handles to change the labels, the viewer part and loop.
 *
 * Hooks: `[data-test=trigger]` the cover, `[data-test=count]` the overlay,
 * `[data-test=layer]` its frame layer, `[data-test=custom-viewer]` the custom
 * viewer content while the viewer part is mounted. Every one has a filmstrip,
 * which a redraw of the viewer's layer must leave in place.
 */
import type { FluidboxLabels } from "@ogdakke/fluidbox";
import { album } from "../../src/patterns/shared";

export { album };

export type LiveFramework = "elements" | "javascript" | "react" | "solid" | "vue" | "angular";

export interface LiveControls {
  /** Set the Root's labels, or clear them with `undefined`. */
  setLabels(labels: Partial<FluidboxLabels> | undefined): void;
  /** Mount or unmount the viewer part with custom content. */
  setViewer(on: boolean): void;
  /** Turn looping on or off. */
  setLoop(on: boolean): void;
}

/** Mount the fixture into `root` and hand back its controls once it renders. */
export type MountLive = (root: HTMLElement) => LiveControls | Promise<LiveControls>;

declare global {
  interface Window {
    __live: LiveControls;
  }
}

export const coverAlt = "Album cover";
export const countText = `+${album.length - 1}`;
export const customViewerText = "Custom viewer";
