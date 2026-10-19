---
title: Gallery
section: Patterns
order: 1
description: A trigger per photo, with Previous, Next and Close in the viewer.
---

# Gallery

One viewer for a set of items, and a trigger for each. A trigger is any element; usually a button holding the thumbnail. When the viewer closes, it flies back to the trigger of the item it shows and focus returns there.

<!-- pattern: basic -->

- The viewer has Previous, Next and Close buttons until you give it content of your own. Then the framework `Controls` part, `<fluidbox-controls>` or the `controls` option keeps them.
- In plain JavaScript, `fluidbox.bind(button, index)` makes each button a trigger, and `fluidbox.destroy()` unbinds them all.
- The trigger's image is where the flight starts and ends. Mark another element with `data-fluidbox-origin` to fly from it instead (see [Rich origins](./origins.md)).
