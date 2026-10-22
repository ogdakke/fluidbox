---
title: JavaScript
section: Frameworks
order: 7
description: The plain JavaScript API of fluidbox, with createFluidbox, the fluidbox's state, commands and events, bind and bindOverlay, and viewer content, for apps without a framework binding.
---

# JavaScript

The package root, `@ogdakke/fluidbox`, runs the viewer without a framework or custom elements. `createFluidbox()` makes a fluidbox, which is one viewer at the end of `<body>` plus the state, commands and events that drive it. `fluidbox.bind()` makes an element open it.

## Install

```bash
npm install @ogdakke/fluidbox
```

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/styles.css";
```

Import `@ogdakke/fluidbox/styles.css` once in your app. The filmstrip and the sheet are add-ons, covered in [Add-ons](#add-ons).

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

The viewer has Previous, Next and Close buttons until you draw your own with `viewer`. To keep some of them next to yours, pass `controls: true` or a list such as `["close"]`. The same gallery, live, in every framework:

<!-- pattern: basic -->

## `createFluidbox(options)`

Returns a `Fluidbox`. Only `items` is required.

| Option      | Type                                                      | Default                               | What it does                                                                                                                                |
| ----------- | --------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`     | `readonly TItem[] \| FluidboxItemList<TItem>`             |                                       | The items: an array, or a lazy list `{ count, get, indexOf? }`. See [Items and origins](./items-and-origins.md).                            |
| `controls`  | `boolean \| readonly ("previous" \| "next" \| "close")[]` | `true` without `viewer`, else `false` | The default Previous, Next and Close buttons, or some of them.                                                                              |
| `viewer`    | `({ target, fluidbox, signal }) => void \| (() => void)`  |                                       | Draw your own controls and captions into the viewer. See [Viewer content](#viewer-content).                                                 |
| `renderers` | `Record<string, FluidboxSlideRenderer<TItem>>`            | `{}`                                  | Draw `custom` items, by the name in their `render`. See [Media types](./media.md#custom).                                                   |
| `zoom`      | `false \| { step?: number; max?: number }`                | `{ step: 2, max: 4 }`                 | `step` is the scale of a double-tap or double-click; `max` the largest scale. `false` turns zoom off.                                       |
| `loop`      | `boolean`                                                 | `false`                               | Go round: past the last item comes the first, by swipe, key, button and filmstrip. A single item never loops. `update` changes it live.     |
| `labels`    | `Partial<FluidboxLabels>`                                 | English                               | Your strings for the viewer's names and announcements. See [Labels](./api.md#labels).                                                       |
| `filmstrip` | `boolean \| { render? }`                                  | `false`                               | A thumbnail strip. Loads its entry; needs `filmstrip.css`.                                                                                  |
| `sheet`     | `boolean \| { snapPoints?, dismiss?, render? }`           | `false`                               | A panel over the photo. Loads its entry; needs `sheet.css`.                                                                                 |
| `origins`   | `FluidboxOriginAdapter<TItem>`                            |                                       | Finds the triggers of items you never bound, as in a virtualized grid. See [The origin adapter](./items-and-origins.md#the-origin-adapter). |
| `loading`   | `"hover" \| "press" \| "eager"`                           | `"hover"`                             | When the viewer's code loads. See [Loading the viewer](./getting-started.md#loading-the-viewer).                                            |

To change `labels`, `zoom`, `controls`, `viewer`, `filmstrip`, `sheet` or `loading`, call `update`. The open viewer stays open. To change the items, call `setItems`. The fluidbox looks up `renderers` by name each time a custom slide mounts, and reads `origins` on each use.

## The fluidbox

| Member                                   | Returns                   | What it does                                                                                                           |
| ---------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `state`                                  | `FluidboxState<TItem>`    | The current state, a frozen snapshot. See [State](#state).                                                             |
| `items`                                  | `FluidboxItemList<TItem>` | The items the viewer reads, as a list: the ones it was made with, or the last `setItems`.                              |
| `open(target?, options?)`                | `Promise<boolean>`        | Opens the viewer on an item, or moves to it while open. Without a target: the current item, else the first.            |
| `close(options?)`                        | `Promise<boolean>`        | Closes the viewer.                                                                                                     |
| `next(options?)`                         | `Promise<boolean>`        | Moves to the next item while open.                                                                                     |
| `previous(options?)`                     | `Promise<boolean>`        | Moves to the previous item while open.                                                                                 |
| `update(options)`                        | `void`                    | Changes `labels`, `zoom`, `loop`, `controls`, `viewer`, `filmstrip`, `sheet` or `loading` live. See [update](#update). |
| `setItems(items)`                        | `Promise<boolean>`        | Replaces the items. An open viewer stays on the same id when it is still there.                                        |
| `preload(target)`                        | `() => void`              | Starts loading an item a press is likely to open, while the viewer is closed. Call the result to let go.               |
| `load()`                                 | `Promise<boolean>`        | Loads the viewer's code now. See [Loading the viewer](./getting-started.md#loading-the-viewer).                        |
| `bind(element, target, options?)`        | `() => void`              | Makes an element a trigger. See [Triggers](#triggers).                                                                 |
| `bindOverlay(element, target, options?)` | `() => void`              | Makes an element on a trigger a thumbnail overlay. See [Thumbnail overlays](#thumbnail-overlays).                      |
| `subscribe(listener)`                    | `() => void`              | Calls `listener(state)` after every state change.                                                                      |
| `sheet`                                  | `FluidboxSheet \| null`   | The sheet, when the `sheet` option is on.                                                                              |
| `destroy()`                              | `void`                    | Closes at once, removes the viewer, and releases every `bind` and `bindOverlay`. Safe to call twice.                   |

A target is an item, its index or its id. The fluidbox matches an item object by its id, so a copy of it works too. The fluidbox is an `EventTarget`, with the events listed below.

### update

`update(options)` changes options on the live viewer, without closing it. A key you leave out keeps its value; a key set to `undefined` goes back to its default:

```ts
const coarse = matchMedia("(pointer: coarse)");
coarse.addEventListener("change", () => {
  fluidbox.update({ zoom: coarse.matches ? false : undefined });
});
fluidbox.update({ labels: { close: "Sulje", previous: "Edellinen", next: "Seuraava" } });
```

Labels and zoom apply in place. A change of `controls`, `viewer` or the labels draws the viewer's layer again, and a change of `filmstrip` or `sheet` mounts that add-on again. `update` compares options objects member by member and functions by identity, so pass the same `viewer` and `render` functions from one call to the next.

### Commands

A target, `FluidboxTarget`, is an item, its index or its id: `open(photo)`, `open(2)` or `open("photo-fjord")`. `options` is `{ signal?: AbortSignal, scrub?: boolean }`. Use `scrub: true` for a move that follows a continuous input, such as your own scrubber or a dragged row of dots. The slide jumps to the item instead of gliding. The fluidbox doesn't scroll the page to the item's trigger until the next move without `scrub`, which ends the scrub.

Each command returns a promise that settles when the motion has: `open` once the viewer is open, `close` once it is closed, `next` once the slide has moved. It resolves `true` when the command happened. It resolves `false` when a listener prevented it, a later command took over, its signal aborted, or there was nothing to do, as with `next()` on the last item of a gallery that doesn't loop, or `close()` while closed.

An unknown id or an index out of range rejects with a `RangeError`, and `preload` throws one. After `destroy()`, the commands and `load()` resolve `false`, so a part of your app still holding the old fluidbox does nothing. `setItems`, `preload`, `bind`, `bindOverlay` and `subscribe` throw an `InvalidStateError` `DOMException`.

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

`id`, `index` and `item` are the item the viewer shows, or is on its way to while a move runs, and `null` while closed. `item` is your own object, the one you passed in. `hasPrevious` and `hasNext` say whether `previous()` and `next()` have somewhere to go. With `loop`, both are true in a gallery of two or more. `subscribe` sees status and selection changes. It doesn't see motion, which runs frame by frame in CSS variables. [Styling](./styling.md) lists them.

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

| Reason       | From                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| `"api"`      | Your code: a command, or a default control.                                        |
| `"trigger"`  | A click on a trigger.                                                              |
| `"keyboard"` | The arrow keys and Escape. The page-scrolling keys close the viewer with this too. |
| `"pointer"`  | A swipe or scroll through the slides, a drag to dismiss, a tap on the backdrop.    |
| `"wheel"`    | A wheel or trackpad scroll that dismisses the viewer.                              |
| `"items"`    | `setItems`, when the new list moved the viewer to another item.                    |

The before-events fire for every command that would do something, whether it comes from a key, a gesture or your code. `close()` while closed or `next()` on the last item fires nothing. An open fires `beforetoggle`, `toggle` and `itemchange`, then `settle` after the flight. Then the promise resolves.

```ts
fluidbox.addEventListener("beforeitemchange", (event) => {
  if (event.reason === "wheel") event.preventDefault();
});
fluidbox.addEventListener("settle", ({ id }) => {
  history.replaceState(null, "", `#${id}`);
});
```

## Triggers

`fluidbox.bind(element, target, options?)` makes an element a trigger. It registers the element as its item's origin, so the flight starts and lands there. It loads the viewer's code as `loading` says, starts loading the item on pointer down, and opens the viewer on click unless a listener prevented the click. It adds `data-fluidbox-trigger`, `aria-haspopup="dialog"` and `aria-expanded` to the element. Use an element that can take focus, such as a `<button>`. It returns a function that unbinds.

| Option            | Type                                   | What it does                                                                                                                    |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `signal`          | `AbortSignal`                          | Unbinds when it aborts.                                                                                                         |
| `returns`         | `FluidboxTarget<TItem>[]`              | More items that close back onto the trigger. See [One trigger for several items](#one-trigger-for-several-items).               |
| `onPreviewChange` | `(item: TItem, index: number) => void` | Called before the closing flight measures the trigger, with the item it lands on. Show that item on the trigger, synchronously. |

The flight uses the trigger's first image, or an element inside it marked `data-fluidbox-origin`. [Which element the flight uses](./items-and-origins.md#which-element-the-flight-uses) has the rules.

### One trigger for several items

List more items in `returns`, and one element stands for all of them, as an album cover does. The viewer opens on the target, and the target and every item in `returns` close back onto the element. `returns` may hold the whole album, the target included. After a close, a click opens the item the trigger last showed, so the flight starts from the picture on it:

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

A badge, a play icon or a count on a thumbnail can follow the flight. `fluidbox.bindOverlay(element, target, options?)` makes an element inside a trigger a thumbnail overlay. As the viewer opens and closes, the element gets `--fluidbox-closed`, from `1` at the thumbnail to `0` fully open, and `data-fluidbox-phase`. Without `travel`, it stays on the page.

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

The travelling content and the `frameLayer` scale with the flying frame, so their boxes match it. Their direct children scale back, so they keep the size they had on the thumbnail. A child scales back around the edge it sits against (left, right, top or bottom) or around its centre, so a corner badge stays in its corner and a centred label stays centred. Size children by their content. A child stretched to the box's width ends up as wide as the full-size frame. While the flight starts, the page shows a still copy of the `frameLayer`, marked `data-fluidbox-ghost`, in the thumbnail.

The renderer gets `{ item, index, target, signal }`, like any [renderer](./media.md#custom). See [Styling](./styling.md#thumbnail-overlays) for the CSS hooks.

## Viewer content

The viewer's layer is yours to fill. The `viewer` option draws into it when the fluidbox is made, and again after an `update` that changes the layer:

| Context field | What it is                                                             |
| ------------- | ---------------------------------------------------------------------- |
| `target`      | The viewer's layer, `[data-fluidbox-portal]`.                          |
| `fluidbox`    | The fluidbox. Use it here, since your own variable isn't assigned yet. |
| `signal`      | Aborts when the fluidbox is destroyed, or the layer is redrawn.        |

Return a function to clean up, such as the one `subscribe` returns. Everything in the layer hides during the opening flight and fades out as a close or a drag starts, like the default controls. `controls` and `viewer` combine, with the default buttons first and yours after.

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

The default buttons carry `data-fluidbox-previous`, `data-fluidbox-next` and `data-fluidbox-close`. Any button in the viewer with one of them runs that command, gets the default styling, and is disabled while the command can do nothing. Call `event.preventDefault()` in your own click listener to stop the command. [Headless controls](./patterns/headless.md) has a full caption bar in every framework.

## Add-ons

The filmstrip and the sheet have their own entries. Turn one on with its option and the fluidbox loads its entry; import the entry to bundle it up front:

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/filmstrip";
import "@ogdakke/fluidbox/filmstrip.css";
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

An open waits for an entry that is still loading. [Filmstrip and sheet](./filmstrip-and-sheet.md) has every option.

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
| [Right to left](./patterns/rtl.md)                 | A `dir="rtl"` ancestor of the triggers, and the `labels` option.                      |
| [Photo in the address](./patterns/url.md)          | `open()` and `close()` from `?photo=`, and `toggle` and `itemchange` writing it back. |

## Notes

**Server rendering.** Importing `@ogdakke/fluidbox` has no side effects and touches no browser globals, so it is safe on the server. `createFluidbox()` needs `document`.

**Clean up.** Call `destroy()` when the gallery leaves the page. It releases every binding too, so the functions `bind` returns are for unbinding one trigger early.

**Your own fields.** Items can carry fields of your own: `createFluidbox<Photo>({ items })` with `interface Photo extends FluidboxImageItem { caption: string }`. Every callback, event and state hands back your object, so `state.item.caption` is typed.
