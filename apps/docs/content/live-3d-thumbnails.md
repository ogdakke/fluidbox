---
title: Live 3D thumbnails
section: Guides
order: 4.6
description: A product card that shows a live <model-viewer> the user turns, and a viewer that opens on that view and hands it back on close. The card's markup, the pinned model-viewer version, why to leave auto-rotate off, and slide.origin.model and slide.onClose for slides of your own.
---

# Live 3D thumbnails

A card can show a 3D model live instead of a still: the user drags it to turn it, then clicks it, and the viewer opens on the view the card showed. As the viewer closes, the card turns to the view the user left the viewer on. It works with the [model add-on](./product-media.md#3d-models), in every entry point.

## Pin `<model-viewer>` 4.0.0

The add-on reads `<model-viewer>`'s camera and its shadow root, and is tested against 4.0.0. Install `@google/model-viewer@4.0.0`, or load that build from Google's CDN, and pin it: another version may lay out its shadow root otherwise. Development builds warn once when the element doesn't look as 4.0.0 does.

A card draws the model with the page, so `<model-viewer>` loads with the page too, not on the first open: call your `load` function as the page starts, as the example does.

## The card

The card is the trigger: a `<button>` named with `aria-label`, around a `<model-viewer>` of the item's `src`, with the item's thumbnail as its `poster`.

```html
<button type="button" aria-label="Open 3D view: Damaged Helmet">
  <model-viewer
    src="/products/damaged-helmet/damaged-helmet.glb"
    poster="/products/damaged-helmet/damaged-helmet-thumb.webp"
    camera-controls
    touch-action="pan-y"
    interaction-prompt="none"
  ></model-viewer>
</button>
```

- `camera-controls` lets a drag turn the model on the card.
- `touch-action="pan-y"` keeps a vertical swipe scrolling the page.
- `interaction-prompt="none"` hides the hand that waves over the model, which would draw the eye on every card.

Leave `auto-rotate` off. A turning card is motion the user didn't ask for, it keeps the GPU busy for every card in view, and the view it would hand the viewer changes under the click.

This is the card from the live fixture, which the browser tests run, in plain JavaScript:

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import { createModelSlide, modelItem } from "@ogdakke/fluidbox/model";

const loadModelViewer = () => import("@google/model-viewer");
// The cards draw live models, so <model-viewer> loads with the page.
void loadModelViewer();

const helmet = modelItem({
  id: "helmet",
  title: "Damaged Helmet",
  src: "/products/damaged-helmet/damaged-helmet.glb",
  poster: "/products/damaged-helmet/damaged-helmet.webp",
  thumbnail: { src: "/products/damaged-helmet/damaged-helmet-thumb.webp" },
});

const fluidbox = createFluidbox({
  items: [helmet],
  slides: { model: createModelSlide({ load: loadModelViewer }) },
});

const button = document.createElement("button");
button.type = "button";
button.setAttribute("aria-label", `Open 3D view: ${helmet.title}`);
const card = document.createElement("model-viewer");
card.setAttribute("src", helmet.src);
card.setAttribute("poster", helmet.thumbnail!.src);
card.setAttribute("camera-controls", "");
card.setAttribute("touch-action", "pan-y");
card.setAttribute("interaction-prompt", "none");
button.append(card);
document.querySelector("#cards")!.append(button);
fluidbox.bind(button, helmet);
```

[Product media](./product-media.md) shows the same card live in every framework. In React, Vue, Solid and Angular the card is the framework's `Trigger` around the `<model-viewer>`; with custom elements it is the `slot="trigger"` button of a `<fluidbox-item>`.

## What the viewer does with the card

- **A drag turns, a click opens.** Inside a trigger, a press on `<model-viewer>` that moves more than 6 pixels is a drag: it turns the model, and the click after it doesn't open the viewer. `data-fluidbox-owns-input` gives any element in a trigger the same rule.
- **The card stays one tab stop.** Importing the model add-on quiets every live model in a trigger: it sets `aria-hidden` on the model, takes its focus target out of the tab order, and makes its own poster and AR buttons inert, so the trigger is the one control a keyboard and a screen reader reach. All of it is undone when the model leaves the trigger, or the trigger is unbound. A `<model-viewer>` that doesn't have 4.0.0's focus target keeps its focus, loses the `aria-hidden` it would hide, and warns once in development.
- **The open starts on the card's view.** The viewer's model copies the card's camera orbit, target and field of view before its first frame. Until that frame, the box shows a snapshot of the card, a canvas copy of what it draws, so the flight lands on the view the user left. The open waits for the model's first frame, at most three seconds, as any model open does.
- **The close hands the view back.** As a close starts, the slide copies its camera to the card it lands on, if that card shows the same model, and the flight carries home a snapshot of the slide's view. An unzoomed view goes back to the card's own field of view, `"auto"` unless the page set one.
- **The snapshot.** The snapshot is a copy of the canvas `<model-viewer>` 4.0.0 shows. Without that canvas it falls back to a PNG of `toDataURL()`, which is slower, and development builds warn once. A PNG keeps the model's clear background; while a snapshot is in the box, the posters under it are hidden.
- **The model is read when the viewer asks.** A card whose `<model-viewer>` is replaced or remounted gives the one connected now; a disconnected one is ignored. Never move a card's model to another element yourself: `<model-viewer>` draws nothing once it has left the page and come back.

## Slides of your own

The model slide does this through two members every slide has, which a slide of your own can use for any live state on a card:

- **`slide.origin.model`** is the trigger's live `<model-viewer>` element itself, on the slide an open started from that trigger. It is null on the neighbours, on slides reached by moving, and for opens without a trigger. It is the element, not a reading of it as `origin.video` is: read its camera through its own API, and never move it.
- **`slide.onClose(listener)`** calls `listener` once as a close starts from the slide, before the closing flight measures the trigger, with the `FluidboxSlideOrigin` of the trigger the close lands on, or null when it lands on none. That may not be the trigger the open started from, as after moving to another item. It runs on every close, flown or not: Escape, the backdrop, Close, a drag or wheel dismiss, `close()`, and a value set to null. It returns a function that stops listening; the slide's `signal` stops it too.

```ts
import type { FluidboxSlideRenderer } from "@ogdakke/fluidbox";

interface ModelElement extends HTMLElement {
  cameraOrbit: string;
  getCameraOrbit(): { toString(): string };
}

const turntable: FluidboxSlideRenderer = (slide) => {
  const model = document.createElement("model-viewer") as ModelElement;
  // Open on the card's view.
  const card = slide.origin?.model as ModelElement | undefined;
  if (card) model.cameraOrbit = card.getCameraOrbit().toString();
  slide.media.append(model);
  // Hand the view to the card the close lands on.
  return slide.onClose((landing) => {
    const home = landing?.model as ModelElement | undefined;
    if (home) home.cameraOrbit = model.getCameraOrbit().toString();
  });
};
```

`slide.returnPlayback(source)` is the video form of `onClose`, read just after its listeners on a close that flies; see [Product media](./product-media.md#a-player-of-your-own-continues-the-triggers-video).

In the frameworks, a component in a slide reads `origin` and calls `onClose` through `useFluidboxSlide()` in [React](./react.md), [Vue](./vue.md) and [Solid](./solid.md), and `injectFluidboxSlide()` in [Angular](./angular.md), with the cleanup in the framework's own unmount: an effect's cleanup, `onBeforeUnmount`, `onCleanup` or `ngOnDestroy`. Angular runs the listener in its zone.
