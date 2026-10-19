---
title: Filmstrip and sheet
section: Guides
order: 6
description: The two optional add-ons, the filmstrip and the sheet, with their imports, every option, sheet stops, the sheetchange event, data-fluidbox-sheet-stop buttons, and sheet.css.
---

# Filmstrip and sheet

Both are optional add-ons with their own entries, so their code loads only when you use them. Import the entry once, anywhere in the browser bundle. Then turn the add-on on with the `filmstrip` and `sheet` options of `createFluidbox`, the `Filmstrip` and `Sheet` parts in each framework, or a `<fluidbox-filmstrip>` or `<fluidbox-sheet>` child of `<fluidbox-gallery>`.

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/filmstrip";
import "@ogdakke/fluidbox/sheet";
import "@ogdakke/fluidbox/styles.css";
import "@ogdakke/fluidbox/filmstrip.css";
import "@ogdakke/fluidbox/sheet.css";

const fluidbox = createFluidbox({
  items: photos,
  filmstrip: true,
  sheet: {
    render({ item, target }) {
      target.textContent = item.id ?? "";
    },
  },
});
```

The entries register the add-ons on import and are safe to import on the server. Turning one on without its import throws an `Error` that names the import, such as `The sheet needs its entry: import "@ogdakke/fluidbox/sheet" once.` `<fluidbox-gallery>` loads them itself when it holds their element.

## Filmstrip

The filmstrip is a strip of thumbnails for a gallery of more than one item. A tap moves to that item, a drag or a wheel scrubs through them, and the strip follows swipes, arrow keys and `open(target)`. It renders only the thumbnails in view, so it works for lazy lists of any size. Its styles are in `@ogdakke/fluidbox/filmstrip.css`.

The strip is viewer content like your own. It mounts beside the viewer's layer, in `[data-fluidbox-addons]`, so a redraw of the layer, or a viewer renderer that clears its `target`, leaves it be. It reveals and dismisses with the layer, as `data-fluidbox-chrome`, and floats over the slides. `filmstrip.css` runs it along the bottom and keeps the photo above it by `--fluidbox-filmstrip-space`. Your CSS on `[data-fluidbox-filmstrip-dock]` puts it anywhere else, over the photo or beside it. Set `--fluidbox-filmstrip-space: 0px` when the photo should run under it.

`--fluidbox-filmstrip-axis: y` on the dialog runs it as a column, down the left unless you move it. The add-on reads the axis from CSS, so a media query can turn a phone's row into a wide screen's column. Its listbox carries `aria-orientation`, and a wheel turned either way scrolls it along.

```css
@media (min-width: 900px) {
  [data-fluidbox-dialog] {
    --fluidbox-filmstrip-axis: y;
  }
}
```

`filmstrip: true` draws each item's thumbnail. An object, `FluidboxFilmstripOptions`, changes that:

| Option   | Type                      | What it does                                                      |
| -------- | ------------------------- | ----------------------------------------------------------------- |
| `render` | `FluidboxRenderer<TItem>` | Fill each thumbnail button yourself instead of the default image. |

`render` gets `{ item, index, target, signal }`. `target` is the thumbnail `<button>`. When the button scrolls out of the rendered window, `signal` aborts and the function you return runs. By default each button holds the item's `thumbnail`, else the full image or the video's poster.

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/filmstrip";

const fluidbox = createFluidbox({
  items: photos,
  filmstrip: {
    render({ index, target }) {
      target.textContent = String(index + 1);
    },
  },
});
```

Each button is a `role="option"` in a listbox named by the `filmstripList` [label](./api.md#labels). It has `data-fluidbox-filmstrip-item`, `data-index`, `aria-selected` and `data-fluidbox-selected` on the current item, and the item's alt text or title as its name. With a thumbnail focused, the arrow keys along the strip step through the items, Home and End go to the ends, and focus follows the selection. The strip carries `data-fluidbox-owns-input`, so its touches, wheel and keys scrub the strip rather than move or close the viewer. A move from the strip has the reason of its input, `"pointer"`, `"wheel"` or `"keyboard"`, and a scrub through it is a [`scrub`](./javascript.md#commands) move.

`render` runs for each button as it enters the strip's rendered window, and its `signal` aborts as the button leaves. The framework `Filmstrip` parts render through it. Put the part in the root, with a child that draws one thumbnail. See the framework pages for each one's form.

<!-- pattern: filmstrip -->

On custom elements, a `<fluidbox-filmstrip>` child adds the strip. Set its `render` property to fill the buttons yourself.

## Sheet

The sheet is a panel that rises from the bottom over the photo, for details, comments or a form. The photo and the sheet share one native scroller with a snap point per stop, so swipes, momentum and rubber-banding are the browser's own. When the sheet reaches the photo, it pushes the photo up with a gap between them. The push is layout, with no animation, so the photo keeps up with the fastest swipe. Import `@ogdakke/fluidbox/sheet.css` with it.

`sheet: true` turns it on with the defaults. An object, `FluidboxSheetOptions`, sets them:

| Option       | Type                             | Default              | What it does                                   |
| ------------ | -------------------------------- | -------------------- | ---------------------------------------------- |
| `snapPoints` | `FluidboxSheetSnapPoint[]`       | `["60%", "content"]` | The stops above the resting one, lowest first. |
| `dismiss`    | `"flight" \| "scroll" \| "none"` | `"flight"`           | What a swipe down on the photo does at rest.   |
| `render`     | `FluidboxRenderer<TItem>`        |                      | Fill the sheet for the item on show.           |

### Stops

Stop `0` is the sheet at rest, either out of sight or showing `--fluidbox-sheet-peek` of itself. Each snap point, a `FluidboxSheetSnapPoint`, adds a stop above it:

- A number is pixels of sheet showing.
- `"40%"` is a percentage of the viewer's height.
- `"content"` is the sheet's own height, so it sits lower when there is little content.

A sheet is always tall enough for its highest pixel or percentage stop. No stop goes above `--fluidbox-sheet-top` from the top of the screen. Stops closer than 24 pixels count as one.

`dismiss` sets what a swipe down on the photo does while the sheet is at rest. `"flight"` closes the viewer with the usual flight home. A second flick down while the sheet is still lowering goes straight into it. `"scroll"` scrolls the photo off the bottom of the screen and closes, and the backdrop fades as it goes. `"none"` keeps the viewer open, as for a caption that always peeks.

### The sheet handle

With the sheet on, `fluidbox.sheet` is a `FluidboxSheet` that you drive and read:

| Member                | What it does                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `stop`                | The stop the sheet rests at: `0`, then one per snap point.                                                                           |
| `set(stop, options?)` | Move to a stop, clamped to the stops there are. `{ animate: false }` jumps. Ignored while the viewer isn't open or the sheet is off. |

Each time the sheet comes to rest at another stop, the fluidbox fires `sheetchange`, a `FluidboxSheetEvent` with `stop` and `reason`. The reason is `"pointer"` for a swipe or a tap, `"wheel"` for a wheel or trackpad, `"keyboard"` for Escape or a key on a stop button, `"api"` for `set()` and for the return to rest as the viewer opens or closes.

```ts
fluidbox.addEventListener("sheetchange", ({ stop, reason }) => {
  console.log(`sheet at stop ${stop}, by ${reason}`);
});
```

In the frameworks, `useFluidboxSheet()` returns `{ stop, set }`, with `stop` in the framework's reactive form. The root takes the event as `onSheetChange`, `@sheetchange` or `(sheetChange)`, and a `SheetStop` part is a button that moves the sheet to its `stop`. On custom elements, `gallery.sheet` is the handle and the gallery fires `sheetchange`.

### The sheet's content

The sheet is a `<section data-fluidbox-sheet data-fluidbox-chrome>` that the runtime makes, named by the `sheet` [label](./api.md#labels). `render({ item, index, target, signal })` fills it for the item on show. When the viewer moves to another item, `signal` aborts, the returned function runs, and the runtime empties the section before the next item's render. The framework `Sheet` parts render through it, so their children re-render with the app's state, and they put their own attributes on the section.

`<fluidbox-sheet>` shows the active item's `<template slot="sheet">`, else its own `<template>`. Set its `render` property to draw the sheet yourself. Its `snap-points` and `dismiss` attributes are the options: `<fluidbox-sheet snap-points="40% 90%" dismiss="scroll">`.

Put these inside the sheet element:

| Attribute                    | Effect                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `data-fluidbox-sheet-handle` | Draws a grab bar. Make it the sheet's first child.                                          |
| `data-fluidbox-sheet-scroll` | The part that scrolls once the sheet is at its top stop. Without one, the whole sheet does. |

Below the top stop, a swipe anywhere on the sheet moves the sheet. At the top stop its content scrolls, and a pull down from the top of the content carries on into the sheet. Put padding on an inner element, not on `[data-fluidbox-sheet]`.

<!-- pattern: sheet -->

### Stop buttons

Any element in the viewer with `data-fluidbox-sheet-stop="N"` moves the sheet to stop `N` when clicked, such as a "Details" button in the viewer's layer or a reply count. Clicked again at that stop, it lowers the sheet to `0`. This works in every entry point, as plain markup. The runtime keeps `aria-expanded` on every stop button, and moves focus into the sheet once it settles at a raised stop. When the sheet goes out of sight, it becomes `inert`, and focus inside it goes back to the button or the dialog.

```html
<button type="button" data-fluidbox-sheet-stop="1">Details</button>
```

With the sheet raised, Escape and a tap above the sheet lower it instead of closing the viewer. Keys typed in the sheet's fields stay there, so the arrow keys don't change the slide. A tap in a field focuses it without the page panning, and the sheet makes room for the software keyboard. Zoom works only with the sheet at rest.

### sheet.css

`@ogdakke/fluidbox/sheet.css` holds the sheet's layout and its variables. Set them on `[data-fluidbox-dialog]`. The defaults have no weight, so any selector wins. The runtime reads the first five, so they can change in a media query.

| Variable                      | Default                                      | What it does                                                                                                             |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `--fluidbox-sheet-enabled`    | `1`                                          | `0` turns the sheet off, as for a wide screen with a sidebar instead.                                                    |
| `--fluidbox-sheet-photo`      | `push`                                       | `push` slides the photo up ahead of the sheet; `fit` shrinks it into the room above, with a scroll-driven animation.     |
| `--fluidbox-sheet-peek`       | `0px`                                        | How much of the sheet shows at rest. Also the stage's bottom inset.                                                      |
| `--fluidbox-sheet-gap`        | `12px`                                       | Space between the photo and the sheet.                                                                                   |
| `--fluidbox-sheet-fit-inset`  | `0px`                                        | With `fit`, space the photo keeps clear above and beside it.                                                             |
| `--fluidbox-sheet-fit-limit`  | `55%`                                        | With `fit`, how much the sheet covers before the photo stops shrinking and rises. A length or a percentage of the stage. |
| `--fluidbox-sheet-top`        | `calc(env(safe-area-inset-top, 0px) + 56px)` | Space above the sheet at its tallest.                                                                                    |
| `--fluidbox-sheet-radius`     | `18px`                                       | The top corners.                                                                                                         |
| `--fluidbox-sheet-max-width`  | `640px`                                      | The sheet's widest.                                                                                                      |
| `--fluidbox-sheet-background` | `Canvas`                                     | The sheet's background.                                                                                                  |
| `--fluidbox-sheet-color`      | `CanvasText`                                 | The sheet's text colour.                                                                                                 |
| `--fluidbox-sheet-fade`       | `1`                                          | How much the photo fades between the first and the top stop. `0` keeps it.                                               |

As the sheet moves, these variables on the overlay follow its scroll. Use them for your own effects:

| Variable                    | Value                                                            |
| --------------------------- | ---------------------------------------------------------------- |
| `--fluidbox-sheet-visible`  | Pixels of the sheet showing.                                     |
| `--fluidbox-sheet-progress` | `0` at rest to `1` at the first stop.                            |
| `--fluidbox-sheet-expand`   | `0` at the first stop to `1` at the top stop.                    |
| `--fluidbox-sheet-dismiss`  | `1` with the photo scrolled away to `0` at rest, for `"scroll"`. |

The dialog gets `data-sheet` with the stop number, `data-sheet-raised` above stop `0`, `data-sheet-expanded` at the top stop, `data-sheet-peeking` while the peek is above zero and `data-sheet-off` while the sheet is turned off. The overlay gets `data-sheet-dismiss` with the `dismiss` option.

```css
[data-fluidbox-dialog] .caption {
  opacity: clamp(0, 1 - var(--fluidbox-sheet-progress) * 2.5, 1);
}

@media (min-width: 900px) {
  [data-fluidbox-dialog]:has(.replies) {
    --fluidbox-sheet-enabled: 0;
    --fluidbox-stage-right: 360px;
  }
}
```

In a browser without scroll-driven animations, the sheet still scrolls, snaps and pushes the photo. With `fit`, the photo keeps its size behind it.
