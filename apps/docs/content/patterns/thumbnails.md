---
title: Thumbnails
section: Patterns
order: 8
description: A strip of thumbnails in the viewer, built in or with your own thumbnails.
---

# Thumbnails

The thumbnails is an optional add-on from `@ogdakke/fluidbox/thumbnails`. The default strip draws the items' thumbnails, or you draw each thumbnail yourself.

<!-- pattern: thumbnails -->

- `import "@ogdakke/fluidbox/thumbnails"` once, then `thumbnails: true` turns it on. In the frameworks, rendering the `Thumbnails` part turns it on. On custom elements, a `<fluidbox-thumbnails>` child does, and it loads the add-on itself. It shows only when there is more than one item.
- For your own thumbnails, use `thumbnails: { render }` in plain JavaScript, the `render` property of `<fluidbox-thumbnails>`, or a child of the framework `Thumbnails` part.
- The selected thumbnail's button has `data-fluidbox-selected`, so CSS can mark it without your thumbnails tracking anything.
- The add-on is its own import, so it costs nothing until you use it.
