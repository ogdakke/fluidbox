---
title: Rich origins
section: Patterns
order: 3
description: Fly from a photo inside a card, and bring the closing item back into view inside a scroller.
---

# Rich origins

The origin is the element the viewer flies from and back to. By default it is the trigger's first image or video, or the trigger itself. A card can mark a different element, and a scroller gets the item it closes on scrolled back into view.

<!-- pattern: origins -->

- **`data-fluidbox-origin`** on any element inside the trigger makes it the origin. The flight copies its box, crop (`object-fit`, `object-position`) and corner radius.
- **Reveal on close.** Before the opening flight and each time the viewer moves, it scrolls the item's trigger into view (nearest edge), so the closing flight lands on it. To do this yourself, as a virtualised grid must, pass `revealTrigger(item, index, { signal, phase })`, and `findTrigger(item, index)` for items whose trigger isn't mounted (see [Items and origins](../items-and-origins.md)).
- **As child.** The framework `Trigger` parts render a `<button>`, and with `asChild` decorate your own element instead. Angular's `fluidboxTrigger` is an attribute, so it always decorates. In plain JavaScript, `fluidbox.bind()` decorates the element you give it.
