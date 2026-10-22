/** Every string the viewer shows or announces. Pass some or all to `labels` to translate them. */
export interface FluidboxLabels {
  /** The dialog's name when the item has no alt text or title. */
  readonly viewer: string;
  readonly close: string;
  readonly previous: string;
  readonly next: string;
  /** A slide's name, and a filmstrip thumbnail's when its item has no name. */
  readonly position: (index: number, count: number) => string;
  /**
   * What the viewer announces as it moves to an item, with the item's alt text
   * or title. As it opens, the dialog's name already says that, so `name` is "".
   */
  readonly announcement: (name: string, index: number, count: number) => string;
  /** The strip of slides. */
  readonly slides: string;
  /** What the strip of slides is, to a screen reader. */
  readonly carousel: string;
  /** What each slide is, to a screen reader. */
  readonly slide: string;
  readonly filmstrip: string;
  /** The filmstrip's list of thumbnails. */
  readonly filmstripList: string;
  /** The scroller of a zoomed image. */
  readonly zoomed: string;
  /** The zoom-in control. */
  readonly zoomIn: string;
  /** The zoom-out control. */
  readonly zoomOut: string;
  /** The control that zooms back out to fit. */
  readonly zoomReset: string;
  /** What the viewer announces as the zoom comes to rest at a scale. */
  readonly zoomLevel: (scale: number) => string;
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
  announcement: (name: string, index: number, count: number) =>
    name ? `${name}, ${index + 1} of ${count}` : `Item ${index + 1} of ${count}`,
  slides: "Gallery items",
  carousel: "carousel",
  slide: "slide",
  filmstrip: "Gallery filmstrip",
  filmstripList: "Choose a gallery item",
  zoomed: "Zoomed image",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  zoomReset: "Fit to screen",
  zoomLevel: (scale: number) => `Zoom ${Math.round(scale * 100)}%`,
  sheet: "Details",
  error: "Unable to load media.",
  retry: "Retry",
});

/** Your labels over the defaults. */
export function resolveLabels(labels: Partial<FluidboxLabels> | undefined): FluidboxLabels {
  return labels ? Object.freeze({ ...defaultLabels, ...labels }) : defaultLabels;
}
