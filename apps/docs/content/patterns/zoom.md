---
title: Zoom
section: Patterns
order: 7
description: Zoom from your code and from controls, pan by keyboard, load a sharper image as the zoom grows, and magnify product photos on hover.
---

# Zoom

Images zoom with pinch (or Ctrl + wheel), a click or double-tap, the zoom controls, the `+`, `-` and `0` keys, and your own code. They pan by drag, scroll and the arrow keys while zoomed. Each viewer can set how far a double-tap zooms (`step`) and how far zoom goes (`max`), or turn zoom off.

<!-- pattern: zoom -->

The first gallery zooms to 3× on a double-click and stops at 6×. Its viewer has the zoom controls, and a readout of `state.zoom` in each framework's own way: a selector hook, a signal, the root's slot, an injected signal, or `subscribe`. Its photos list two widths in `srcset` and the full-size file as `zoomSrc`, so a zoom past the 1280w candidate loads the sharper file (see [A sharper image as the zoom grows](#a-sharper-image-as-the-zoom-grows)). The second gallery turns zoom off.

- `zoom: { step, max }` or `zoom: false` on the viewer. The custom elements also read the `zoom-step`, `zoom-max` and `nozoom` attributes.
- Zoom options apply live, even while the viewer is open. Call `fluidbox.update({ zoom })`, or set a new `zoom` prop or property. Turning zoom off zooms a zoomed photo back out.
- `step` defaults to `2` and `max` to `4`.
- While zoomed, the dialog has `data-zoomed`. Pans can reach under the browser's bars; set `--fluidbox-zoom-bleed: 0px` to keep them inside the window, or `--fluidbox-zoom-clip` to keep them inside the stage insets.

## Commands and state

```ts
await fluidbox.zoomTo(2, { origin: { x: event.clientX, y: event.clientY } });
await fluidbox.zoomIn(); // × 1.5
await fluidbox.zoomOut(); // ÷ 1.5
await fluidbox.zoomReset(); // back to fit
```

| Command                   | What it does                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `zoomTo(scale, options?)` | Zooms the image on show to `scale`, kept between 1 and `max`. A scale that isn't a finite number rejects with a `RangeError`. |
| `zoomIn(options?)`        | Zooms in by 1.5, up to `max`.                                                                                                 |
| `zoomOut(options?)`       | Zooms out by 1.5, down to fit.                                                                                                |
| `zoomReset(options?)`     | Zooms back out to fit.                                                                                                        |

`options` is `FluidboxZoomCommandOptions`: `{ signal?, origin? }`. `origin` is the point in the window, in CSS pixels, that stays where it is as the image grows, as under a pinch; without it, the zoom grows from the middle of the stage. Each command resolves `true` once the zoom has come to rest, and `false` when there is no image to zoom (the viewer is closed, on a video or a custom item, or zoom is off), when another zoom took over, or when its signal aborted. With reduced motion, the zoom jumps.

`state.zoom` is `{ scale, min, max }` while the viewer is open on an image with zoom on, else `null`. `scale` is 1 at fit, and changes only as the zoom comes to rest, not frame by frame. Moving to another item starts it at 1 again. The `zoomchange` event, a `FluidboxZoomEvent` with `scale` and `reason`, fires each time it rests at another scale, whatever moved it: `"api"` for your code, `"pointer"` for a click, tap or pinch, `"wheel"` for Ctrl + wheel, and `"keyboard"` for the keys. A zoom control reports the input that pressed it: `"pointer"` for a click, `"keyboard"` for Enter or Space. Per-frame values stay in the CSS variables.

The bindings have the same commands on `useFluidbox()`, `injectFluidbox()` and the gallery element, the zoom as `zoom` in their state, and the event as `onZoomChange`, `@zoomchange`, `(zoomChange)` and the gallery's `zoomchange`.

## Zoom controls

The default controls leave zoom out; ask for it with `controls: ["previous", "next", "close", "zoomIn", "zoomOut", "zoomReset"]`. In a viewer of your own, `<fluidbox-controls zoom>`, `<Fluidbox.Controls zoom />` or `<div fluidboxControls zoom>` adds them, and the parts `ZoomIn`, `ZoomOut` and `ZoomReset` (`button[fluidboxZoomIn]`, `[fluidboxZoomOut]`, `[fluidboxZoomReset]` in Angular) place them one by one.

The three buttons sit in a `[data-fluidbox-zoom-controls]` group named by the `zoomed` label, at the bottom of the stage. Each is named by its label, `zoomIn`, `zoomOut` and `zoomReset` ("Fit to screen"), and is disabled when it can do nothing: Zoom in at `max`, Zoom out and Fit at fit, all three on a video. A button of your own is a zoom control once it has `data-fluidbox-zoom-in`, `data-fluidbox-zoom-out` or `data-fluidbox-zoom-reset`, wherever your viewer content puts it:

```html
<button type="button" data-fluidbox-zoom-in aria-label="Zoom in">+</button>
```

## Keyboard and screen readers

`+` and `-` zoom in and out by 1.5, as the controls do, and `0` zooms back to fit. While zoomed, the arrow keys pan by a fifth of the window, Shift with an arrow by half; with the image back at fit, they move between items again. The zoomed image is in a scrollable group inside the dialog, named by the `zoomed` label, so it takes focus and reads as part of the viewer. Each zoom that comes to rest is announced politely through the `zoomLevel` label, "Zoom 200%" by default.

## Clicks and taps

A mouse click on the image zooms in to `step` at the pointer, and the next click zooms back out, as a product page's photo does. A double click is one zoom, not two. On a touch screen, a double tap zooms, with taps up to 350 ms apart. A click or tap beside a zoomed image zooms it out rather than closing the viewer; at fit, a tap on the backdrop closes it as before.

## A sharper image as the zoom grows

As the zoom shows the image larger than the pixels it loaded, the viewer loads a larger candidate from the item's `srcset` (or the `srcset` of its `sources`), decodes it off screen, and swaps it in without moving the image. It steps between the candidates you list, never past the largest, only for the image on show; a neighbour stays as it was, and an image you leave goes back to its own candidate.

Give an image more pixels for zooming than for the slide with two item fields:

```ts
const photo = {
  type: "img",
  src: "/photos/fjord-1600.webp",
  srcset: "/photos/fjord-800.webp 800w, /photos/fjord-1600.webp 1600w",
  zoomSrcset: "/photos/fjord-3200.webp 3200w",
  zoomSrc: "/photos/fjord-master.webp",
  width: 1600,
  height: 1067,
};
```

`zoomSrcset` lists candidates only a zoom loads. `zoomSrc` is the largest image there is, loaded once the zoom needs more than every candidate has.

## Hover zoom

On a product page, the photo on the page can magnify under a resting mouse, before anyone opens the viewer. `@ogdakke/fluidbox/hover-zoom` is an add-on of its own, about 1.5 kB:

```ts
import { hoverZoom } from "@ogdakke/fluidbox/hover-zoom";

const stop = hoverZoom(card, photo, { scale: 2.5 });
```

`hoverZoom(element, item, options?)` shows `item` magnified inside the box of the first `<img>` in `element` (or `options.image`), following the pointer. It starts from the image already on the page, then swaps in the candidate of `srcset`, `zoomSrcset` or `zoomSrc` sharp at that scale once it has decoded. It sits over the page in its own `[data-fluidbox-hover-zoom]` layer (`--layer-fluidbox-hover-zoom`, default `2`), so nothing moves, and takes no pointer events, so a click still reaches the trigger and opens the viewer. `element` has `data-fluidbox-hover-zooming` while it shows.

It does nothing on touch screens, for a pen, and with reduced motion, and loads nothing until the first hover, so it doesn't compete with the page's largest image. It goes as the pointer leaves or presses, or the page scrolls. Call the returned function, or abort `options.signal`, to remove it: from an effect's cleanup, `onCleanup`, `watchEffect`'s `onCleanup` or a directive's `ngOnDestroy`.

Hover over the photo with a mouse, then click it. The page shows the 640w candidate. The hover zoom magnifies it 2.5× and swaps in the 1600w one, and the click opens the viewer as before.

<!-- pattern: hover -->
