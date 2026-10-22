---
title: Styling
section: Guides
order: 5
description: How to theme the fluidbox viewer and style its parts with data attributes and CSS variables, add your own controls and chrome, respect reduced motion, and work with the viewer's body-level layer.
---

# Styling

The viewer has no class names. You style it through data attributes and CSS custom properties. The package's own rules have as little weight as they can, so a rule of yours with the same selector wins. Every hook is listed in the [CSS reference](./css-reference.md).

## Order

Import the package CSS first, then yours:

```ts
import "@ogdakke/fluidbox/styles.css";
import "./gallery-theme.css";
```

The package wraps the viewer's rules in `:where([data-fluidbox-overlay], [data-fluidbox-flight])`, which adds nothing to their specificity. A later rule on the same part overrides the default:

```css
[data-fluidbox-close] {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}
```

The package declares the filmstrip's and the sheet's variables on the dialog with no weight at all, so set them on `[data-fluidbox-dialog]`:

```css
[data-fluidbox-dialog] {
  --fluidbox-filmstrip-item-size: 64px;
  --fluidbox-sheet-peek: 120px;
}
```

## The viewer layer

While it is open, the viewer is one element, `[data-fluidbox-overlay]`, at the end of `<body>`. It is not inside your component, so it doesn't inherit your component's styles or CSS variables. Inside it:

<!-- css: parts data-fluidbox-overlay data-fluidbox-backdrop data-fluidbox-container data-fluidbox-dialog data-fluidbox-slides data-fluidbox-slide data-fluidbox-frame data-fluidbox-media data-fluidbox-portal data-fluidbox-addons -->

While the viewer is open, every other child of `<body>` is `inert`. The overlay's z-index is `var(--layer-fluidbox, 7)` and the flight's is `var(--layer-fluidbox-flight, 8)`. Set both on `:root` if your page has higher layers.

The container is `position: absolute` at the page's scroll position. Don't make it `fixed` or `sticky`, because iOS Safari colours its bars from a fixed or sticky layer at the screen's edge.

## Theme

When the viewer opens, it reads the trigger's computed styles and copies every `--fluidbox-*` property onto the overlay. Set them on `:root`, on a section, or on one trigger, and the viewer uses what that trigger inherits:

<!-- css: theme -->

```css
.gallery {
  --fluidbox-background: #0a0a0a;
  --fluidbox-color: #ededee;
  --fluidbox-control-background: #232326;
  --fluidbox-backdrop-background: rgb(10 10 10 / 0.72);
  --fluidbox-backdrop-filter: blur(24px) saturate(1.5);
  --fluidbox-slide-gap: 24px;
}
```

`--fluidbox-backdrop-background` defaults to `--fluidbox-background`. `--fluidbox-backdrop-filter` is `none` by default. Pair a blur with a see-through background.

## State attributes

Attribute names follow one rule. Parts of the viewer, and the markers you put on your own elements, are `data-fluidbox-*`, such as `[data-fluidbox-dialog]` and `data-fluidbox-origin`. State on the viewer's own elements is a plain flag, such as `data-open` or `data-zoomed`. State on your elements, a trigger or a thumbnail overlay, is `data-fluidbox-*`, so it never clashes with your own attributes. `data-fluidbox-status` is the one name on both, since the active trigger mirrors the viewer.

The overlay and the dialog both carry the viewer's state:

<!-- css: states data-fluidbox-status data-open data-closed data-starting-style data-opening data-ending-style data-dragging data-dismissing -->

The dialog alone also has `data-zoomed` while an image is zoomed, and `data-gallery` when there is more than one item. Style a dialog that holds a filmstrip with `[data-fluidbox-dialog]:has([data-fluidbox-filmstrip])`.

```css
[data-fluidbox-dialog][data-zoomed] .caption {
  opacity: 0;
}
```

The trigger of the open item gets `data-fluidbox-status="open"` and `data-open`. Every trigger has `data-fluidbox-trigger` and `aria-haspopup="dialog"`. It has no `aria-expanded`: the viewer is a modal dialog, not something the trigger expands.

## Controls

The default controls are buttons marked `data-fluidbox-previous`, `data-fluidbox-next` and `data-fluidbox-close`, each holding an SVG marked `data-fluidbox-icon`. Close sits in the top-right corner. With more than one item, Previous and Next sit at the middle of each side. All three keep 16 pixels inside the stage. A disabled Previous or Next fades to `--fluidbox-gallery-control-opacity: 0.35`.

You choose which controls exist:

- **Plain JavaScript.** You get all three unless you pass `viewer`. Then `controls: true`, or a list such as `controls: ["close"]`, keeps some next to your own content.
- **Frameworks.** Put the `Controls` part, or `Previous`, `Next` and `Close`, in the `Viewer` part. Without them there are no controls. Each renders the default icon and label when it is empty, or your children.
- **Custom elements.** The gallery adds all three. A `<template slot="viewer">` replaces them. Put `<fluidbox-controls>` in it to keep them. Any button marked `data-fluidbox-close`, `-previous` or `-next` in the viewer runs that command, in every API.

The button names come from the `close`, `previous` and `next` [labels](./api.md#labels).

### Your own controls

You can render anything into the viewer's layer, such as a caption bar, a counter or a share button. Read the state and call the commands. [Headless controls](./patterns/headless.md) has a full caption bar in every framework.

Everything you put in the layer behaves like the default controls: hidden during the opening flight, shown as it lands, faded out as soon as a close or a drag starts, and back if the drag is cancelled. Mark a layer outside it `data-fluidbox-chrome` to get the same. If you give a chrome layer your own `transition`, include `opacity`.

### The stage

The stage is the part of the dialog the media fits into. By default it is all of it. Inset it with `--fluidbox-stage-top`, `--fluidbox-stage-right`, `--fluidbox-stage-bottom` and `--fluidbox-stage-left` on the dialog, to make room for a sidebar or an action row. The media centres in the stage, flights land there, and the default controls keep to its edges. The insets are registered lengths, so they can transition.

```css
[data-fluidbox-dialog]:has(.replies) {
  --fluidbox-stage-right: 360px;
}
```

A zoomed image still pans under the insets, so a see-through bar floats over it. `--fluidbox-zoom-clip` on the dialog keeps it inside them: `stage` for every side, or a list of sides such as `right` or `top bottom`. To place something against the picture, read `--fluidbox-media-width` and `--fluidbox-media-height` on the dialog. The picture is centred in the stage.

## Thumbnail overlays

A badge, a play icon or a count on a thumbnail can follow the flight. Make it a thumbnail overlay: `fluidbox.bindOverlay()` in plain JavaScript, the `ThumbnailOverlay` part in the frameworks, `data-fluidbox-thumbnail-overlay` inside a `<fluidbox-item>` trigger.

- By default the overlay stays on the thumbnail.
- With `travel`, it flies with the photo and fades as the flight lands. What flies is a copy of its content, or live content that a renderer draws into the flying frame. On the custom elements, `data-fluidbox-thumbnail-overlay="travel"`.

The runtime sets `--fluidbox-closed` on the overlay, from `1` at the thumbnail to `0` fully open, and `data-fluidbox-phase` to `idle`, `opening`, `open`, `dragging` or `closing`:

```css
.photo-count {
  opacity: var(--fluidbox-closed, 1);
}
```

While an item is open, its thumbnail image on the page gets `data-fluidbox-thumbnail-hidden`, so it doesn't show twice.

## Reduced motion

With `prefers-reduced-motion: reduce`, the viewer opens and closes without flights, moves between slides without smooth scrolling, zooms and moves the sheet without animation, and its controls and filmstrip appear without fading. You don't need to set anything. Do the same for your own chrome:

```css
@media (prefers-reduced-motion: reduce) {
  .caption {
    transition: none;
  }
}
```

## Triggers

`<fluidbox-item>` triggers get a reset: no border, background or padding, `display: block`, `cursor: zoom-in`. The package wraps the reset in `:where()`, so your classes win. The framework triggers render a plain `<button type="button">` with no styles, or decorate your own element, and `fluidbox.bind()` leaves your element's styles alone.
