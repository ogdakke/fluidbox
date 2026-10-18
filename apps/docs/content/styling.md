---
title: Styling and theming
section: Guides
order: 5
---

# Styling and theming

The viewer is styled through data attributes and CSS variables. There are no generated class names, and every package rule has the lowest weight it can, so your stylesheet wins without `!important`.

## Order

Import the package CSS first, then your overrides:

```ts
import "@ogdakke/fluidbox/styles.css";
import "./fluidbox-theme.css";
```

Viewer rules are rooted at a zero-specificity `:where([data-fluidbox-overlay])`, so a later rule with the same part selector overrides a default:

```css
[data-fluidbox-close] {
  width: 40px;
  height: 40px;
  border-radius: 0;
}
```

## Theme inputs

The open viewer lives in a body-level portal, outside your component tree. When it opens, the runtime reads six computed variables from the opening element and copies them onto the portal:

```css
:root {
  --background: #0a0a0a; /* backdrop and control surfaces */
  --color: #ededee; /* text and icons */
  --accent: #18181a; /* hover and navigation buttons */
  --primary: #ededee; /* focus rings */
  --border: #36363b;
  --radius: 0px; /* control and filmstrip rounding */
}
```

Set them on `:root`, a section, or an individual `fluidbox-item`; whatever the opening element inherits is what the viewer uses. Any other variable must be set on `:root` or on `[data-fluidbox-overlay]` itself, because the portal does not inherit from your component.

## Parts

Style open-viewer parts from `[data-fluidbox-overlay]` or `[data-fluidbox-flight]`, never from the host element. The full list is in the [CSS reference](./css-reference.md); the ones you will reach for most:

| Selector                                                                    | Part                              |
| --------------------------------------------------------------------------- | --------------------------------- |
| `[data-fluidbox-backdrop]`                                                  | Modal backdrop                    |
| `[data-fluidbox-frame]`                                                     | Cropping and radius frame         |
| `[data-fluidbox-close]`, `[data-fluidbox-previous]`, `[data-fluidbox-next]` | Default controls                  |
| `[data-fluidbox-portal]`                                                    | Mount point for your own controls |
| `[data-fluidbox-filmstrip-item]`                                            | Filmstrip thumbnail               |

## State

The overlay and dialog expose `data-fluidbox-state="closed|opening|open|closing"`, plus presence hooks such as `[data-open]`, `[data-starting-style]`, `[data-ending-style]`, `[data-dragging]`, `[data-dismissing]`, and `[data-zoomed]`.

```css
[data-fluidbox-dialog][data-zoomed] [data-fluidbox-portal] {
  opacity: 0;
}
```

## Overlays that move with the image

A badge, play icon, or count on a thumbnail can follow the transition. The runtime publishes `--fluidbox-progress` on overlay elements: `1` at the thumbnail, `0` fully open.

```css
.photo-count {
  opacity: var(--fluidbox-progress, 1);
}
```

- **Host** overlays stay on the card and fade or transform with progress.
- **Travel** overlays render a copy into the transition plane so they ride along with the image.

In React these are `Fluidbox.ThumbnailOverlay behavior="host" | "travel"`. Plain JavaScript uses `controller.registerThumbnailOverlay(id, registration)`.

## Reading motion

Gesture and transition values are published as runtime-owned variables. Read them; never set them.

```css
[data-fluidbox-overlay] [data-fluidbox-close] {
  rotate: calc(var(--fluidbox-dismiss-progress, 0) * 30deg);
}
```
