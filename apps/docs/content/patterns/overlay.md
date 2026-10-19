---
title: One trigger for an album
section: Patterns
order: 2
description: Several items behind one thumbnail that shows the last one viewed, with a count that travels in the flight.
---

# One trigger for an album

One thumbnail stands for a whole album. It opens the first item, every item in the album returns to it on close, and it shows whichever item the viewer showed last, so the closing flight lands on a matching picture.

<!-- pattern: overlay -->

- **Multi-item trigger.** Give the trigger every item that may return to it: a list of targets in `fluidbox.bind`, `items` on the framework `Trigger`, `returns="id id …"` on a `<fluidbox-item>`. The first one opens.
- **Preview follows the selection.** The framework triggers hand their content the item they show (`{ item, index, status }`). Plain JavaScript gets `onPreviewChange(item, index)`. On custom elements, the `<fluidbox-item>` dispatches `fluidbox-preview-change` with `{ id, item }`; swap the trigger's image there, and mark the trigger `data-fluidbox-dynamic-preview` so the swap doesn't make the gallery re-read its items. The preview updates before the closing flight measures it.
- **Thumbnail overlays.** A badge or caption on the thumbnail: `fluidbox.bindOverlay()`, the `ThumbnailOverlay` part, or `data-fluidbox-thumbnail-overlay`. With `travel` the overlay flies with the image and fades on landing; `travel` can also be a renderer that draws live content into the flying frame. Without it, the overlay stays in the page and gets `--fluidbox-progress` to animate against.
