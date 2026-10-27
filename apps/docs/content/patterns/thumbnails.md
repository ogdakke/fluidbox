---
title: Thumbnails
section: Patterns
order: 8
description: A strip of thumbnails in the viewer, built in or with your own thumbnails.
---

# Thumbnails

The thumbnails are an optional add-on from `@ogdakke/fluidbox/thumbnails`: a strip of the items under the photo. The default strip draws each item's thumbnail, or you draw each one yourself.

<!-- pattern: thumbnails -->

- In the frameworks, rendering the `Thumbnails` part turns them on (`<ng-container fluidboxThumbnails />` in Angular). On custom elements, a `<fluidbox-thumbnails>` child does. In plain JavaScript, `import "@ogdakke/fluidbox/thumbnails"` once, then pass `thumbnails: true`. The strip shows only when there is more than one item.
- For thumbnails of your own, give the `Thumbnails` part a child (a function in React and Solid, a slot in Vue, an `<ng-template>` in Angular), set the `render` property of `<fluidbox-thumbnails>`, or pass `thumbnails: { render }` in plain JavaScript. Each gets the item and its index; the strip draws the button around it.
- The selected thumbnail's button has `data-active` and `aria-selected="true"`, so CSS can mark it without your thumbnails tracking anything.
- Import `@ogdakke/fluidbox/thumbnails.css` with it: it lays out the strip. `baseline.css` sizes and draws the thumbnails, with the `--fluidbox-thumbnails-*` properties to adjust them (see [Thumbnails and sheet](../thumbnails-and-sheet.md)).
- The add-on is about 3.8 kB gzip, in its own entry, so a page that doesn't use it loads none of it.
