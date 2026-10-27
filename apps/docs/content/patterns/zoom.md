---
title: Zoom
section: Patterns
order: 7
description: Zoom from your code and from controls, pan by keyboard, load a sharper image as the zoom grows, or turn zoom off.
---

# Zoom

Images zoom with pinch (or Ctrl + wheel), a click or double-tap, the zoom controls, the `+`, `-` and `0` keys, and your own code. They pan by drag, scroll and the arrow keys while zoomed. Each viewer can set how far a double-tap zooms (`step`) and how far zoom goes (`max`), or turn zoom off.

<!-- pattern: zoom -->

The first gallery zooms to 3× on a double-click and stops at 6×. Its viewer has the zoom controls with icons of the page's own (the package ships none; see [Zoom controls](#zoom-controls)), and a readout of `state.zoom` in each framework's own way: a selector hook, a signal, the root's slot, an injected signal, or `subscribe`. Its photos list two widths in `srcset` and the full-size file as `zoom.src`, so a zoom past the 1280w candidate loads the sharper file (see [A sharper image as the zoom grows](#a-sharper-image-as-the-zoom-grows)). The second gallery turns zoom off.

- `zoom: { step, max, click, tap }` or `zoom: false` on the viewer. The custom elements also read the `zoom-step`, `zoom-max`, `zoom-click`, `zoom-tap` and `nozoom` attributes.
- Zoom options apply live, even while the viewer is open. Call `fluidbox.update({ zoom })`, or set a new `zoom` prop or property. Turning zoom off zooms a zoomed photo back out.
- `step` defaults to `2` and `max` to `4`.
- `click` is what a mouse click on the photo does: `"single"` (the default) zooms on one click, `"double"` on a double-click, as the system's double-click speed counts it, and `false` not at all. A single click under `"double"` waits for nothing and doesn't close the viewer.
- `tap` is what a touch or pen tap does: `"double"` (the default) zooms on two taps within 350 ms, and `false` not at all.
- With either off, pinch, the wheel, the keys, the zoom controls and `zoomTo` still zoom, and a click beside a zoomed photo zooms out in every mode.
- The viewer has `data-fluidbox-zoom-click="single"`, `"double"` or `"off"`. `baseline.css` shows the zoom cursors only under `"single"`.
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

The default controls leave zoom out. In plain JavaScript, ask for them with `controls: ["previous", "next", "close", "zoomIn", "zoomOut", "zoomReset"]`. In a viewer of your own, `ZoomControls` adds all three (`<div fluidboxZoomControls>` in Angular, `<fluidbox-zoom-controls>` in an elements template), beside a `Toolbar` for Previous, Next and Close. The parts `ZoomIn`, `ZoomOut` and `ZoomReset` (`button[fluidboxZoomIn]`, `[fluidboxZoomOut]` and `[fluidboxZoomReset]` in Angular) place them one by one, with content of your own if you like. With none, each shows its label as text, which `baseline.css` draws as a glyph. The package ships no icons: bring an SVG, or a component from an icon set, as the part's content (`icons` in plain JavaScript), and the label becomes the button's `aria-label`. Mark the icon `aria-hidden`.

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

Give an image more pixels for zooming than for the slide with the item's `zoom` field:

```ts
const photo = {
  type: "image",
  src: "/photos/fjord-1600.webp",
  srcset: "/photos/fjord-800.webp 800w, /photos/fjord-1600.webp 1600w",
  alt: "Fjord from the cliff edge",
  zoom: {
    srcset: "/photos/fjord-3200.webp 3200w",
    src: "/photos/fjord-master.webp",
  },
  width: 1600,
  height: 1067,
};
```

`zoom.srcset` lists candidates only a zoom loads. `zoom.src` is the largest image there is, loaded once the zoom needs more than every candidate has.

Hover zoom magnifies the photo on the page, before the viewer opens: see [Hover zoom](./hover.md).
