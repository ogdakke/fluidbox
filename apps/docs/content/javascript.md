---
title: JavaScript
section: Frameworks
order: 7
description: The plain JavaScript API of fluidbox, with createFluidbox, the fluidbox's state, commands and events, bind, bindOverlay and bindControl, and viewer content, for apps without a framework binding.
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
import "@ogdakke/fluidbox/baseline.css"; // optional: the default look
```

Import `@ogdakke/fluidbox/styles.css` once in your app, and `baseline.css` if you want the default look rather than your own; see [Styling](./styling.md). The thumbnails and the sheet are add-ons, covered in [Add-ons](#add-ons).

## A gallery

```ts
import { createFluidbox, type FluidboxItem } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/styles.css";

const photos: FluidboxItem[] = [
  {
    type: "image",
    src: "/photos/dune.jpg",
    alt: "Dune at dusk",
    width: 1800,
    height: 1200,
    thumbnail: { src: "/photos/dune-400.jpg", width: 400, height: 267 },
  },
  {
    type: "image",
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

The viewer has Previous, Next and Close buttons until you draw your own with `viewer`. Then it keeps Close, until your content draws a button of its own marked `data-fluidbox-close`: a screen reader's touch needs a way out it can count on. To keep more of them next to yours, pass `controls: true` or a list such as `["previous", "next", "close"]`. The same gallery, live, in every framework:

<!-- pattern: basic -->

## `createFluidbox(options)`

Returns a `Fluidbox`. Only `items` is required.

| Option              | Type                                                        | Default                                   | What it does                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`             | `readonly TItem[] \| FluidboxItemList<TItem>`               |                                           | The items: an array, or a lazy list `{ count, get, indexOf? }`. See [Items and origins](./items-and-origins.md).                                                                                                                 |
| `value`             | `string \| null`                                            | `null`                                    | The id of an item to open with, as a deep link does: the viewer opens on it without motion once its media is ready.                                                                                                              |
| `controls`          | `boolean \| readonly FluidboxControlName[]`                 | `true` without `viewer`, else `["close"]` | The default Previous, Next and Close buttons, or a list of the controls to show. With a `viewer`, Close steps aside while your content has its own. See [Controls of your own](#controls-of-your-own).                           |
| `icons`             | `Partial<Record<FluidboxControlName, () => Node>>`          |                                           | Your icons for the default controls. Without one, a control shows its label as text, marked `data-fluidbox-default`; with one, the label becomes its `aria-label`. Each call returns a new Node.                                 |
| `viewer`            | `({ target, fluidbox, signal }) => void \| (() => void)`    |                                           | Draw your own controls and captions into the viewer. See [Viewer content](#viewer-content).                                                                                                                                      |
| `slides`            | `FluidboxSlides<TItem>`                                     |                                           | Draw slides by item type: types of your own, or the built-in ones. See [Media types](./media.md).                                                                                                                                |
| `zoom`              | `false \| { step?, max?, click?, tap? }`                    | `{ step: 2, max: 4 }`                     | `step` is the scale of a click or double-tap, and `max` the largest scale. `click` (`"single"`, `"double"` or `false`) and `tap` (`"double"` or `false`) say what zooms. `false` turns zoom off. See [Zoom](./patterns/zoom.md). |
| `loop`              | `boolean`                                                   | `false`                                   | Go round: past the last item comes the first, by swipe, key, button and thumbnails. A single item never loops.                                                                                                                   |
| `labels`            | `Partial<FluidboxLabels>`                                   | English                                   | Your strings for the viewer's names and announcements. See [Languages and direction](./languages.md).                                                                                                                            |
| `thumbnails`        | `boolean \| { render? }`                                    | `false`                                   | A thumbnail strip. Loads its entry; needs `thumbnails.css`.                                                                                                                                                                      |
| `sheet`             | `boolean \| { snapPoints?, dismissMotion?, render? }`       | `false`                                   | A panel over the photo. Loads its entry; needs `sheet.css`.                                                                                                                                                                      |
| `slideshow`         | `{ interval?, loop?, autoplay? }`                           |                                           | Move on a timer, with `play()` and the Slideshow control. See [Slideshow](./slideshow.md).                                                                                                                                       |
| `reachEndThreshold` | `number`                                                    | `2`                                       | How near the last item `reachend` fires. See [Lists that grow](./items-and-origins.md#lists-that-grow).                                                                                                                          |
| `findTrigger`       | `(item, index) => HTMLElement \| null`                      |                                           | Finds the trigger of an item without a bound one, as in a virtualized grid. See [The origin adapter](./items-and-origins.md#the-origin-adapter).                                                                                 |
| `revealTrigger`     | `(item, index, { signal, phase }) => void \| Promise<void>` |                                           | Brings an item's trigger into view before the viewer flies to or from it. See [Reveal on close](./items-and-origins.md#reveal-on-close).                                                                                         |
| `preload`           | `"intent" \| "press" \| "eager"`                            | `"intent"`                                | When the viewer's code loads. See [Loading the viewer](./getting-started.md#loading-the-viewer).                                                                                                                                 |
| `dismiss`           | `{ drag?: boolean; backdrop?: boolean }`                    | both `true`                               | Whether a drag down on the media, and a tap on the backdrop, close the viewer. Escape and Close always do.                                                                                                                       |
| `wheel`             | `"dismiss" \| "zoom" \| "navigate" \| "none"`               | `"dismiss"`                               | What a vertical wheel or trackpad scroll does: close, zoom, move one item per gesture, or nothing. A horizontal scroll still moves, and Ctrl + wheel still zooms.                                                                |
| `shareUrl`          | `(item) => string \| undefined`                             |                                           | The link the Share control shares. Without one, Share is hidden.                                                                                                                                                                 |

Every option but `items`, `value`, `slides`, `findTrigger` and `revealTrigger` can change later through [`update`](#update); the open viewer stays open. To change the items, call `setItems`. The fluidbox reads `slides` when a slide mounts, and `findTrigger` and `revealTrigger` on each use.

## The fluidbox

| Member                                  | Returns                   | What it does                                                                                                          |
| --------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `state`                                 | `FluidboxState<TItem>`    | The current state, a frozen snapshot. See [State](#state).                                                            |
| `items`                                 | `FluidboxItemList<TItem>` | The items the viewer reads, as a list: the ones it was made with, or the last `setItems`.                             |
| `open(target?, options?)`               | `Promise<boolean>`        | Opens the viewer on an item, or moves to it while open. Without a target: the current item, else the first.           |
| `close(options?)`                       | `Promise<boolean>`        | Closes the viewer.                                                                                                    |
| `next(options?)`                        | `Promise<boolean>`        | Moves to the next item while open.                                                                                    |
| `previous(options?)`                    | `Promise<boolean>`        | Moves to the previous item while open.                                                                                |
| `update(options)`                       | `void`                    | Changes options live. See [update](#update).                                                                          |
| `zoomTo(scale, options?)`               | `Promise<boolean>`        | Zooms the image on show to `scale`, between 1 and the zoom's `max`. See [Zoom](./patterns/zoom.md).                   |
| `zoomIn(options?)`, `zoomOut(options?)` | `Promise<boolean>`        | Zooms in or out by 1.5.                                                                                               |
| `zoomReset(options?)`                   | `Promise<boolean>`        | Zooms back out to fit.                                                                                                |
| `setFullscreen(on?)`                    | `Promise<boolean>`        | Puts the open viewer in full screen, or takes it out; without an argument, toggles. False where the page can't.       |
| `download()`                            | `Promise<boolean>`        | Saves the open item's file: its `download`, else an image's `zoom.src ?? src` or a video's `src`.                     |
| `share()`                               | `Promise<boolean>`        | Shares the `shareUrl` of the open item through the share sheet, else copies it.                                       |
| `play()`, `pause()`                     | `void`                    | Starts and stops the slideshow. See [Slideshow](./slideshow.md).                                                      |
| `setItems(items)`                       | `Promise<boolean>`        | Replaces the items. An open viewer stays on the same id when it is still there. Equal items change nothing.           |
| `preload(target)`                       | `() => void`              | Starts loading an item a press is likely to open, while the viewer is closed. Call the result to let go.              |
| `load()`                                | `Promise<boolean>`        | Loads the viewer's code now. See [Loading the viewer](./getting-started.md#loading-the-viewer).                       |
| `bind(element, value, options?)`        | `() => void`              | Makes an element a trigger. See [Triggers](#triggers).                                                                |
| `bindOverlay(element, value, options?)` | `() => void`              | Makes an element on a trigger a trigger overlay. See [Thumbnail overlays](#thumbnail-overlays).                       |
| `bindControl(element, name, options?)`  | `() => void`              | Makes an element of yours a control, in the viewer or on the page. See [Controls of your own](#controls-of-your-own). |
| `subscribe(listener)`                   | `() => void`              | Calls `listener(state)` after every state change.                                                                     |
| `sheet`                                 | `FluidboxSheet \| null`   | The sheet, when the `sheet` option is on.                                                                             |
| `destroy()`                             | `void`                    | Closes at once, removes the viewer, and releases every binding. Safe to call twice.                                   |

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

Labels and zoom apply in place, so a zoomed photo zooms out when zoom turns off. A change of `controls`, `viewer` or the labels draws the viewer's layer again, and a change of `thumbnails` or `sheet` mounts that add-on again. `update` compares option objects member by member and functions by identity, so pass the same `viewer` and `render` functions from one call to the next.

### Commands

A target, `FluidboxTarget`, is an item, its index or its id: `open(photo)`, `open(2)` or `open("photo-fjord")`. `options` is `{ signal?: AbortSignal, scrub?: boolean }`. Use `scrub: true` for a move that follows a continuous input, such as your own scrubber or a dragged row of dots. The slide jumps to the item instead of gliding. The fluidbox doesn't scroll the page to the item's trigger until the next move without `scrub`, which ends the scrub.

Each command returns a promise that settles when the motion has: `open` once the viewer is open, `close` once it is closed, `next` once the slide has moved. It resolves `true` when the command happened. It resolves `false` when a listener prevented it, a later command took over, its signal aborted, or there was nothing to do, as with `next()` on the last item of a gallery that doesn't loop, or `close()` while closed.

An unknown id or an index out of range rejects with a `RangeError`, and `preload` throws one. After `destroy()`, the commands and `load()` resolve `false`, so a part of your app still holding the old fluidbox does nothing. `setItems`, `preload`, `bind`, `bindOverlay` and `subscribe` throw an `InvalidStateError` `DOMException`.

### State

<!-- api: FluidboxState -->

`value`, `index` and `item` are the item the viewer shows, or is on its way to while a move runs, and `null` while closed. `value` is the item's id, and `item` is your own object, the one you passed in. `hasPrevious` and `hasNext` say whether `previous()` and `next()` have somewhere to go. With `loop`, both are true in a gallery of two or more. `zoom` is the zoom of the image on show, `null` when there is none: closed, on another type of item, or with zoom off. Its `scale` changes as a zoom comes to rest. `subscribe` sees status, selection, zoom, full screen and slideshow changes. It doesn't see motion, which runs frame by frame in CSS variables. The [CSS reference](./css-reference.md#published-values) lists them.

### Events

Listen with `addEventListener`. The events are typed, so `event.reason` and `event.item` need no casts:

| Event                 | Class                      | Fields                                                        | When                                                                                                                      |
| --------------------- | -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `beforevaluechange`   | `FluidboxValueChangeEvent` | `value`, `previousValue`, `index`, `item`, `action`, `reason` | Before every open, move and close. `preventDefault()` stops it.                                                           |
| `valuechange`         | `FluidboxValueChangeEvent` | the same                                                      | The viewer opens, moves or closes; the motion starts.                                                                     |
| `valuechangecomplete` | `FluidboxValueChangeEvent` | the same                                                      | The motion settled: the flight landed, a move came to rest, a close finished.                                             |
| `sheetchange`         | `FluidboxSheetEvent`       | `snap`, `reason`                                              | The sheet comes to rest at another stop.                                                                                  |
| `zoomchange`          | `FluidboxZoomEvent`        | `scale`, `reason`                                             | The image on show comes to rest at another zoom.                                                                          |
| `mediaerror`          | `FluidboxMediaErrorEvent`  | `value`, `index`, `item`, `kind`, `cause`                     | A slide shows its error, or a sharper image for the zoom fails.                                                           |
| `reachend`            | `FluidboxReachEndEvent`    | `value`, `index`, `count`                                     | The open item came within `reachEndThreshold` of the last. See [Lists that grow](./items-and-origins.md#lists-that-grow). |

`action` is `"open"`, `"move"` or `"close"`. `reason`, a `FluidboxReason`, says what asked:

| Reason        | From                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| `"api"`       | Your code: a command, or a default control.                                     |
| `"trigger"`   | A click on a trigger.                                                           |
| `"keyboard"`  | The arrow keys, Home and End, and Escape. See [Keyboard](#keyboard).            |
| `"pointer"`   | A swipe or scroll through the slides, a drag to dismiss, a tap on the backdrop. |
| `"wheel"`     | A wheel or trackpad scroll that dismisses the viewer.                           |
| `"items"`     | `setItems`, when the new list moved the viewer to another item.                 |
| `"slideshow"` | The slideshow's timer.                                                          |

`beforevaluechange` fires for every open, move and close that would do something, whether it comes from a key, a gesture or your code. `close()` while closed or `next()` on the last item fires nothing. An open fires `beforevaluechange` and `valuechange`, then `valuechangecomplete` after the flight. Then the promise resolves. A change the items force, as a close when they run out, fires `beforevaluechange` too, not cancelable.

```ts
fluidbox.addEventListener("beforevaluechange", (event) => {
  if (event.reason === "wheel") event.preventDefault();
});
fluidbox.addEventListener("valuechangecomplete", ({ value }) => {
  history.replaceState(null, "", value ? `#${value}` : location.pathname);
});
```

## Triggers

`fluidbox.bind(element, value, options?)` makes an element a trigger. It registers the element as its item's origin, so the flight starts and lands there. It loads the viewer's code as `preload` says, starts loading the item on pointer down, and opens the viewer on click unless a listener prevented the click. It adds `data-fluidbox-trigger` and `aria-haspopup="dialog"` to the element. Use a `<button>`, or an `<a href>` to the full image ([A link as the trigger](./getting-started.md#a-link-as-the-trigger)). Any other element needs a `role` and `tabindex` of its own, and warns in development without them. It returns a function that unbinds.

| Option            | Type                                   | What it does                                                                                                                    |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `signal`          | `AbortSignal`                          | Unbinds when it aborts.                                                                                                         |
| `onPreviewChange` | `(item: TItem, index: number) => void` | Called before the closing flight measures the trigger, with the item it lands on. Show that item on the trigger, synchronously. |

The flight uses the trigger's first image, video or live `<model-viewer>`, or an element inside it marked `data-fluidbox-origin`. [Which element the flight uses](./items-and-origins.md#which-element-the-flight-uses) has the rules.

### One trigger for several items

Pass a list as the value, and one element stands for all of them, as an album cover does. The viewer opens on the first, and every item in the list closes back onto the element. After a close, a click opens the item the trigger last showed, so the flight starts from the picture on it. This is the [One trigger for an album](./patterns/overlay.md) pattern:

<!-- pattern: overlay -->

Bindings follow `setItems`. An id that leaves the list stops being the trigger's until it comes back, and an index names whichever item is at that index now, so bind by id where the list reorders.

## Thumbnail overlays

A badge, a play icon or a count on a thumbnail can follow the flight. `fluidbox.bindOverlay(element, value, options?)` makes an element inside a trigger a trigger overlay, for the same `value` as the trigger. As the viewer opens and closes, the element gets `--fluidbox-closed`, from `1` at the thumbnail to `0` fully open, and `data-fluidbox-phase`.

| Option   | Type                                                        | What it does                                                                                                                                                                                                                      |
| -------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signal` | `AbortSignal`                                               | Unbinds when it aborts.                                                                                                                                                                                                           |
| `flight` | `"none" \| "copy" \| "frame" \| { live: FluidboxRenderer }` | How it goes with the flight. `"none"` (the default) stays on the card; `"copy"` flies a still copy of it; `{ live }` draws live content into the flying frame; `"frame"` moves the element itself into the flying frame and back. |

A trigger can have several overlays, as a scrim beside a count:

```ts
// The count flies with the photo and fades as it lands.
fluidbox.bindOverlay(count, album, { flight: "copy" });

// Live content: the renderer draws into the flying frame for each flight.
fluidbox.bindOverlay(badge, "clip", {
  flight: {
    live: ({ item, target }) => {
      const label = document.createElement("span");
      label.className = "badge";
      label.textContent = item.type === "video" ? "Video" : "";
      target.append(label);
    },
  },
});
```

The flying content scales with the flying frame, so its box matches it. Its direct children scale back, so they keep the size they had on the thumbnail. A child scales back around the edge it sits against (left, right, top or bottom) or around its centre, so a corner badge stays in its corner and a centred label stays centred. Size children by their content. A child stretched to the box's width ends up as wide as the full-size frame. While a `"frame"` flight starts, the page shows a still copy of the element, marked `data-fluidbox-ghost`, in the thumbnail.

The live renderer gets `{ item, index, target, signal }`, as any `FluidboxRenderer` does. See [Styling](./styling.md) for the CSS hooks.

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

const credits: Record<string, string> = { harbour: "Photo by Ana Ruiz, 2024" };

const fluidbox = createFluidbox({
  items: photos,
  viewer({ target, fluidbox }) {
    const caption = document.createElement("p");
    caption.className = "caption";
    // The dialog's description: read once as the viewer opens.
    caption.dataset.fluidboxDescription = "";
    target.append(caption);
    return fluidbox.subscribe(({ value }) => {
      caption.textContent = (value && credits[value]) || "";
    });
  },
});
```

The dialog is already named by the item's `alt` or `title`, so a caption that repeats it is read twice. Show something the name doesn't say, such as a credit or a date, and mark it `data-fluidbox-description`: the dialog gets `aria-describedby` pointing at it, whether it is in the layer or in a slide.

### Controls of your own

The package ships no icons. The default controls show their labels as text, "Close" and "Next", marked `data-fluidbox-default`; the opt-in `baseline.css` draws glyphs over them. Give the `icons` option a function per control to put your own icon in instead, and the label becomes the control's `aria-label`:

```ts
const closeIcon = document.querySelector<HTMLTemplateElement>("#icon-close")!;
createFluidbox({ items: photos, icons: { close: () => closeIcon.content.cloneNode(true) } });
```

`fluidbox.bindControl(element, name)` makes an element of yours a control anywhere, on the page as well as in the viewer: it runs the command on a click, gets the control's data attribute, `disabled` and `hidden` from the state, and an `aria-label` unless it has a name of its own. Full screen and Slideshow get the label that matches their state, and `data-active` while full screen or playing. The names are those of `FluidboxControlName`: `previous`, `next`, `close`, `zoomIn`, `zoomOut`, `zoomReset`, `counter`, `fullscreen`, `download`, `share`, `retry` and `slideshow`. It returns its cleanup, and takes a `signal`.

```ts
// A Slideshow button of the page's own.
fluidbox.bindControl(document.querySelector("#page-slideshow")!, "slideshow");
```

Any button in the viewer marked with a control's attribute, as `data-fluidbox-close` or `data-fluidbox-next`, runs that command too, is disabled while the command can do nothing, and is hidden where it can't work, as Full screen is on an iPhone. Call `event.preventDefault()` in your own click listener to stop the command. [Headless controls](./patterns/headless.md) has a full caption bar in every framework.

## Keyboard

The viewer is a modal dialog. As it opens, focus moves into it, onto Close; as it closes, focus goes back to the trigger. What was on the page when it opened is `inert` (see [Layers and isolation](./styling.md#layers-and-isolation)), and Tab and Shift+Tab are the browser's own, so they reach everything in the viewer that can take focus, shadow roots and native media controls included.

| Key                   | On the viewer: the dialog, its controls, or the strip of slides |
| --------------------- | --------------------------------------------------------------- |
| Left and Right arrows | The previous and next item, swapped right to left.              |
| Home and End          | The first and last item.                                        |
| `+`, `-` and `0`      | Zoom in, out and back.                                          |
| Escape                | Closes the viewer, or lowers a raised sheet.                    |

Keys belong to what has focus. With a field, a link, a button of your own, a `<video>`, or a widget that moves with the arrow keys (a slider, a radio group, a menu, tabs, a listbox, a grid) focused, only Escape reaches the viewer, and only if the content doesn't handle it first: the viewer listens on the document after your content, and leaves a key that was `preventDefault()`ed, or that a dialog, popover, menu or open combobox in the content takes. Arrow keys with Alt, Ctrl, Meta or Shift aren't the viewer's. Content marked `data-fluidbox-owns-input` keeps its keys and gestures, as the thumbnails do.

The viewer announces the item it moves to, as "Blue study, 2 of 4", through a polite live region, which is quiet while a slideshow plays. Change the wording with the `announcement` label; see [Languages and direction](./languages.md).

## Add-ons

The thumbnails and the sheet have their own entries. Turn one on with its option and the fluidbox loads its entry; import the entry to bundle it up front:

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/thumbnails";
import "@ogdakke/fluidbox/thumbnails.css";
import "@ogdakke/fluidbox/sheet";
import "@ogdakke/fluidbox/sheet.css";

const fluidbox = createFluidbox({
  items: photos,
  thumbnails: true,
  sheet: {
    snapPoints: ["40%", "90%"],
    render({ item, target }) {
      target.textContent = item.id ?? "";
    },
  },
});
```

An open waits for an entry that is still loading. [Thumbnails and sheet](./thumbnails-and-sheet.md) has every option. The media add-ons (embeds, spins and 3D models) are slides you pass to `slides`; see [Product media](./product-media.md).

## Patterns

| Pattern                                            | In plain JavaScript                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [Gallery](./patterns/basic.md)                     | `createFluidbox({ items })` and `fluidbox.bind(button, index)`.                         |
| [One trigger for an album](./patterns/overlay.md)  | `bind(cover, album, { onPreviewChange })`, and `bindOverlay(count, album, { flight })`. |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` inside the trigger.                                              |
| [Custom content](./patterns/renderers.md)          | `slides: { note }`, a slide renderer for the item type `"note"`.                        |
| [Programmatic control](./patterns/programmatic.md) | `open(2)`, `subscribe`, and `beforevaluechange` with `preventDefault()`.                |
| [Zoom](./patterns/zoom.md)                         | `zoom: { step, max }` or `zoom: false`.                                                 |
| [Thumbnails](./patterns/thumbnails.md)             | `thumbnails: true`, or `thumbnails: { render }`.                                        |
| [Sheet](./patterns/sheet.md)                       | `sheet: { snapPoints, render }`, `fluidbox.sheet.setSnap(snap)` and `sheetchange`.      |
| [Headless controls](./patterns/headless.md)        | A `viewer` renderer that builds your buttons and subscribes to the state.               |
| [Right to left](./patterns/rtl.md)                 | A `dir="rtl"` ancestor of the triggers, and the `labels` option.                        |
| [Photo in the address](./patterns/url.md)          | `open()` and `close()` from `?photo=`, and `valuechange` writing it back.               |
| [Hover zoom](./patterns/zoom.md#hover-zoom)        | `hoverZoom(image, item)` from `@ogdakke/fluidbox/hover-zoom`.                           |
| [Product media](./product-media.md)                | `slides: { embed, spin, model }` from the media add-ons.                                |

## Notes

**Server rendering.** Importing `@ogdakke/fluidbox` has no side effects and touches no browser globals, so it is safe on the server. `createFluidbox()` needs `document`.

**Clean up.** Call `destroy()` when the gallery leaves the page. It releases every binding too, so the functions `bind` returns are for unbinding one trigger early.

**Your own fields.** Items can carry fields of your own: `createFluidbox<Photo>({ items })` with `interface Photo extends FluidboxImageItem { credit: string }`. Every callback, event and state hands back your object, so `state.item?.credit` is typed.
