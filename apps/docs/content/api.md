---
title: API reference
section: Reference
order: 1
description: Every entry point of @ogdakke/fluidbox and every export of the root, with types: createFluidbox options, the Fluidbox, state, events and reasons, items, lists, renderers, origins, labels, the add-ons, the framework parts and the binding kit.
---

# API reference

## Entry points

| Import                         | What it holds                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `@ogdakke/fluidbox`            | `createFluidbox`, the event classes and every type. Safe to import on the server, with no side effects. |
| `@ogdakke/fluidbox/elements`   | The custom elements, defined on import. Browser only. See [Custom elements](./custom-elements.md).      |
| `@ogdakke/fluidbox/filmstrip`  | The filmstrip add-on, registered on import, and its types.                                              |
| `@ogdakke/fluidbox/sheet`      | The sheet add-on, registered on import, and its types.                                                  |
| `@ogdakke/fluidbox/kit`        | The binding kit, for writing a framework binding. See [Binding kit](#binding-kit).                      |
| `@ogdakke/fluidbox/react`      | The React binding. See [React](./react.md). Likewise `/vue`, `/solid` and `/angular`.                   |
| `@ogdakke/fluidbox/styles.css` | The viewer's layout and default look.                                                                   |
| `@ogdakke/fluidbox/sheet.css`  | The sheet's layout and variables.                                                                       |

```ts
import { createFluidbox, FluidboxChangeEvent, FluidboxToggleEvent } from "@ogdakke/fluidbox";
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
  readonly origins?: FluidboxOriginAdapter;
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

The options are read once. `renderers` is looked up when a slide mounts, and `origins` on each use; to change anything else, destroy the fluidbox and create a new one. The framework roots and `<fluidbox-gallery>` do this for you. An array with an empty or duplicate id throws a `TypeError`. `filmstrip` or `sheet` without its import throws an `Error` that names the import.

## Fluidbox

```ts
interface Fluidbox<TItem extends FluidboxItem = FluidboxItem> extends EventTarget {
  readonly state: FluidboxState<TItem>;
  readonly items: FluidboxItemList<TItem>;
  readonly sheet: FluidboxSheet | null;
  readonly filmstrip: FluidboxFilmstrip<TItem> | null;
  open(target?: FluidboxTarget, options?: FluidboxCommandOptions): Promise<boolean>;
  close(options?: FluidboxCommandOptions): Promise<boolean>;
  next(options?: FluidboxCommandOptions): Promise<boolean>;
  previous(options?: FluidboxCommandOptions): Promise<boolean>;
  setItems(items: FluidboxItems<TItem>): Promise<boolean>;
  preload(target: FluidboxTarget): () => void;
  bind(
    element: HTMLElement,
    target: FluidboxTarget | readonly FluidboxTarget[],
    options?: FluidboxBindOptions<TItem>,
  ): () => void;
  bindOverlay(
    element: HTMLElement,
    target: FluidboxTarget | readonly FluidboxTarget[],
    options?: FluidboxOverlayOptions<TItem>,
  ): () => void;
  subscribe(listener: (state: FluidboxState<TItem>) => void): () => void;
  destroy(): void;
}

type FluidboxTarget = number | string; // an index, or an id
interface FluidboxCommandOptions {
  readonly signal?: AbortSignal;
}
```

| Member             | What it does                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `state`            | The current [state](#fluidboxstate), a frozen snapshot.                                                                                 |
| `items`            | The items as a list: those it was made with, or the last `setItems`.                                                                    |
| `sheet`            | The [sheet handle](#add-ons), when the `sheet` option is on; else `null`.                                                               |
| `filmstrip`        | The [filmstrip handle](#add-ons), when the `filmstrip` option is on; else `null`.                                                       |
| `open`             | Opens the viewer on an item, or moves to it while open. Without a target: the current item, else the first.                             |
| `close`            | Closes the viewer.                                                                                                                      |
| `next`, `previous` | Move one item while open.                                                                                                               |
| `setItems`         | Replaces the items. An open viewer stays on the same id, else the item now at its index, or the last; it closes when the list is empty. |
| `preload`          | Starts loading an item a press is likely to open, while closed. Call the result to drop the work.                                       |
| `bind`             | Makes an element a trigger for an item, or for several, the first of which it opens. See [Triggers](./javascript.md#triggers).          |
| `bindOverlay`      | Makes an element on a trigger a thumbnail overlay. See [Thumbnail overlays](./javascript.md#thumbnail-overlays).                        |
| `subscribe`        | Calls `listener(state)` after every state change. Not called per animation frame.                                                       |
| `destroy`          | Closes at once, removes the viewer, and releases every binding. Safe to call twice.                                                     |

Commands resolve `true` once the command has happened and its motion has settled, and `false` when it was prevented, superseded by a later command, aborted by its signal, or had nothing to do. An unknown id or an index out of range rejects with a `RangeError`, and `preload` throws one. After `destroy()`, the commands resolve `false`, so a part still holding the old fluidbox does nothing; `setItems`, `preload`, `bind`, `bindOverlay` and `subscribe` throw an `InvalidStateError` `DOMException`.

### Bind options

```ts
interface FluidboxBindOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** Unbinds when aborted. */
  readonly signal?: AbortSignal;
  /** Before the closing flight measures the trigger, with the item it lands on. Update it synchronously. */
  readonly onPreviewChange?: (item: TItem, index: number) => void;
}

interface FluidboxOverlayOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** Unbinds when aborted. */
  readonly signal?: AbortSignal;
  /** Fly with the photo: true flies a copy of the element; a renderer draws live content into the flying frame. */
  readonly travel?: boolean | FluidboxRenderer<TItem>;
  /** With travel, an element moved into the flying frame for the flight and put back after. */
  readonly frameLayer?: HTMLElement;
}
```

A trigger sets `data-fluidbox-trigger`, `aria-haspopup="dialog"` and `aria-expanded="false"` on its element. On a primary-button `pointerdown` it calls `preload`, and drops that work 250 ms after the pointer lifts without a click. A click opens the item the trigger shows: its first target, or the item it last closed onto. A click whose `defaultPrevented` is `true` doesn't open.

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

| Event              | Class                        | Cancelable | When                                                       |
| ------------------ | ---------------------------- | ---------- | ---------------------------------------------------------- |
| `beforetoggle`     | `FluidboxToggleEvent`        | yes        | Before the viewer opens or closes.                         |
| `toggle`           | `FluidboxToggleEvent`        | no         | The opening or closing motion starts.                      |
| `beforeitemchange` | `FluidboxChangeEvent<TItem>` | yes        | Before the open viewer moves to another item.              |
| `itemchange`       | `FluidboxChangeEvent<TItem>` | no         | The viewer moves to an item, the one it opens on included. |
| `settle`           | `FluidboxChangeEvent<TItem>` | no         | The viewer comes to rest on an item.                       |

```ts
class FluidboxToggleEvent extends Event {
  readonly oldState: "open" | "closed"; // FluidboxToggleState
  readonly newState: "open" | "closed";
  readonly reason: FluidboxReason;
}

class FluidboxChangeEvent<TItem extends FluidboxItem = FluidboxItem> extends Event {
  readonly id: string;
  readonly index: number;
  readonly item: TItem;
  readonly reason: FluidboxReason;
}

type FluidboxReason = "api" | "trigger" | "keyboard" | "pointer" | "wheel" | "filmstrip" | "items";
```

The before-events fire synchronously for every command that would do something, whether it comes from a key, a gesture or your code; `preventDefault()` cancels it, and its promise resolves `false`. For an open, the order is `beforetoggle`, `toggle`, `itemchange`, then after the flight `settle`. `"items"` is a move made by `setItems`. [Events](./javascript.md#events) lists what each reason comes from.

## Items

```ts
type FluidboxItem = FluidboxImageItem | FluidboxVideoItem | FluidboxIframeItem | FluidboxCustomItem;

interface FluidboxItemBase {
  readonly id?: string; // defaults to src
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

One renderer type draws everything that is yours: custom slides (`renderers`), filmstrip thumbnails (`filmstrip.render`), the sheet (`sheet.render`) and travelling overlays (`bindOverlay`'s `travel`). Draw into `target`, and return a function that releases your own resources, such as timers. The viewer renderer runs once, when the fluidbox is made, and its function when it is destroyed.

## Origins

```ts
interface FluidboxOrigin {
  readonly trigger: HTMLElement;
  readonly visual: HTMLElement;
  readonly thumbnail?: HTMLImageElement;
  readonly prepareClose?: (item: FluidboxItem, index: number) => void;
}

interface FluidboxOriginAdapter {
  getOrigin(id: string): FluidboxOrigin | null;
  revealOrigin?(id: string, index: number, context: FluidboxRevealContext): void | Promise<void>;
}

interface FluidboxRevealContext {
  readonly signal: AbortSignal;
  readonly reason: "open" | "selection";
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
| `sheet`         | `"Details"`                                             | The sheet the runtime makes when the sheet has a `render`.    |
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

The framework roots take the same object as a `labels` prop, and `<fluidbox-gallery>` as its `labels` property.

## Add-ons

Import an add-on's entry once to make its option work. Each entry exports only its types.

```ts
import "@ogdakke/fluidbox/filmstrip";
import "@ogdakke/fluidbox/sheet";
```

```ts
interface FluidboxFilmstripOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly render?: FluidboxRenderer<TItem>; // fills each thumbnail button
  readonly slots?: boolean; // leave the buttons empty and list them in `slots`
}

interface FluidboxFilmstrip<TItem extends FluidboxItem = FluidboxItem> {
  readonly slots: readonly FluidboxFilmstripSlot<TItem>[]; // { item, index, target }, in index order
  subscribe(listener: () => void): () => void;
}

type FluidboxSheetSnapPoint = number | `${number}%` | "content";

interface FluidboxSheetOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly snapPoints?: readonly FluidboxSheetSnapPoint[]; // default ["60%", "content"]
  readonly dismiss?: "flight" | "scroll" | "none"; // default "flight"
  readonly render?: FluidboxRenderer<TItem>;
}

interface FluidboxSheet {
  readonly stop: number;
  readonly slot: HTMLElement | null;
  set(stop: number, options?: { readonly animate?: boolean }): void;
  subscribe(listener: (stop: number) => void): () => void;
}
```

[Filmstrip and sheet](./filmstrip-and-sheet.md) explains every option and member.

## Framework parts

Each binding has the same parts, with the same names, in its own idiom. The framework pages have the props, slots and inputs: [React](./react.md), [Vue](./vue.md), [Solid](./solid.md), [Angular](./angular.md).

| Part                        | What it does                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Root`                      | Holds the items and owns the viewer. Takes `items`, `labels`, `zoom`, `renderers`, `origins` and the five events. |
| `Trigger`                   | Opens an item, or stands for several. Hands its content the item it shows.                                        |
| `Item`                      | Scopes one item for the `Trigger` and `ThumbnailOverlay` inside it.                                               |
| `Viewer`                    | Renders its children into the viewer's layer.                                                                     |
| `Controls`                  | The default Previous, Next and Close buttons.                                                                     |
| `Close`, `Previous`, `Next` | One default button each, or your children as its content.                                                         |
| `Filmstrip`                 | Turns the filmstrip on by being there. A child draws each thumbnail.                                              |
| `Sheet`                     | Turns the sheet on by being there, with `snapPoints` and `dismiss`. Its children are the sheet.                   |
| `SheetStop`                 | A button that moves the sheet to its `stop`.                                                                      |
| `ThumbnailOverlay`          | A thumbnail overlay inside a trigger; `travel` makes it fly with the photo.                                       |

| Hook                 | Returns                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `useFluidbox()`      | The state and the commands: `open`, `close`, `next`, `previous` and `setItems`. With a selector, just what it selects. |
| `useFluidboxSheet()` | `{ stop, set }`: the sheet's stop, and a function that moves it.                                                       |

## Binding kit

`@ogdakke/fluidbox/kit` holds what the framework bindings are built from, for writing a binding of your own. App code doesn't need it.

| Export                                                  | What it does                                                                                                                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createDeferredFluidbox(items)`                         | A stand-in fluidbox that parts can bind to during render, before the viewer exists. `attach(fluidbox)` hands over the real one; bindings move to it.                                          |
| `createTrigger(fluidbox, { targets, onPreviewChange })` | A trigger without DOM listeners. Call `setElement`, and feed it `pointerDown`, `pointerUp`, `pointerCancel` and `click` from the framework's events. `preview(state)` gives the item to show. |
| `bindTrigger(fluidbox, element, options)`               | The same trigger with DOM listeners: what `fluidbox.bind` uses.                                                                                                                               |
| `resolveOrigin(trigger)`                                | Builds an origin from a trigger element, with the `data-fluidbox-origin` rules.                                                                                                               |
| `latestOrigins(read)`                                   | An origin adapter that calls the newest adapter each time, as a prop changes.                                                                                                                 |
| `fluidboxControls`, `controlNames`, `controlButton`     | Each default control's attribute, label, disabled rule and command, and a ready button.                                                                                                       |
| `fluidboxControlIcon`                                   | The default control icons as SVG attributes and paths, for frameworks that build their own SVG.                                                                                               |
| `itemLabel(item)`                                       | An item's alt text, or its title.                                                                                                                                                             |
| `fluidboxEventTypes`                                    | The five event names, for bindings that forward them as props, emits or outputs.                                                                                                              |
| `defaultLabels`, `resolveLabels`                        | The default labels, and the labels with your overrides applied.                                                                                                                               |

## Type index

Every type the root exports: `Fluidbox`, `FluidboxBindOptions`, `FluidboxCommandOptions`, `FluidboxControlName`, `FluidboxCustomItem`, `FluidboxEventMap`, `FluidboxFilmstrip`, `FluidboxFilmstripOptions`, `FluidboxFilmstripSlot`, `FluidboxIframeItem`, `FluidboxImageItem`, `FluidboxItem`, `FluidboxItemBase`, `FluidboxItemList`, `FluidboxItems`, `FluidboxLabels`, `FluidboxOptions`, `FluidboxOrigin`, `FluidboxOriginAdapter`, `FluidboxOverlayOptions`, `FluidboxPictureSource`, `FluidboxReason`, `FluidboxRenderContext`, `FluidboxRenderer`, `FluidboxRevealContext`, `FluidboxSheet`, `FluidboxSheetOptions`, `FluidboxSheetSnapPoint`, `FluidboxState`, `FluidboxStatus`, `FluidboxTarget`, `FluidboxThumbnail`, `FluidboxToggleState`, `FluidboxVideoItem`, `FluidboxViewerContext`, `FluidboxViewerRenderer`. The classes `FluidboxChangeEvent` and `FluidboxToggleEvent` are values.
