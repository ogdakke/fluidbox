import type { FluidboxLabels } from "./labels";

export type { FluidboxLabels } from "./labels";

/** What every item can carry besides its media. */
export interface FluidboxItemBase {
  /**
   * Stable identity across item updates. Defaults to `src`; in an array, an item
   * without one whose `src` repeats gets `src#2`, `src#3` in order. Unique in a list.
   */
  readonly id?: string;
  /**
   * A small image of the item: the thumbnails' thumbnail, an iframe's still, and
   * the picture shown while the full image loads. With `srcset`, the browser
   * picks a sharper one where it can.
   */
  readonly thumbnail?: FluidboxThumbnail;
  /** An image URL, such as a data URI, painted at once behind an image slide. */
  readonly placeholder?: string;
  /** Text shown by a caption part, which becomes the dialog's description. */
  readonly caption?: string;
  /**
   * How the media box is sized. `"contain"`: to the item's `width` and
   * `height`, fitted in the stage. `"fill"`: to the whole stage, less its
   * insets, as a 3D view or a map wants. Ignored on image items.
   * @default "contain"; `modelItem()` sets `"fill"`
   */
  readonly fit?: "contain" | "fill";
  /**
   * The file Download saves: a URL, `{ src, filename }`, or false for none.
   * @default an image's `zoom.src ?? src`, a video's `src`, none for the others
   */
  readonly download?: string | false | { readonly src: string; readonly filename?: string };
  /**
   * Becomes `data-*` on the slide, its thumbnail and the server copy's slide:
   * `{ tone: "light" }` gives `data-tone="light"`. Names are lower case, with
   * digits and single dashes, and don't start with `fluidbox-`.
   */
  readonly data?: Readonly<Record<string, string>>;
}

/** An `<img>`'s source attributes. */
export interface FluidboxThumbnail {
  readonly src: string;
  readonly srcset?: string;
  readonly sizes?: string;
  readonly width?: number;
  readonly height?: number;
}

/** A `<source>` of a `<picture>`. */
export interface FluidboxPictureSource {
  readonly srcset: string;
  readonly sizes?: string;
  readonly media?: string;
  readonly type?: string;
}

/** An `<img>`, or a `<picture>` when it has `sources`. */
export interface FluidboxImageItem extends FluidboxItemBase {
  readonly type: "image";
  readonly src: string;
  readonly srcset?: string;
  readonly sizes?: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly sources?: readonly FluidboxPictureSource[];
  /**
   * The larger image zoom and hover zoom load. `src` is a master kept apart
   * from the `srcset`, loaded once a zoom shows more pixels than the slide's
   * own source has. `srcset` lists larger candidates with width descriptors,
   * of which the viewer loads the smallest that is sharp at the zoom it rests at.
   */
  readonly zoom?: { readonly src?: string; readonly srcset?: string };
}

/** A `<track>` of a video: captions, subtitles, descriptions or chapters. */
export interface FluidboxVideoTrack {
  readonly src: string;
  /** @default "subtitles" */
  readonly kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
  readonly srclang?: string;
  readonly label?: string;
  /** Shown unless the viewer's own settings say otherwise. */
  readonly default?: boolean;
}

/** An encoding of a video to try before its `src`: a `<source>` of the `<video>`. */
export interface FluidboxVideoSource {
  readonly src: string;
  /** The MIME type with codecs, as `video/mp4; codecs="av01.0.05M.08"`. */
  readonly type?: string;
  /** A media query, as `(min-width: 1200px)`. */
  readonly media?: string;
}

/**
 * Whether the slide an attached video is in shows, so an engine can hold its
 * downloads for a neighbour, as a built-in video only fetches what `preload`
 * allows until it plays.
 */
export type FluidboxVideoAttachSlide = Pick<FluidboxSlide, "active" | "opening" | "onActiveChange">;

/** How the built-in video loads. */
export interface FluidboxVideoOptions {
  /**
   * Load the media yourself: the runtime sets no `src` and no `<source>`.
   * Called when the slide loads, neighbours too, so start fetching segments
   * once `slide.active` or `slide.opening` is true or `onActiveChange` says
   * so, as hls.js does with `autoStartLoad: false` and `startLoad()`. Clean
   * up when `signal` aborts, which happens before the runtime empties the
   * video. The item's URLs are still checked; what `attach` loads is yours
   * to trust.
   */
  readonly attach?: (
    video: HTMLVideoElement,
    signal: AbortSignal,
    item: FluidboxVideoItem,
    slide: FluidboxVideoAttachSlide,
  ) => void;
}

/** A `<video>`. */
export interface FluidboxVideoItem extends FluidboxItemBase {
  readonly type: "video";
  /** The video, or with `sources` the last resort: drawn as the last `<source>`. */
  readonly src: string;
  /**
   * Encodings to try first, in order of preference, such as AV1, then WebM,
   * then `src` as MP4. Each is a `<source>` child of the `<video>`.
   */
  readonly sources?: readonly FluidboxVideoSource[];
  /** The video's accessible name. */
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly poster?: string;
  /** Plays when its slide comes into view, and pauses when it leaves. */
  readonly autoplay?: boolean;
  readonly loop?: boolean;
  readonly muted?: boolean;
  /** @default true */
  readonly playsInline?: boolean;
  /** @default true */
  readonly controls?: boolean;
  /** @default "metadata" */
  readonly preload?: "none" | "metadata" | "auto";
  /** Captions and other text tracks, drawn as `<track>` elements. */
  readonly tracks?: readonly FluidboxVideoTrack[];
}

/** An `<iframe>`. It gets `loading="lazy"` and `allowfullscreen`. */
export interface FluidboxIframeItem extends FluidboxItemBase {
  readonly type: "iframe";
  readonly src: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly allow?: string;
  readonly referrerPolicy?: ReferrerPolicy;
  readonly sandbox?: string;
}

/** What every item type of your own needs: a name and a size for its media box. */
export interface FluidboxCustomItemBase<TType extends string> extends FluidboxItemBase {
  readonly type: TType;
  /** The accessible name of the slide and the dialog. */
  readonly title: string;
  /** Required unless `fit` is `"fill"`; then they only shape the poster. */
  readonly width?: number;
  readonly height?: number;
}

/**
 * Every item type, by its `type`. The add-on entries and your own code add to
 * it by declaration merging:
 *
 * ```ts
 * declare module "@ogdakke/fluidbox" {
 *   interface FluidboxItemTypes {
 *     product: ProductItem;
 *   }
 * }
 * ```
 */
export interface FluidboxItemTypes {
  image: FluidboxImageItem;
  video: FluidboxVideoItem;
  iframe: FluidboxIframeItem;
}

/**
 * One piece of media, of any type in `FluidboxItemTypes`. Every field of the
 * built-in types is the HTML attribute of the element the viewer draws, by its
 * DOM property name, so `srcset`, `sizes`, `poster` and `referrerPolicy` mean
 * what they mean on `<img>`, `<video>` and `<iframe>`. Extend a type to add
 * fields of your own. They come back in every callback, event and state.
 */
export type FluidboxItem = FluidboxItemTypes[keyof FluidboxItemTypes];

/** A list read on demand, for long or generated galleries. */
export interface FluidboxItemList<TItem extends FluidboxItem = FluidboxItem> {
  /** A non-negative integer. */
  readonly count: number;
  /** The item at an index, synchronously. Return the same object each time. */
  get(index: number): TItem;
  /** The index of the item with this id, or -1. Without it, ids are found by scanning. */
  indexOf?(id: string): number;
}

/** What `createItemList` makes a list from. */
export interface FluidboxItemListOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly count: number;
  /** Makes the item at an index. The list calls it once per index and keeps the item. */
  readonly item: (index: number) => TItem;
  /**
   * Where an id is, as a guess the list checks: an index out of range, or one whose
   * item has another id, counts as not found. Without it, the list scans.
   */
  readonly index?: (id: string) => number;
}

/**
 * An array, which the fluidbox copies and checks for empty and duplicate ids of
 * the items' own (a repeated `src` gets `src#2`), or a lazy list it reads on
 * demand and doesn't check.
 */
export type FluidboxItems<TItem extends FluidboxItem = FluidboxItem> =
  | readonly TItem[]
  | FluidboxItemList<TItem>;

/** An item, its index, or its id. Items are matched by id. */
export type FluidboxTarget<TItem extends FluidboxItem = FluidboxItem> = number | string | TItem;

// Rendering.

export interface FluidboxRenderContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  /** The element to draw into. The viewer empties it afterwards. */
  readonly target: HTMLElement;
  /** Aborted when the content is no longer shown. */
  readonly signal: AbortSignal;
}

/**
 * Draws into `target`: a thumbnail, the
 * sheet, or a travelling thumbnail overlay. Return a function to release your own
 * resources, such as timers.
 */
export type FluidboxRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  context: FluidboxRenderContext<TItem>,
) => void | (() => void);

/** What a slide's trigger showed. */
export interface FluidboxSlideOrigin {
  /** The trigger's `<video>`, when that is what the trigger showed. */
  readonly video?: FluidboxPlayback;
  /**
   * The trigger's live `<model-viewer>`, when the trigger holds one. It is the
   * element itself, not a reading of it as `video` is: a slide reads its
   * camera and draws a snapshot of it when it opens, and turns it to the
   * slide's view when it closes, through `<model-viewer>`'s own API. Never
   * move it: it draws nothing once it has left the page and come back.
   */
  readonly model?: HTMLElement;
}

/** A video's playback, read live: each read returns its state now. */
export interface FluidboxPlayback {
  readonly currentTime: number;
  readonly paused: boolean;
  readonly muted: boolean;
}

/**
 * Anything with `currentTime` and `paused`, read when the close starts: a
 * `<video>`, `<mux-player>`, Vidstack's player. Or a function, for players
 * whose state is behind methods (Video.js). Return null to leave the trigger
 * alone.
 */
export type FluidboxPlaybackSource =
  | { readonly currentTime: number; readonly paused: boolean }
  | (() => { readonly currentTime: number; readonly paused: boolean } | null);

/**
 * A slide, as its renderer gets it: the item, the media box to draw it in,
 * and whether it is on show.
 */
export interface FluidboxSlide<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  /** The item's index, read live: new items keep a slide whose item moved. */
  readonly index: number;
  /**
   * The media box: the element that flies, follows a drag to dismiss and
   * zooms. The runtime sizes it from the item's width and height. Draw your
   * media here. The runtime empties it after your disposer runs.
   */
  readonly media: HTMLElement;
  /**
   * The slide's layer beside the box, over the whole slide. It doesn't fly or
   * zoom, and it shows and hides with the viewer's controls. Made the first
   * time you read it; the runtime empties it after your disposer runs.
   */
  readonly layer: HTMLElement;
  /** Aborted when the slide is disposed. */
  readonly signal: AbortSignal;
  /** Whether the slide is the one on show in the viewer. */
  readonly active: boolean;
  /**
   * True while an open waits for this slide: it mounted as the item being
   * opened. Neighbours that mount with it are false. Start heavy work early
   * only when an open waits for it.
   */
  readonly opening: boolean;
  /**
   * Call `listener` with the new `active` each time it changes: true as the slide
   * comes to be the one on show, false as the viewer moves away from it. Use it to
   * play and pause. Returns a function that stops listening; `signal` stops it too.
   */
  onActiveChange(this: void, listener: (active: boolean) => void): () => void;
  /**
   * What the trigger showed, when this slide is the one an open started from
   * a trigger. `video` is set when the trigger's picture is a playing or
   * paused `<video>`. Null on neighbours, on slides reached by moving, and for
   * opens without a trigger. It stays set for the slide's lifetime.
   */
  readonly origin: FluidboxSlideOrigin | null;
  /**
   * Hand the playback position back to the trigger's video on close. Read
   * once, when a close starts from this slide, before the closing flight.
   * Returns a function that unregisters it.
   */
  returnPlayback(this: void, source: FluidboxPlaybackSource): () => void;
  /**
   * Call `listener` once as a close starts from this slide, before the closing
   * flight measures the trigger, with what the trigger the close lands on
   * shows: null when it lands on none. That trigger may not be the one the
   * open started from, as after moving to another item. Returns a function
   * that stops listening; `signal` stops it too.
   */
  onClose(this: void, listener: (landing: FluidboxSlideOrigin | null) => void): () => void;
  /**
   * Let the media box zoom (pinch, double-tap, wheel, the zoom controls), or
   * stop it. Off by default for your own media; on for `drawImage`.
   */
  zoomable(this: void, on: boolean | FluidboxZoomableOptions): void;
  /**
   * Follow the box's zoom pose: every frame it changes while it moves, and
   * once as it comes to rest. Returns a function that stops listening.
   */
  onZoom(this: void, listener: (pose: FluidboxZoomPose) => void): () => void;
  /**
   * Make the opening flight also wait for `promise`, as
   * `ExtendableEvent.waitUntil` does: for what the runtime can't see in the
   * box, such as a canvas having painted. Every open already waits for the
   * box's images and videos, at most three seconds in all. A rejected promise
   * counts as settled. Call it before the slide commits: in the renderer.
   */
  waitUntil(this: void, promise: Promise<unknown>): void;
  /**
   * Put the slide in its error state: the error message and Retry, and a
   * `mediaerror` event of kind "custom" with `error` as its cause. Retry
   * disposes the slide and renders it again.
   */
  fail(this: void, error?: unknown): void;
  /**
   * Draw the built-in image into `media`: it loads, sharpens and fails as a
   * photo's does. Without an argument it draws `item`, which must be an image
   * item. A slide draws one built-in media at a time: drawing again replaces it.
   * Returns a function that takes it out.
   */
  drawImage(this: void, item?: FluidboxImageItem): () => void;
  /**
   * Draw the built-in video into `media`, as `drawImage` does the image.
   * `attach` loads the media yourself, as a streaming engine does.
   */
  drawVideo(this: void, item?: FluidboxVideoItem, options?: FluidboxVideoOptions): () => void;
  /** Draw the built-in iframe into `media`, as `drawImage` does the image. */
  drawIframe(this: void, item?: FluidboxIframeItem): () => void;
}

/** Where a zoomable box's zoom is. */
export interface FluidboxZoomPose {
  readonly scale: number;
  /** The box's translation in CSS pixels, as the zoom has it. */
  readonly x: number;
  readonly y: number;
  /**
   * The part of the media showing through the zoom viewport, the stage, in the
   * item's own pixels (0…width, 0…height).
   */
  readonly visible: DOMRectReadOnly;
  /** True while a pinch, wheel or animation moves it; false once it rests. */
  readonly moving: boolean;
}

export interface FluidboxZoomableOptions {
  /** This box's largest scale, over the fluidbox's `zoom.max`. */
  readonly max?: number;
  /** Load the sharper `zoom` image when zoomed. @default true for a drawn image */
  readonly sharpen?: boolean;
}

/** Draws a slide. Return a function to release your own resources, such as timers. */
export type FluidboxSlideRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  slide: FluidboxSlide<TItem>,
) => void | (() => void);

/**
 * How each item type draws its slide, by `type`. A type looks up its own
 * entry, then the built-in slide of images, videos and iframes, then
 * `default`. A type with none shows the slide's error.
 */
export type FluidboxSlides<TItem extends FluidboxItem = FluidboxItem> = {
  readonly [K in TItem["type"]]?: FluidboxSlideRenderer<Extract<TItem, { readonly type: K }>>;
} & {
  /** Any type without its own entry and without a built-in slide. */
  readonly default?: FluidboxSlideRenderer<TItem>;
};

export interface FluidboxViewerContext<TItem extends FluidboxItem = FluidboxItem> {
  /** The viewer's layer for your controls and captions. */
  readonly target: HTMLElement;
  readonly fluidbox: Fluidbox<TItem>;
  /** Aborted when the fluidbox is destroyed. */
  readonly signal: AbortSignal;
}

/**
 * Draws your controls and captions into the viewer. It runs when the fluidbox is
 * made, and again after an `update` that redraws the viewer's layer. The function
 * it returns, and its `signal`, end each run.
 */
export type FluidboxViewerRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  context: FluidboxViewerContext<TItem>,
) => void | (() => void);

// Triggers: where a flight starts and lands.

export interface FluidboxRevealContext {
  readonly signal: AbortSignal;
  /** "open" before the opening flight, "selection" as the viewer moves between items. */
  readonly phase: "open" | "selection";
}

// State and events.

export type FluidboxStatus = "closed" | "opening" | "open" | "closing";

/** The zoom of the image on show. */
export interface FluidboxZoomState {
  /** The scale the image rests at: 1 when it fits the stage. */
  readonly scale: number;
  /** The smallest scale, 1. */
  readonly min: number;
  /** The largest scale, the `zoom` option's `max`. */
  readonly max: number;
}

/** A frozen snapshot. */
export interface FluidboxState<TItem extends FluidboxItem = FluidboxItem> {
  readonly status: FluidboxStatus;
  /** The item the viewer shows or is going to, by id; null while closed. */
  readonly value: FluidboxValue;
  readonly index: number | null;
  readonly item: TItem | null;
  readonly count: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  /**
   * The zoom of the open viewer's image, or null while closed, on media that
   * doesn't zoom, or with zoom off. It changes as the zoom comes to rest.
   */
  readonly zoom: FluidboxZoomState | null;
  /** The viewer is the document's fullscreen element. */
  readonly fullscreen: boolean;
}

/**
 * What made something happen. "api" is your code or a default control, "trigger"
 * a click on a trigger, and "keyboard" the arrow keys, Escape, or a page-scrolling
 * key that closes the viewer. "pointer" is a swipe or scroll through the slides, a
 * drag to dismiss or a tap on the backdrop, and "wheel" a wheel or trackpad scroll
 * that dismisses. "items" is a move made by `setItems`. A move from the thumbnails
 * has the reason of its input.
 */
export type FluidboxReason = "api" | "trigger" | "keyboard" | "pointer" | "wheel" | "items";

/** The open item's id, or null while the viewer is closed. */
export type FluidboxValue = string | null;

/** What a value change does: open the viewer, move it to another item, or close it. */
export type FluidboxValueChangeAction = "open" | "move" | "close";

/**
 * Fired as the viewer opens, moves between items and closes:
 * `beforevaluechange` first, cancelable, then `valuechange` as the motion
 * starts, and `valuechangecomplete` once it settles.
 */
export class FluidboxValueChangeEvent<TItem extends FluidboxItem = FluidboxItem> extends Event {
  /** The id the viewer goes to, or null for a close. */
  readonly value: FluidboxValue;
  /** The id the viewer comes from, or null for an open. */
  readonly previousValue: FluidboxValue;
  /** The index the viewer goes to, or null for a close. */
  readonly index: number | null;
  /** The item the viewer goes to, or null for a close. */
  readonly item: TItem | null;
  readonly action: FluidboxValueChangeAction;
  readonly reason: FluidboxReason;

  constructor(
    type: "beforevaluechange" | "valuechange" | "valuechangecomplete",
    init: EventInit & {
      value: FluidboxValue;
      previousValue: FluidboxValue;
      index: number | null;
      item: TItem | null;
      action: FluidboxValueChangeAction;
      reason: FluidboxReason;
    },
  ) {
    super(type, init);
    this.value = init.value;
    this.previousValue = init.previousValue;
    this.index = init.index;
    this.item = init.item;
    this.action = init.action;
    this.reason = init.reason;
  }
}

/**
 * What a binding's value-change callback gets with the new value, from the
 * `beforevaluechange` event behind it.
 */
export interface FluidboxValueChangeDetails<TItem extends FluidboxItem = FluidboxItem> {
  readonly reason: FluidboxReason;
  readonly action: FluidboxValueChangeAction;
  readonly index: number | null;
  readonly item: TItem | null;
  readonly previousValue: FluidboxValue;
  /** The DOM event behind it, when there was one. */
  readonly event: Event | undefined;
  /** Stop the change. Only works synchronously inside the callback, and only where it can be stopped. */
  cancel(): void;
  readonly isCanceled: boolean;
}

/**
 * Fired when the sheet comes to rest at another stop. A swipe or a scroll of the
 * sheet has the reason "pointer", a wheel "wheel", Escape or a key on a stop
 * button "keyboard", and `sheet.set` or the viewer opening and closing "api".
 */
export class FluidboxSheetEvent extends Event {
  /** The snap the sheet rests at: 0 at rest, then one per snap point. */
  readonly snap: number;
  readonly reason: FluidboxReason;

  constructor(type: "sheetchange", init: EventInit & { snap: number; reason: FluidboxReason }) {
    super(type, init);
    this.snap = init.snap;
    this.reason = init.reason;
  }
}

/**
 * Fired when the image on show comes to rest at another zoom, back at 1 as
 * the viewer moves on or closes included. Never fired per frame. A pinch or a
 * double-tap has the reason "pointer", a ctrl-wheel or trackpad pinch
 * "wheel", the `+`, `-`, `0` and arrow keys "keyboard", and a command "api".
 */
export class FluidboxZoomEvent extends Event {
  /** The scale the image rests at. */
  readonly scale: number;
  readonly reason: FluidboxReason;

  constructor(type: "zoomchange", init: EventInit & { scale: number; reason: FluidboxReason }) {
    super(type, init);
    this.scale = init.scale;
    this.reason = init.reason;
  }
}

/**
 * The events a fluidbox and `<fluidbox-gallery>` fire. `beforevaluechange`
 * fires synchronously for every open, move and close that would do something,
 * from a key, a gesture or your code; `preventDefault()` cancels it, and the
 * command's promise resolves false. A change the items force, as a close when
 * they run out, fires it too, not cancelable. An open fires
 * `beforevaluechange`, `valuechange`, and `valuechangecomplete` after the flight.
 */
/** What failed: a slide's built-in media, a sharper zoom image, or a slide that called `fail`. */
export type FluidboxMediaErrorKind = "image" | "video" | "iframe" | "zoom" | "custom";

/**
 * Fired each time a slide enters its error state, neighbours too, and when a
 * zoom image fails to load (then no error shows). Not cancelable.
 */
export class FluidboxMediaErrorEvent<TItem extends FluidboxItem = FluidboxItem> extends Event {
  readonly value: string;
  readonly index: number;
  readonly item: TItem;
  readonly kind: FluidboxMediaErrorKind;
  /** The DOM event, the TypeError of a refused URL, or what `slide.fail` got. */
  readonly cause: unknown;

  constructor(
    type: "mediaerror",
    init: EventInit & {
      value: string;
      index: number;
      item: TItem;
      kind: FluidboxMediaErrorKind;
      cause?: unknown;
    },
  ) {
    super(type, init);
    this.value = init.value;
    this.index = init.index;
    this.item = init.item;
    this.kind = init.kind;
    this.cause = init.cause;
  }
}

export interface FluidboxEventMap<TItem extends FluidboxItem = FluidboxItem> {
  /** Before an open, a move or a close. Cancelable: the command resolves false. */
  beforevaluechange: FluidboxValueChangeEvent<TItem>;
  /** The change happens: the motion starts. */
  valuechange: FluidboxValueChangeEvent<TItem>;
  /** The motion settled: the opening flight landed, a move came to rest, or a close finished. */
  valuechangecomplete: FluidboxValueChangeEvent<TItem>;
  /** The sheet comes to rest at another stop. */
  sheetchange: FluidboxSheetEvent;
  /** The image on show comes to rest at another zoom. */
  zoomchange: FluidboxZoomEvent;
  /** A slide's media failed, or a zoom image did. */
  mediaerror: FluidboxMediaErrorEvent<TItem>;
}

// Add-ons. Each needs its entry imported once: `import "@ogdakke/fluidbox/sheet"`.

/**
 * How much of the sheet shows at a stop: pixels, a percentage of the viewer's
 * height, or "content" for all of it, up to the space under the top inset.
 */
export type FluidboxSheetSnapPoint = number | `${number}%` | "content";

export interface FluidboxSheetOptions<TItem extends FluidboxItem = FluidboxItem> {
  /**
   * The stops above the resting one, lowest first. Stop 0 is the sheet at rest:
   * away, or showing `--fluidbox-sheet-peek`.
   * @default ["60%", "content"]
   */
  readonly snapPoints?: readonly FluidboxSheetSnapPoint[];
  /**
   * How a swipe down on the photo closes the viewer with the sheet down.
   * "flight" flies the photo home; "scroll" scrolls it off the bottom of the
   * screen and closes. The root's `dismiss: { drag: false }` keeps it open.
   * @default "flight"
   */
  readonly dismissMotion?: "flight" | "scroll";
  /**
   * Fills the sheet, a `<section data-fluidbox-sheet>` named by `labels.sheet`,
   * for the item on show. It runs again when the item changes; the `signal`
   * aborts and the section is emptied first.
   */
  readonly render?: FluidboxRenderer<TItem>;
}

/** Reads and moves the sheet. A `sheetchange` event follows each new snap. */
export interface FluidboxSheet {
  /** The snap the sheet rests at: 0 at rest, then one per snap point. */
  readonly snap: number;
  /** Move the sheet to a snap. Ignored while the viewer is not open. */
  setSnap(snap: number, options?: { readonly animate?: boolean }): void;
}

export interface FluidboxThumbnailsOptions<TItem extends FluidboxItem = FluidboxItem> {
  /**
   * Fills each thumbnail button instead of the default image, while the button
   * is in the strip's rendered window. The `signal` aborts as it leaves.
   */
  readonly render?: FluidboxRenderer<TItem>;
}

// The fluidbox.

/**
 * A default control. `previous`, `next` and `close` show by default; the
 * others only when you list them in `controls`.
 */
export type FluidboxControlName =
  | "previous"
  | "next"
  | "close"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  | "counter"
  | "fullscreen"
  | "download"
  | "share"
  | "retry";

/**
 * When the viewer's code loads. `"intent"` loads it when a mouse rests on a
 * trigger for 100 ms, a finger or pen touches one, or one takes focus.
 * `"press"` loads it when a trigger is pressed, and `"eager"` once the page is
 * idle. In every mode, an open loads it if it hasn't loaded yet, and
 * `load()` loads it whenever you call it.
 */
export type FluidboxPreload = "intent" | "press" | "eager";

/**
 * Every option but `items`, `value`, `slides`, `findTrigger` and
 * `revealTrigger` can change later through `update`.
 */
export interface FluidboxOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly items: FluidboxItems<TItem>;
  /**
   * The item to open with, by id, as a deep link does: the viewer opens on it
   * without motion once its media is ready. An id the items don't hold opens nothing.
   */
  readonly value?: FluidboxValue;
  /** Your strings for the viewer, over the defaults. */
  readonly labels?: Partial<FluidboxLabels>;
  /**
   * Pinch, double-tap, click, wheel and keyboard zoom of images. `step` is the
   * scale of a click or double-tap, and `max` the largest scale for every
   * input. The `+` and `-` keys, `zoomIn`, `zoomOut` and the zoom controls zoom
   * by 1.5. `click` is what a mouse click on the media does, and `tap` what a
   * touch or pen tap does. A click beside a zoomed image zooms out in every
   * mode. `false` turns zoom off.
   * @default { step: 2, max: 4, click: "single", tap: "double" }
   */
  readonly zoom?:
    | false
    | {
        readonly step?: number;
        readonly max?: number;
        /** What a mouse click on the media does: zoom on one click, on a double-click, or nothing. */
        readonly click?: "single" | "double" | false;
        /** What a touch or pen tap on the media does: zoom on a double tap, or nothing. */
        readonly tap?: "double" | false;
      };
  /** Draw slides by item type: your own types, or the built-in ones. Read when a slide mounts. */
  readonly slides?: FluidboxSlides<TItem>;
  /**
   * Go round: past the last item comes the first, and before the first the
   * last, by swipe, key, button and thumbnails alike. A single item never loops.
   * @default false
   */
  readonly loop?: boolean;
  /** Draw your own controls and captions into the viewer. */
  readonly viewer?: FluidboxViewerRenderer<TItem>;
  /**
   * The default Previous, Next and Close buttons, or a list of the controls to
   * show, the zoom controls included: `["close", "zoomIn", "zoomOut", "zoomReset"]`.
   * @default true without a `viewer`, else false
   */
  readonly controls?: boolean | readonly FluidboxControlName[];
  /**
   * Your icons for the default controls, which otherwise show their labels as
   * text. Each call returns a new Node; the label then names the control.
   */
  readonly icons?: Partial<Record<FluidboxControlName, () => Node>>;
  /**
   * A thumbnail strip. Needs `import "@ogdakke/fluidbox/thumbnails"` and its
   * stylesheet. Without the import, it throws an Error that names it.
   */
  readonly thumbnails?: boolean | FluidboxThumbnailsOptions<TItem>;
  /**
   * A sheet over the photo. Needs `import "@ogdakke/fluidbox/sheet"` and its
   * stylesheet. Without the import, it throws an Error that names it.
   */
  readonly sheet?: boolean | FluidboxSheetOptions<TItem>;
  /**
   * Find the trigger of an item the page doesn't have bound, as in a
   * virtualised grid. Read on each use. Return null when it isn't rendered. The
   * flight starts from what is in it, as from a bound trigger.
   */
  readonly findTrigger?: (item: TItem, index: number) => HTMLElement | null;
  /**
   * Bring an item's trigger into view: before the opening flight, and as the
   * viewer moves between items. Without it, the viewer scrolls it into view.
   */
  readonly revealTrigger?: (
    item: TItem,
    index: number,
    context: FluidboxRevealContext,
  ) => void | Promise<void>;
  /**
   * When the viewer's code loads.
   * @default "intent"
   */
  readonly preload?: FluidboxPreload;
  /**
   * Which gestures close the viewer: a drag down on the media, and a tap on
   * the backdrop. Escape and Close always do.
   * @default { drag: true, backdrop: true }
   */
  readonly dismiss?: { readonly drag?: boolean; readonly backdrop?: boolean };
  /**
   * What a vertical wheel or trackpad scroll does on an unzoomed slide:
   * close the viewer, zoom as Ctrl + wheel does, move one slide per gesture,
   * or nothing. A horizontal scroll still moves, and Ctrl + wheel still zooms.
   * @default "dismiss"
   */
  readonly wheel?: "dismiss" | "zoom" | "navigate" | "none";
  /** The link Share shares for an item. Without one, Share hides. */
  readonly shareUrl?: (item: TItem) => string | undefined;
}

/**
 * The options `update` changes on a live fluidbox. A key left out keeps its
 * value; a key set to undefined goes back to its default.
 */
export type FluidboxUpdateOptions<TItem extends FluidboxItem = FluidboxItem> = {
  readonly [K in
    | "labels"
    | "zoom"
    | "loop"
    | "controls"
    | "icons"
    | "viewer"
    | "thumbnails"
    | "sheet"
    | "preload"
    | "dismiss"
    | "wheel"
    | "shareUrl"]?: FluidboxOptions<TItem>[K] | undefined;
};

export interface FluidboxCommandOptions {
  /** Aborting it stops the command, which resolves false. */
  readonly signal?: AbortSignal;
  /**
   * A move that follows a continuous input, as a thumbnail strip being
   * scrubbed: the slide jumps rather than glides, and the page is not
   * scrolled to the item's trigger. The next move without it ends the scrub
   * and brings the trigger into view.
   */
  readonly scrub?: boolean;
}

export interface FluidboxZoomCommandOptions {
  /** Aborting it stops the zoom where it is, and the command resolves false. */
  readonly signal?: AbortSignal;
  /**
   * The point that stays put as the image scales, in client pixels, as a
   * pointer event's `clientX` and `clientY`.
   * @default the centre of the stage
   */
  readonly origin?: { readonly x: number; readonly y: number };
}

/**
 * What a trigger opens: one target, or a list of them. The first opens, and
 * every one closes back onto the trigger, as on an album cover.
 */
export type FluidboxTriggerValue<TItem extends FluidboxItem = FluidboxItem> =
  | FluidboxTarget<TItem>
  | readonly FluidboxTarget<TItem>[];

export interface FluidboxBindOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** Unbinds when aborted. */
  readonly signal?: AbortSignal;
  /**
   * Called before the closing flight measures the trigger, with the item it
   * lands on: show that item on the trigger, synchronously, as an album cover does.
   */
  readonly onPreviewChange?: (item: TItem, index: number) => void;
}

export interface FluidboxOverlayOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** Unbinds when aborted. */
  readonly signal?: AbortSignal;
  /**
   * How it goes with the photo's flight. `"none"` stays on the card, with
   * `--fluidbox-closed` and `data-fluidbox-phase`; `"copy"` flies a still copy
   * of it; `{ live }` draws live content into the flying frame; `"frame"` moves
   * the element itself into the flying frame, scaling with it as a scrim does.
   * A trigger can have several overlays, as a scrim beside a count.
   * @default "none"
   */
  readonly flight?: "none" | "copy" | "frame" | { readonly live: FluidboxRenderer<TItem> };
}

/**
 * Commands resolve true once they happened and their motion settled, and false
 * when they were prevented, superseded by a later command, aborted, or had
 * nothing to do. An unknown id or an index out of range rejects with a
 * RangeError.
 */
export interface Fluidbox<TItem extends FluidboxItem = FluidboxItem> extends EventTarget {
  readonly state: FluidboxState<TItem>;
  /** The items it was made with, or the last `setItems`, as a list. */
  readonly items: FluidboxItemList<TItem>;
  /** The sheet, when the `sheet` option is on. */
  readonly sheet: FluidboxSheet | null;
  /**
   * Open the viewer on an item, or move to it while open. Without a target, it
   * opens the current item, or the first if there is none.
   */
  open(target?: FluidboxTarget<TItem>, options?: FluidboxCommandOptions): Promise<boolean>;
  close(options?: FluidboxCommandOptions): Promise<boolean>;
  next(options?: FluidboxCommandOptions): Promise<boolean>;
  previous(options?: FluidboxCommandOptions): Promise<boolean>;
  /**
   * Zoom the image on show to `scale`, kept between 1 and the `zoom` option's
   * `max`. Resolves true once it rests there, and false while no image can
   * zoom (`state.zoom` is null), or when a gesture or another zoom interrupts it.
   * A scale that isn't a finite number rejects with a RangeError.
   */
  zoomTo(scale: number, options?: FluidboxZoomCommandOptions): Promise<boolean>;
  /** Zoom in by 1.5, as the `+` key does. */
  zoomIn(options?: FluidboxZoomCommandOptions): Promise<boolean>;
  /** Zoom out by 1.5, as the `-` key does. */
  zoomOut(options?: FluidboxZoomCommandOptions): Promise<boolean>;
  /** Zoom back out to fit, as the `0` key does. */
  zoomReset(options?: Pick<FluidboxZoomCommandOptions, "signal">): Promise<boolean>;
  /**
   * Make the open viewer fullscreen, or leave it; without an argument, toggle.
   * Resolves whether it is fullscreen after. Where only a video may go
   * fullscreen, as on iPhone, it resolves false.
   */
  setFullscreen(on?: boolean): Promise<boolean>;
  /**
   * Download the open item's file, as the Download control does. Resolves
   * whether a download or a tab with the file started.
   */
  download(): Promise<boolean>;
  /**
   * Share the open item's link, through the system's share sheet or else the
   * clipboard. Resolves whether it was shared or copied.
   */
  share(): Promise<boolean>;
  /**
   * Change options without closing the viewer. Labels and zoom apply in place, so
   * a zoomed photo zooms out when zoom turns off. A change of `controls`, `viewer`
   * or the labels redraws the viewer's layer, and a change of `thumbnails` or
   * `sheet` mounts that add-on again, with the sheet at rest. It compares option
   * objects member by member and functions by identity, so a fresh object with the
   * same members changes nothing. Turning an add-on on without its import
   * throws.
   */
  update(options: FluidboxUpdateOptions<TItem>): void;
  /**
   * Replace the items. An open viewer stays on the same id, else on the item now at
   * its index, or the last. It closes when the list is empty.
   */
  setItems(items: FluidboxItems<TItem>): Promise<boolean>;
  /**
   * Start loading an item a press is likely to open, while closed. Until the
   * viewer's code has loaded, this only loads the code. Call the result to drop
   * the work. Throws a RangeError for an unknown target.
   */
  preload(target: FluidboxTarget<TItem>): () => void;
  /**
   * Load the viewer's code now, as on any signal of your own that a viewer is
   * about to open. Resolves to true once it has loaded, or false if it failed or
   * the fluidbox was destroyed. A failed load tries again on the next call.
   */
  load(): Promise<boolean>;
  /**
   * Make an element a trigger. `value` is one target, or a list: the first
   * opens, and every one closes back onto the element. It sets
   * `data-fluidbox-trigger` and `aria-haspopup="dialog"` on the element, loads
   * the viewer's code as the `preload` option says, preloads on a
   * primary-button `pointerdown`, and drops that work 250 ms after the pointer
   * lifts without a click. A plain primary click opens the item the trigger
   * shows, its first or the one of its list it last closed onto, unless the
   * click was prevented, and prevents it, so an `<a href>` trigger stays on the
   * page. A click with a modifier key is left to the link, and a link is
   * followed when the viewer fails to open. Returns a function that unbinds.
   */
  bind(
    element: HTMLElement,
    value: FluidboxTriggerValue<TItem>,
    options?: FluidboxBindOptions<TItem>,
  ): () => void;
  /**
   * Make an element on a trigger, such as a badge or a caption, a trigger
   * overlay for the same `value`: it gets `--fluidbox-closed` and
   * `data-fluidbox-phase` as the viewer opens and closes, and goes with the
   * flight as `flight` says.
   */
  bindOverlay(
    element: HTMLElement,
    value: FluidboxTriggerValue<TItem>,
    options?: FluidboxOverlayOptions<TItem>,
  ): () => void;
  /**
   * Make your own element a control, in the viewer or anywhere on the page: it
   * runs the command on click, gets the control's data attribute, its
   * `aria-label` unless it has a name of its own, `disabled` and `hidden` from
   * the state, and for Full screen the label that matches it. Returns its cleanup.
   */
  bindControl(
    element: HTMLElement,
    name: FluidboxControlName,
    options?: { readonly signal?: AbortSignal },
  ): () => void;
  /**
   * Call `listener` after every state change, not on every animation frame.
   * Returns a function that unsubscribes.
   */
  subscribe(listener: (state: FluidboxState<TItem>) => void): () => void;
  /**
   * Close at once, remove the viewer and release every binding. Calling it again
   * does nothing. After it, commands resolve false, and `setItems`, `preload`,
   * `bind`, `bindOverlay` and `subscribe` throw an InvalidStateError.
   */
  destroy(): void;

  addEventListener<K extends keyof FluidboxEventMap<TItem>>(
    type: K,
    listener: (event: FluidboxEventMap<TItem>[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof FluidboxEventMap<TItem>>(
    type: K,
    listener: (event: FluidboxEventMap<TItem>[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
}
