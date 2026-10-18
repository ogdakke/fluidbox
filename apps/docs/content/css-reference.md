---
title: CSS reference
section: Reference
order: 2
---

# CSS reference

The public styling surface: part selectors, state hooks, theme inputs, and the variables the runtime publishes. Anything else the runtime renders is an implementation detail.

## Parts

| Selector                                                                    | Part                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `[data-fluidbox-trigger]`                                                   | Element that opens the lightbox                                  |
| `[data-fluidbox-preview]`                                                   | Optional preview box used for handoff geometry                   |
| `[data-fluidbox-target]`                                                    | Preferred handoff target inside a custom preview                 |
| `[data-fluidbox-overlay]`                                                   | Body-level portal root                                           |
| `[data-fluidbox-container]`                                                 | Gesture and layout container                                     |
| `[data-fluidbox-backdrop]`                                                  | Modal backdrop                                                   |
| `[data-fluidbox-dialog]`                                                    | Accessible dialog                                                |
| `[data-fluidbox-portal]`                                                    | Application controls and caption mount target                    |
| `[data-fluidbox-slides]`                                                    | Native horizontal gallery scroller                               |
| `[data-fluidbox-slide]`                                                     | Gallery item                                                     |
| `[data-fluidbox-frame]`                                                     | Cropping and radius frame                                        |
| `[data-fluidbox-media]`                                                     | Media element                                                    |
| `[data-fluidbox-media-cover]`                                               | Snapshot shown over an iframe until it loads and while it closes |
| `[data-fluidbox-content]`                                                   | Arbitrary standalone content wrapper                             |
| `[data-fluidbox-item-content]`                                              | Arbitrary gallery item                                           |
| `[data-fluidbox-close]`, `[data-fluidbox-previous]`, `[data-fluidbox-next]` | Default controls                                                 |
| `[data-fluidbox-icon]`                                                      | SVG icon inside a default control                                |
| `[data-fluidbox-chrome]`                                                    | Your own floating layer in the portal; see Stage and chrome      |
| `[data-fluidbox-filmstrip]`                                                 | Filmstrip root                                                   |
| `[data-fluidbox-filmstrip-scroll]`                                          | Filmstrip scroller                                               |
| `[data-fluidbox-filmstrip-item]`                                            | Filmstrip option                                                 |
| `[data-fluidbox-transition-layer]`                                          | Authored content that travels with an item                       |
| `[data-fluidbox-transition-content]`                                        | Portalled transition content plane                               |

## State hooks

| Hook                                                    | On                    | Meaning                                                |
| ------------------------------------------------------- | --------------------- | ------------------------------------------------------ |
| `data-fluidbox-state`                                   | Host, overlay, dialog | `closed`, `opening`, `open`, or `closing`              |
| `[data-open]`, `[data-closed]`                          | Host, overlay, dialog | Presence versions of the state                         |
| `[data-starting-style]`, `[data-ending-style]`          | Overlay, dialog       | Opening and closing                                    |
| `[data-dragging]`, `[data-dismissing]`, `[data-zoomed]` | Dialog                | Gesture and zoom state                                 |
| `[data-fluidbox-gallery]`, `[data-filmstrip]`           | Dialog                | Multi-item gallery; filmstrip present                  |
| `data-fluidbox-phase`                                   | Transition layers     | `preview`, `opening`, `open`, `dragging`, or `closing` |
| `aria-hidden`                                           | Slides                | `false` on the active slide                            |
| `aria-selected`                                         | Filmstrip items       | `true` on the active item                              |

## Theme inputs

Read from the opening element and copied onto the portal: `--background`, `--color`, `--accent`, `--primary`, `--border`, `--radius`.

Read from `:root` or the overlay: `--layer-fluidbox`, `--layer-fluidbox-flight`, `--fluidbox-backdrop-background`, `--fluidbox-filmstrip-dock-background`, `--fluidbox-filmstrip-zoom-duration`, `--fluidbox-filmstrip-zoom-travel`.

`--fluidbox-backdrop-filter` sets the backdrop's `backdrop-filter`, `none` by default. Pair it with a translucent `--fluidbox-backdrop-background`, for example `blur(24px) saturate(1.5)`; iOS 26 Safari then shows the blurred page behind its bars.

`[data-fluidbox-container]` is `position: absolute` at the page's scroll position, which the runtime sets as `--fluidbox-scroll-top`. Don't make it sticky or fixed: iOS 26 Safari tints its bars from a sticky or fixed layer at the screen's edge, using colours from anywhere inside it.

While zoomed, the image can pan under the browser's own bars. On touch screens the zoom viewport reaches past the window by the difference between the screen and window heights, which covers iOS Safari's status bar and toolbar wherever they sit. Set `--fluidbox-zoom-bleed` on `:root` or the overlay to choose the reach yourself, or `0px` to keep the image inside the window.

`--fluidbox-slide-gap` adds space between gallery slides, shown only while swiping; images stay full-bleed. It is `0` by default. Set it on the opening element, `:root`, or the overlay; like every `--fluidbox-*` property on the opening element, it is copied onto the portal.

Closed previews read `--fluidbox-preview-width`, `--fluidbox-preview-height`, and `--fluidbox-preview-aspect`.

## Stage and chrome

The stage is the part of the dialog the photo fits into. By default it is the whole dialog. Set `--fluidbox-stage-top`, `--fluidbox-stage-right`, `--fluidbox-stage-bottom`, and `--fluidbox-stage-left` on the dialog to make room for a sidebar, an action row, or margins. The photo fits and centres in the stage, opening and closing flights land there, zoom centres inside it, and the default arrows and close button sit against its edges. The insets are registered lengths, so you can transition them.

```css
[data-fluidbox-dialog]:has(.replies) {
  --fluidbox-stage-right: 360px;
  --fluidbox-stage-bottom: 56px;
}
```

Mark your own floating layers in `[data-fluidbox-portal]` with `data-fluidbox-chrome`, such as a sidebar, an action row, or a caption. They behave like the default controls: hidden during the opening flight, revealed as it lands, and faded out when a dismiss starts by drag, Escape, or the close button. A cancelled drag brings them back. If you set your own `transition` on a chrome layer, include `opacity`.

Zoomed in, the photo pans under the insets, so a see-through action row or caption floats over it; panned to the end, its edges still stop at the stage's. Set `--fluidbox-zoom-clip` on the dialog to keep it inside the stage instead: `stage` clips every side, or list the sides, such as `right` behind an opaque sidebar or `top bottom`.

```css
[data-fluidbox-dialog]:has(.replies) {
  --fluidbox-zoom-clip: right;
}
```

To attach something to the photo, read `--fluidbox-media-width` and `--fluidbox-media-height` on the dialog. Together with the stage insets they place the photo: it is centred in the stage.

## Runtime-owned variables

Read these to synchronize your own effects. Do not set them; inline values or Web Animations control the active pose.

| Variable                                                        | Published on                  | Value                                                          |
| --------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| `--fluidbox-progress`                                           | Transition layers and content | `1` at the preview pose, `0` open. Inherits to children.       |
| `--fluidbox-dismiss-progress`                                   | Overlay                       | `0`–`1` during a pointer dismissal; capped at `0.6` for wheel. |
| `--fluidbox-drag-x`, `--fluidbox-drag-y`                        | Overlay                       | Drag displacement in pixels.                                   |
| `--fluidbox-frame-transform`, `--fluidbox-frame-radius`         | Frame                         | Crop pose transform and radius.                                |
| `--fluidbox-media-transform`                                    | Media                         | Media pose, also updated by zoom.                              |
| `--fluidbox-backdrop-opacity`, `--fluidbox-close-opacity`       | Backdrop, close               | Opacity during interactive dismissal.                          |
| `--fluidbox-item-width`, `--fluidbox-item-height`               | Frame                         | Item size constrained to the stage.                            |
| `--fluidbox-media-width`, `--fluidbox-media-height`             | Dialog                        | The active item's drawn size, without flight or zoom.          |
| `--fluidbox-zoom-canvas-width`, `--fluidbox-zoom-canvas-height` | Zoom canvas                   | Geometry while zoomed.                                         |

Authored transition layers can supply `--fluidbox-transition-layer-opacity` and `--fluidbox-transition-content-opacity`, which the runtime copies when it moves content to the body.
