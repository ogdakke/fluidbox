---
title: Rich origins
section: Patterns
order: 3
description: Fly from a photo inside a card, and bring the closing item back into view inside a scroller.
---

# Rich origins

The origin is the element the viewer flies from and back to. By default it is the trigger's first image or video, or the trigger itself. A card can mark a different element, and a scroller gets its closing item scrolled back into view.

<!-- pattern: origins -->

- **`data-fluidbox-origin`** on any element inside the trigger makes it the origin. The flight copies its box, crop (`object-fit`, `object-position`) and corner radius.
- **Reveal on close.** Each time the selection settles, and on close if it hasn't yet, the viewer scrolls the item's trigger into view (nearest edge), so the closing flight lands on it. To control this yourself, give the viewer an `origins` adapter with `revealOrigin(id, index, { signal, reason })` (see [The origin adapter](../items-and-origins.md#the-origin-adapter)).
- **As child.** The framework `Trigger` parts render a button by default, and with `asChild` decorate your own element instead; see each framework page. Angular's `fluidboxTrigger` is an attribute, so it always decorates. In plain JavaScript, `fluidbox.bind()` always decorates the element you give it.
