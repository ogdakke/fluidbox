---
title: CSS reference
section: Reference
order: 2
description: Every CSS custom property, part selector and state attribute fluidbox exposes in styles.css and sheet.css, with defaults and where each is set or read.
---

# CSS reference

The custom properties, parts and state attributes of `@ogdakke/fluidbox/styles.css` and `@ogdakke/fluidbox/sheet.css`. [Styling](./styling.md) explains how to use them. The stylesheets use other `--fluidbox-*` properties and data attributes internally; anything not listed here can change without notice.

`styles.css` wraps the viewer's rules in `:where([data-fluidbox-overlay], [data-fluidbox-flight])`, so a rule of yours on the same part wins when it comes later. The filmstrip's and the sheet's defaults, declared on the dialog, sit wholly inside `:where()`, so `[data-fluidbox-dialog] { … }` overrides them in any order. When the viewer opens, it copies every `--fluidbox-*` property on the trigger onto the overlay as inline styles. So you can set most inputs on `:root`, on the trigger or an ancestor of it, or on `[data-fluidbox-overlay]`; set the ones declared on the dialog on `[data-fluidbox-dialog]`.

## Theme variables

| Variable                           | Default                | Used for                                                                                   |
| ---------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `--fluidbox-background`            | `#111`                 | The backdrop (through `--fluidbox-backdrop-background`), the close button, error messages. |
| `--fluidbox-color`                 | `white`                | Text and icons.                                                                            |
| `--fluidbox-control-background`    | `rgb(20 20 20 / 0.72)` | The Previous and Next buttons; the close button on hover.                                  |
| `--fluidbox-focus-color`           | `currentColor`         | Focus rings on the controls, filmstrip items, the dialog and `<fluidbox-item>` triggers.   |
| `--fluidbox-filmstrip-item-radius` | `3px`                  | The corners of filmstrip thumbnails.                                                       |

An error message without `--fluidbox-background` and `--fluidbox-color` set is black on white.

## Inputs

Properties you set. Each is read where the table says, and inherits there from any ancestor unless noted.

| Property                                             | Default                                                              | Read on                            | What it does                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `--layer-fluidbox`                                   | `7` (on `:root`)                                                     | Overlay                            | The overlay's `z-index`.                                                                                         |
| `--layer-fluidbox-flight`                            | `8` (on `:root`)                                                     | Flight                             | The `z-index` of flights and travelling overlays.                                                                |
| `--fluidbox-backdrop-background`                     | `var(--fluidbox-background, #111)`                                   | Backdrop                           | The backdrop's `background`.                                                                                     |
| `--fluidbox-backdrop-filter`                         | `none`                                                               | Backdrop                           | The backdrop's `backdrop-filter`, such as `blur(24px)`.                                                          |
| `--fluidbox-backdrop-opacity`                        | `1`                                                                  | Backdrop                           | The backdrop's resting opacity.                                                                                  |
| `--fluidbox-image-placeholder-background`            | `rgb(127 127 127 / 0.12)`                                            | Image frames                       | Shown behind an image before anything has loaded.                                                                |
| `--fluidbox-slide-gap`                               | `0px`                                                                | Slides                             | Space between slides, seen only while swiping.                                                                   |
| `--fluidbox-stage-top`, `-right`, `-bottom`, `-left` | `0px`                                                                | Dialog                             | Insets of the stage the media fits into. Registered `<length>`s, so they can transition.                         |
| `--fluidbox-zoom-clip`                               | none                                                                 | Dialog                             | Keeps a zoomed image inside the stage insets: `stage`, or sides such as `right` or `top bottom`.                 |
| `--fluidbox-zoom-bleed`                              | the browser's bar height on touch screens, else `0px`                | Zoom viewport                      | How far a zoomed image pans past the window's top and bottom. `0px` keeps it inside.                             |
| `--fluidbox-gallery-control-opacity`                 | `1`; `0.35` when disabled                                            | Previous, Next, Close              | The default controls' opacity.                                                                                   |
| `--fluidbox-filmstrip-axis`                          | `x`                                                                  | Dialog                             | `y` runs the filmstrip as a column. The add-on reads it, so a media query can change it.                         |
| `--fluidbox-filmstrip-item-size`                     | `52px`; `38px` on touch                                              | Dialog                             | The thumbnails' size. The strip's height and its end padding follow it, so the first and last thumbnails centre. |
| `--fluidbox-filmstrip-gap`                           | `5px`; `3px` on touch                                                | Dialog                             | Space between thumbnails.                                                                                        |
| `--fluidbox-filmstrip-space`                         | the item size plus `32px` (`30px` on touch) and the bottom safe area | Dialog                             | The room a row keeps below the photo. `0px` lets the photo run under it.                                         |
| `--fluidbox-filmstrip-zoom-duration`                 | `180ms`                                                              | Filmstrip                          | How fast the strip hides and returns, as on zoom.                                                                |
| `--fluidbox-filmstrip-zoom-travel`                   | `18px`                                                               | Filmstrip                          | How far the strip drops as it hides.                                                                             |
| `--fluidbox-preview-width`                           | `100%`                                                               | `<fluidbox-item>` trigger          | The closed trigger's width.                                                                                      |
| `--fluidbox-preview-height`                          | `auto`                                                               | `<fluidbox-item>` trigger          | The closed trigger's height.                                                                                     |
| `--fluidbox-layer-color`                             | `transparent`                                                        | `[data-fluidbox-transition-layer]` | A colour behind the layer's content.                                                                             |
| `--fluidbox-layer-mask-opacity`                      | `1`                                                                  | `[data-fluidbox-transition-layer]` | The opacity of that colour.                                                                                      |
| `--fluidbox-transition-layer-opacity`                | `var(--fluidbox-closed)`                                             | `[data-fluidbox-transition-layer]` | The layer's opacity during a flight.                                                                             |
| `--fluidbox-transition-content-opacity`              | fades in near the thumbnail                                          | Travelling overlay copy            | The copy's opacity during a flight.                                                                              |

### Sheet inputs

From `sheet.css`, declared on the dialog at zero specificity. Override them on `[data-fluidbox-dialog]`. The runtime reads the first five.

| Property                      | Default                                      | What it does                                                                                         |
| ----------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `--fluidbox-sheet-enabled`    | `1`                                          | `0` turns the sheet off.                                                                             |
| `--fluidbox-sheet-photo`      | `push`                                       | `push` slides the photo up ahead of the sheet; `fit` shrinks it above the sheet.                     |
| `--fluidbox-sheet-peek`       | `0px`                                        | How much of the sheet shows at rest. Also sets `--fluidbox-stage-bottom`.                            |
| `--fluidbox-sheet-gap`        | `12px`                                       | Space between the photo and the sheet.                                                               |
| `--fluidbox-sheet-fit-inset`  | `0px`                                        | With `fit`, space the photo keeps clear above and beside it.                                         |
| `--fluidbox-sheet-fit-limit`  | `55%` (not declared; the runtime's fallback) | With `fit`, how much the sheet covers before the photo rises. A length or a percentage of the stage. |
| `--fluidbox-sheet-top`        | `calc(env(safe-area-inset-top, 0px) + 56px)` | Space above the sheet at its tallest.                                                                |
| `--fluidbox-sheet-radius`     | `18px`                                       | The sheet's top corners.                                                                             |
| `--fluidbox-sheet-max-width`  | `640px`                                      | The sheet's widest.                                                                                  |
| `--fluidbox-sheet-background` | `Canvas`                                     | The sheet's background.                                                                              |
| `--fluidbox-sheet-color`      | `CanvasText`                                 | The sheet's text colour.                                                                             |
| `--fluidbox-sheet-fade`       | `1` (not declared)                           | How much the photo fades towards the top stop. `0` keeps it.                                         |

## Published values

Set by the runtime. Read them for your own effects; don't set them.

| Property                                            | On                                                       | Value                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `--fluidbox-closed`                                 | Thumbnail overlays, travelling copies, transition layers | `1` at the thumbnail, `0` fully open. A registered `<number>`.                         |
| `--fluidbox-dismiss-progress`                       | Overlay                                                  | `0` to `1` during a drag to dismiss; at most `0.6` for a wheel.                        |
| `--fluidbox-drag-x`, `--fluidbox-drag-y`            | Overlay                                                  | The drag's offset in pixels.                                                           |
| `--fluidbox-media-width`, `--fluidbox-media-height` | Dialog                                                   | The current media's drawn size, without flight or zoom.                                |
| `--fluidbox-height`                                 | Overlay                                                  | The window's inner height in pixels.                                                   |
| `--fluidbox-scroll-top`                             | Overlay                                                  | The page's scroll position, where the container sits.                                  |
| `--fluidbox-content-height`                         | Dialog                                                   | The stage's height: `--fluidbox-height` less the stage insets and the filmstrip space. |
| `--fluidbox-sheet-visible`                          | Overlay                                                  | Pixels of the sheet showing.                                                           |
| `--fluidbox-sheet-progress`                         | Overlay                                                  | `0` at rest to `1` at the first stop.                                                  |
| `--fluidbox-sheet-expand`                           | Overlay                                                  | `0` at the first stop to `1` at the top stop.                                          |
| `--fluidbox-sheet-dismiss`                          | Overlay                                                  | `1` with the photo scrolled away to `0` at rest (`dismiss: "scroll"`).                 |
| `--fluidbox-sheet-keyboard`                         | Overlay                                                  | Pixels the software keyboard covers, while a sheet field has focus.                    |

The sheet values follow the scroll on the compositor and inherit to everything in the viewer.

## Parts

| Selector                                                                    | Part                                                                                                                                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[data-fluidbox-overlay]`                                                   | The viewer's root, at the end of `<body>` while open.                                                                                                                                          |
| `[data-fluidbox-backdrop]`                                                  | The backdrop.                                                                                                                                                                                  |
| `[data-fluidbox-container]`                                                 | The viewport-sized box at the page's scroll position.                                                                                                                                          |
| `[data-fluidbox-dialog]`                                                    | The dialog, with `role="dialog"` and `aria-modal="true"`.                                                                                                                                      |
| `[data-fluidbox-slides]`                                                    | The horizontal scroller of slides.                                                                                                                                                             |
| `[data-fluidbox-slide]`                                                     | A slide. `aria-hidden="false"` on the current one.                                                                                                                                             |
| `[data-fluidbox-frame]`                                                     | The box that crops and rounds the media.                                                                                                                                                       |
| `[data-fluidbox-image-frame]`                                               | A frame that holds an image.                                                                                                                                                                   |
| `[data-fluidbox-media]`                                                     | The `<img>`, `<video>`, `<iframe>` or custom content element.                                                                                                                                  |
| `[data-fluidbox-item-content]`                                              | A custom slide's content element.                                                                                                                                                              |
| `[data-fluidbox-mount]`                                                     | A framework binding's wrapper inside custom content, with `display: contents`.                                                                                                                 |
| `[data-fluidbox-slide-placeholder]`                                         | The item's `placeholder` image.                                                                                                                                                                |
| `[data-fluidbox-slide-preview]`                                             | The item's `thumbnail` image.                                                                                                                                                                  |
| `[data-fluidbox-media-cover]`                                               | The still over an iframe until it loads.                                                                                                                                                       |
| `[data-fluidbox-error]`                                                     | The "Unable to load media." message with its Retry button.                                                                                                                                     |
| `[data-fluidbox-announcer]`                                                 | A visually hidden live region.                                                                                                                                                                 |
| `[data-fluidbox-portal]`                                                    | The viewer's layer, where your controls and captions go.                                                                                                                                       |
| `[data-fluidbox-addons]`                                                    | Beside the viewer's layer. The filmstrip goes here, so the layer holds only your content. It takes no box.                                                                                     |
| `[data-fluidbox-close]`, `[data-fluidbox-previous]`, `[data-fluidbox-next]` | The controls.                                                                                                                                                                                  |
| `[data-fluidbox-icon]`                                                      | The SVG inside a default control.                                                                                                                                                              |
| `[data-fluidbox-chrome]`                                                    | A layer outside the viewer's layer that shows and hides with the controls. Content in the layer does this already.                                                                             |
| `[data-fluidbox-owns-input]`                                                | Content that keeps its own touches, wheel and arrow keys, as the filmstrip and the sheet do. The viewer doesn't swipe, dismiss or step from them. Mark your own scrubbers and sliders with it. |
| `[data-fluidbox-zoom-viewport]`                                             | The scroller a zoomed image pans in. `data-grabbing` while dragged.                                                                                                                            |
| `[data-fluidbox-filmstrip-dock]`                                            | The filmstrip's box, in `[data-fluidbox-addons]`. Place it with your own CSS.                                                                                                                  |
| `[data-fluidbox-filmstrip]`                                                 | The filmstrip.                                                                                                                                                                                 |
| `[data-fluidbox-filmstrip-scroll]`                                          | Its scroller, `role="listbox"`.                                                                                                                                                                |
| `[data-fluidbox-filmstrip-item]`                                            | A thumbnail button, `role="option"`, with `data-index`.                                                                                                                                        |
| `[data-fluidbox-flight]`                                                    | A flight layer at the end of `<body>`, during opening and closing.                                                                                                                             |
| `[data-fluidbox-transition-content]`                                        | A travelling overlay's copy, in the flight.                                                                                                                                                    |
| `[data-fluidbox-transition-layer]`                                          | Mark a travel overlay's `frameLayer` with it to get the layer styles in Inputs.                                                                                                                |
| `[data-fluidbox-trigger]`                                                   | A trigger, on the page.                                                                                                                                                                        |
| `[data-fluidbox-thumbnail-overlay]`                                         | A thumbnail overlay inside a `<fluidbox-item>` trigger. The value `travel` makes it fly with the photo.                                                                                        |
| `[data-fluidbox-frame-layer]`                                               | A travelling overlay's frame layer. It moves into the flying frame and scales with it.                                                                                                         |
| `[data-fluidbox-ghost]`                                                     | The still copy of a frame layer the page shows in the thumbnail while a flight starts.                                                                                                         |

### Sheet parts

| Selector                         | Part                                                    |
| -------------------------------- | ------------------------------------------------------- |
| `[data-fluidbox-sheet-scroller]` | The scroller the photo and the sheet share.             |
| `[data-fluidbox-sheet-stage]`    | The photos' room inside it.                             |
| `[data-fluidbox-sheet-slot]`     | Where the sheet element goes.                           |
| `[data-fluidbox-sheet]`          | The sheet, a `<section>` that `render` fills.           |
| `[data-fluidbox-sheet-handle]`   | A grab bar you add.                                     |
| `[data-fluidbox-sheet-scroll]`   | The part of the sheet that scrolls at the top stop.     |
| `[data-fluidbox-sheet-stop]`     | A button that moves the sheet to the stop in its value. |

## State attributes

| Attribute                                                           | On                  | Meaning                                             |
| ------------------------------------------------------------------- | ------------------- | --------------------------------------------------- |
| `data-fluidbox-status`                                              | Overlay, dialog     | `closed`, `opening`, `open` or `closing`.           |
| `data-open`, `data-closed`                                          | Overlay, dialog     | Not closed, or closed.                              |
| `data-starting-style`, `data-opening`                               | Overlay, dialog     | Opening.                                            |
| `data-ending-style`                                                 | Overlay, dialog     | Closing.                                            |
| `data-dragging`                                                     | Overlay, dialog     | A drag to dismiss is under way.                     |
| `data-dismissing`                                                   | Overlay, dialog     | Closing, or a drag to dismiss is under way.         |
| `data-zoomed`                                                       | Dialog              | An image is zoomed.                                 |
| `data-gallery`                                                      | Dialog              | There is more than one item.                        |
| `data-sheet`                                                        | Dialog              | The sheet's stop number.                            |
| `data-sheet-raised`, `data-sheet-expanded`                          | Dialog              | The sheet is above stop `0`; at its top stop.       |
| `data-sheet-peeking`, `data-sheet-off`                              | Dialog              | The sheet peeks at rest; the sheet is turned off.   |
| `data-sheet-dismiss`                                                | Overlay             | The sheet's `dismiss` option.                       |
| `data-sheet-dismissed`                                              | Overlay             | A scroll dismiss is committed.                      |
| `data-fluidbox-status`, `data-open`, `data-closed`, `aria-expanded` | The active trigger  | The trigger's item is open.                         |
| `data-fluidbox-thumbnail-hidden`                                    | The trigger's image | Its item is open, so it is hidden.                  |
| `data-fluidbox-phase`                                               | Thumbnail overlays  | `idle`, `opening`, `open`, `dragging` or `closing`. |
| `aria-selected`, `data-fluidbox-selected`                           | Filmstrip items     | The current item.                                   |

## Events

The sheet's stop changes arrive as the `sheetchange` event on the fluidbox and on `<fluidbox-gallery>`, not on an element in the viewer. See [Filmstrip and sheet](./filmstrip-and-sheet.md#the-sheet-handle).
