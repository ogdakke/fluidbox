# 2. Core API

The plain JavaScript API in `@ogdakke/fluidbox`. The bindings and the custom elements are built on
it and the kit, as now. Signatures are the proposed `public-api.ts`.

## 2.1 Principles kept from today

- Item fields are HTML attribute names by DOM property name.
- Commands resolve `true` once they happened and their motion settled, `false` when prevented,
  superseded, aborted, or with nothing to do. An unknown target rejects with a `RangeError`.
- `state` is a frozen snapshot; `subscribe` never fires per frame.
- The package root has no side effects and touches no browser globals on import.
- One registry per page for add-ons (`Symbol.for`).

## 2.2 `createFluidbox`

```ts
export function createFluidbox<TItem extends FluidboxItem = FluidboxItem>(
  options: FluidboxOptions<TItem>,
): Fluidbox<TItem>;

export interface FluidboxOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly items: FluidboxItems<TItem>;
  /** The item to open with, by id: a server-rendered open viewer, or a deep link. */
  readonly value?: string | null;
  readonly labels?: Partial<FluidboxLabels>;
  /** @default { step: 2, max: 4, click: "single", tap: "double" } (§2.23) */
  readonly zoom?:
    | false
    | {
        readonly step?: number;
        readonly max?: number;
        /** What a mouse click on the media does. */
        readonly click?: "single" | "double" | false;
        /** What a touch or pen tap on the media does. */
        readonly tap?: "double" | false;
      };
  /**
   * How each item type draws its slide. Built-in types (image, video, iframe)
   * have a slide already; list one to replace it. Read when a slide mounts.
   */
  readonly slides?: FluidboxSlides<TItem>;
  /** @default false */
  readonly loop?: boolean;
  /** Draw your own controls and captions into the viewer's layer. */
  readonly viewer?: FluidboxViewerRenderer<TItem>;
  /** @default true without `viewer`, else ["close"] */
  readonly controls?: boolean | readonly FluidboxControlName[];
  /** Needs `import "@ogdakke/fluidbox/thumbnails"`. */
  readonly thumbnails?: boolean | FluidboxThumbnailsOptions<TItem>;
  /** Needs `import "@ogdakke/fluidbox/sheet"`. */
  readonly sheet?: boolean | FluidboxSheetOptions<TItem>;
  /**
   * Find the trigger of an item the page doesn't have bound, as in a
   * virtualised grid. Read on each use. Return null when it isn't rendered.
   */
  readonly findTrigger?: (item: TItem, index: number) => HTMLElement | null;
  /** Bring an item's trigger into view. Without it, the viewer scrolls it into view. */
  readonly revealTrigger?: (
    item: TItem,
    index: number,
    context: FluidboxRevealContext,
  ) => void | Promise<void>;
  /** When the viewer's code loads. @default "intent" */
  readonly preload?: FluidboxPreload;
  /** Which gestures close the viewer. Escape always does. (§2.14) */
  readonly dismiss?: { readonly drag?: boolean; readonly backdrop?: boolean };
  /** What a vertical wheel or trackpad scroll does on an unzoomed slide. @default "dismiss" (§2.14) */
  readonly wheel?: "dismiss" | "zoom" | "navigate" | "none";
  /** The link Share shares. Without it, the Root's `href`; without both, Share hides. (§2.12) */
  readonly shareUrl?: (item: TItem) => string | undefined;
  /** Advance on a timer. Off until `play()`, or `autoplay: true`. (§2.19, plan step 7) */
  readonly slideshow?: FluidboxSlideshowOptions;
  /** How near the end `reachend` fires. @default 2 (§2.20, plan step 7) */
  readonly reachEndThreshold?: number;
}

export type FluidboxPreload = "intent" | "press" | "eager";
```

`findTrigger` returns the trigger. The runtime finds the visual inside it as `bind` does now:
`[data-fluidbox-origin]`, else the first `img` or `video`, else the trigger
(`resolveOrigin`, `trigger.ts:16`). Today's `getOrigin(id)` returns a `FluidboxOrigin` with an
`onPreviewChange`; nothing in the docs or examples uses a custom `visual` or `thumbnail`, and
`data-fluidbox-origin` covers the visual. If a use for a separate visual turns up, `findTrigger`
can return `{ trigger, visual }` later without breaking.

`update` changes every option but `items`, `value`, `slides`, `findTrigger` and `revealTrigger`,
as now (`slides` and the two trigger functions are read on use).

## 2.3 Items

```ts
export interface FluidboxItemBase {
  readonly id?: string;
  readonly thumbnail?: FluidboxThumbnail;
  readonly placeholder?: string;
  /** Text shown by <Fluidbox.Caption>; becomes the dialog's description. */
  readonly caption?: string;
  /**
   * How the media box is sized. "contain": to the item's width and height,
   * fitted in the stage. "fill": to the whole stage, less its insets (§5.4).
   * Ignored on image items.
   * @default "contain"; modelItem() sets "fill"
   */
  readonly fit?: "contain" | "fill";
  /**
   * The file Download saves: a URL, `{ src, filename }`, or false for none.
   * @default image: `zoom.src ?? src`; video: `src`; others: none (§2.12)
   */
  readonly download?: string | false | { readonly src: string; readonly filename?: string };
  /** Becomes `data-*` on the slide and its thumbnail: `{ tone: "light" }` → `data-tone="light"`. (§2.15) */
  readonly data?: Readonly<Record<string, string>>;
}

export interface FluidboxImageItem extends FluidboxItemBase {
  readonly type: "image";
  readonly src: string;
  readonly srcset?: string;
  readonly sizes?: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly sources?: readonly FluidboxPictureSource[];
  /** The larger image zoom and hover zoom load: a master, or width candidates. */
  readonly zoom?: { readonly src?: string; readonly srcset?: string };
  /** A tiled pyramid for the deep-zoom add-on. The core ignores it. (§2.18, plan step 7) */
  readonly tiles?: { readonly format: "iiif" | "dzi"; readonly url: string };
}

export interface FluidboxVideoItem extends FluidboxItemBase {
  readonly type: "video";
  /** The last resort: drawn as the last <source>, after `sources`. */
  readonly src: string;
  /**
   * Encodings to try first, in order of preference, such as AV1, then WebM,
   * then `src` as MP4. Each is a <source> child of the <video>.
   */
  readonly sources?: readonly FluidboxVideoSource[];
  // title, width, height, poster, autoplay, loop, muted,
  // playsInline, controls, preload, tracks: unchanged.
}

export interface FluidboxVideoSource {
  readonly src: string;
  /** The MIME type with codecs, as `video/mp4; codecs="av01.0.05M.08"`. */
  readonly type?: string;
  /** A media query, as `(min-width: 1200px)`. */
  readonly media?: string;
}

export interface FluidboxIframeItem extends FluidboxItemBase {
  readonly type: "iframe";
  // src, title, width, height, allow, referrerPolicy, sandbox: unchanged.
}

/** What every item of your own needs: a name and a size for its media box. */
export interface FluidboxCustomItemBase<TType extends string> extends FluidboxItemBase {
  readonly type: TType;
  /** The accessible name of the slide and the dialog. */
  readonly title: string;
  /** Required unless `fit` is "fill"; then they only shape the poster. */
  readonly width?: number;
  readonly height?: number;
}

/**
 * Every item type, by its `type`. Add-on entries and your own code add to it
 * by declaration merging. FluidboxItem is the union of its values.
 */
export interface FluidboxItemTypes {
  image: FluidboxImageItem;
  video: FluidboxVideoItem;
  iframe: FluidboxIframeItem;
}

export type FluidboxItem = FluidboxItemTypes[keyof FluidboxItemTypes];
```

### Adding a type

```ts
declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    product: ProductItem;
  }
}

interface ProductItem extends FluidboxCustomItemBase<"product"> {
  readonly id: string;
  readonly price: number;
  readonly image: FluidboxImageItem;
}
```

The add-on entries do the same: `@ogdakke/fluidbox/model` adds `model: FluidboxModelItem`.
Importing the entry's _types_ is enough, so a page can describe model items without loading the
model code.

The generic `TItem extends FluidboxItem` still flows through options, state, events and parts,
as today, for apps that extend item types with fields of their own (`interface Photo extends
FluidboxImageItem { slug: string }`). The two mechanisms answer different questions: merging says
which `type` values exist; `TItem` says what fields a given app's items carry.

Why merging and not only a generic: with a generic alone, `slides.model` can only be typed if every
part and option takes a type parameter for the union, and the parts in JSX can't infer it from
`<Fluidbox.Root items>` to `<Fluidbox.Slides>` across the tree. Merging gives `Slides` its keys
without threading a parameter. The cost: the union is global to the program. Two apps in one
TypeScript program see each other's types. That is acceptable for a component library and is what
`HTMLElementTagNameMap` does.

### Ids and validation

Unchanged, apart from names: `id` defaults to `src`; repeated `src` gets `src#2`; an item without
either throws a `TypeError`; URL checks per type stay (`media-url.ts`), and now cover every
`sources[].src` of a video item too. An item without `width` and `height` throws unless its
`fit` is `"fill"`; the check runs where items are checked now (`toList`, `createItemList`). An item whose `type` has
no slide (no built-in, no entry in `slides`, no `default`) shows the slide's error state with
`labels.error` and logs once in development. Today an unknown `render` throws inside the strip
(`viewer-strip.ts:987`), which breaks the viewer for every item; an error slide is kinder.

**The declared image size is checked** (user-approved). When an image item decodes, the runtime
compares its natural aspect ratio with `width / height`. If they differ by more than 2%, it logs
a development warning, once per file. The warning says the viewer frames the declared shape, so
the photo will be letterboxed or cropped. Built on `feat/api-redesign` in `#revealImage`
(`viewer-strip.ts`).

## 2.4 The instance

```ts
export interface Fluidbox<TItem extends FluidboxItem = FluidboxItem> extends EventTarget {
  readonly state: FluidboxState<TItem>;
  readonly items: FluidboxItemList<TItem>;
  readonly sheet: FluidboxSheet | null;

  open(target?: FluidboxTarget<TItem>, options?: FluidboxCommandOptions): Promise<boolean>;
  close(options?: FluidboxCommandOptions): Promise<boolean>;
  next(options?: FluidboxCommandOptions): Promise<boolean>;
  previous(options?: FluidboxCommandOptions): Promise<boolean>;
  zoomTo(scale: number, options?: FluidboxZoomCommandOptions): Promise<boolean>;
  zoomIn(options?: FluidboxZoomCommandOptions): Promise<boolean>;
  zoomOut(options?: FluidboxZoomCommandOptions): Promise<boolean>;
  zoomReset(options?: Pick<FluidboxZoomCommandOptions, "signal">): Promise<boolean>;
  /** Enter or leave fullscreen; toggles without an argument. Resolves the new state. (§2.11) */
  setFullscreen(on?: boolean): Promise<boolean>;
  /** Download the open item's file, as the Download control does. (§2.12) */
  download(): Promise<boolean>;
  /** Share the open item's link, as the Share control does. (§2.12) */
  share(): Promise<boolean>;
  /** Start and stop the slideshow. (§2.19, plan step 7) */
  play(): void;
  pause(): void;
  update(options: FluidboxUpdateOptions<TItem>): void;
  setItems(items: FluidboxItems<TItem>): Promise<boolean>;
  preload(target: FluidboxTarget<TItem>): () => void;
  load(): Promise<boolean>;
  /**
   * Make an element a trigger. `value` is one target, or a list: the first
   * opens and every one of them closes back onto the element.
   */
  bind(
    element: HTMLElement,
    value: FluidboxTriggerValue<TItem>,
    options?: FluidboxBindOptions<TItem>,
  ): () => void;
  bindOverlay(
    element: HTMLElement,
    value: FluidboxTriggerValue<TItem>,
    options?: FluidboxOverlayOptions<TItem>,
  ): () => void;
  subscribe(listener: (state: FluidboxState<TItem>) => void): () => void;
  destroy(): void;
  // addEventListener / removeEventListener overloads over FluidboxEventMap.
}

export type FluidboxTriggerValue<TItem extends FluidboxItem = FluidboxItem> =
  | FluidboxTarget<TItem>
  | readonly FluidboxTarget<TItem>[];

export interface FluidboxBindOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly signal?: AbortSignal;
  /** Show this item on the trigger before the closing flight measures it. */
  readonly onPreviewChange?: (item: TItem, index: number) => void;
}

export interface FluidboxOverlayOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly signal?: AbortSignal;
  /** @default "none" */
  readonly flight?: "none" | "copy" | "frame" | { readonly live: FluidboxRenderer<TItem> };
}
```

`open(target)` still takes an index, an id or an item, because plain-JS code works with indexes
(`fluidbox.open(2)` in the programmatic pattern). The bindings' `value` is always an id.

## 2.5 State

```ts
export interface FluidboxState<TItem extends FluidboxItem = FluidboxItem> {
  readonly status: FluidboxStatus;
  /** The item the viewer shows or is going to, by id; null while closed. */
  readonly value: string | null;
  readonly index: number | null;
  readonly item: TItem | null;
  readonly count: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  /** Non-null while open on a slide whose media box zooms (§5.2), with zoom on. */
  readonly zoom: FluidboxZoomState | null;
  /** The viewer is the document's fullscreen element (§2.11). */
  readonly fullscreen: boolean;
  /** The slideshow is advancing on its timer (§2.19, plan step 7). */
  readonly playing: boolean;
}
```

## 2.6 Events

Plain JS dispatches one family for the open item. The decision is in §8.5.

```ts
export type FluidboxValueChangeAction = "open" | "move" | "close";

export class FluidboxValueChangeEvent<TItem extends FluidboxItem = FluidboxItem> extends Event {
  /** The id the viewer goes to, or null for a close. */
  readonly value: string | null;
  readonly previousValue: string | null;
  readonly index: number | null;
  readonly item: TItem | null;
  readonly action: FluidboxValueChangeAction;
  readonly reason: FluidboxReason;
  constructor(
    type: "beforevaluechange" | "valuechange" | "valuechangecomplete",
    init: EventInit & {
      /* the fields above */
    },
  );
}

export interface FluidboxEventMap<TItem extends FluidboxItem = FluidboxItem> {
  /** Before an open, a move or a close. Cancelable: the command resolves false. */
  beforevaluechange: FluidboxValueChangeEvent<TItem>;
  /** The change happens: the motion starts. */
  valuechange: FluidboxValueChangeEvent<TItem>;
  /** The motion settled: the opening flight landed, a move came to rest, or a close finished. */
  valuechangecomplete: FluidboxValueChangeEvent<TItem>;
  sheetchange: FluidboxSheetEvent;
  zoomchange: FluidboxZoomEvent;
  /** A slide entered its error state, or a zoom image failed (§2.13). */
  mediaerror: FluidboxMediaErrorEvent<TItem>;
  /** The open item came within `reachEndThreshold` of the end (§2.20, plan step 7). */
  reachend: FluidboxReachEndEvent<TItem>;
}
```

Order for an open: `beforevaluechange` (`action: "open"`), `valuechange`, then
`valuechangecomplete` after the flight. Today an open fires `beforetoggle`, `toggle`,
`itemchange` and `settle`; the new family fires three events, one per moment.

Mapping of the current events (for the implementer): `beforetoggle` and `beforeitemchange` both
become `beforevaluechange`; `toggle` and `itemchange` become one `valuechange` (an open no longer
fires two); `settle` becomes `valuechangecomplete`. A close's `valuechangecomplete` is new: the
controller fires it where the state goes to `"closed"` (`create-fluidbox.ts`, the status
transition `subscribe` already reports).

`FluidboxSheetEvent` keeps its shape with `snap` instead of `stop`. `FluidboxZoomEvent` is
unchanged.

### Details for the bindings

```ts
/** What a binding's onValueChange gets with the new value. Modelled on Base UI's eventDetails. */
export interface FluidboxValueChangeDetails<TItem extends FluidboxItem = FluidboxItem> {
  readonly reason: FluidboxReason;
  readonly action: FluidboxValueChangeAction;
  readonly index: number | null;
  readonly item: TItem | null;
  readonly previousValue: string | null;
  /** The DOM event behind it, when there was one. */
  readonly event: Event | undefined;
  /** Stop the change. Only works synchronously inside onValueChange. */
  cancel(): void;
  readonly isCanceled: boolean;
}
```

Base UI's `Dialog.Root` `onOpenChange(open, eventDetails)` has `reason`, `event`, `cancel()` and
`isCanceled`; Base UI also has `onOpenChangeComplete`. The names here follow it. Base UI's reasons
are kebab-case strings (`"trigger-press"`, `"escape-key"`); this spec keeps fluidbox's reasons
because they describe the input, which a lightbox needs (a wheel dismiss is not a pointer one).

## 2.7 Slides: the `slides` option

```ts
/** How each item type draws its slide, by `type`. */
export type FluidboxSlides<TItem extends FluidboxItem = FluidboxItem> = {
  readonly [K in TItem["type"]]?: FluidboxSlideRenderer<Extract<TItem, { type: K }>>;
} & {
  /** Any type without its own entry and without a built-in slide. */
  readonly default?: FluidboxSlideRenderer<TItem>;
};

export type FluidboxSlideRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  slide: FluidboxSlide<TItem>,
) => void | (() => void);
```

Lookup order for an item: `slides[item.type]`, then the built-in slide for `image`, `video` and
`iframe`, then `slides.default`, then the error slide. Listing `image` replaces the built-in image
slide; the renderer can still draw the built-in image with `slide.drawImage()`.

```ts
createFluidbox({
  items,
  slides: {
    model: createModelSlide({ load: () => import("@google/model-viewer") }),
    embed: embedSlide,
    spin: createSpinSlide(),
  },
});
```

## 2.8 The slide contract

```ts
export interface FluidboxSlide<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  /**
   * The media box: the element that flies, follows a drag to dismiss and
   * zooms. The runtime sizes it from the item's width and height. Draw your
   * media here.
   */
  readonly media: HTMLElement;
  /**
   * The slide's layer beside the box, over the whole slide. It doesn't fly
   * or zoom, and it shows and hides with the viewer's controls.
   */
  readonly layer: HTMLElement;
  /** Aborted when the slide is disposed. */
  readonly signal: AbortSignal;
  readonly active: boolean;
  /**
   * True while an open is waiting for this slide: it mounted as the item
   * being opened. Neighbours that mount with it are false. Lets a slide start
   * heavy work early only when an open waits for it, as the model add-on does.
   */
  readonly opening: boolean;
  onActiveChange(this: void, listener: (active: boolean) => void): () => void;
  /**
   * What the trigger showed, when this slide is the one an open started from
   * a trigger. `video` is set when the trigger's visual is a playing or paused
   * `<video>`. Null on neighbours, on slides reached by moving, and for opens
   * without a trigger. (§2.22)
   */
  readonly origin: FluidboxSlideOrigin | null;
  /**
   * Hand the playback position back to the trigger's video on close. Read
   * once, just after the `onClose` listeners, and only on a close that flies.
   * Returns a function that unregisters it. (§2.22)
   */
  returnPlayback(this: void, source: FluidboxPlaybackSource): () => void;
  /**
   * Called once as a close starts from the slide on show, before the closing
   * flight measures, with the origin of the trigger the close lands on. Fires
   * on every close path, flown or not. Returns a function that unsubscribes. (§4.4)
   */
  onClose(this: void, listener: (landing: FluidboxSlideOrigin | null) => void): () => void;
  /**
   * Let the media box zoom (pinch, double-tap, wheel, the zoom controls).
   * Off by default for your own media; on for drawImage.
   */
  zoomable(this: void, on: boolean | FluidboxZoomableOptions): void;
  /**
   * Put the slide in its error state: the error message and Retry, and a
   * `mediaerror` event with kind "custom". Retry disposes and renders the
   * slide again. (§2.13)
   */
  fail(this: void, error?: unknown): void;
  /**
   * Follow the box's zoom pose, every frame it changes. The hook hotspots and
   * deep zoom build on; built in step 1.4. (§2.18)
   */
  onZoom(this: void, listener: (pose: FluidboxZoomPose) => void): () => void;
  /**
   * Make the opening flight also wait for `promise`, as
   * ExtendableEvent.waitUntil does. For what the engine can't see in the box,
   * such as a canvas having painted. Every open already waits for the box's
   * images and videos, at most three seconds in all. See §5.3.
   */
  waitUntil(this: void, promise: Promise<unknown>): void;
  /** Draw the built-in image, video or iframe for an item into `media`. */
  drawImage(this: void, item?: FluidboxImageItem): () => void;
  drawVideo(this: void, item?: FluidboxVideoItem, options?: FluidboxVideoOptions): () => void;
  drawIframe(this: void, item?: FluidboxIframeItem): () => void;
}
```

Rules, which hold for every binding too:

- A slide mounts within one slide of the current one, inactive; it activates as it comes on show
  in an open viewer, and deactivates as the viewer moves away or closes, the leaving slide first.
  Unchanged from today (`viewer-strip.ts:1050-1066`).
- Slides outside the window are disposed and may mount again as new instances. Unchanged.
- The runtime empties `media` and `layer` after the disposer runs. It never moves a node you put
  in them; it may move `media` itself (§5.1).
- Every open waits until the opened slide is ready, at most 3 seconds (§5.3). Ready means the
  renderer has returned (or the binding has committed), every `<img>` in `media` has decoded,
  every `<video>` in it can show a frame or has a decoded poster, and every `waitUntil` promise has
  settled. What `draw*` drew follows today's rules and adds no wait. The slide layer never holds
  the open.
- If `media` is empty when the slide commits, the slide opens and closes with a fade instead of a
  flight (§5.1).
- `drawImage()` without an argument draws `slide.item`, which must then be an image item; the
  other `draw*` likewise. With an argument it draws that item: a product slide can draw its
  `image` field.

### Video sources and streaming

Today the built-in video sets one `src` (`viewer-strip.ts:962`), so a page can't offer AV1 or
WebM with an MP4 fallback, and can't plug in a streaming engine such as hls.js or dash.js. Both
change in the built-in video, so a streamed video keeps everything else it does: controls,
tracks, the poster, pausing as it leaves, autoplay as it comes on show, its size, and continuing
from the trigger's video (`continueVideo`, `:600`).

**Sources.** With `sources`, the video gets one `<source>` per entry, in order, then a last
`<source src={item.src}>`. It never also gets a `src` attribute, because a `src` attribute makes
the browser ignore every `<source>` child. Two changes follow:

- Unloading a slide removes the `<source>` children before `load()` (`#unload`, `:1032-1034`).
  Otherwise `load()` picks a source again and the unloaded video keeps downloading.
- When every source fails, the `error` event fires on the last `<source>`, not on the video. The
  slide listens there for its error state and Retry.

Without `sources`, the video sets `src` as now. The server copy is images only, so it is
unaffected. The hand-off from a playing trigger video works the same, because it waits for
`loadedmetadata` and syncs by `currentTime` (`:660-664`), whichever source the browser chose.

**Attaching an engine.**

```ts
export interface FluidboxVideoOptions {
  /**
   * Load the media yourself: the runtime sets no src and no <source>. Called
   * when the slide loads, which includes mounted neighbours; clean up when
   * `signal` aborts, which happens before the runtime empties the video.
   * Fetch segments only once `slide.active` or `slide.opening` is true.
   */
  readonly attach?: (
    video: HTMLVideoElement,
    signal: AbortSignal,
    item: FluidboxVideoItem,
    slide: FluidboxVideoAttachSlide,
  ) => void;
}

/** The part of the slide an `attach` needs: whether it is shown, and when that changes. */
export type FluidboxVideoAttachSlide = Pick<FluidboxSlide, "active" | "opening" | "onActiveChange">;

/** A slide for video items that draws the built-in video with these options. */
export function videoSlide(options: FluidboxVideoOptions): FluidboxSlideRenderer<FluidboxVideoItem>;
```

```ts
// plain JS: every video item through hls.js, or natively where the browser plays HLS
import Hls from "hls.js";

const attachHls = (video, signal, item, slide) => {
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = item.src; // native HLS honours preload="metadata"
    return;
  }
  const hls = new Hls({ autoStartLoad: false });
  hls.loadSource(item.src); // the manifest only
  hls.attachMedia(video);
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    hls.startLoad(); // segments
  };
  if (slide.active || slide.opening) start();
  const off = slide.onActiveChange((active) => active && start());
  signal.addEventListener("abort", () => (off(), hls.destroy()), { once: true });
};

createFluidbox({ items, slides: { video: videoSlide({ attach: attachHls }) } });
```

`attach` runs where the runtime would set `src` (`#load`, `:961`), so it runs for mounted
neighbours too. The fourth argument says whether this slide is showing. The rule for an
`attach`: it may load the manifest and the poster at once, as `preload="metadata"` would, but it
fetches media segments only once `slide.active` or `slide.opening` is true. With hls.js that is
`autoStartLoad: false`, then `startLoad()`, as above. An engine attached eagerly (hls.js with
`autoStartLoad` on) would download segments for every idle neighbour. A neighbour therefore
attaches without loading until it is shown. The HLS add-on follows the rule (§4.8). The
runtime still sets `poster`, the attributes and the tracks. `item.src` must still pass the URL
check (the manifest URL); what `attach` loads is the app's responsibility. A built-in video with
`attach` is still exempt from the generic readiness rule (§5.3). An open doesn't wait for the
engine's first segment.

### Plain-JS example

```ts
const productSlide: FluidboxSlideRenderer<ProductItem> = (slide) => {
  // The built-in image in the box: it flies, zooms and gets sharper as it zooms.
  const undraw = slide.drawImage(slide.item.image);
  const price = document.createElement("p");
  price.className = "price";
  price.textContent = `€${slide.item.price}`;
  // Beside the photo: it doesn't fly or zoom.
  slide.layer.append(price);
  return undraw;
};
```

## 2.9 Labels

```ts
export interface FluidboxLabels {
  readonly viewer: string;
  readonly close: string;
  readonly previous: string;
  readonly next: string;
  readonly position: (index: number, count: number) => string;
  readonly announcement: (name: string, index: number, count: number) => string;
  readonly slides: string;
  readonly carousel: string;
  readonly slide: string;
  readonly thumbnails: string;
  readonly thumbnailsList: string;
  readonly counter: (index: number, count: number) => string;
  readonly zoomed: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly zoomReset: string;
  readonly zoomLevel: (scale: number) => string;
  readonly sheet: string;
  readonly error: string;
  readonly retry: string;
  /** §2.11 */
  readonly enterFullscreen: string;
  readonly exitFullscreen: string;
  /** §2.12 */
  readonly download: string;
  readonly share: string;
  /** Announced after Share copied the link. */
  readonly linkCopied: string;
  /** §2.19, plan step 7 */
  readonly playSlideshow: string;
  readonly pauseSlideshow: string;
}
```

Defaults are today's, with `thumbnails: "Gallery thumbnails"`, `thumbnailsList: "Choose a gallery
item"` and `counter: (index, count) => \`${index + 1} / ${count}\``. The new keys default to
`"Enter full screen"`, `"Exit full screen"`, `"Download"`, `"Share"`, `"Link copied"`, `"Play
slideshow"`and`"Pause slideshow"`.

## 2.10 Sheet and thumbnails options

```ts
export interface FluidboxSheetOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** @default ["60%", "content"] */
  readonly snapPoints?: readonly FluidboxSheetSnapPoint[];
  /**
   * How a swipe down on the photo closes the viewer while the sheet is down.
   * Was `dismiss`; "none" moved to the Root's `dismiss: { drag: false }` (§2.14).
   * @default "flight"
   */
  readonly dismissMotion?: "flight" | "scroll";
  readonly render?: FluidboxRenderer<TItem>;
}

export interface FluidboxSheet {
  /** 0 at rest, then one per snap point. */
  readonly snap: number;
  setSnap(snap: number, options?: { readonly animate?: boolean }): void;
}

export interface FluidboxThumbnailsOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly render?: FluidboxRenderer<TItem>;
}
```

## 2.11 Fullscreen

`fluidbox.setFullscreen(on?)`, `state.fullscreen`, the `"fullscreen"` control name, the
`Fullscreen` part (§3.18), and the labels `enterFullscreen` and `exitFullscreen`.

- It calls `requestFullscreen()` on the viewer root (`[data-fluidbox-viewer]`), falling back to
  `webkitRequestFullscreen()` for older iPad Safari.
- **Availability.** The control is `hidden` when `document.fullscreenEnabled` (or
  `webkitFullscreenEnabled`) is false, which is the case on iPhone Safari. There only a `<video>`
  can go fullscreen, through its own controls. `setFullscreen()` then resolves false.
- **Over a modal dialog.** Over an open modal `<dialog>`, the viewer mounts inside the dialog and
  shows in the top layer as a manual popover (`viewer-portal.ts:67-90`). Browsers disagree about
  calling `requestFullscreen` on a showing popover, so the runtime hides the popover first
  (`hidePopover()`) and requests fullscreen. Fullscreen then puts the viewer in the top layer
  above the dialog by itself. The viewer is inside the dialog, so the dialog's inertness doesn't
  reach it. On leaving fullscreen the runtime shows the popover again. This needs a browser test
  in Chromium, WebKit and Firefox (§9.4), because it is the one path the spec can't settle by
  reading.
- **Closing exits fullscreen first.** The close awaits `exitFullscreen()` and the
  `fullscreenchange` that follows (at most 500 ms), then measures the trigger and flies home. A
  close planned while the viewer still covers the screen would fly to stale geometry.
- **Leaving fullscreen doesn't close the viewer.** In fullscreen the browser takes Escape to
  leave fullscreen and doesn't deliver it to the page, so the next Escape closes. The runtime adds
  no code for this.
- A move or a zoom keeps fullscreen. `destroy()` exits it. The viewer listens for
  `fullscreenchange` to keep `state.fullscreen` true to the document, whoever changed it.
- The control's name switches between the two labels. It doesn't also use `aria-pressed`,
  because a toggle button whose name changes shouldn't also report a pressed state.

## 2.12 Download and Share

### Download

The item's `download` field (§2.3) says what to save. By default that is the largest file:
`zoom.src ?? src` for images and `src` for video. Models, embeds, iframes and custom types have
none unless they set it. `false` turns it off. The URL must pass the media URL check (http(s),
relative or `blob:`).

The control is an `<a download>` with a real `href`, so "Save link as" and a middle click work.
On a click:

1. Same origin (or `blob:`): the browser downloads it. `download` is the filename: the
   `filename` given, else the URL's last path segment, else the item's id.
2. Cross origin: browsers ignore `download` there and navigate instead, so the runtime prevents
   the default and fetches the file (`mode: "cors"`). If that succeeds, it saves the blob through
   a temporary object URL and revokes it afterwards. The control has `aria-busy` while fetching,
   and a move or a close aborts the fetch.
3. If the fetch fails (no CORS, network), it opens the URL in a new tab
   (`noopener,noreferrer`), where the browser's own save works.

`fluidbox.download()` does the same for the open item and resolves whether a download or a tab
started. The control is `hidden` on items without a file.

### Share

The link is `shareUrl(item)` (option), else the Root's `href(value)` in the bindings, resolved
against `location`. The title is the item's label (`itemLabel`).

1. If `navigator.share` exists and `navigator.canShare({ url })` allows it, call
   `navigator.share({ title, url })`. When the user cancels (`AbortError`), nothing happens.
2. Otherwise, or on `NotAllowedError`, copy the link with `navigator.clipboard.writeText` and
   announce `labels.linkCopied` in the viewer's live region. The button gets `data-copied` for two
   seconds, for styling.
3. With neither API, or no link, the control is `hidden`.

`fluidbox.share()` does the same and resolves whether something was shared or copied. Both
controls live in the lazy viewer chunk; their parts are a few lines that call these commands
(§3.18).

## 2.13 Media errors

```ts
export type FluidboxMediaErrorKind = "image" | "video" | "iframe" | "zoom" | "custom";

export class FluidboxMediaErrorEvent<TItem extends FluidboxItem = FluidboxItem> extends Event {
  readonly value: string;
  readonly index: number;
  readonly item: TItem;
  readonly kind: FluidboxMediaErrorKind;
  /** The DOM event, the TypeError of a failed URL check, or what `slide.fail` got. */
  readonly cause: unknown;
}
```

It fires every time a slide enters its error state. Today those are the `#fail` call sites
(`viewer-strip.ts:492`, `:951`, `:960`), plus the video error now heard on the last `<source>`
(§2.8). Neighbours count too: a slide loaded beside the current one that fails fires with its own
index. A Retry that fails again fires again.

- **Zoom images.** When the image zoom loads (the sharper candidate in `sharpen`, `:837`, or the
  zoom master a zoom command waits for) fails, it fires with `kind: "zoom"`, and no error slide
  shows. The slide keeps the image it has, as today, where the failure is swallowed
  (`viewer-strip.ts`, the `.catch(() => {})` in `sharpen`).
- **Custom slides** call `slide.fail(error)`: the slide shows `labels.error` and Retry, and the
  event fires with `kind: "custom"`. Retry disposes the slide's renderer (or unmounts the
  framework content) and renders it again. In the bindings `useFluidboxSlide().fail`.
- Not cancelable. It reports; the error UI is the slide's.

Bindings: `onMediaError(event)` (React, Solid), `@media-error` (Vue), `(mediaError)` (Angular),
and the `mediaerror` event on `<fluidbox-gallery>`.

## 2.14 Turning gestures off

What closes the viewer today: Escape, the Close button, a drag down on the media, a tap on the
backdrop, and a vertical wheel or trackpad scroll on an unzoomed slide. The last is the wheel
dismiss (`#onWheel`, `dom-viewer-driver.ts:2184`, and `#commitWheelDismiss`, `:1835`), which a
sheet takes first to raise itself. Other wheel input today: a horizontal scroll moves between
slides (the strip's native scroll), Ctrl + wheel and trackpad pinch zoom (`fluidbox-zoom.ts:638`),
and a plain wheel pans a zoomed image.

```ts
dismiss?: { drag?: boolean; backdrop?: boolean }; // both default true
wheel?: "dismiss" | "zoom" | "navigate" | "none"; // default "dismiss"
```

- `dismiss.drag: false`: a drag down doesn't close. The media follows with a short rubber band and
  springs back. With a sheet, a drag up still raises it.
- `dismiss.backdrop: false`: a tap on the backdrop does nothing.
- Escape and Close always close. A viewer without a way out would fail WCAG 2.1.2.
- `wheel` governs a vertical wheel on an unzoomed slide. `"dismiss"` is today's behaviour.
  `"zoom"` makes a plain wheel zoom as Ctrl + wheel does, as photo apps do. `"navigate"` makes one
  wheel gesture one move to the previous or next slide; a gesture ends after 150 ms without wheel
  input, so trackpad inertia doesn't skip slides. `"none"` ignores it and keeps the page still.
  In every mode a horizontal scroll still moves between slides, and Ctrl + wheel still zooms.
- The brief's sketch had `wheel: "zoom" | "navigate" | "none"`, with today's behaviour as the
  default. Today's behaviour is dismissing, so it gets a name and is the default.

**The name clash with the sheet.** The sheet's `dismiss: "flight" | "scroll" | "none"`
(`public-api.ts:417-422`) says how a swipe down on the photo closes the viewer while the sheet is
down. It becomes `dismissMotion: "flight" | "scroll"`. Its `"none"` ("keep the viewer open") is
the same as the Root's `dismiss: { drag: false }` and moves there. One `dismiss` remains, on the
Root, and it means "what may close the viewer". The `SheetSnap` and `Sheet` parts take
`dismissMotion`.

Both options can change through `update` and are Root props in the bindings.

## 2.15 Styling by item

```ts
{ type: "image", src, alt, width, height, data: { tone: "light", kind: "product" } }
```

Each entry becomes `data-<name>="<value>"` on the slide (`[data-fluidbox-slide]`), on the item's
Thumbnails button, and on the server copy's slide:

```css
[data-fluidbox-slide][data-tone="light"] {
  --fluidbox-backdrop-background: #f4f1ea;
}
[data-fluidbox-viewer]:has([data-fluidbox-slide][data-active][data-tone="light"])
  [data-fluidbox-close] {
  color: #111;
}
```

- Names must match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`: lower case, digits, single dashes. Names
  starting `fluidbox-` are reserved for the runtime. Values are strings. Items are checked where
  they are checked now (`toList`, `createItemList`). A bad name throws a `TypeError` that names the
  item and the key.
- A slide reused across `setItems` (same id, new data) has stale keys removed and new ones set.
- `data-active` on the slide on show (§1.11) is what makes viewer-wide rules like the second
  example work.

## 2.16 Motion speed (built in step 7)

Before step 7, flight timing was fixed: the open was `OPEN_DURATION` 300 ms
(`dom-viewer-driver.ts:60`), the close 220–480 ms by distance (`:819`), the drag release
140–220 ms (`:1914`), each with a spring `response` proportional to its duration (`:873`, `:1923`).

`--fluidbox-motion-speed` is a number, default `1`, clamped to `0.25`–`4`. `2` is twice as fast.
It divides the duration and spring `response` of the open, the close, a drag release, a zoom
animation and a move between slides. Each motion reads it as it starts. Reduced motion is
unchanged: no flights, whatever the speed. Being CSS, it can change by breakpoint, theme or
`:has()`.

- **Documented as an `@input` in `styles.css`** (`@on Viewer`). It is not in `css-api.ts`,
  which lists only the properties the runtime publishes.
- **Where to set it.** As the viewer opens, it copies the `--fluidbox-*` custom properties from
  around the trigger. So a value set on the page applies from the next open. A value set on the
  viewer itself (`[data-fluidbox-viewer]`) applies at once, from the next motion.
- **Moves between slides.** At speed 1 the strip uses the browser's smooth scroll, as before. At
  any other speed the strip glides itself (300 ms ÷ speed) with scroll-snap off, and holds its
  internal slide sync until it lands. The value events (`beforevaluechange`, `valuechange`,
  `valuechangecomplete`) fire at the same points at every speed.
- **A gesture ends a glide.** A `pointerdown`, a `touchstart` or a horizontal wheel stops the
  glide, or a native smooth move, where it is, and the gesture carries on natively from there
  with snapping back on. A vertical wheel never takes over a move in flight.

## 2.17 Hotspots (built in step 7)

`<Fluidbox.Hotspot x="42%" y="30%">` inside `Media` (§3.18) marks a point on the media.

- **No layer element.** Each hotspot is a `<button>` that its binding renders where the app puts
  it, inside the media box (`Media`, `fluidboxMedia`, `<fluidbox-media>`). The runtime marks it
  `data-fluidbox-hotspot`, gives it `type="button"` if it has none, and sets its `left` and `top`
  as percentages of the box's padding box.
- **Placed on the painted media, not the box.** The reference is the media the viewer drew
  (`[data-fluidbox-drawn]`). Failing that, it is the first shown `<img>` or `<video>` that isn't
  inside a hotspot or `aria-hidden`, and failing that, the box. The painted rectangle comes from
  that media's shape, `object-fit` and `object-position`, so a hotspot stays on the product with
  `object-fit: contain` and in a fill box (§5.4). Hotspots lay out again when the box or the
  media resizes and when media loads.
- **Coordinates.** `x` and `y` are `` `${number}%` `` of the painted media, or a number of
  pixels (`FluidboxHotspotCoordinate`). Pixels count on the drawn media's declared `width` and
  `height` attributes, when it has both. Otherwise they count on its natural size, and with no
  media, on the item's `width` and `height`. A string without `%` (an attribute's `"412"`) is
  pixels. An unreadable value puts the pin on the box's corner, never at `NaN`.
- **The containing-block rule.** The box's `will-change` makes it the hotspots' containing
  block. Nothing between a hotspot and the box may establish another one: no `position`,
  `transform`, `filter` or `will-change`. Development builds warn when that is broken, when a
  hotspot is outside its slide's box, and when a hotspot has no accessible name. These are
  warnings and never throw.
- **Zoom.** The pins are inside the box, so they zoom with it. Each is centred on its point
  (`translate: -50% -50%`) and keeps its screen size by `scale: calc(1 / var(--fluidbox-zoom-scale, 1))`.
  The zoom engine sets `--fluidbox-zoom-scale` on the box. `scaleWithZoom` sets
  `data-scale-with-zoom`, which turns the counter-scale off.
- **Hidden through the chrome.** A pin stays hidden until it is first placed. Pins are hidden
  during flights and drag-dismiss, and fade in with the controls.
- **Focus.** When a hotspot takes keyboard focus (`:focus-visible`) on a zoomed image and is
  outside the stage, the image pans to put it in the middle. Pointer focus doesn't pan, since a
  pan under a press would take its click away. The pan is smooth, and instant under reduced
  motion.
- **Input.** A hotspot owns its input (`data-fluidbox-owns-input`), so a pointer on it doesn't
  start a pan or a dismiss. A press that begins on content owning its input (a hotspot, a live
  model) and ends outside it does nothing: no zoom and no close.
- **On demand.** The code is its own chunk, about 1,320 B gzip, loaded the first time a slide
  adds a hotspot. It is not part of the viewer chunk (§8.24).
- **Surface.**
  - Plain JS: `slide.hotspot({ x, y, scaleWithZoom }): HTMLButtonElement` returns the button
    for the app to fill.
  - Bindings call kit's `placeHotspot(slide, button, options)`, and again whenever the options
    change.
  - Elements: `<fluidbox-hotspot x y scale-with-zoom>` inside a slide template's media becomes
    the hotspot button, keeping its other attributes and its children. `scale-with-zoom="false"`
    reads as false.
  - CSS API: `[data-fluidbox-hotspot]`, `[data-scale-with-zoom]` and `--fluidbox-zoom-scale`.

## 2.18 The zoom pose hook, and deep zoom (deep zoom after 1.0)

```ts
export interface FluidboxZoomPose {
  readonly scale: number;
  /** The box's translation in CSS pixels, as the zoom engine's pose has it. */
  readonly x: number;
  readonly y: number;
  /** The part of the media on screen, in the item's own pixels (0…width, 0…height). */
  readonly visible: DOMRectReadOnly;
  /** True while a pinch, wheel or animation moves it; false once it rests. */
  readonly moving: boolean;
}

export interface FluidboxZoomableOptions {
  /** This box's maximum scale, overriding the Root's `zoom.max`. */
  readonly max?: number;
  /** Load the sharper `zoom` image when zoomed. @default true for drawImage */
  readonly sharpen?: boolean;
}
```

`slide.onZoom(listener)` calls back on every frame the pose changes and once when it rests. It
covers both of the zoom engine's modes: the transform during a gesture and the native scroller at
rest (`fluidbox-zoom.ts:175-254`, where the pose is read back from the scroll offsets). That is
what step 1.4 must build now, since it is rewriting the zoom target anyway. It costs one callback
list per slide.

Deep zoom (`@ogdakke/fluidbox/deep-zoom`) is then an add-on with no further engine changes:

```ts
createFluidbox({ items, slides: { image: deepZoomSlide() } });
<Fluidbox.Slides image={() => <DeepZoom />} />
```

For an image item with `tiles: { format: "iiif" | "dzi", url }`, it draws the image with
`drawImage`, calls `zoomable({ max: naturalWidth / fittedWidth, sharpen: false })`, reads the
IIIF `info.json` or the DZI XML, and keeps a tile layer inside the box. On each `onZoom` it picks
the pyramid level for `scale` and loads the tiles that intersect `visible`. While `moving` it
only loads tiles; once at rest it also evicts tiles off screen. Images without `tiles` get the
plain built-in slide. Size estimate: 3–5 KB gzip, its own bundle-check consumer.

## 2.19 Slideshow (built in step 7)

```ts
export interface FluidboxSlideshowOptions {
  /**
   * Time on each slide, in ms. The next slide then has as long again to be
   * ready before the slideshow moves to it. @default 5000
   */
  readonly interval?: number;
  /** Go from the last slide to the first. Without it, it stops on the last. @default the `loop` option */
  readonly loop?: boolean;
  /** Start playing as the viewer opens. @default false */
  readonly autoplay?: boolean;
}
```

`play()`, `pause()`, `state.playing`, the `"slideshow"` control name and the `Slideshow` part
(§3.18), named by the optional labels `playSlideshow` and `pauseSlideshow`.

- **It never starts by itself.** Only `autoplay`, `play()` or the control start it.
- **`play()`** works without the `slideshow` option, using the defaults. It acts once the viewer
  has loaded. A queued `play()` is dropped if anything changes before then, and a `pause()` wins
  over it. When closed, already playing, or on the last slide without a loop, it does nothing.
- **`state.playing`** is true only while the viewer is open or opening. It turns false as soon
  as a close starts.
- **The interval** counts from the moment the previous move settles. Then the next slide gets up
  to one more interval to be ready, using the readiness wait of §5.3, before the slideshow moves
  with `reason: "slideshow"`. New items given as fresh objects for the same ids keep the
  interval running.
- **The last slide without a loop.** `playing` turns false when the slideshow arrives there.
- **Holds don't pause.** A hidden tab or a video playing in the active slide holds the timer
  while `playing` stays true. The interval starts again once the hold ends. A muted, looping
  autoplay video holds it indefinitely.
- **Input pauses.** A pointer, a key, a wheel or a zoom (by gesture or command) pauses the
  slideshow until `play()` or the control. The control's own press (`pointerdown` or
  `touchstart`, Enter or Space) is exempt.
- **The control.** Without the `slideshow` option it is hidden unless the slideshow is playing.
  It carries `data-active` while playing. The Fullscreen control now also carries `data-active`
  while active.
- **WCAG 2.2.2 (Pause, Stop, Hide).** The control is reachable while playing, and input pauses.
  While playing, the viewer's live region is `aria-live="off"`, so a screen reader isn't
  interrupted every few seconds. It goes back to polite on pause.
- **Reduced motion.** Moves are instant.

## 2.20 `reachend` (built in step 7)

```ts
// The item type keeps it in step with the other events; it carries no item.
export class FluidboxReachEndEvent<_TItem extends FluidboxItem = FluidboxItem> extends Event {
  readonly value: string;
  readonly index: number;
  /** The item count it fired for. */
  readonly count: number;
}
```

- **When it fires.** It fires when the open item's index is `count - 1 - reachEndThreshold` or
  later, once the move settles, not at `valuechange`. If a `valuechangecomplete` handler starts
  another move, it waits for that one. It fires again after `setItems` when the count changed,
  at once if the open item is already within the threshold of the new end.
- **Once per count, literally.** A close and reopen at the same count doesn't fire again. Any
  change of count re-arms it, including a change made by its own handler.
- **Never with `loop`.**
- **`reachEndThreshold`** is an option, and can be changed through `update()`. Default 2. A value
  that isn't a finite number of 0 or more means 2.
- **Bindings.** React and Solid: `onReachEnd`. Vue: `@reach-end`. Angular: `(reachEnd)`, with a
  `reachEndThreshold` input taking `numberAttribute`. Elements: the `reachend` event and the
  `reach-end-threshold` attribute. `FluidboxReachEndEvent` and `FluidboxLazyItemList` are
  re-exported by every binding.

**Appending.** The app appends with `setItems`. The viewer keeps the open item by id
(`#setSource`): it finds the previous id in the new source, keeps that index, and reuses slides
by id. So `value` doesn't change, and nothing moves or reloads.

**Loop changes.** Turning `loop` on or off while open keeps the slides, each at its offset from
the shown one, instead of rebuilding them. A two-item loop makes a −1 duplicate, with its own
copy of an iframe.

**Growing a lazy list.** `createItemList` now returns the exported type `FluidboxLazyItemList`.
Its `indexOf` is required, and it adds `withCount(count)`: a new list over the same `item` and
`index` functions that keeps the items already made, so the ids already known resolve at once. A
shorter list from `withCount` answers -1 for ids past its end, and throws a `RangeError` for an
index past its end.

```ts
const list = createItemList({
  count: 50,
  item: (i) => photoAt(i),
  index: (id) => Number(id.slice(6)),
});
viewer.addEventListener("reachend", async () => {
  await fetchMore();
  fluidbox.setItems(list.withCount(total()));
});
```

## 2.21 Headless controls: no icons, `bindControl`, `icons`

**Decided (the user, fourth amendment):** "Consumers should bring their own icons … lean more
into headless, with just the default styles we need to make things function, and everything else
on the consumer." The package's JavaScript ships no icon. The opt-in baseline stylesheet (§10.4)
can draw today's glyphs in CSS.

### What a control renders

Every control, in plain JS, the elements and every binding, follows one rule:

| The control has                   | It renders                                                                | Its accessible name                                                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no content                        | its label as text (`labels.close`, "Close"), with `data-fluidbox-default` | the text                                                                                                                                                                                              |
| content (an icon, text, anything) | the content                                                               | `aria-label` from `labels`, unless the control has its own `aria-label`/`aria-labelledby`, or `label={false}` in a binding (`data-fluidbox-label="content"` in markup), which names it by its content |

A text-only fallback still works and is still accessible with no stylesheet beyond the
functional one. `data-fluidbox-default` lets a theme restyle fallbacks (the baseline turns them
into glyphs, §10.4) without touching controls that carry the app's own icons. The same rule
covers the state-switching controls: Fullscreen and Slideshow swap their text, or their
`aria-label`, between their two labels.

`control-icons.ts`, `controlIcon`, `CONTROL_ICON_PATHS`, `CONTROL_ICON_ATTRIBUTES`, the React
`defaultIcon` and its Vue, Solid and Angular equivalents, and the static viewer's icon nodes
(`static-viewer.ts:54-58`) are deleted. The server copy's controls render their label text, as
the live ones do, so the copy and the takeover still match. The add-ons' glyphs go the same way
(§4.9).

### Plain JS

```ts
export interface FluidboxOptions<TItem> {
  // …
  /** The default controls to draw: plain <button>s with text, or `icons`. */
  readonly controls?: boolean | readonly FluidboxControlName[];
  /** Your icons for the default controls. Each call returns a new Node. */
  readonly icons?: Partial<Record<FluidboxControlName, () => Node>>;
}

export interface Fluidbox<TItem> {
  // …
  /**
   * Make your own element a control: it runs the command on click, gets the
   * control's data attribute, its `aria-label` (unless it has its own),
   * `disabled` and `hidden` from state, and for Fullscreen and Slideshow the
   * label that matches the state. Returns its cleanup.
   */
  bindControl(
    element: HTMLElement,
    name: FluidboxControlName,
    options?: { signal?: AbortSignal },
  ): () => void;
}
```

- `controls` draws unstyled `<button type="button" data-fluidbox-close>Close</button>`
  elements. With `icons.close`, the button holds the returned node and gets `aria-label`.
- `icons` factories return Nodes, never HTML strings, so the package needs no `innerHTML` and
  stays clean under Trusted Types (`require-trusted-types-for 'script'`). The factory is called
  once per drawn button. A `<template>` clone or `document.createElementNS` both work:

  ```ts
  const closeIcon = document.querySelector<HTMLTemplateElement>("#icon-close")!;
  createFluidbox({ items, icons: { close: () => closeIcon.content.cloneNode(true) } });
  ```

- `bindControl` works anywhere: in the viewer's layer, or on the page (a Slideshow button in a
  page toolbar). Inside the viewer's layer, any `[data-fluidbox-close]` and the rest are wired as
  now (`wireControls`, `viewer-layer.ts:101`) without calling it. `bindControl` is for elements the
  layer doesn't own, and it adds the label and `hidden` handling the attribute wiring lacked.
- `retry` joins `FluidboxControlName` (§3.19), so `bindControl(button, "retry")` wires a custom
  error UI.

### Custom elements

`<fluidbox-gallery>` with no `<template slot="viewer">` draws what plain JS draws: Previous, Next
and Close as plain text buttons. Markup supplies icons three ways, from narrow to broad:

```html
<!-- 1. Your own button, anywhere in the viewer template: its content is the icon. -->
<template slot="viewer">
  <button data-fluidbox-close><svg aria-hidden="true">…</svg></button>
  <fluidbox-toolbar></fluidbox-toolbar>
</template>

<!-- 2. An icon for every default button of that control, in this gallery. -->
<fluidbox-gallery>
  <template data-fluidbox-icon="close"><svg aria-hidden="true">…</svg></template>
  <template data-fluidbox-icon="next"><svg aria-hidden="true">…</svg></template>
</fluidbox-gallery>

<!-- 3. The `icons` property, as in plain JS. -->
<script type="module">
  gallery.icons = { close: () => closeIcon.content.cloneNode(true) };
</script>
```

A `data-fluidbox-icon` template is cloned into each default button the gallery draws: the
defaults, and placeholders such as `<fluidbox-toolbar>` and `<fluidbox-zoom-controls>` when
expanded. Templates are inert, so their SVG costs nothing until cloned, and cloning is
Trusted-Types clean. The `icons` property wins over a template for the same name.

## 2.22 The trigger video's playback, for custom players

The built-in video already continues a playing trigger video. On open it seeks to the trigger's
time, twice if the trigger kept playing, and plays if the trigger was playing
(`continueVideo`, `viewer-strip.ts:600-667`, called at `dom-viewer-driver.ts:1146`). On close it
seeks the trigger's video to the player's time and plays it if the player was playing
(`#handBackVideo`, `dom-viewer-driver.ts:1109-1117`, called at `:803`). A custom player
(Mux, Video.js, Vidstack) gets the same through two members of the slide.

```ts
export interface FluidboxSlideOrigin {
  /** The trigger's `<video>`, when that is what the trigger showed. */
  readonly video?: FluidboxPlayback;
  /**
   * The trigger's live model element itself, not a reading of it: its camera
   * is live WebGL state. Never move or reattach it. (§4.4)
   */
  readonly model?: HTMLElement;
}

export interface FluidboxPlayback {
  /** Live: each read returns the trigger video's time now. */
  readonly currentTime: number;
  readonly paused: boolean;
  readonly muted: boolean;
}

/**
 * Anything with `currentTime` and `paused`, read when the close starts: a
 * `<video>`, `<mux-player>`, Vidstack's player. Or a function, for players
 * whose state is behind methods (Video.js). Return null to leave the
 * trigger alone.
 */
export type FluidboxPlaybackSource =
  | { readonly currentTime: number; readonly paused: boolean }
  | (() => { readonly currentTime: number; readonly paused: boolean } | null);
```

Rules:

- **`origin` is set on one slide:** the one being opened, when the open came from a trigger and
  the trigger's picture (what `#originPicture` finds, `dom-viewer-driver.ts:1121`) is a
  `<video>`. It is null on neighbours, on
  slides reached by moving, and for opens from `open(value)` with no trigger. It stays set for
  that slide's lifetime, so a player that mounts late still reads it.
- **`origin.video` is live**, not a snapshot. The trigger's video keeps playing during the
  flight, as it does for the built-in video, so a player that seeks once its metadata has loaded
  reads the time then and lands on the right frame.
- **`returnPlayback(source)`** registers what the runtime reads when a close starts from this
  slide. It is the video counterpart of `onClose` (§4.4). The close reads `currentTime` and
  `paused` once, just after the `onClose` listeners and only on a close that flies, then does
  what `#handBackVideo` does today: if the item's trigger has a `<video>`, it seeks it when the
  times differ by more than 10 ms, and plays it unless `paused`. This applies to whichever slide
  closes, so it also works after moving to another video item whose trigger is a video. With
  nothing registered, or a function returning null, the trigger's video is left alone, as for
  custom slides today.
- **The built-in video uses the same path.** `drawVideo` registers its `<video>` with
  `returnPlayback`, so `#handBackVideo` reads from the slide instead of from `#media`. The
  open-side seek stays in `drawVideo`, since it also paints the hand-off canvas.
- **Waiting.** An open doesn't wait for a custom player's seek. A player that wants the flight to
  land on the trigger's frame wraps its seek in `slide.waitUntil` (§5.3), under the same 3 s cap.

### In the bindings

`useFluidboxSlide()` (React, Vue, Solid) and `injectFluidboxSlide()` (Angular) add `origin` and
`returnPlayback`. `origin` doesn't change for a slide, so it is a plain value in every binding,
not a signal or a getter. Call `returnPlayback` from an effect, and return its result as the
cleanup. Custom elements' slide templates get the plain-JS slide.

Mux Player (React):

```tsx
function MuxSlide() {
  const slide = useFluidboxSlide<MuxItem>();
  const player = useRef<MuxPlayerRefAttributes>(null);
  useEffect(() => slide.returnPlayback(player.current!), []);
  const from = slide.origin?.video;
  return (
    <Fluidbox.Media>
      <MuxPlayer
        ref={player}
        playbackId={slide.item.playbackId}
        startTime={from?.currentTime}
        autoPlay={from ? !from.paused : false}
        muted={from?.muted}
      />
    </Fluidbox.Media>
  );
}
```

Vidstack (React):

```tsx
const player = useRef<MediaPlayerInstance>(null);
useEffect(() => slide.returnPlayback(player.current!), []);
const from = slide.origin?.video;
<MediaPlayer
  ref={player}
  src={slide.item.src}
  muted={from?.muted}
  autoPlay={from ? !from.paused : false}
  onLoadedMetadata={() => from && (player.current!.currentTime = from.currentTime)}
/>;
```

Video.js (plain JS), where state is behind methods:

```ts
const player = videojs(videoElement);
const from = slide.origin?.video;
if (from) {
  player.ready(() => {
    player.muted(from.muted);
    player.currentTime(from.currentTime);
    if (!from.paused) void player.play();
  });
}
slide.returnPlayback(() => ({ currentTime: player.currentTime(), paused: player.paused() }));
```

In each, the fluidbox part is three statements: register the player, read `origin`, and pass its
time and play state to the player. The library prop names (`startTime`, `onLoadedMetadata`,
`player.ready`) are the libraries' own, and the docs examples are checked against each library's
current release when they are written (step 6).

## 2.23 Click and tap zoom

Today (`fluidbox-zoom.ts:705-750`):

- A mouse click on the media zooms in at the pointer, or out if zoomed. The second click of a
  double-click is ignored (`event.detail === 1`).
- A touch or pen tap does nothing alone. Two taps within 350 ms and 40 px (`DOUBLE_TAP`) toggle
  the zoom at the tap.
- A click or tap beside a zoomed image, on the zoom canvas, zooms out instead of closing.

`zoom.click` and `zoom.tap` make the first two configurable:

| Option                      | A click or tap on the media                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `click: "single"` (default) | Toggles the zoom at the pointer. The second click of a double-click is ignored, as now.    |
| `click: "double"`           | A double-click (`event.detail === 2`) toggles at the pointer. A single click does nothing. |
| `click: false`              | Nothing.                                                                                   |
| `tap: "double"` (default)   | Two taps within 350 ms and 40 px toggle at the tap, as now.                                |
| `tap: false`                | Nothing.                                                                                   |

- **A single click does nothing under `"double"`.** It doesn't close the viewer, because the
  close happens on the slide outside the frame (`dom-viewer-driver.ts:261-269`), and the media is
  inside the frame, so a click on the photo has never closed it. It doesn't wait for a possible
  second click either, so there is no delay to tune. The runtime uses the browser's click count,
  which follows the OS double-click setting.
- **`false` turns off only that pointer's click or tap.** Buttons, keys, pinch, the wheel
  (`wheel: "zoom"`) and `zoomTo` still zoom. The click is still consumed, so nothing behind the
  media reacts to it.
- **Clicking beside a zoomed image zooms out in every mode,** `false` included. It is the way back
  from a zoom for a mouse user who never sees the controls.
- **Keyboard activation** (`event.detail === 0`) is unchanged: it never zooms.
- **The double-tap window stays a constant** (350 ms, 40 px). It sits near the platforms' own
  timing, and an option would rarely be set (§8.25).
- **Cursor.** The viewer root gets `data-fluidbox-zoom-click="single" | "double" | "off"`. The
  baseline shows `zoom-in` and `zoom-out` cursors only under `"single"`, since under `"double"` a
  zoom cursor would promise a single click that does nothing. Apps style the other modes as they
  like (§10.6).
- **Live.** `update({ zoom })` changes both options, and the next click uses them. The bindings'
  Root `zoom` prop takes the same object, compared by value. Custom elements get the attributes
  `zoom-click` (`single`, `double`, `off`) and `zoom-tap` (`double`, `off`), beside `zoom-step`
  and `zoom-max`.
- **Per slide.** `slide.zoomable({ max, sharpen })` doesn't take `click` or `tap`. They are the
  viewer's gesture settings, not the media's. A slide that wants no click zoom (a custom player
  whose clicks play and pause) isn't zoomable in the first place.
