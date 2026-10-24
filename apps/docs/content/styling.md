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
import "@ogdakke/fluidbox/thumbnails.css"; // with thumbnails
import "@ogdakke/fluidbox/baseline.css"; // optional: the default look
import "./gallery-theme.css";
```

`styles.css`, `thumbnails.css` and `sheet.css` hold what makes the viewer work: layout, the strip, flights, zoom, hidden states and reduced motion. On its own, the viewer has a `Canvas` backdrop and plain text buttons. [`baseline.css`](#baselinecss) adds the default look.

The functional rules are in no cascade layer, so a site's resets can't break them. They select parts by data attribute inside `:where([data-fluidbox-viewer], [data-fluidbox-flight])`, which adds nothing, so most weigh one attribute. That beats an element reset such as Tailwind v3's `img, video { max-width: 100%; height: auto }`, and it is as light as a single class of yours. `baseline.css` is in the `fluidbox-baseline` layer and wholly in `:where()`, so any rule of yours outside a layer beats it, whatever its selector. A rule on the same part overrides the default look:

```css
[data-fluidbox-close] {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}
```

The package declares the thumbnails' and the sheet's variables on the dialog with no weight at all, so set them on `[data-fluidbox-dialog]`:

```css
[data-fluidbox-dialog] {
  --fluidbox-thumbnails-item-size: 64px;
  --fluidbox-sheet-peek: 120px;
}
```

To change how the viewer works rather than how it looks, such as the media's size, match the package's selector or use its custom properties. A reset can't do it by accident.

### Your own layers

A rule in any of your layers beats `baseline.css` if your layer comes later, and the first `@layer` statement a page loads fixes the order. If your CSS has layers, as Tailwind v4's does, name `fluidbox-baseline` with them, once, before any stylesheet loads. Put it before your components and utilities, so they win:

```css
@layer theme, base, fluidbox-baseline, components, utilities;
```

Nothing else depends on it. A layer named later is stronger, and every layer loses to a rule outside any layer, so an unlayered reset of yours beats `baseline.css` too. A reset such as `button { padding: 0 }` or `*, ::after { border-width: 0 }` changes the look: put it in a layer before `fluidbox-baseline`, as Tailwind v4's `base` is above. The functional rules aren't in a layer, so they win over every layer of yours, and resets in them can't touch the mechanics.

The package's few `!important` declarations hide a thumbnail during a flight, keep the flight's source hidden and hand touches back to the page after a dismiss. `baseline.css` has none.

## The viewer layer

While it is open, the viewer is one element, `[data-fluidbox-viewer]`, at the end of `<body>`. It is not inside your component, so it doesn't inherit your component's styles or CSS variables. Inside it:

<!-- css: parts data-fluidbox-viewer data-fluidbox-backdrop data-fluidbox-container data-fluidbox-dialog data-fluidbox-slides data-fluidbox-slide data-fluidbox-frame data-fluidbox-media data-fluidbox-portal data-fluidbox-addons -->

The overlay's z-index is `var(--layer-fluidbox, 7)` and the flight's is `var(--layer-fluidbox-flight, 8)`. Set both on `:root` if your page has higher layers.

### Layers and isolation

While the viewer is open, what was on the page when it opened is `inert`: the other children of `<body>`, and, around anything kept, its neighbours. It keeps live regions (`aria-live`, `role="status"`, `"alert"` or `"log"`), so a toast region still speaks, and anything you mark `data-fluidbox-exempt`, such as the root your popovers, menus or cart drawer render into. What the page adds after the viewer opened, as a toast or a popover opened from the viewer's content, is never made inert, and focus may stay there. As it closes, the viewer takes off only the `inert` it put on.

Opened from inside a modal `<dialog>`, as a quick view's, the overlay goes inside that dialog and into the top layer as a manual popover, with the flights above it, so it shows over the dialog and the dialog stays open and usable behind it. The z-index variables don't apply there: the top layer is above every z-index. Still no native `<dialog>`: the viewer stays a `div` with `role="dialog"` and `aria-modal`.

The container is `position: absolute` at the page's scroll position. Don't make it `fixed` or `sticky`, because iOS Safari colours its bars from a fixed or sticky layer at the screen's edge.

## baseline.css

`@ogdakke/fluidbox/baseline.css` is the default look: the round controls and where they sit, the focus rings, cursors, fades, the placeholder colour, the error message, the thumbnails' corners and current bar, the sheet's corners, shadow and handle, and the media add-ons' Play button and cursors. One file covers the viewer, the thumbnails and the sheet. Its rules are in the `fluidbox-baseline` layer and in `:where()`, so any rule of yours outside a layer, or in a later layer, wins. It never sets a property the functional CSS sets on the same element. Where both have a say, as on the backdrop's colour, the functional CSS reads a variable such as `--fluidbox-backdrop-background`, with a `Canvas` fallback, and the baseline gives it its own. To own the look, leave it out, or copy it and change it.

Every transition in it sits inside `@media (prefers-reduced-motion: no-preference)`. Do the same with yours: a transition of yours that outweighs the package's own reduced-motion rule would run anyway.

Don't put a `transition` or `!important` on the backdrop's `opacity`. The runtime reads and animates it.

### Glyphs

A control you give no content shows its label as text, such as "Close", and gets `data-fluidbox-default`. The text is its accessible name. `baseline.css` draws a glyph over such a control and clips the text, so the name stays. Controls holding your own icon don't have the attribute, and the baseline leaves them alone.

Each glyph is a token, a `url()` of an SVG whose shape masks the control's text colour. Set one to change a glyph:

```css
:root {
  --fluidbox-icon-close: url("/icons/close.svg");
}
```

The tokens are `--fluidbox-icon-close`, `-previous`, `-next`, `-zoom-in`, `-zoom-out`, `-zoom-reset`, `-enter-fullscreen`, `-exit-fullscreen`, `-download`, `-share`, `-play-slideshow`, `-pause-slideshow`, `-retry` and `-embed-play`. Retry and the counter keep their text.

`data-fluidbox-glyphs="off"` on an ancestor, such as `<html>`, shows the text labels instead. So does a forced-colours mode, where a masked glyph would vanish.

The default glyphs are `data:` URLs, which a Content Security Policy governs through `img-src`. Under `default-src 'self'`, set every token to a file on your own origin, or turn the glyphs off.

## Theme

When the viewer opens, it reads the trigger's computed styles and copies every `--fluidbox-*` property onto the overlay. Set them on `:root`, on a section, or on one trigger, and the viewer uses what that trigger inherits. These tokens are read by `baseline.css`:

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

With `baseline.css`, focus rings are 2px of `--fluidbox-focus-color`, which defaults to the text colour. On the controls a 2px edge of `--fluidbox-focus-contrast`, black by default, sits inside the ring, so a white ring still shows over a bright photo. In forced colours, as Windows' contrast themes, the controls get a border and focus rings take the system's `Highlight`; with `prefers-contrast: more`, a disabled Previous or Next fades only to 0.6.

## State attributes

Attribute names follow one rule. Parts of the viewer, and the markers you put on your own elements, are `data-fluidbox-*`, such as `[data-fluidbox-dialog]` and `data-fluidbox-origin`. State on the viewer's own elements is a plain flag, such as `data-open` or `data-zoomed`. State on your elements, a trigger or a thumbnail overlay, is `data-fluidbox-*`, so it never clashes with your own attributes. `data-fluidbox-status` is the one name on both, since the active trigger mirrors the viewer.

The overlay and the dialog both carry the viewer's state:

<!-- css: states data-fluidbox-status data-open data-closed data-starting-style data-opening data-ending-style data-dragging data-dismissing -->

The dialog alone also has `data-zoomed` while an image is zoomed, and `data-gallery` when there is more than one item. Style a dialog that holds thumbnails with `[data-fluidbox-dialog]:has([data-fluidbox-thumbnails])`.

```css
[data-fluidbox-dialog][data-zoomed] .caption {
  opacity: 0;
}
```

The trigger of the open item gets `data-fluidbox-status="open"` and `data-open`. Every trigger has `data-fluidbox-trigger` and `aria-haspopup="dialog"`. It has no `aria-expanded`: the viewer is a modal dialog, not something the trigger expands.

## Controls

The default controls are buttons marked `data-fluidbox-previous`, `data-fluidbox-next` and `data-fluidbox-close`, each showing its label as text. With `baseline.css`, Close sits in the top-right corner, and with more than one item Previous and Next sit at the middle of each side, each with its glyph. Full screen, Download, Share and the counter, when `controls` lists them, run from the top-left corner. All of them keep 16 pixels inside the stage. A disabled Previous or Next fades to `--fluidbox-gallery-control-opacity: 0.35`. Right to left, the sides swap.

You choose which controls exist:

- **Plain JavaScript.** You get all three unless you pass `viewer`. Then you keep Close until your content has its own `data-fluidbox-close` button, and `controls: true`, or a list such as `controls: ["previous", "next"]`, keeps more next to your own content.
- **Frameworks.** Put the `Controls` part, or `Previous`, `Next` and `Close`, in the `Viewer` part. Without them there is only the default Close. Each renders its label as text when it is empty, or your children.
- **Custom elements.** The gallery adds all three. A `<template slot="viewer">` replaces them, apart from Close while the template has none of its own. Put `<fluidbox-controls>` in it to keep them. Any button marked `data-fluidbox-close`, `-previous` or `-next` in the viewer runs that command, in every API.

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

With `prefers-reduced-motion: reduce`, the viewer opens and closes without flights, moves between slides without smooth scrolling, zooms and moves the sheet without animation, and its controls and thumbnails appear without fading. You don't need to set anything. Give your own chrome its transitions only when motion is welcome, as `baseline.css` does:

```css
@media (prefers-reduced-motion: no-preference) {
  .caption {
    transition: opacity 180ms linear;
  }
}
```

## Triggers

`<fluidbox-item>` triggers get a reset: no border, background or padding, `display: block`, and `cursor: zoom-in` from `baseline.css`. The package wraps the reset in `:where()`, so your classes win. The framework triggers render a plain `<button type="button">` with no styles, or decorate your own element, and `fluidbox.bind()` leaves your element's styles alone.
