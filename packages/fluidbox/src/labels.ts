/** Every string the viewer shows or announces. Pass some or all to `labels` to translate them. */
export interface FluidboxLabels {
  /** The dialog's name when the item has no alt text or title. */
  readonly viewer: string;
  readonly close: string;
  readonly previous: string;
  readonly next: string;
  /** A slide's name, and what the viewer announces as it moves. */
  readonly position: (index: number, count: number) => string;
  /** The strip of slides. */
  readonly slides: string;
  readonly filmstrip: string;
  /** The filmstrip's list of thumbnails. */
  readonly filmstripList: string;
  /** The scroller of a zoomed image. */
  readonly zoomed: string;
  /** The sheet the runtime makes when the sheet has a `render`. */
  readonly sheet: string;
  /** Shown on a slide whose media failed to load. */
  readonly error: string;
  /** The button that loads failed media again. */
  readonly retry: string;
}

/** The labels the viewer uses for any you don't pass. */
export const defaultLabels: FluidboxLabels = Object.freeze({
  viewer: "Media viewer",
  close: "Close",
  previous: "Previous",
  next: "Next",
  position: (index: number, count: number) => `Item ${index + 1} of ${count}`,
  slides: "Gallery items",
  filmstrip: "Gallery filmstrip",
  filmstripList: "Choose a gallery item",
  zoomed: "Zoomed image",
  sheet: "Details",
  error: "Unable to load media.",
  retry: "Retry",
});

/** Your labels over the defaults. */
export function resolveLabels(labels: Partial<FluidboxLabels> | undefined): FluidboxLabels {
  return labels ? Object.freeze({ ...defaultLabels, ...labels }) : defaultLabels;
}
