import type { FluidboxLabels } from "./labels";

export type { FluidboxLabels } from "./labels";

/** What every item can carry besides its media. */
export interface FluidboxItemBase {
  /** Stable identity across item updates. Defaults to `src`. Unique in a list. */
  readonly id?: string;
  /**
   * A small image of the item: the filmstrip's thumbnail, an iframe's still, and
   * the picture shown while the full image loads. With `srcset`, the browser
   * picks a sharper one where it can.
   */
  readonly thumbnail?: FluidboxThumbnail;
  /** An image URL, such as a data URI, painted at once behind an image slide. */
  readonly placeholder?: string;
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
  readonly type: "img";
  readonly src: string;
  readonly srcset?: string;
  readonly sizes?: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly sources?: readonly FluidboxPictureSource[];
}

/** A `<video>`. */
export interface FluidboxVideoItem extends FluidboxItemBase {
  readonly type: "video";
  readonly src: string;
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

/** Your own content, drawn by the renderer named `render`. */
export interface FluidboxCustomItem extends FluidboxItemBase {
  readonly type: "custom";
  readonly id: string;
  /** The key of a renderer in the `renderers` option. */
  readonly render: string;
  /** The content's accessible name. */
  readonly title: string;
  readonly width: number;
  readonly height: number;
}

/**
 * One piece of media. Every field is the HTML attribute of the element the viewer
 * draws, by its DOM property name, so `srcset`, `sizes`, `poster` and
 * `referrerPolicy` mean what they mean on `<img>`, `<video>` and `<iframe>`.
 * Extend a type to add fields of your own. They come back in every callback,
 * event and state.
 */
export type FluidboxItem =
  | FluidboxImageItem
  | FluidboxVideoItem
  | FluidboxIframeItem
  | FluidboxCustomItem;

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
 * An array, which the fluidbox copies and checks for empty and duplicate ids, or
 * a lazy list it reads on demand and doesn't check.
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
 * Draws into `target`: a custom slide (`renderers`), a filmstrip thumbnail, the
 * sheet, or a travelling thumbnail overlay. Return a function to release your own
 * resources, such as timers.
 */
export type FluidboxRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  context: FluidboxRenderContext<TItem>,
) => void | (() => void);

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

// Origins: where a flight starts and lands.

export interface FluidboxOrigin<TItem extends FluidboxItem = FluidboxItem> {
  /** The element that opened the item, scrolled into view on close. */
  readonly trigger: HTMLElement;
  /** The box the flight starts from and lands on. */
  readonly visual: HTMLElement;
  /** The image painted at the start of the flight, if any. */
  readonly thumbnail?: HTMLImageElement;
  /**
   * Called before the closing flight measures `visual`, with the item it lands
   * on: show that item on the trigger, synchronously, as an album cover does.
   */
  readonly onPreviewChange?: (item: TItem, index: number) => void;
}

export interface FluidboxRevealContext {
  readonly signal: AbortSignal;
  /** "open" before the opening flight, "selection" as the viewer moves between items. */
  readonly phase: "open" | "selection";
}

/** Finds origins the viewer can't see, as in a virtualized grid. */
export interface FluidboxOriginAdapter<TItem extends FluidboxItem = FluidboxItem> {
  getOrigin(id: string): FluidboxOrigin<TItem> | null;
  /** Bring the item's trigger into view. Without it, the viewer scrolls it into view. */
  revealOrigin?(id: string, index: number, context: FluidboxRevealContext): void | Promise<void>;
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
  /** The item the viewer shows or is going to, or null while closed. */
  readonly id: string | null;
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
}

/**
 * What made something happen. "api" is your code or a default control, "trigger"
 * a click on a trigger, and "keyboard" the arrow keys, Escape, or a page-scrolling
 * key that closes the viewer. "pointer" is a swipe or scroll through the slides, a
 * drag to dismiss or a tap on the backdrop, and "wheel" a wheel or trackpad scroll
 * that dismisses. "items" is a move made by `setItems`. A move from the filmstrip
 * has the reason of its input.
 */
export type FluidboxReason = "api" | "trigger" | "keyboard" | "pointer" | "wheel" | "items";

export type FluidboxToggleState = "open" | "closed";

/**
 * Fired as the viewer opens or closes, like a popover's events: `beforetoggle`
 * first, cancelable, then `toggle` as the motion starts.
 */
export class FluidboxToggleEvent extends Event {
  readonly oldState: FluidboxToggleState;
  readonly newState: FluidboxToggleState;
  readonly reason: FluidboxReason;

  constructor(
    type: "beforetoggle" | "toggle",
    init: EventInit & {
      oldState: FluidboxToggleState;
      newState: FluidboxToggleState;
      reason: FluidboxReason;
    },
  ) {
    super(type, init);
    this.oldState = init.oldState;
    this.newState = init.newState;
    this.reason = init.reason;
  }
}

/**
 * Fired as the viewer moves between items: `beforeitemchange` first, cancelable,
 * then `itemchange` when the item changes (opening included), and `settle` once it
 * comes to rest.
 */
export class FluidboxItemChangeEvent<TItem extends FluidboxItem = FluidboxItem> extends Event {
  readonly id: string;
  readonly index: number;
  readonly item: TItem;
  readonly reason: FluidboxReason;

  constructor(
    type: "beforeitemchange" | "itemchange" | "settle",
    init: EventInit & { id: string; index: number; item: TItem; reason: FluidboxReason },
  ) {
    super(type, init);
    this.id = init.id;
    this.index = init.index;
    this.item = init.item;
    this.reason = init.reason;
  }
}

/**
 * Fired when the sheet comes to rest at another stop. A swipe or a scroll of the
 * sheet has the reason "pointer", a wheel "wheel", Escape or a key on a stop
 * button "keyboard", and `sheet.set` or the viewer opening and closing "api".
 */
export class FluidboxSheetEvent extends Event {
  /** The stop the sheet rests at: 0 at rest, then one per snap point. */
  readonly stop: number;
  readonly reason: FluidboxReason;

  constructor(type: "sheetchange", init: EventInit & { stop: number; reason: FluidboxReason }) {
    super(type, init);
    this.stop = init.stop;
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
 * The events a fluidbox and `<fluidbox-gallery>` fire. The before-events fire
 * synchronously for every command that would do something, from a key, a gesture
 * or your code. `preventDefault()` cancels the command, and its promise resolves
 * false. An open fires `beforetoggle`, `toggle`, `itemchange`, and `settle` after
 * the flight.
 */
export interface FluidboxEventMap<TItem extends FluidboxItem = FluidboxItem> {
  /** Before the viewer opens or closes. Cancelable. */
  beforetoggle: FluidboxToggleEvent;
  /** The opening or closing motion starts. */
  toggle: FluidboxToggleEvent;
  /** Before the open viewer moves to another item. Cancelable. */
  beforeitemchange: FluidboxItemChangeEvent<TItem>;
  /** The viewer moves to an item, the one it opens on included. */
  itemchange: FluidboxItemChangeEvent<TItem>;
  /** The viewer comes to rest on an item. */
  settle: FluidboxItemChangeEvent<TItem>;
  /** The sheet comes to rest at another stop. */
  sheetchange: FluidboxSheetEvent;
  /** The image on show comes to rest at another zoom. */
  zoomchange: FluidboxZoomEvent;
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
   * What a swipe down on the photo does with the sheet down. "flight" flies the
   * photo home; "scroll" scrolls it off the bottom of the screen and closes;
   * "none" keeps the viewer open.
   * @default "flight"
   */
  readonly dismiss?: "flight" | "scroll" | "none";
  /**
   * Fills the sheet, a `<section data-fluidbox-sheet>` named by `labels.sheet`,
   * for the item on show. It runs again when the item changes; the `signal`
   * aborts and the section is emptied first.
   */
  readonly render?: FluidboxRenderer<TItem>;
}

/** Reads and moves the sheet. A `sheetchange` event follows each new stop. */
export interface FluidboxSheet {
  /** The stop the sheet rests at: 0 at rest, then one per snap point. */
  readonly stop: number;
  /** Move the sheet to a stop. Ignored while the viewer is not open. */
  set(stop: number, options?: { readonly animate?: boolean }): void;
}

export interface FluidboxFilmstripOptions<TItem extends FluidboxItem = FluidboxItem> {
  /**
   * Fills each thumbnail button instead of the default image, while the button
   * is in the strip's rendered window. The `signal` aborts as it leaves.
   */
  readonly render?: FluidboxRenderer<TItem>;
}

// The fluidbox.

/**
 * A default control. `previous`, `next` and `close` show by default; the zoom
 * controls only when you list them in `controls`.
 */
export type FluidboxControlName =
  | "previous"
  | "next"
  | "close"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset";

/**
 * When the viewer's code loads. `"hover"` loads it when a mouse rests on a
 * trigger for 100 ms, a finger or pen touches one, or one takes focus.
 * `"press"` loads it when a trigger is pressed, and `"eager"` once the page is
 * idle. In every mode, an open loads it if it hasn't loaded yet, and
 * `load()` loads it whenever you call it.
 */
export type FluidboxLoading = "hover" | "press" | "eager";

/** Every option but `items`, `renderers` and `origins` can change later through `update`. */
export interface FluidboxOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly items: FluidboxItems<TItem>;
  /** Your strings for the viewer, over the defaults. */
  readonly labels?: Partial<FluidboxLabels>;
  /**
   * Pinch, double-tap, click, wheel and keyboard zoom of images. `step` is the
   * scale of a click or double-tap, and `max` the largest scale for every
   * input. The `+` and `-` keys, `zoomIn`, `zoomOut` and the zoom controls zoom
   * by 1.5. `false` turns zoom off.
   * @default { step: 2, max: 4 }
   */
  readonly zoom?: false | { readonly step?: number; readonly max?: number };
  /** Draw `custom` items, by the name in their `render`. Read when a slide mounts. */
  readonly renderers?: Readonly<Record<string, FluidboxRenderer<TItem>>>;
  /**
   * Go round: past the last item comes the first, and before the first the
   * last, by swipe, key, button and filmstrip alike. A single item never loops.
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
   * A thumbnail strip. Needs `import "@ogdakke/fluidbox/filmstrip"` and its
   * stylesheet. Without the import, it throws an Error that names it.
   */
  readonly filmstrip?: boolean | FluidboxFilmstripOptions<TItem>;
  /**
   * A sheet over the photo. Needs `import "@ogdakke/fluidbox/sheet"` and its
   * stylesheet. Without the import, it throws an Error that names it.
   */
  readonly sheet?: boolean | FluidboxSheetOptions<TItem>;
  /** Find origins the viewer can't see, as in a virtualized grid. Read on each use. */
  readonly origins?: FluidboxOriginAdapter<TItem>;
  /**
   * When the viewer's code loads.
   * @default "hover"
   */
  readonly loading?: FluidboxLoading;
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
    | "viewer"
    | "filmstrip"
    | "sheet"
    | "loading"]?: FluidboxOptions<TItem>[K] | undefined;
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

export interface FluidboxBindOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** Unbinds when aborted. */
  readonly signal?: AbortSignal;
  /** More items that close back onto this element, as on an album cover. */
  readonly returns?: readonly FluidboxTarget<TItem>[];
  /**
   * Called before the closing flight measures the trigger, with the item it
   * lands on: show that item on the trigger, synchronously, as an album cover does.
   */
  readonly onPreviewChange?: (item: TItem, index: number) => void;
}

export interface FluidboxOverlayOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** Unbinds when aborted. */
  readonly signal?: AbortSignal;
  /** More items whose flights carry the overlay, as with the trigger's `returns`. */
  readonly returns?: readonly FluidboxTarget<TItem>[];
  /**
   * Fly with the photo. `true` flies a copy of the element; a renderer draws
   * live content into the flying frame.
   */
  readonly travel?: boolean | FluidboxRenderer<TItem>;
  /** With `travel`, an element moved into the flying frame for the flight and put back after. */
  readonly frameLayer?: HTMLElement;
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
  resetZoom(options?: Pick<FluidboxZoomCommandOptions, "signal">): Promise<boolean>;
  /**
   * Change options without closing the viewer. Labels and zoom apply in place, so
   * a zoomed photo zooms out when zoom turns off. A change of `controls`, `viewer`
   * or the labels redraws the viewer's layer, and a change of `filmstrip` or
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
   * Make an element a trigger that opens the viewer on an item. The item, and any
   * in `returns`, close back onto it. It sets `data-fluidbox-trigger`,
   * `aria-haspopup="dialog"` and `aria-expanded` on the element, loads the viewer's
   * code as the `loading` option says, preloads on a primary-button `pointerdown`,
   * and drops that work 250 ms after the pointer lifts without a click. A click
   * opens the item the trigger shows, its target or the item of `returns` it last
   * closed onto, unless the click was prevented.
   * Returns a function that unbinds.
   */
  bind(
    element: HTMLElement,
    target: FluidboxTarget<TItem>,
    options?: FluidboxBindOptions<TItem>,
  ): () => void;
  /**
   * Make an element on a trigger, such as a badge or a caption, a thumbnail
   * overlay: it gets `--fluidbox-closed` and `data-fluidbox-phase` as the
   * viewer opens and closes, and with `travel` it flies with the photo.
   */
  bindOverlay(
    element: HTMLElement,
    target: FluidboxTarget<TItem>,
    options?: FluidboxOverlayOptions<TItem>,
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
