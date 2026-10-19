---
title: JavaScript
section: Frameworks
order: 6
description: The plain JavaScript API of fluidbox, with createFluidbox, the fluidbox's state, commands and events, bind and bindOverlay, and viewer content, for apps without a framework binding.
---

# JavaScript

The package root, `@ogdakke/fluidbox`, runs the viewer without a framework or custom elements. `createFluidbox()` makes a fluidbox: one viewer at the end of `<body>`, with the state, commands and events that drive it. `fluidbox.bind()` makes an element open it.

## Install

```bash
npm install @ogdakke/fluidbox
```

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/styles.css";
```

Import `@ogdakke/fluidbox/styles.css` once in your app. The filmstrip and the sheet are add-ons: see [Add-ons](#add-ons).

## A gallery

```ts
import { createFluidbox, type FluidboxItem } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/styles.css";

const photos: FluidboxItem[] = [
  {
    type: "img",
    src: "/photos/dune.jpg",
    alt: "Dune at dusk",
    width: 1800,
    height: 1200,
    thumbnail: { src: "/photos/dune-400.jpg", width: 400, height: 267 },
  },
  {
    type: "img",
    src: "/photos/fjord.jpg",
    alt: "Fjord",
    width: 1200,
    height: 1600,
    thumbnail: { src: "/photos/fjord-400.jpg", width: 400, height: 533 },
  },
];

const fluidbox = createFluidbox({ items: photos });

// Each <button> in .gallery holds its thumbnail <img>, in the order of `photos`.
document.querySelectorAll<HTMLButtonElement>(".gallery button").forEach((button, index) => {
  fluidbox.bind(button, index);
});
```

The viewer has Previous, Next and Close buttons until you draw your own with `viewer`; then pass `controls: true`, or a list such as `["close"]`, to keep some. The same gallery, live, in every framework:

<!-- pattern: basic -->

## `createFluidbox(options)`

Returns a `Fluidbox`. Only `items` is required.

| Option      | Type                                                      | Default                               | What it does                                                                                                                                |
| ----------- | --------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`     | `readonly TItem[] \| FluidboxItemList<TItem>`             |                                       | The items: an array, or a lazy list `{ count, get, indexOf? }`. See [Items and origins](./items-and-origins.md).                            |
| `controls`  | `boolean \| readonly ("previous" \| "next" \| "close")[]` | `true` without `viewer`, else `false` | The default Previous, Next and Close buttons, or some of them.                                                                              |
| `viewer`    | `({ target, fluidbox, signal }) => void \| (() => void)`  |                                       | Draw your own controls and captions into the viewer. See [Viewer content](#viewer-content).                                                 |
| `renderers` | `Record<string, FluidboxRenderer<TItem>>`                 | `{}`                                  | Draw `custom` items, by the name in their `render`. See [Media types](./media.md#custom).                                                   |
| `zoom`      | `false \| { step?: number; max?: number }`                | `{ step: 2, max: 4 }`                 | `step` is the scale of a double-tap or double-click; `max` the largest scale. `false` turns zoom off.                                       |
| `labels`    | `Partial<FluidboxLabels>`                                 | English                               | Your strings for the viewer's names and announcements. See [Labels](./api.md#labels).                                                       |
| `filmstrip` | `boolean \| { render?, slots? }`                          | `false`                               | A thumbnail strip. Needs `import "@ogdakke/fluidbox/filmstrip"`.                                                                            |
| `sheet`     | `boolean \| { snapPoints?, dismiss?, render? }`           | `false`                               | A panel over the photo. Needs `import "@ogdakke/fluidbox/sheet"` and `sheet.css`.                                                           |
| `origins`   | `FluidboxOriginAdapter`                                   |                                       | Finds the triggers of items you never bound, as in a virtualized grid. See [The origin adapter](./items-and-origins.md#the-origin-adapter). |

To change `labels`, `zoom`, `controls`, `viewer`, `filmstrip` or `sheet`, call `update`; the open viewer stays open. To change the items, call `setItems`. `renderers` is looked up by name each time a custom slide mounts, and `origins` on each use.

## The fluidbox

| Member                                   | Returns                   | What it does                                                                                                |
| ---------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `state`                                  | `FluidboxState<TItem>`    | The current state, a frozen snapshot. See [State](#state).                                                  |
| `items`                                  | `FluidboxItemList<TItem>` | The items the viewer reads, as a list: the ones it was made with, or the last `setItems`.                   |
| `open(target?, options?)`                | `Promise<boolean>`        | Opens the viewer on an item, or moves to it while open. Without a target: the current item, else the first. |
| `close(options?)`                        | `Promise<boolean>`        | Closes the viewer.                                                                                          |
| `next(options?)`                         | `Promise<boolean>`        | Moves to the next item while open.                                                                          |
| `previous(options?)`                     | `Promise<boolean>`        | Moves to the previous item while open.                                                                      |
| `update(options)`                        | `void`                    | Changes `labels`, `zoom`, `controls`, `viewer`, `filmstrip` or `sheet` live. See [update](#update).         |
| `setItems(items)`                        | `Promise<boolean>`        | Replaces the items. An open viewer stays on the same id when it is still there.                             |
| `preload(target)`                        | `() => void`              | Starts loading an item a press is likely to open, while the viewer is closed. Call the result to let go.    |
| `bind(element, target, options?)`        | `() => void`              | Makes an element a trigger. See [Triggers](#triggers).                                                      |
| `bindOverlay(element, target, options?)` | `() => void`              | Makes an element on a trigger a thumbnail overlay. See [Thumbnail overlays](#thumbnail-overlays).           |
| `subscribe(listener)`                    | `() => void`              | Calls `listener(state)` after every state change.                                                           |
| `sheet`                                  | `FluidboxSheet \| null`   | The sheet, when the `sheet` option is on.                                                                   |
| `destroy()`                              | `void`                    | Closes at once, removes the viewer, and releases every `bind` and `bindOverlay`. Safe to call twice.        |

A target is an item, its index or its id; an item object is matched by its id, so a copy of it works too. The fluidbox is an `EventTarget`; its events are below.

### update

`update(options)` changes options on the live viewer, without closing it. A key you leave out keeps its value; a key set to `undefined` goes back to its default:

```ts
const coarse = matchMedia("(pointer: coarse)");
coarse.addEventListener("change", () => {
  fluidbox.update({ zoom: coarse.matches ? false : undefined });
});
fluidbox.update({ labels: { close: "Sulje", previous: "Edellinen", next: "Seuraava" } });
```

Labels and zoom apply in place. A change of `controls`, `viewer` or the labels draws the viewer's layer again, and a change of `filmstrip` or `sheet` mounts that add-on again. Options objects are compared member by member, functions by identity, so keep `viewer` and the `render` functions the same from one call to the next.

### Commands

A target, `FluidboxTarget`, is an index or an id: `open(2)` or `open("photo-fjord")`. `options` is `{ signal?: AbortSignal }`.

Each command returns a promise that settles when the motion has: `open` once the viewer is open, `close` once it is closed, `next` once the slide has moved. It resolves `true` when the command happened, and `false` when it didn't: a listener prevented it, a later command took over, its signal aborted, or there was nothing to do, as `next()` on the last item or `close()` while closed.

An unknown id or an index out of range rejects with a `RangeError`, and `preload` throws one. After `destroy()`, the commands resolve `false`, so a part still holding the old fluidbox does nothing; `setItems`, `preload`, `bind`, `bindOverlay` and `subscribe` throw an `InvalidStateError` `DOMException`.

### State

```ts
interface FluidboxState<TItem> {
  readonly status: "closed" | "opening" | "open" | "closing";
  readonly id: string | null;
  readonly index: number | null;
  readonly item: TItem | null;
  readonly count: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}
```

`id`, `index` and `item` are the item the viewer shows, or is on its way to while a move runs, and `null` while closed. `item` is your own object, the one you passed in. `subscribe` sees status and selection changes, not motion: per-frame motion is in CSS variables (see [Styling](./styling.md)).

### Events

Listen with `addEventListener`. The events are typed, so `event.reason` and `event.item` need no casts:

| Event              | Class                     | Fields                           | When                                                                                    |
| ------------------ | ------------------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| `beforetoggle`     | `FluidboxToggleEvent`     | `oldState`, `newState`, `reason` | Before the viewer opens or closes. Cancelable: `preventDefault()` keeps it as it is.    |
| `toggle`           | `FluidboxToggleEvent`     | `oldState`, `newState`, `reason` | The opening or closing motion starts.                                                   |
| `beforeitemchange` | `FluidboxItemChangeEvent` | `id`, `index`, `item`, `reason`  | Before the open viewer moves to another item. Cancelable: `preventDefault()` stays put. |
| `itemchange`       | `FluidboxItemChangeEvent` | `id`, `index`, `item`, `reason`  | The viewer moves to an item, including the one it opens on.                             |
| `settle`           | `FluidboxItemChangeEvent` | `id`, `index`, `item`, `reason`  | The viewer comes to rest on an item.                                                    |
| `sheetchange`      | `FluidboxSheetEvent`      | `stop`, `reason`                 | The sheet comes to rest at another stop.                                                |

`oldState` and `newState` are `"open"` or `"closed"`, as on a popover's toggle events. `reason`, a `FluidboxReason`, says what asked:

| Reason        | From                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| `"api"`       | Your code: a command, or a default control.                                        |
| `"trigger"`   | A click on a trigger.                                                              |
| `"keyboard"`  | The arrow keys and Escape. The page-scrolling keys close the viewer with this too. |
| `"pointer"`   | A swipe or scroll through the slides, a drag to dismiss, a tap on the backdrop.    |
| `"wheel"`     | A wheel or trackpad scroll that dismisses the viewer.                              |
| `"filmstrip"` | A tap or a scrub on the filmstrip.                                                 |
| `"items"`     | `setItems`, when the new list moved the viewer to another item.                    |

The before-events fire for every command that would do something, whether it comes from a key, a gesture or your code; `close()` while closed or `next()` on the last item fires nothing. For an open, the order is `beforetoggle`, `toggle`, `itemchange`, then after the flight `settle`, and the promise resolves.

```ts
fluidbox.addEventListener("beforeitemchange", (event) => {
  if (event.reason === "wheel") event.preventDefault();
});
fluidbox.addEventListener("settle", ({ id }) => {
  history.replaceState(null, "", `#${id}`);
});
```

## Triggers

`fluidbox.bind(element, target, options?)` makes an element a trigger. It registers the element as the origin of its item, so the flight starts and lands on it; starts loading the item on pointer down; and opens on click, unless the click was prevented. It adds `data-fluidbox-trigger`, `aria-haspopup="dialog"` and `aria-expanded` to the element. Use an element that can take focus, such as a `<button>`. It returns a function that unbinds.

| Option            | Type                                   | What it does                                                                                                                    |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `signal`          | `AbortSignal`                          | Unbinds when it aborts.                                                                                                         |
| `returns`         | `FluidboxTarget<TItem>[]`              | More items that close back onto the trigger. See [One trigger for several items](#one-trigger-for-several-items).               |
| `onPreviewChange` | `(item: TItem, index: number) => void` | Called before the closing flight measures the trigger, with the item it lands on. Show that item on the trigger, synchronously. |

The flight uses the trigger's first image, or an element inside it marked `data-fluidbox-origin`; see [Which element the flight uses](./items-and-origins.md#which-element-the-flight-uses).

### One trigger for several items

List more items in `returns`, and one element stands for all of them, as an album cover does. The target opens; it and every item of `returns` close back onto the element. `returns` may hold the whole album, the target included. After a close, a click opens the item the trigger last showed, so the flight starts from the picture on it:

```ts
fluidbox.bind(cover, album[0], {
  returns: album,
  onPreviewChange(item) {
    coverImage.src = item.thumbnail?.src ?? coverImage.src;
  },
});
```

[One trigger for an album](./patterns/overlay.md) shows it in every framework.

Bindings follow `setItems`. An id that leaves the list stops being the trigger's until it comes back, and an index names whichever item is at that index now, so bind by id where the list reorders.

## Thumbnail overlays

A badge, a play icon or a count on a thumbnail can follow the flight. `fluidbox.bindOverlay(element, target, options?)` makes an element inside a trigger a thumbnail overlay: it gets `--fluidbox-closed`, from `1` at the thumbnail to `0` fully open, and `data-fluidbox-phase`, as the viewer opens and closes. Without `travel`, it stays on the page.

| Option       | Type                                 | What it does                                                                                                           |
| ------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `signal`     | `AbortSignal`                        | Unbinds when it aborts.                                                                                                |
| `returns`    | `FluidboxTarget<TItem>[]`            | More items whose flights carry the overlay, as with the trigger's `returns`.                                           |
| `travel`     | `boolean \| FluidboxRenderer<TItem>` | Fly with the photo. `true` flies a copy of the element's content; a renderer draws live content into the flying frame. |
| `frameLayer` | `HTMLElement`                        | With `travel`, an element moved into the flying frame for the flight and put back after.                               |

```ts
// The count flies with the photo and fades as it lands.
fluidbox.bindOverlay(count, album[0], { returns: album, travel: true });

// Live content: the renderer draws into the flying frame for each flight.
fluidbox.bindOverlay(badge, "clip", {
  travel: ({ item, target }) => {
    const label = document.createElement("span");
    label.className = "badge";
    label.textContent = item.type === "video" ? "Video" : "";
    target.append(label);
  },
});
```

The travelling content and the `frameLayer` scale with the flying frame, so their boxes always match it, and their direct children scale back so they keep the size they had on the thumbnail. A child scales back around the edge it sits against (left, right, top or bottom) or around its centre, so a corner badge stays in its corner and a centred label stays centred. Size children by their content, not by a percentage of the box: a child stretched to the box's width is stretched to the full-size frame. While the flight starts, the page shows a still copy of the `frameLayer` (marked `data-fluidbox-ghost`) in the thumbnail.

The renderer gets `{ item, index, target, signal }`, like any [renderer](./media.md#custom). See [Styling](./styling.md#thumbnail-overlays) for the CSS hooks.

## Viewer content

The viewer's layer is yours to fill. The `viewer` option draws into it when the fluidbox is made, and again after an `update` that changes the layer:

| Context field | What it is                                                       |
| ------------- | ---------------------------------------------------------------- |
| `target`      | The viewer's layer, `[data-fluidbox-portal]`.                    |
| `fluidbox`    | The fluidbox. Use it here: your own variable isn't assigned yet. |
| `signal`      | Aborts when the fluidbox is destroyed, or the layer is redrawn.  |

Return a function to clean up, such as the one `subscribe` returns. Everything in the layer hides during the opening flight and fades out as a close or a drag starts, like the default controls. `controls` and `viewer` go together: the default buttons come first, then yours.

```ts
import { createFluidbox } from "@ogdakke/fluidbox";

const fluidbox = createFluidbox({
  items: photos,
  controls: ["close"],
  viewer({ target, fluidbox }) {
    const caption = document.createElement("p");
    caption.className = "caption";
    target.append(caption);
    return fluidbox.subscribe(({ item }) => {
      if (item?.type === "img") caption.textContent = item.alt;
    });
  },
});
```

The default buttons carry `data-fluidbox-previous`, `data-fluidbox-next` and `data-fluidbox-close`. Any button in the viewer with one of them runs that command and is disabled while it can do nothing, and it gets the default styling. Call `event.preventDefault()` in your own click listener to stop the command. [Headless controls](./patterns/headless.md) has a full caption bar in every framework.

## Add-ons

The filmstrip and the sheet have their own entries. Import the entry once in the browser bundle, then turn the add-on on with its option:

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/filmstrip";
import "@ogdakke/fluidbox/sheet";
import "@ogdakke/fluidbox/sheet.css";

const fluidbox = createFluidbox({
  items: photos,
  filmstrip: true,
  sheet: {
    snapPoints: ["40%", "90%"],
    render({ item, target }) {
      target.textContent = item.id ?? "";
    },
  },
});
```

Turning one on without its import throws an `Error` that names the import. [Filmstrip and sheet](./filmstrip-and-sheet.md) has every option.

## Patterns

| Pattern                                            | In plain JavaScript                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [Gallery](./patterns/basic.md)                     | `createFluidbox({ items })` and `fluidbox.bind(button, index)`.                       |
| [One trigger for an album](./patterns/overlay.md)  | `bind(cover, album[0], { returns, onPreviewChange })`, and `bindOverlay(count, ...)`. |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` inside the trigger.                                            |
| [Custom content](./patterns/renderers.md)          | `renderers: { note: ({ target }) => {} }` and `render: "note"` on the item.           |
| [Programmatic control](./patterns/programmatic.md) | `open(2)`, `subscribe`, and `beforeitemchange` with `preventDefault()`.               |
| [Zoom](./patterns/zoom.md)                         | `zoom: { step, max }` or `zoom: false`.                                               |
| [Filmstrip](./patterns/filmstrip.md)               | `filmstrip: true`, or `filmstrip: { render }`.                                        |
| [Sheet](./patterns/sheet.md)                       | `sheet: { snapPoints, render }`, `fluidbox.sheet.set(stop)` and `sheetchange`.        |
| [Headless controls](./patterns/headless.md)        | A `viewer` renderer that builds your buttons and subscribes to the state.             |

## Notes

**Server rendering.** Importing `@ogdakke/fluidbox` has no side effects and touches no browser globals, so it is safe on the server. `createFluidbox()` needs `document`.

**Clean up.** Call `destroy()` when the gallery leaves the page. It releases every binding too, so the functions `bind` returns are for unbinding one trigger early.

**Your own fields.** Items can carry fields of your own: `createFluidbox<Photo>({ items })` with `interface Photo extends FluidboxImageItem { caption: string }`. Every callback, event and state hands back your object, so `state.item.caption` is typed.
