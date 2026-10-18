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
| `[data-lightbox-trigger]`                                                   | Element that opens the lightbox                                  |
| `[data-lightbox-preview]`                                                   | Optional preview box used for handoff geometry                   |
| `[data-lightbox-target]`                                                    | Preferred handoff target inside a custom preview                 |
| `[data-lightbox-overlay]`                                                   | Body-level portal root                                           |
| `[data-lightbox-container]`                                                 | Gesture and layout container                                     |
| `[data-lightbox-backdrop]`                                                  | Modal backdrop                                                   |
| `[data-lightbox-dialog]`                                                    | Accessible dialog                                                |
| `[data-lightbox-portal]`                                                    | Application controls and caption mount target                    |
| `[data-lightbox-slides]`                                                    | Native horizontal gallery scroller                               |
| `[data-lightbox-slide]`                                                     | Gallery item                                                     |
| `[data-lightbox-frame]`                                                     | Cropping and radius frame                                        |
| `[data-lightbox-media]`                                                     | Media element                                                    |
| `[data-lightbox-media-cover]`                                               | Snapshot shown over an iframe until it loads and while it closes |
| `[data-lightbox-content]`                                                   | Arbitrary standalone content wrapper                             |
| `[data-lightbox-item-content]`                                              | Arbitrary gallery item                                           |
| `[data-lightbox-close]`, `[data-lightbox-previous]`, `[data-lightbox-next]` | Default controls                                                 |
| `[data-lightbox-icon]`                                                      | SVG icon inside a default control                                |
| `[data-lightbox-filmstrip]`                                                 | Filmstrip root                                                   |
| `[data-lightbox-filmstrip-scroll]`                                          | Filmstrip scroller                                               |
| `[data-lightbox-filmstrip-item]`                                            | Filmstrip option                                                 |
| `[data-lightbox-transition-layer]`                                          | Authored content that travels with an item                       |
| `[data-lightbox-transition-content]`                                        | Portalled transition content plane                               |

## State hooks

| Hook                                                    | On                    | Meaning                                                |
| ------------------------------------------------------- | --------------------- | ------------------------------------------------------ |
| `data-lightbox-state`                                   | Host, overlay, dialog | `closed`, `opening`, `open`, or `closing`              |
| `[data-open]`, `[data-closed]`                          | Host, overlay, dialog | Presence versions of the state                         |
| `[data-starting-style]`, `[data-ending-style]`          | Overlay, dialog       | Opening and closing                                    |
| `[data-dragging]`, `[data-dismissing]`, `[data-zoomed]` | Dialog                | Gesture and zoom state                                 |
| `[data-lightbox-gallery]`, `[data-filmstrip]`           | Dialog                | Multi-item gallery; filmstrip present                  |
| `data-lightbox-phase`                                   | Transition layers     | `preview`, `opening`, `open`, `dragging`, or `closing` |
| `aria-hidden`                                           | Slides                | `false` on the active slide                            |
| `aria-selected`                                         | Filmstrip items       | `true` on the active item                              |

## Theme inputs

Read from the opening element and copied onto the portal: `--background`, `--color`, `--accent`, `--primary`, `--border`, `--radius`.

Read from `:root` or the overlay: `--layer-lightbox`, `--layer-lightbox-flight`, `--lightbox-backdrop-background`, `--lightbox-filmstrip-dock-background`, `--lightbox-filmstrip-zoom-duration`, `--lightbox-filmstrip-zoom-travel`.

Closed previews read `--lightbox-preview-width`, `--lightbox-preview-height`, and `--lightbox-preview-aspect`.

## Runtime-owned variables

Read these to synchronize your own effects. Do not set them; inline values or Web Animations control the active pose.

| Variable                                                        | Published on                  | Value                                                          |
| --------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| `--lightbox-progress`                                           | Transition layers and content | `1` at the preview pose, `0` open. Inherits to children.       |
| `--lightbox-dismiss-progress`                                   | Overlay                       | `0`–`1` during a pointer dismissal; capped at `0.6` for wheel. |
| `--lightbox-drag-x`, `--lightbox-drag-y`                        | Overlay                       | Drag displacement in pixels.                                   |
| `--lightbox-frame-transform`, `--lightbox-frame-radius`         | Frame                         | Crop pose transform and radius.                                |
| `--lightbox-media-transform`                                    | Media                         | Media pose, also updated by zoom.                              |
| `--lightbox-backdrop-opacity`, `--lightbox-close-opacity`       | Backdrop, close               | Opacity during interactive dismissal.                          |
| `--lightbox-item-width`, `--lightbox-item-height`               | Frame                         | Item size constrained to the viewport.                         |
| `--lightbox-zoom-canvas-width`, `--lightbox-zoom-canvas-height` | Zoom canvas                   | Geometry while zoomed.                                         |

Authored transition layers can supply `--lightbox-transition-layer-opacity` and `--lightbox-transition-content-opacity`, which the runtime copies when it moves content to the body.
