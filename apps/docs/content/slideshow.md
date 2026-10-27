---
title: Slideshow
section: Guides
order: 6.5
description: Move through the items on a timer, with the slideshow option, play() and pause(), state.playing, the Slideshow control and its labels, and what holds and pauses it.
---

# Slideshow

A slideshow moves the open viewer to the next item on a timer. It never starts by itself: `play()`, the Slideshow control or `autoplay` start it, and a person's input stops it. The timer is part of the viewer's code, so it adds no chunk of its own.

## Turn it on

Give the fluidbox the `slideshow` option, and show the Slideshow control. This is how the slideshow example page sets it up, cut short:

```ts
const fluidbox = createFluidbox({
  items,
  controls: ["previous", "next", "close", "slideshow"],
  slideshow: { interval: 5000 },
});
```

`slideshow` is a `FluidboxSlideshowOptions`:

| Option     | Default           | What it does                                                                                  |
| ---------- | ----------------- | --------------------------------------------------------------------------------------------- |
| `interval` | `5000`            | Time on each slide, in ms. The next slide then has as long again to be ready before it moves. |
| `loop`     | the `loop` option | Go from the last slide to the first. Without it, the slideshow stops on the last slide.       |
| `autoplay` | `false`           | Start playing as the viewer opens. It plays once per open: after a pause, it stays paused.    |

`update({ slideshow })` changes the options on a live fluidbox.

## Play and pause from code

`fluidbox.play()` starts the slideshow on the open viewer, and `fluidbox.pause()` stops it. `play()` does nothing while the viewer is closed, while it plays already, or on the last slide without a loop. It works without the `slideshow` option, with the defaults.

`state.playing` says whether it plays, and `subscribe` sees it change. Each move the timer makes has the reason `"slideshow"`, so a `valuechange` listener can tell them from a person's moves:

```ts
fluidbox.addEventListener("valuechange", (event) => {
  if (event.reason === "slideshow") return;
  analytics.track("photo", event.value);
});
```

## The Slideshow control

The control plays and pauses. It is named by the `playSlideshow` label, "Play slideshow", while paused, and by `pauseSlideshow`, "Pause slideshow", while it plays. It has `data-fluidbox-slideshow`, and `data-active` while it plays, so your CSS can show a pause glyph then. Full screen does the same: `data-active` while the viewer is full screen. Without the `slideshow` option, the control hides, unless the slideshow plays: then it is how to stop it.

The control comes in every entry point. As with the other controls, it shows its label as text until you give it content of your own:

- Plain JavaScript: `"slideshow"` in `controls`, or `fluidbox.bindControl(button, "slideshow")` for a button of yours, in the viewer or on the page. A bound button gets the labels and `data-active` too.
- [React](./react.md), [Vue](./vue.md) and [Solid](./solid.md): the `Slideshow` part, and `play`, `pause` and `playing` from `useFluidbox()`.
- [Angular](./angular.md): `button[fluidboxSlideshow]`, and `play`, `pause` and `playing` from `injectFluidbox()`.
- [Custom elements](./custom-elements.md): `<fluidbox-slideshow>`, and the gallery's `slideshow` property and `play()` and `pause()` methods.

## What holds it, and what pauses it

A **hold** stops the timer for a while, and `playing` stays true:

- The tab is hidden.
- A video in the slide on show is playing. A muted, looping video that plays by itself holds it for as long as it plays.

Once the hold ends, the interval starts again from the beginning.

A **pause** sets `playing` to false, and the slideshow stays paused until `play()` or the control:

- A person's input to the viewer: a pointer, a key, a wheel or a zoom.
- `pause()`.
- Arriving on the last slide without a loop.
- The viewer closing.

Before each move, the timer waits for the next slide to be ready, as an open waits for its slide, for up to another `interval`. A move a `beforevaluechange` listener prevents starts another interval on the same slide.

## Accessibility and motion

While the slideshow plays, the viewer's live region is off, so a screen reader isn't interrupted at every slide; it speaks again once the slideshow stops. Under `prefers-reduced-motion: reduce`, the timer's moves are instant, as every move is there. The [motion speed](./styling.md#motion-speed) changes how long its moves take otherwise.
