/**
 * The CSS the runtime publishes: the custom properties it sets, the parts it
 * marks and the state attributes it toggles. The CSS reference is generated
 * from this map, and the docs build fails while a name here is missing from
 * the runtime and the stylesheets, or a `--fluidbox-*` or `data-fluidbox-*`
 * name there is in neither this map nor a stylesheet's doc comments.
 *
 * The inputs you set are documented where the stylesheets declare or read
 * them, in `/** … *\/` comments. Nothing imports this module.
 */

export interface CssName {
  /** The names one row covers. */
  readonly names: readonly string[];
  /** The elements that carry it. */
  readonly on?: string;
}

/** Values the runtime sets. Read them for your own effects; don't set them. */
export const publishedValues: readonly CssName[] = [
  /** `1` at the thumbnail, `0` fully open. A registered `<number>`. */
  {
    names: ["--fluidbox-closed"],
    on: "Thumbnail overlays, travelling copies, transition layers",
  },
  /** `0` to `1` during a drag to dismiss; at most `0.6` for a wheel. */
  { names: ["--fluidbox-dismiss-progress"], on: "Overlay" },
  /** The drag's offset in pixels. */
  { names: ["--fluidbox-drag-x", "--fluidbox-drag-y"], on: "Overlay" },
  /** The current media's drawn size, without flight or zoom. */
  { names: ["--fluidbox-media-width", "--fluidbox-media-height"], on: "Dialog" },
  /** The window's inner height in pixels. */
  { names: ["--fluidbox-height"], on: "Overlay" },
  /** The page's scroll position, where the container sits. */
  { names: ["--fluidbox-scroll-top"], on: "Overlay" },
  /** The stage's height: `--fluidbox-height` less the stage insets and the filmstrip space. */
  { names: ["--fluidbox-content-height"], on: "Dialog" },
  /** Pixels of the sheet showing. */
  { names: ["--fluidbox-sheet-visible"], on: "Overlay" },
  /** `0` at rest to `1` at the first stop. */
  { names: ["--fluidbox-sheet-progress"], on: "Overlay" },
  /** `0` at the first stop to `1` at the top stop. */
  { names: ["--fluidbox-sheet-expand"], on: "Overlay" },
  /** `1` with the photo scrolled away to `0` at rest, with `dismiss: "scroll"`. */
  { names: ["--fluidbox-sheet-dismiss"], on: "Overlay" },
  /** Pixels the software keyboard covers, while a sheet field has focus. */
  { names: ["--fluidbox-sheet-keyboard"], on: "Overlay" },
];

/** The elements of the viewer, and the attributes that mark your own. */
export const parts: readonly CssName[] = [
  /** The viewer's root, at the end of `<body>` while open. */
  { names: ["data-fluidbox-overlay"] },
  /**
   * On the overlay's copy a server renders when the page starts open. It sits
   * absolute at the top of the page until the viewer takes over, then hides.
   */
  { names: ["data-fluidbox-static"] },
  /** The backdrop. A click on it closes the viewer. */
  { names: ["data-fluidbox-backdrop"] },
  /** The viewport-sized box at the page's scroll position. */
  { names: ["data-fluidbox-container"] },
  /** The dialog, with `role="dialog"` and `aria-modal="true"`. It carries the state attributes. */
  { names: ["data-fluidbox-dialog"] },
  /** The horizontal scroller of slides. */
  { names: ["data-fluidbox-slides"] },
  /** A slide. `aria-hidden="false"` on the current one. */
  { names: ["data-fluidbox-slide"] },
  /** The box that crops and rounds the media. */
  { names: ["data-fluidbox-frame"] },
  /** A frame that holds an image. */
  { names: ["data-fluidbox-image-frame"] },
  /** The `<img>`, `<video>`, `<iframe>` or custom content element. */
  { names: ["data-fluidbox-media"] },
  /** A custom slide's content element. */
  { names: ["data-fluidbox-item-content"] },
  /** A framework binding's wrapper inside custom content, with `display: contents`. */
  { names: ["data-fluidbox-mount"] },
  /** The item's `placeholder` image. */
  { names: ["data-fluidbox-slide-placeholder"] },
  /** The item's `thumbnail` image. */
  { names: ["data-fluidbox-slide-preview"] },
  /** The still over an iframe until it loads. */
  { names: ["data-fluidbox-media-cover"] },
  /** The "Unable to load media." message with its Retry button. */
  { names: ["data-fluidbox-error"] },
  /** A visually hidden live region. */
  { names: ["data-fluidbox-announcer"] },
  /** The viewer's layer, where your controls and captions go. */
  { names: ["data-fluidbox-portal"] },
  /** Beside the viewer's layer. The filmstrip goes here, so the layer holds only your content. It takes no box. */
  { names: ["data-fluidbox-addons"] },
  /** The controls. On a button of yours in the viewer, it runs that command. */
  { names: ["data-fluidbox-close", "data-fluidbox-previous", "data-fluidbox-next"] },
  /** The zoom controls. On a button of yours in the viewer, it zooms the image on show. */
  { names: ["data-fluidbox-zoom-in", "data-fluidbox-zoom-out", "data-fluidbox-zoom-reset"] },
  /** The group of the default zoom controls, under the photo. */
  { names: ["data-fluidbox-zoom-controls"] },
  /** The hover zoom add-on's magnified view, over the hovered image. */
  { names: ["data-fluidbox-hover-zoom"] },
  /** The SVG inside a default control. */
  { names: ["data-fluidbox-icon"] },
  /** A layer outside the viewer's layer that shows and hides with the controls. Content in the layer does this already. */
  { names: ["data-fluidbox-chrome"] },
  /**
   * Content that keeps its own touches, pinches, wheel and arrow keys, as the
   * filmstrip, the sheet, a spin and a 3D model do. The viewer doesn't swipe,
   * dismiss, zoom or step from them. Mark your own scrubbers and sliders with
   * it, and give them the `touch-action` they need.
   */
  { names: ["data-fluidbox-owns-input"] },
  /**
   * An element in the viewer that describes the dialog: its `aria-describedby`,
   * such as a caption that adds what the item's name doesn't say.
   */
  { names: ["data-fluidbox-description"] },
  /**
   * Outside the viewer: an element it never makes inert while open, such as the
   * root your popovers, menus or toasts render into.
   */
  { names: ["data-fluidbox-exempt"] },
  /** The scroller a zoomed image pans in. `data-grabbing` while dragged. */
  { names: ["data-fluidbox-zoom-viewport"] },
  /** The filmstrip's box, in `[data-fluidbox-addons]`. Place it with your own CSS. */
  { names: ["data-fluidbox-filmstrip-dock"] },
  /** The filmstrip. */
  { names: ["data-fluidbox-filmstrip"] },
  /** Its scroller, `role="listbox"`. */
  { names: ["data-fluidbox-filmstrip-scroll"] },
  /** A thumbnail button, `role="option"`, with `data-index`. */
  { names: ["data-fluidbox-filmstrip-item"] },
  /** A flight layer at the end of `<body>`, during opening and closing. */
  { names: ["data-fluidbox-flight"] },
  /** A travelling overlay's copy, in the flight. */
  { names: ["data-fluidbox-transition-content"] },
  /** Mark a travel overlay's `frameLayer` with it to get the layer inputs. */
  { names: ["data-fluidbox-transition-layer"] },
  /** A trigger, on the page. */
  { names: ["data-fluidbox-trigger"] },
  /** On an element inside a trigger: the flight starts and ends there instead. */
  { names: ["data-fluidbox-origin"] },
  /** A thumbnail overlay inside a trigger. The value `travel` makes it fly with the photo. */
  { names: ["data-fluidbox-thumbnail-overlay"] },
  /** A travelling overlay's frame layer. It moves into the flying frame and scales with it. */
  { names: ["data-fluidbox-frame-layer"] },
  /** The still copy of a frame layer the page shows in the thumbnail while a flight starts. */
  { names: ["data-fluidbox-ghost"] },
  /** In a `<fluidbox-gallery>` with `items` set, makes the element a trigger of the item with that id. */
  { names: ["data-fluidbox-item-id"] },
  /** A media add-on's box in a custom slide: a video's, a spin's or a model's. */
  { names: ["data-fluidbox-media-addon"] },
  /** A media add-on's poster layers: `thumbnail`, then the sharper `poster` over it. */
  { names: ["data-fluidbox-media-poster"] },
  /** A YouTube or Vimeo video's box; the value is the provider. */
  { names: ["data-fluidbox-embed"] },
  /** A video's Play button. */
  { names: ["data-fluidbox-embed-play"] },
  /** A 3D model's box, around `<model-viewer>`. */
  { names: ["data-fluidbox-model"] },
  /** A spin, `role="slider"`, with `data-frame` and `data-grabbing` while dragged. */
  { names: ["data-fluidbox-spin"] },
];

/** The sheet's elements, from the sheet add-on. */
export const sheetParts: readonly CssName[] = [
  /** The scroller the photo and the sheet share. */
  { names: ["data-fluidbox-sheet-scroller"] },
  /** The photos' room inside it. */
  { names: ["data-fluidbox-sheet-stage"] },
  /** Where the sheet element goes. */
  { names: ["data-fluidbox-sheet-slot"] },
  /** The sheet, a `<section>` that `render` fills. */
  { names: ["data-fluidbox-sheet"] },
  /** Draws a grab bar. Make it the sheet's first child. */
  { names: ["data-fluidbox-sheet-handle"] },
  /** The part that scrolls once the sheet is at its top stop. Without one, the whole sheet does. */
  { names: ["data-fluidbox-sheet-scroll"] },
  /** A button that moves the sheet to the stop in its value. */
  { names: ["data-fluidbox-sheet-stop"] },
];

/** Attributes the runtime toggles as the viewer changes. */
export const states: readonly CssName[] = [
  /** `closed`, `opening`, `open` or `closing`. */
  { names: ["data-fluidbox-status"], on: "Overlay, dialog" },
  /** Not closed, or closed. */
  { names: ["data-open", "data-closed"], on: "Overlay, dialog" },
  /** Opening. */
  { names: ["data-starting-style", "data-opening"], on: "Overlay, dialog" },
  /** Closing. */
  { names: ["data-ending-style"], on: "Overlay, dialog" },
  /** A drag to dismiss is under way. */
  { names: ["data-dragging"], on: "Overlay, dialog" },
  /** Closing, or a drag to dismiss is under way. */
  { names: ["data-dismissing"], on: "Overlay, dialog" },
  /** An image is zoomed. */
  { names: ["data-zoomed"], on: "Dialog" },
  /** Zoom is on: a mouse click zooms an image, and the cursor says so. */
  { names: ["data-zoomable"], on: "Dialog" },
  /** The hover zoom add-on magnifies its image. */
  { names: ["data-fluidbox-hover-zooming"], on: "An element given to `hoverZoom`" },
  /** There is more than one item. */
  { names: ["data-gallery"], on: "Dialog" },
  /** The sheet's stop number. */
  { names: ["data-sheet"], on: "Dialog" },
  /** The sheet is above stop `0`; at its top stop. */
  { names: ["data-sheet-raised", "data-sheet-expanded"], on: "Dialog" },
  /** The sheet peeks at rest; the sheet is turned off. */
  { names: ["data-sheet-peeking", "data-sheet-off"], on: "Dialog" },
  /** The sheet's `dismiss` option. */
  { names: ["data-sheet-dismiss"], on: "Overlay" },
  /** A scroll dismiss is committed. */
  { names: ["data-sheet-dismissed"], on: "Overlay" },
  /** The trigger's item is open. */
  {
    names: ["data-fluidbox-status", "data-open", "data-closed"],
    on: "The active trigger",
  },
  /** Its item is open, so it is hidden. */
  { names: ["data-fluidbox-thumbnail-hidden"], on: "The trigger's image" },
  /** `idle`, `opening`, `open`, `dragging` or `closing`. */
  { names: ["data-fluidbox-phase"], on: "Thumbnail overlays" },
  /** The current item. */
  { names: ["aria-selected", "data-fluidbox-selected"], on: "Filmstrip items" },
  /** The poster is still decoding, and hidden. */
  { names: ["data-fluidbox-media-pending"], on: "A media add-on's poster" },
  /** Play was pressed; the player has loaded over the poster. */
  { names: ["data-fluidbox-embed-playing", "data-fluidbox-embed-ready"], on: "A video's box" },
  /** The model shows, so the poster hides; the model failed, so the poster stays. */
  { names: ["data-fluidbox-model-ready", "data-fluidbox-model-error"], on: "A model's box" },
  /** Every frame has loaded. */
  { names: ["data-fluidbox-spin-loaded"], on: "A spin" },
];

/** Names the runtime and the stylesheets use among themselves. They can change without notice. */
export const internal: readonly string[] = [
  "--fluidbox-chrome-reach",
  "--fluidbox-controls-reveal-delay",
  "--fluidbox-filmstrip-hide",
  "--fluidbox-flight-height",
  "--fluidbox-flight-item-height",
  "--fluidbox-flight-left",
  "--fluidbox-flight-top",
  "--fluidbox-flight-width",
  "--fluidbox-item-height",
  "--fluidbox-item-width",
  "--fluidbox-media-aspect",
  "--fluidbox-media-transform",
  "--fluidbox-page-height",
  "--fluidbox-reveal-delay",
  "--fluidbox-scroll-compensation",
  "--fluidbox-sheet-dismiss-distance",
  "--fluidbox-sheet-height",
  "--fluidbox-sheet-lead",
  "--fluidbox-sheet-min-height",
  "--fluidbox-sheet-push",
  "--fluidbox-sheet-range",
  "--fluidbox-sheet-reach",
  "--fluidbox-sheet-stage",
  "--fluidbox-sheet-stage-height",
  "--fluidbox-transition-height",
  "--fluidbox-transition-host-height",
  "--fluidbox-transition-left",
  "--fluidbox-transition-top",
  "--fluidbox-transition-transform",
  "--fluidbox-transition-width",
  "--fluidbox-zoom-anchor-left",
  "--fluidbox-zoom-anchor-top",
  "--fluidbox-zoom-canvas-height",
  "--fluidbox-zoom-canvas-width",
  "--fluidbox-zoom-chrome",
  "--fluidbox-zoom-item-height",
  "--fluidbox-zoom-item-width",
  "--fluidbox-zoom-placeholder-height",
  "--fluidbox-zoom-placeholder-width",
  "--fluidbox-zoom-reach",
  "--fluidbox-zoom-reach-bottom",
  "--fluidbox-zoom-reach-end",
  "--fluidbox-zoom-reach-inline-end",
  "--fluidbox-zoom-reach-inline-start",
  "--fluidbox-zoom-reach-left",
  "--fluidbox-zoom-reach-right",
  "--fluidbox-zoom-reach-start",
  "--fluidbox-zoom-reach-top",
  "--fluidbox-zoom-scroll-offset",
  "--fluidbox-zoom-stage-bottom",
  "--fluidbox-zoom-stage-left",
  "--fluidbox-zoom-stage-right",
  "--fluidbox-zoom-stage-top",
  "data-fluidbox-content",
  "data-fluidbox-server-viewer",
  "data-fluidbox-controls-revealing",
  "data-fluidbox-drawn",
  "data-fluidbox-filmstrip-thumbnail",
  "data-fluidbox-filmstrip-track",
  "data-fluidbox-flight-source-hidden",
  "data-fluidbox-frozen",
  "data-fluidbox-headless",
  "data-fluidbox-modal",
  "data-fluidbox-image-pending",
  "data-fluidbox-image-ready",
  "data-fluidbox-managed",
  "data-fluidbox-media-ready",
  "data-fluidbox-picture",
  "data-fluidbox-prepared",
  "data-fluidbox-returns",
  "data-fluidbox-sheet-hold",
  "data-fluidbox-sheet-host",
  "data-fluidbox-sheet-overlay",
  "data-fluidbox-sheet-push",
  "data-fluidbox-sheet-snap",
  "data-fluidbox-sheet-space",
  "data-fluidbox-thumbnail-crossfade",
  "data-fluidbox-thumbnail-kept",
  "data-fluidbox-transition-host",
  "data-fluidbox-travel-layer",
  "data-fluidbox-video-actions",
  "data-fluidbox-video-stand-in",
  "data-fluidbox-zoom-anchor",
  "data-fluidbox-zoom-canvas",
  "data-fluidbox-zoom-placeholder",
];
