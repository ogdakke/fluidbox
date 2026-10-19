---
title: Filmstrip
section: Patterns
order: 8
description: A strip of thumbnails in the viewer, built in or with your own thumbnails.
---

# Filmstrip

The filmstrip is an optional add-on from `@ogdakke/fluidbox/filmstrip`. The default strip draws the items' thumbnails, or you draw each thumbnail yourself.

<!-- pattern: filmstrip -->

- `import "@ogdakke/fluidbox/filmstrip"` once, then `filmstrip: true` turns it on. In the frameworks, the `Filmstrip` part turns it on by being there; on custom elements, a `<fluidbox-filmstrip>` child, which loads the add-on itself. It shows only when there is more than one item.
- Your own thumbnails: `filmstrip: { render }` in plain JavaScript, the `render` property of `<fluidbox-filmstrip>`, or a child of the framework `Filmstrip` part.
- The selected thumbnail's button has `data-fluidbox-selected`, so CSS can mark it without your thumbnails tracking anything.
- The add-on is its own import, so it costs nothing until you use it.
