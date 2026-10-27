---
title: Hover zoom
section: Patterns
order: 13
description: A product photo that magnifies under a resting mouse, and opens the viewer on a click.
---

# Hover zoom

A product photo magnifies inside its own box under a resting mouse, and a click opens the viewer as before. Hover over the photo with a mouse, then click it. The page shows the 640w candidate; the hover zoom swaps in the 1600w one.

<!-- pattern: hover -->

On a product page, the photo on the page can magnify under a resting mouse, before anyone opens the viewer. `@ogdakke/fluidbox/hover-zoom` is an add-on of its own, about 1.5 kB gzip, and loads nothing until the first hover:

```ts
import { hoverZoom } from "@ogdakke/fluidbox/hover-zoom";

const stop = hoverZoom(card, photo, { scale: 2.5 });
```

`hoverZoom(element, item, options?)` shows `item` magnified inside the box of the first `<img>` in `element` (or `options.image`), following the pointer. It starts from the image already on the page, then swaps in the candidate of `srcset`, `zoom.srcset` or `zoom.src` sharp at that scale once it has decoded. It sits over the page in its own `[data-fluidbox-hover-zoom]` layer (`--layer-fluidbox-hover-zoom`, default `2`), so nothing moves, and takes no pointer events, so a click still reaches the trigger and opens the viewer. `element` has `data-fluidbox-hover-zooming` while it shows.

It does nothing on touch screens, for a pen, and with reduced motion, and loads nothing until the first hover, so it doesn't compete with the page's largest image. It goes as the pointer leaves or presses, or the page scrolls. Call the returned function, or abort `options.signal`, to remove it: from an effect's cleanup, `onCleanup`, `watchEffect`'s `onCleanup` or a directive's `ngOnDestroy`.

Hover zoom is not a viewer part: it works on any image, in or out of a trigger. For zoom inside the viewer, see [Zoom](./zoom.md).
