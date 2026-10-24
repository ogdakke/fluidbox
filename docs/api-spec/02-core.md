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
  /** @default { step: 2, max: 4 } */
  readonly zoom?: false | { readonly step?: number; readonly max?: number };
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
}

export interface FluidboxVideoItem extends FluidboxItemBase {
  readonly type: "video";
  // src, title, width, height, poster, autoplay, loop, muted,
  // playsInline, controls, preload, tracks: unchanged.
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
  readonly width: number;
  readonly height: number;
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
either throws a `TypeError`; URL checks per type stay (`media-url.ts`). An item whose `type` has
no slide (no built-in, no entry in `slides`, no `default`) shows the slide's error state with
`labels.error` and logs once in development. Today an unknown `render` throws inside the strip
(`viewer-strip.ts:987`), which breaks the viewer for every item; an error slide is kinder.

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
   * Let the media box zoom (pinch, double-tap, wheel, the zoom controls).
   * Off by default for your own media; on for drawImage.
   */
  zoomable(this: void, on: boolean): void;
  /**
   * Make the opening flight also wait for `promise`, as
   * ExtendableEvent.waitUntil does. For what the engine can't see in the box,
   * such as a canvas having painted. Every open already waits for the box's
   * images and videos, at most three seconds in all. See §5.3.
   */
  waitUntil(this: void, promise: Promise<unknown>): void;
  /** Draw the built-in image, video or iframe for an item into `media`. */
  drawImage(this: void, item?: FluidboxImageItem): () => void;
  drawVideo(this: void, item?: FluidboxVideoItem): () => void;
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
}
```

Defaults are today's, with `thumbnails: "Gallery thumbnails"`, `thumbnailsList: "Choose a gallery
item"` and `counter: (index, count) => \`${index + 1} / ${count}\``.

## 2.10 Sheet and thumbnails options

```ts
export interface FluidboxSheetOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** @default ["60%", "content"] */
  readonly snapPoints?: readonly FluidboxSheetSnapPoint[];
  /** @default "flight" */
  readonly dismiss?: "flight" | "scroll" | "none";
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
