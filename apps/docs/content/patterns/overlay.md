---
title: One trigger for an album
section: Patterns
order: 2
description: Several items behind one thumbnail that shows the last one viewed, with a count that travels in the flight.
---

# One trigger for an album

One thumbnail stands for a whole album. It opens the first item, and every item in the album returns to it on close. It shows whichever item the viewer showed last, so the closing flight lands on a matching picture.

<!-- pattern: overlay -->

- **Multi-item trigger.** The trigger opens its own item, and `returns` lists every item that may close back onto it. Set it as `returns` in `fluidbox.bind` and on the framework `Trigger` (`fluidboxReturns` in Angular), or as `returns="id id …"` on a `<fluidbox-item>`. It may hold the whole album, the opened item included.
- **Preview follows the selection.** The framework triggers hand their content the item they show (`{ item, index, status }`). Plain JavaScript gets `onPreviewChange(item, index)`. On custom elements, the `<fluidbox-item>` dispatches `fluidbox-preview-change` with `{ id, item }`, and you swap the trigger's image in its handler. Changes inside a trigger never make the gallery re-read its items. The preview updates before the closing flight measures it.
- **Thumbnail overlays.** For a badge or caption on the thumbnail, use `fluidbox.bindOverlay()`, the `ThumbnailOverlay` part, or `data-fluidbox-thumbnail-overlay`. With `travel` the overlay flies with the image and fades on landing; `travel` can also be a renderer that draws live content into the flying frame. The framework parts render their content live there on their own. Angular's part takes it as an `<ng-template>` child. Without `travel`, the overlay stays in the page and gets `--fluidbox-closed` to animate against. A frame layer moves into the flying frame itself and scales with it, as a scrim does. It is `FrameLayer` in the frameworks (`fluidboxFrameLayer` in Angular), `frameLayer` in plain JavaScript, and `data-fluidbox-frame-layer` in markup.
