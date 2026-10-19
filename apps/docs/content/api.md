---
title: API reference
section: Reference
order: 1
description: Every entry point of @ogdakke/fluidbox and every export of the root, with types: createFluidbox options, the Fluidbox, state, events and reasons, items, lists, renderers, origins, labels, the add-ons, the framework parts and the binding kit.
---

# API reference

## Entry points

| Import                         | What it holds                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `@ogdakke/fluidbox`            | `createFluidbox`, `idOf`, `itemLabel`, the event classes and every type. Safe to import on the server, with no side effects. |
| `@ogdakke/fluidbox/elements`   | The custom elements, defined on import. Browser only. See [Custom elements](./custom-elements.md).                           |
| `@ogdakke/fluidbox/filmstrip`  | The filmstrip add-on, registered on import, and its types.                                                                   |
| `@ogdakke/fluidbox/sheet`      | The sheet add-on, registered on import, and its types.                                                                       |
| `@ogdakke/fluidbox/kit`        | The binding kit, for writing a framework binding. See [Binding kit](#binding-kit).                                           |
| `@ogdakke/fluidbox/react`      | The React binding. See [React](./react.md). Likewise `/vue`, `/solid` and `/angular`.                                        |
| `@ogdakke/fluidbox/styles.css` | The viewer's layout and default look.                                                                                        |
| `@ogdakke/fluidbox/sheet.css`  | The sheet's layout and variables.                                                                                            |

```ts
import {
  createFluidbox,
  idOf,
  itemLabel,
  FluidboxItemChangeEvent,
  FluidboxSheetEvent,
  FluidboxToggleEvent,
} from "@ogdakke/fluidbox";
```

## createFluidbox(options)

```ts
function createFluidbox<TItem extends FluidboxItem = FluidboxItem>(
  options: FluidboxOptions<TItem>,
): Fluidbox<TItem>;
```

Creates a viewer at the end of `<body>`, and the fluidbox that drives it. Browser only. `TItem` is your item type: every callback, event and state field hands back your own objects.

```ts
interface FluidboxOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly items: readonly TItem[] | FluidboxItemList<TItem>;
  readonly labels?: Partial<FluidboxLabels>;
  readonly zoom?: false | { readonly step?: number; readonly max?: number };
  readonly renderers?: Readonly<Record<string, FluidboxRenderer<TItem>>>;
  readonly viewer?: FluidboxViewerRenderer<TItem>;
  readonly controls?: boolean | readonly FluidboxControlName[];
  readonly filmstrip?: boolean | FluidboxFilmstripOptions<TItem>;
  readonly sheet?: boolean | FluidboxSheetOptions<TItem>;
  readonly origins?: FluidboxOriginAdapter<TItem>;
}
```

| Option      | Default                 | What it does                                                                                                                                                         |
| ----------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`     |                         | Required. An array, or a lazy list. See [Lists](#lists).                                                                                                             |
| `labels`    | [the defaults](#labels) | Your strings for the viewer.                                                                                                                                         |
| `zoom`      | `{ step: 2, max: 4 }`   | `step` is the scale of a double-click or double-tap zoom; `max` the largest for pinch, wheel and keyboard. The `+` and `-` keys zoom by 1.5. `false` turns zoom off. |
| `renderers` | `{}`                    | Draws `custom` items, by the name in their `render`.                                                                                                                 |
| `viewer`    |                         | Draws your own controls and captions into the viewer, once.                                                                                                          |
| `controls`  | `true` without `viewer` | Adds the default buttons: `true` for all, or a list of `"previous"`, `"next"` and `"close"`.                                                                         |
| `filmstrip` | `false`                 | A thumbnail strip. Needs `import "@ogdakke/fluidbox/filmstrip"`.                                                                                                     |
| `sheet`     | `false`                 | A panel over the photo. Needs `import "@ogdakke/fluidbox/sheet"` and `@ogdakke/fluidbox/sheet.css`.                                                                  |
| `origins`   |                         | Finds origins for items no trigger is bound to. See [Origins](#origins).                                                                                             |

`renderers` is looked up when a slide mounts, and `origins` on each use. `labels`, `zoom`, `controls`, `viewer`, `filmstrip` and `sheet` change with [`update`](#update), without closing the viewer; the framework roots and `<fluidbox-gallery>` pass their props and properties through it. An array with an empty or duplicate id throws a `TypeError`. `filmstrip` or `sheet` without its import throws an `Error` that names the import.

## Fluidbox

```ts
interface Fluidbox<TItem extends FluidboxItem = FluidboxItem> extends EventTarget {
  readonly state: FluidboxState<TItem>;
  readonly items: FluidboxItemList<TItem>;
  readonly sheet: FluidboxSheet | null;
  open(target?: FluidboxTarget<TItem>, options?: FluidboxCommandOptions): Promise<boolean>;
  close(options?: FluidboxCommandOptions): Promise<boolean>;
  next(options?: FluidboxCommandOptions): Promise<boolean>;
  previous(options?: FluidboxCommandOptions): Promise<boolean>;
  update(options: FluidboxUpdateOptions<TItem>): void;
  setItems(items: FluidboxItems<TItem>): Promise<boolean>;
  preload(target: FluidboxTarget<TItem>): () => void;
  bind(
    element: HTMLElement,
    target: FluidboxTarget<TItem>,
    options?: FluidboxBindOptions<TItem>,
  ): () => void;
  bindOverlay(
    element: HTMLElement,
    target: FluidboxTarget<TItem>,
    options?: FluidboxOverlayOptions<TItem>,
  ): () => void;
  subscribe(listener: (state: FluidboxState<TItem>) => void): () => void;
  destroy(): void;
}

// An item, its index, or its id. An item is matched by its id.
type FluidboxTarget<TItem extends FluidboxItem = FluidboxItem> = number | string | TItem;
interface FluidboxCommandOptions {
  readonly signal?: AbortSignal;
}
```

| Member             | What it does                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `state`            | The current [state](#fluidboxstate), a frozen snapshot.                                                                                 |
| `items`            | The items as a list: those it was made with, or the last `setItems`.                                                                    |
| `sheet`            | The [sheet handle](#add-ons), when the `sheet` option is on; else `null`.                                                               |
| `open`             | Opens the viewer on an item, or moves to it while open. Without a target: the current item, else the first.                             |
| `close`            | Closes the viewer.                                                                                                                      |
| `next`, `previous` | Move one item while open.                                                                                                               |
| `update`           | Changes options on the live viewer. See [update](#update).                                                                              |
| `setItems`         | Replaces the items. An open viewer stays on the same id, else the item now at its index, or the last; it closes when the list is empty. |
| `preload`          | Starts loading an item a press is likely to open, while closed. Call the result to drop the work.                                       |
| `bind`             | Makes an element a trigger for an item; `returns` adds items that close back onto it. See [Triggers](./javascript.md#triggers).         |
| `bindOverlay`      | Makes an element on a trigger a thumbnail overlay. See [Thumbnail overlays](./javascript.md#thumbnail-overlays).                        |
| `subscribe`        | Calls `listener(state)` after every state change. Not called per animation frame.                                                       |
| `destroy`          | Closes at once, removes the viewer, and releases every binding. Safe to call twice.                                                     |

Commands resolve `true` once the command has happened and its motion has settled, and `false` when it was prevented, superseded by a later command, aborted by its signal, or had nothing to do. An unknown id or an index out of range rejects with a `RangeError`, and `preload` throws one. After `destroy()`, the commands resolve `false`, so a part still holding the old fluidbox does nothing; `setItems`, `preload`, `bind`, `bindOverlay` and `subscribe` throw an `InvalidStateError` `DOMException`.

### update

```ts
type FluidboxUpdateOptions<TItem extends FluidboxItem = FluidboxItem> = {
  readonly [K in "labels" | "zoom" | "controls" | "viewer" | "filmstrip" | "sheet"]?:
    | FluidboxOptions<TItem>[K]
    | undefined;
};
```

`update` changes options without closing the viewer. A key you leave out keeps its value; a key set to `undefined` goes back to its default. Labels and zoom apply in place: a zoomed photo zooms back out when zoom turns off. When `controls` or `viewer` changes, or the labels do, the viewer's layer is drawn again. When `filmstrip` or `sheet` changes, that add-on is mounted again; a sheet starts again at rest. Options objects are compared member by member, so passing a fresh object with the same members changes nothing, but functions are compared by identity: keep `viewer` and the `render` functions stable. Turning an add-on on without its import throws.

```ts
fluidbox.update({
  labels: finnish,
  zoom: matchMedia("(pointer: coarse)").matches ? false : undefined,
});
```

### Bind options

```ts
interface FluidboxBindOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** Unbinds when aborted. */
  readonly signal?: AbortSignal;
  /** More items that close back onto this element, as on an album cover. */
  readonly returns?: readonly FluidboxTarget<TItem>[];
  /** Before the closing flight measures the trigger, with the item it lands on. Update it synchronously. */
  readonly onPreviewChange?: (item: TItem, index: number) => void;
}

interface FluidboxOverlayOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** Unbinds when aborted. */
  readonly signal?: AbortSignal;
  /** More items whose flights carry the overlay, as with the trigger's returns. */
  readonly returns?: readonly FluidboxTarget<TItem>[];
  /** Fly with the photo: true flies a copy of the element; a renderer draws live content into the flying frame. */
  readonly travel?: boolean | FluidboxRenderer<TItem>;
  /** With travel, an element moved into the flying frame for the flight and put back after. */
  readonly frameLayer?: HTMLElement;
}
```

A trigger sets `data-fluidbox-trigger`, `aria-haspopup="dialog"` and `aria-expanded="false"` on its element. On a primary-button `pointerdown` it calls `preload`, and drops that work 250 ms after the pointer lifts without a click. A click opens the item the trigger shows: its target, or the item of `returns` it last closed onto. The target always closes back onto its trigger, whether or not `returns` lists it too. A click whose `defaultPrevented` is `true` doesn't open.

## FluidboxState

```ts
interface FluidboxState<TItem extends FluidboxItem = FluidboxItem> {
  readonly status: "closed" | "opening" | "open" | "closing"; // FluidboxStatus
  readonly id: string | null;
  readonly index: number | null;
  readonly item: TItem | null;
  readonly count: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}
```

`id`, `index` and `item` are the item the viewer shows, or is moving to, and `null` while closed.

## Events

The fluidbox, and `<fluidbox-gallery>`, fire these. `addEventListener` on a `Fluidbox` is typed through `FluidboxEventMap`.

| Event              | Class                            | Cancelable | When                                                       |
| ------------------ | -------------------------------- | ---------- | ---------------------------------------------------------- |
| `beforetoggle`     | `FluidboxToggleEvent`            | yes        | Before the viewer opens or closes.                         |
| `toggle`           | `FluidboxToggleEvent`            | no         | The opening or closing motion starts.                      |
| `beforeitemchange` | `FluidboxItemChangeEvent<TItem>` | yes        | Before the open viewer moves to another item.              |
| `itemchange`       | `FluidboxItemChangeEvent<TItem>` | no         | The viewer moves to an item, the one it opens on included. |
| `settle`           | `FluidboxItemChangeEvent<TItem>` | no         | The viewer comes to rest on an item.                       |
| `sheetchange`      | `FluidboxSheetEvent`             | no         | The sheet comes to rest at another stop.                   |

```ts
class FluidboxToggleEvent extends Event {
  readonly oldState: "open" | "closed"; // FluidboxToggleState
  readonly newState: "open" | "closed";
  readonly reason: FluidboxReason;
}

class FluidboxItemChangeEvent<TItem extends FluidboxItem = FluidboxItem> extends Event {
  readonly id: string;
  readonly index: number;
  readonly item: TItem;
  readonly reason: FluidboxReason;
}

class FluidboxSheetEvent extends Event {
  readonly stop: number; // 0 at rest, then one per snap point
  readonly reason: FluidboxReason;
}

type FluidboxReason = "api" | "trigger" | "keyboard" | "pointer" | "wheel" | "filmstrip" | "items";
```

The before-events fire synchronously for every command that would do something, whether it comes from a key, a gesture or your code; `preventDefault()` cancels it, and its promise resolves `false`. For an open, the order is `beforetoggle`, `toggle`, `itemchange`, then after the flight `settle`. `"items"` is a move made by `setItems`. A `sheetchange` from a swipe or a scroll of the sheet has the reason `"pointer"`, from a wheel `"wheel"`, from Escape or a key on a stop button `"keyboard"`, and from `sheet.set` or the viewer opening and closing `"api"`. [Events](./javascript.md#events) lists what each reason comes from.

## Items

```ts
type FluidboxItem = FluidboxImageItem | FluidboxVideoItem | FluidboxIframeItem | FluidboxCustomItem;

interface FluidboxItemBase {
  readonly id?: string; // defaults to src: idOf(item) gives it
  readonly thumbnail?: FluidboxThumbnail;
  readonly placeholder?: string;
}

interface FluidboxImageItem extends FluidboxItemBase {
  readonly type: "img";
  readonly src: string;
  readonly srcset?: string;
  readonly sizes?: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly sources?: readonly FluidboxPictureSource[];
}

interface FluidboxVideoItem extends FluidboxItemBase {
  readonly type: "video";
  readonly src: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly poster?: string;
  readonly autoplay?: boolean;
  readonly loop?: boolean;
  readonly muted?: boolean;
  readonly playsInline?: boolean; // default true
  readonly controls?: boolean; // default true
  readonly preload?: "none" | "metadata" | "auto"; // default "metadata"
}

interface FluidboxIframeItem extends FluidboxItemBase {
  readonly type: "iframe";
  readonly src: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly allow?: string;
  readonly referrerPolicy?: ReferrerPolicy;
  readonly sandbox?: string;
}

interface FluidboxCustomItem extends FluidboxItemBase {
  readonly type: "custom";
  readonly id: string;
  readonly render: string; // a key of `renderers`
  readonly title: string;
  readonly width: number;
  readonly height: number;
}

interface FluidboxThumbnail {
  readonly src: string;
  readonly srcset?: string;
  readonly sizes?: string;
  readonly width?: number;
  readonly height?: number;
}

interface FluidboxPictureSource {
  readonly srcset: string;
  readonly sizes?: string;
  readonly media?: string;
  readonly type?: string;
}
```

Each field is the attribute of the element the viewer draws, by its DOM property name. [Media types](./media.md) explains each. Add fields of your own by extending a type: `TItem` flows through every callback and event.

`idOf(item)` returns an item's id, else its `src`, and throws a `TypeError` when it has neither. `itemLabel(item)` returns its alt text, or its title.

## Lists

```ts
type FluidboxItems<TItem extends FluidboxItem = FluidboxItem> =
  | readonly TItem[]
  | FluidboxItemList<TItem>;

interface FluidboxItemList<TItem extends FluidboxItem = FluidboxItem> {
  readonly count: number;
  get(index: number): TItem;
  indexOf?(id: string): number; // -1 when missing
}
```

An array is copied and its ids checked. A lazy list is read on demand; without `indexOf`, ids are found by scanning. See [Items and origins](./items-and-origins.md#lazy-lists).

## Renderers

```ts
type FluidboxRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  context: FluidboxRenderContext<TItem>,
) => void | (() => void);

interface FluidboxRenderContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  readonly target: HTMLElement; // emptied by the viewer afterwards
  readonly signal: AbortSignal; // aborted when the content is no longer shown
}

type FluidboxViewerRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  context: FluidboxViewerContext<TItem>,
) => void | (() => void);

interface FluidboxViewerContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly target: HTMLElement; // the viewer's layer
  readonly fluidbox: Fluidbox<TItem>;
  readonly signal: AbortSignal; // aborted when the fluidbox is destroyed
}
```

One renderer type draws everything that is yours: custom slides (`renderers`), filmstrip thumbnails (`filmstrip.render`), the sheet (`sheet.render`) and travelling overlays (`bindOverlay`'s `travel`). Draw into `target`, and return a function that releases your own resources, such as timers. The viewer renderer runs when the fluidbox is made, and again after an [`update`](#update) that changes the viewer's layer; its function, and its `signal`, end each run.

## Origins

```ts
interface FluidboxOrigin<TItem extends FluidboxItem = FluidboxItem> {
  readonly trigger: HTMLElement;
  readonly visual: HTMLElement;
  readonly thumbnail?: HTMLImageElement;
  readonly onPreviewChange?: (item: TItem, index: number) => void;
}

interface FluidboxOriginAdapter<TItem extends FluidboxItem = FluidboxItem> {
  getOrigin(id: string): FluidboxOrigin<TItem> | null;
  revealOrigin?(id: string, index: number, context: FluidboxRevealContext): void | Promise<void>;
}

interface FluidboxRevealContext {
  readonly signal: AbortSignal;
  readonly phase: "open" | "selection";
}
```

[Items and origins](./items-and-origins.md#origins) explains each.

## Labels

Every string the viewer shows or announces. Pass some or all of them as `labels` to translate the viewer:

| Key             | Default                                                 | Used for                                                      |
| --------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| `viewer`        | `"Media viewer"`                                        | The dialog's name, when the item has no alt text or title.    |
| `close`         | `"Close"`                                               | The Close button.                                             |
| `previous`      | `"Previous"`                                            | The Previous button.                                          |
| `next`          | `"Next"`                                                | The Next button.                                              |
| `position`      | `` (index, count) => `Item ${index + 1} of ${count}` `` | Each slide's name, and what the viewer announces as it moves. |
| `slides`        | `"Gallery items"`                                       | The strip of slides.                                          |
| `filmstrip`     | `"Gallery filmstrip"`                                   | The filmstrip.                                                |
| `filmstripList` | `"Choose a gallery item"`                               | The filmstrip's list of thumbnails.                           |
| `zoomed`        | `"Zoomed image"`                                        | The scroller of a zoomed image.                               |
| `sheet`         | `"Details"`                                             | The sheet's `<section>`.                                      |
| `error`         | `"Unable to load media."`                               | Shown on a slide whose media failed to load.                  |
| `retry`         | `"Retry"`                                               | The button that loads failed media again.                     |

```ts
import { createFluidbox } from "@ogdakke/fluidbox";

createFluidbox({
  items: photos,
  labels: {
    close: "Sulje",
    previous: "Edellinen",
    next: "Seuraava",
    position: (index, count) => `Kuva ${index + 1}/${count}`,
  },
});
```

The framework roots take the same object as a `labels` prop, and `<fluidbox-gallery>` as its `labels` property. A change of labels applies to the open viewer.

## Add-ons

Import an add-on's entry once to make its option work. Each entry exports only its types.

```ts
import "@ogdakke/fluidbox/filmstrip";
import "@ogdakke/fluidbox/sheet";
```

```ts
interface FluidboxFilmstripOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly render?: FluidboxRenderer<TItem>; // fills each thumbnail button
}

type FluidboxSheetSnapPoint = number | `${number}%` | "content";

interface FluidboxSheetOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly snapPoints?: readonly FluidboxSheetSnapPoint[]; // default ["60%", "content"]
  readonly dismiss?: "flight" | "scroll" | "none"; // default "flight"
  readonly render?: FluidboxRenderer<TItem>; // fills the sheet's <section> for the item on show
}

interface FluidboxSheet {
  readonly stop: number;
  set(stop: number, options?: { readonly animate?: boolean }): void;
}
```

A `sheetchange` event on the fluidbox follows each new stop. [Filmstrip and sheet](./filmstrip-and-sheet.md) explains every option and member.

## Framework parts

Each binding has the same parts, with the same names, in its own idiom. The framework pages have the props, slots and inputs: [React](./react.md), [Vue](./vue.md), [Solid](./solid.md), [Angular](./angular.md).

| Part                        | What it does                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Root`                      | Holds the items and owns the viewer. Takes `items`, `labels`, `zoom`, `renderers`, `origins` and the six events. |
| `Trigger`                   | Opens its `item`; `returns` adds items that close back onto it. Hands its content the item it shows.             |
| `Viewer`                    | Renders its children into the viewer's layer.                                                                    |
| `Controls`                  | The default Previous, Next and Close buttons.                                                                    |
| `Close`, `Previous`, `Next` | One default button each, or your children as its content.                                                        |
| `Filmstrip`                 | Turns the filmstrip on by being there. A child draws each thumbnail.                                             |
| `Sheet`                     | Turns the sheet on by being there, with `snapPoints` and `dismiss`. Its children are the sheet.                  |
| `SheetStop`                 | A button that moves the sheet to its `stop`.                                                                     |
| `ThumbnailOverlay`          | A thumbnail overlay inside a trigger; `travel` makes it fly with the photo, drawn live.                          |
| `FrameLayer`                | Inside a travelling `ThumbnailOverlay`: moves into the flying frame and scales with it, as a scrim does.         |

| Hook                 | Returns                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useFluidbox()`      | A `FluidboxApi`: the state and the commands `open`, `close`, `next`, `previous`, `setItems` and `preload`. With a selector, just what it selects. |
| `useFluidboxSheet()` | A `FluidboxSheetApi`, `{ stop, set }`: the sheet's stop, and a function that moves it.                                                            |

A part's props change the open viewer through `update`; nothing rebuilds it. Commands made before the viewer exists, as a deep link on mount does, wait for it and then run.

## Binding kit

`@ogdakke/fluidbox/kit` holds what the framework bindings are built from, for writing a binding of your own. App code doesn't need it.

| Export                                                          | What it does                                                                                                                                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createDeferredFluidbox(items)`                                 | A stand-in fluidbox that parts can bind to during render, before the viewer exists. `attach(fluidbox)` hands over the real one; bindings move to it, and commands made so far run on it.      |
| `createTrigger(fluidbox, { target, returns, onPreviewChange })` | A trigger without DOM listeners. Call `setElement`, and feed it `pointerDown`, `pointerUp`, `pointerCancel` and `click` from the framework's events. `preview(state)` gives the item to show. |
| `bindTrigger(fluidbox, element, options)`                       | The same trigger with DOM listeners: what `fluidbox.bind` uses.                                                                                                                               |
| `resolveOrigin(trigger)`                                        | Builds an origin from a trigger element, with the `data-fluidbox-origin` rules.                                                                                                               |
| `latestOrigins(read)`                                           | An origin adapter that calls the newest adapter each time, as a prop changes.                                                                                                                 |
| `fluidboxControls`, `controlNames`, `controlButton`             | Each default control's attribute, label, disabled rule and command, and a ready button.                                                                                                       |
| `fluidboxControlIcon`                                           | The default control icons as SVG attributes and paths, for frameworks that build their own SVG.                                                                                               |
| `createSlots()`                                                 | A sheet or filmstrip renderer that lists its targets, `{ item, index, target, container }`, for a framework to fill through portals.                                                          |
| `frameLayerOf(overlay)`                                         | The overlay, or the element inside it, marked `data-fluidbox-frame-layer`.                                                                                                                    |
| `idOf(item)`, `itemLabel(item)`                                 | An item's id, and its alt text or title, as the root exports them.                                                                                                                            |
| `fluidboxEventTypes`                                            | The six event names, for bindings that forward them as props, emits or outputs.                                                                                                               |
| `defaultLabels`, `resolveLabels`                                | The default labels, and the labels with your overrides applied.                                                                                                                               |

## Type index

Every type the root exports: `Fluidbox`, `FluidboxBindOptions`, `FluidboxCommandOptions`, `FluidboxControlName`, `FluidboxCustomItem`, `FluidboxEventMap`, `FluidboxFilmstripOptions`, `FluidboxIframeItem`, `FluidboxImageItem`, `FluidboxItem`, `FluidboxItemBase`, `FluidboxItemList`, `FluidboxItems`, `FluidboxLabels`, `FluidboxOptions`, `FluidboxOrigin`, `FluidboxOriginAdapter`, `FluidboxOverlayOptions`, `FluidboxPictureSource`, `FluidboxReason`, `FluidboxRenderContext`, `FluidboxRenderer`, `FluidboxRevealContext`, `FluidboxSheet`, `FluidboxSheetOptions`, `FluidboxSheetSnapPoint`, `FluidboxState`, `FluidboxStatus`, `FluidboxTarget`, `FluidboxThumbnail`, `FluidboxToggleState`, `FluidboxUpdateOptions`, `FluidboxVideoItem`, `FluidboxViewerContext`, `FluidboxViewerRenderer`. The classes `FluidboxItemChangeEvent`, `FluidboxSheetEvent` and `FluidboxToggleEvent`, and the functions `createFluidbox`, `idOf` and `itemLabel`, are values.
