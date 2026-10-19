---
title: Filmstrip and sheet
section: Guides
order: 6
description: The two optional add-ons, the filmstrip and the sheet, with their imports, every option, slot mode, sheet stops, data-fluidbox-sheet-stop buttons, and sheet.css.
---

# Filmstrip and sheet

Both are optional add-ons with their own entries, so their code loads only when you use them. Import the entry once, anywhere in the browser bundle, and turn the add-on on: the `filmstrip` and `sheet` options of `createFluidbox`, the `Filmstrip` and `Sheet` parts in each framework, or a `<fluidbox-filmstrip>` or `<fluidbox-sheet>` child of `<fluidbox-gallery>`.

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/filmstrip";
import "@ogdakke/fluidbox/sheet";
import "@ogdakke/fluidbox/styles.css";
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

The filmstrip docks a row of thumbnails along the bottom of the viewer when there is more than one item. A tap moves to that item, a drag scrubs through them, and the strip follows swipes, arrow keys and `open(target)`. It renders only the thumbnails in view, so it works for lazy lists of any size. Its styles are in `styles.css`.

`filmstrip: true` draws each item's thumbnail. An object, `FluidboxFilmstripOptions`, changes that:

| Option   | Type                      | What it does                                                                                                  |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `render` | `FluidboxRenderer<TItem>` | Fill each thumbnail button yourself instead of the default image.                                             |
| `slots`  | `boolean`                 | Leave each button empty and list it in the handle's `slots`, for framework components. Ignored with `render`. |

`render` gets `{ item, index, target, signal }`. `target` is the thumbnail `<button>`; `signal` aborts, and the function you return runs, when the button scrolls out of the rendered window. By default each button holds the item's `thumbnail`, else the full image or the video's poster.

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

Each button is a `role="option"` in a listbox named by the `filmstripList` [label](./api.md#labels). It has `data-fluidbox-filmstrip-item`, `data-index`, `aria-selected` and `data-fluidbox-selected` on the current item, and the item's alt text or title as its name. The dialog gets `data-filmstrip` while a strip is docked. A move from the strip has the reason `"filmstrip"`.

### Slot mode

With `slots: true`, `fluidbox.filmstrip` lists the rendered buttons as `slots`, `{ item, index, target }` in index order, and its `subscribe(listener)` calls back when they change. Render your own component into each `target`. The framework `Filmstrip` parts do this for you: put the part in the root, with a child that draws one thumbnail. See the framework pages for each one's form.

<!-- pattern: filmstrip -->

On custom elements, a `<fluidbox-filmstrip>` child adds the strip. Set its `render` property to fill the buttons yourself.

## Sheet

The sheet is a panel that rises from the bottom over the photo, for details, comments or a form. The photo and the sheet share one native scroller with a snap point per stop, so swipes, momentum and rubber-banding are the browser's own. When the sheet reaches the photo, it pushes the photo up, a gap ahead of it, as layout rather than an animation, so the photo keeps up with the fastest swipe. Import `@ogdakke/fluidbox/sheet.css` with it.

`sheet: true` turns it on with the defaults. An object, `FluidboxSheetOptions`, sets them:

| Option       | Type                             | Default              | What it does                                         |
| ------------ | -------------------------------- | -------------------- | ---------------------------------------------------- |
| `snapPoints` | `FluidboxSheetSnapPoint[]`       | `["60%", "content"]` | The stops above the resting one, lowest first.       |
| `dismiss`    | `"flight" \| "scroll" \| "none"` | `"flight"`           | What a swipe down on the photo does at rest.         |
| `render`     | `FluidboxRenderer<TItem>`        |                      | Fill a sheet the runtime makes, for the active item. |

### Stops

Stop `0` is the sheet at rest: out of sight, or showing `--fluidbox-sheet-peek` of itself. Each snap point, a `FluidboxSheetSnapPoint`, adds a stop above it:

- A number is pixels of sheet showing.
- `"40%"` is a percentage of the viewer's height.
- `"content"` is the sheet's own height, so it sits lower when there is little content.

A sheet is always tall enough for its highest pixel or percentage stop. No stop goes above `--fluidbox-sheet-top` from the top of the screen. Stops closer than 24 pixels count as one.

`dismiss` decides a swipe down on the photo with the sheet at rest. `"flight"` closes the viewer with the usual flight home; a second flick down while the sheet is still lowering goes straight into it. `"scroll"` scrolls the photo off the bottom of the screen and closes, and the backdrop fades as it goes. `"none"` keeps the viewer open, as for a caption that always peeks.

### The sheet handle

With the sheet on, `fluidbox.sheet` is a `FluidboxSheet` that you drive and read:

| Member                | What it does                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `stop`                | The stop the sheet rests at: `0`, then one per snap point.                                                                           |
| `set(stop, options?)` | Move to a stop, clamped to the stops there are. `{ animate: false }` jumps. Ignored while the viewer isn't open or the sheet is off. |
| `subscribe(listener)` | Calls `listener(stop)` when the stop changes, and when the slot appears or goes. Returns a function to unsubscribe.                  |
| `slot`                | The element to render your own sheet into, or `null` before the viewer exists.                                                       |

The dialog also dispatches `fluidbox-sheet-change` with `detail.stop`. The event bubbles from `[data-fluidbox-dialog]`.

In the frameworks, `useFluidboxSheet()` returns `{ stop, set }`, with `stop` in the framework's reactive form, and a `SheetStop` part is a button that moves the sheet to its `stop`. On custom elements, `gallery.sheet` is the handle.

### The sheet's content

There are two ways to fill the sheet:

- **`render`.** The runtime makes a `<section data-fluidbox-sheet data-fluidbox-chrome>`, named by the `sheet` [label](./api.md#labels), and calls `render({ item, index, target, signal })` for the current item. `signal` aborts when the viewer moves to another item, and the returned function runs then too.
- **Slot.** Leave `render` out and render one element with `data-fluidbox-sheet` into `fluidbox.sheet.slot`. The framework `Sheet` parts do this, so their children re-render with the app's state.

`<fluidbox-sheet>` shows the active item's `<template slot="sheet">`, else its own `<template>`; set its `render` property to draw the sheet yourself. Its `snap-points` and `dismiss` attributes are the options: `<fluidbox-sheet snap-points="40% 90%" dismiss="scroll">`.

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

`@ogdakke/fluidbox/sheet.css` holds the sheet's layout and its variables. Set them on `[data-fluidbox-dialog]`; the defaults have no weight, so any selector wins. The runtime reads the first five, so they can change in a media query.

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

As the sheet moves, these follow the scroll on the overlay, for your own effects:

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

In a browser without scroll-driven animations, the sheet still scrolls, snaps and pushes the photo; with `fit`, the photo keeps its size behind it.
