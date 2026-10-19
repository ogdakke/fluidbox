import type { FluidboxLabels } from "./labels";

export type { FluidboxLabels } from "./labels";

// Items. Every field is the HTML attribute of the element the viewer draws, by
// its DOM property name, so `srcset`, `sizes`, `poster` and `referrerPolicy`
// mean what they mean on `<img>`, `<video>` and `<iframe>`.

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

/** A `<video>`. `controls` and `playsInline` default to true. */
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
  readonly playsInline?: boolean;
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

export type FluidboxItem =
  | FluidboxImageItem
  | FluidboxVideoItem
  | FluidboxIframeItem
  | FluidboxCustomItem;

/** A list read on demand, for long or generated galleries. */
export interface FluidboxItemList<TItem extends FluidboxItem = FluidboxItem> {
  readonly count: number;
  get(index: number): TItem;
  /** The index of the item with this id, or -1. Without it, ids are found by scanning. */
  indexOf?(id: string): number;
}

export type FluidboxItems<TItem extends FluidboxItem = FluidboxItem> =
  | readonly TItem[]
  | FluidboxItemList<TItem>;

/** An item's index, or its id. */
export type FluidboxTarget = number | string;

// Rendering.

export interface FluidboxRenderContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  /** The element to draw into. The viewer empties it afterwards. */
  readonly target: HTMLElement;
  /** Aborted when the content is no longer shown. */
  readonly signal: AbortSignal;
}

/** Draws into `target`. May return a function that releases what it made. */
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

/** Draws your controls and captions into the viewer, once. */
export type FluidboxViewerRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  context: FluidboxViewerContext<TItem>,
) => void | (() => void);

// Origins: where a flight starts and lands.

export interface FluidboxOrigin {
  /** The element that opened the item, scrolled into view on close. */
  readonly trigger: HTMLElement;
  /** The box the flight starts from and lands on. */
  readonly visual: HTMLElement;
  /** The image painted at the start of the flight, if any. */
  readonly thumbnail?: HTMLImageElement;
  /** Called before the closing flight measures `visual`, with the item it lands on. Update it synchronously. */
  readonly prepareClose?: (item: FluidboxItem, index: number) => void;
}

export interface FluidboxRevealContext {
  readonly signal: AbortSignal;
  readonly reason: "open" | "selection";
}

/** Finds origins the viewer can't see, as in a virtualized grid. */
export interface FluidboxOriginAdapter {
  getOrigin(id: string): FluidboxOrigin | null;
  /** Bring the item's trigger into view. Without it, the viewer scrolls it into view. */
  revealOrigin?(id: string, index: number, context: FluidboxRevealContext): void | Promise<void>;
}

// State and events.

export type FluidboxStatus = "closed" | "opening" | "open" | "closing";

export interface FluidboxState<TItem extends FluidboxItem = FluidboxItem> {
  readonly status: FluidboxStatus;
  /** The item the viewer shows or is going to, or null while closed. */
  readonly id: string | null;
  readonly index: number | null;
  readonly item: TItem | null;
  readonly count: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}

/** What made something happen. "items" is a change of the item list. */
export type FluidboxReason =
  | "api"
  | "trigger"
  | "keyboard"
  | "pointer"
  | "wheel"
  | "filmstrip"
  | "items";

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
export class FluidboxChangeEvent<TItem extends FluidboxItem = FluidboxItem> extends Event {
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

export interface FluidboxEventMap<TItem extends FluidboxItem = FluidboxItem> {
  beforetoggle: FluidboxToggleEvent;
  toggle: FluidboxToggleEvent;
  beforeitemchange: FluidboxChangeEvent<TItem>;
  itemchange: FluidboxChangeEvent<TItem>;
  settle: FluidboxChangeEvent<TItem>;
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
   * Fills a sheet the runtime makes, for the active item. Leave it out and draw
   * your own element with `data-fluidbox-sheet` into the handle's `slot`.
   */
  readonly render?: FluidboxRenderer<TItem>;
}

/** Reads and moves the sheet. */
export interface FluidboxSheet {
  /** The stop the sheet rests at: 0 at rest, then one per snap point. */
  readonly stop: number;
  /** Where to draw your own `data-fluidbox-sheet` element. */
  readonly slot: HTMLElement | null;
  /** Move the sheet to a stop. Ignored while the viewer is not open. */
  set(stop: number, options?: { readonly animate?: boolean }): void;
  /** Called when the stop changes, and when the slot appears or goes. */
  subscribe(listener: (stop: number) => void): () => void;
}

export interface FluidboxFilmstripOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** Fills each thumbnail button instead of the default image. */
  readonly render?: FluidboxRenderer<TItem>;
  /** Leave the buttons empty and list them in the handle's `slots`, for framework components. */
  readonly slots?: boolean;
}

/** A thumbnail button of the filmstrip, while it is in the strip's rendered window. */
export interface FluidboxFilmstripSlot<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  readonly target: HTMLElement;
}

export interface FluidboxFilmstrip<TItem extends FluidboxItem = FluidboxItem> {
  /** The thumbnail buttons in view, in index order. Empty unless made with `slots: true`. */
  readonly slots: readonly FluidboxFilmstripSlot<TItem>[];
  subscribe(listener: () => void): () => void;
}

// The fluidbox.

export type FluidboxControlName = "previous" | "next" | "close";

export interface FluidboxOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly items: FluidboxItems<TItem>;
  /** Your strings for the viewer. */
  readonly labels?: Partial<FluidboxLabels>;
  /** Pinch, double-tap, wheel and keyboard zoom of images. `false` turns it off. */
  readonly zoom?: false | { readonly step?: number; readonly max?: number };
  /** Draw `custom` items, by the name in their `render`. */
  readonly renderers?: Readonly<Record<string, FluidboxRenderer<TItem>>>;
  /** Draw your own controls and captions into the viewer. */
  readonly viewer?: FluidboxViewerRenderer<TItem>;
  /**
   * The default Previous, Next and Close buttons, or some of them.
   * @default true without a `viewer`, else false
   */
  readonly controls?: boolean | readonly FluidboxControlName[];
  /** A thumbnail strip. Needs `import "@ogdakke/fluidbox/filmstrip"`. */
  readonly filmstrip?: boolean | FluidboxFilmstripOptions<TItem>;
  /** A sheet over the photo. Needs `import "@ogdakke/fluidbox/sheet"` and its stylesheet. */
  readonly sheet?: boolean | FluidboxSheetOptions<TItem>;
  /** Find origins the viewer can't see, as in a virtualized grid. */
  readonly origins?: FluidboxOriginAdapter;
}

export interface FluidboxCommandOptions {
  readonly signal?: AbortSignal;
}

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
   * Fly with the photo. `true` flies a copy of the element; a renderer draws
   * live content into the flying frame.
   */
  readonly travel?: boolean | FluidboxRenderer<TItem>;
  /** With `travel`, an element moved into the flying frame for the flight and put back after. */
  readonly frameLayer?: HTMLElement;
}

export interface Fluidbox<TItem extends FluidboxItem = FluidboxItem> extends EventTarget {
  readonly state: FluidboxState<TItem>;
  readonly items: FluidboxItemList<TItem>;
  /** The sheet, when the `sheet` option is on. */
  readonly sheet: FluidboxSheet | null;
  /** The filmstrip, when the `filmstrip` option is on. */
  readonly filmstrip: FluidboxFilmstrip<TItem> | null;
  /**
   * Open the viewer on an item, or move to it while open. Without a target, the
   * current item, else the first. Resolves true once it happened, false when it
   * was prevented, superseded or aborted. Rejects with a RangeError for an
   * unknown target.
   */
  open(target?: FluidboxTarget, options?: FluidboxCommandOptions): Promise<boolean>;
  close(options?: FluidboxCommandOptions): Promise<boolean>;
  next(options?: FluidboxCommandOptions): Promise<boolean>;
  previous(options?: FluidboxCommandOptions): Promise<boolean>;
  /** Replace the items. An open viewer stays on the same id when it is still there. */
  setItems(items: FluidboxItems<TItem>): Promise<boolean>;
  /** Start loading an item a press is likely to open. Call the result to let go. */
  preload(target: FluidboxTarget): () => void;
  /**
   * Make an element open the viewer. With several targets, the first opens and
   * any of them can close back onto it. Returns a function that unbinds.
   */
  bind(
    element: HTMLElement,
    target: FluidboxTarget | readonly FluidboxTarget[],
    options?: FluidboxBindOptions<TItem>,
  ): () => void;
  /**
   * Make an element on a trigger, such as a badge or a caption, a thumbnail
   * overlay: it gets `--fluidbox-progress` and `data-fluidbox-phase` as the
   * viewer opens and closes, and with `travel` it flies with the photo.
   */
  bindOverlay(
    element: HTMLElement,
    target: FluidboxTarget | readonly FluidboxTarget[],
    options?: FluidboxOverlayOptions<TItem>,
  ): () => void;
  subscribe(listener: (state: FluidboxState<TItem>) => void): () => void;
  /** Remove the viewer and release every binding. */
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
