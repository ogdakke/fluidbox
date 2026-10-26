/** Every string the viewer shows or announces. Pass some or all to `labels` to translate them. */
export interface FluidboxLabels {
  /** The dialog's name when the item has no alt text or title. */
  readonly viewer: string;
  readonly close: string;
  readonly previous: string;
  readonly next: string;
  /** A slide's name, and a thumbnail's when its item has no name. */
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
  readonly thumbnails: string;
  /** The thumbnails' list of thumbnails. */
  readonly thumbnailsList: string;
  /** The counter's text. It is hidden from screen readers, which hear `position`. */
  readonly counter: (index: number, count: number) => string;
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
  /** The fullscreen control, while the viewer isn't fullscreen. */
  readonly enterFullscreen: string;
  /** The fullscreen control, while the viewer is fullscreen. */
  readonly exitFullscreen: string;
  readonly download: string;
  readonly share: string;
  /** Announced once Share copied the link. */
  readonly linkCopied: string;
  /**
   * The slideshow control, while the slideshow is paused. Its default lives with the control.
   * @default "Play slideshow"
   */
  readonly playSlideshow?: string;
  /**
   * The slideshow control, while the slideshow plays.
   * @default "Pause slideshow"
   */
  readonly pauseSlideshow?: string;
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
  thumbnails: "Gallery thumbnails",
  thumbnailsList: "Choose a gallery item",
  counter: (index: number, count: number) => `${index + 1} / ${count}`,
  zoomed: "Zoomed image",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  zoomReset: "Fit to screen",
  zoomLevel: (scale: number) => `Zoom ${Math.round(scale * 100)}%`,
  sheet: "Details",
  error: "Unable to load media.",
  retry: "Retry",
  enterFullscreen: "Enter full screen",
  exitFullscreen: "Exit full screen",
  download: "Download",
  share: "Share",
  linkCopied: "Link copied",
});

/** Your labels over the defaults. */
export function resolveLabels(labels: Partial<FluidboxLabels> | undefined): FluidboxLabels {
  return labels ? Object.freeze({ ...defaultLabels, ...labels }) : defaultLabels;
}
