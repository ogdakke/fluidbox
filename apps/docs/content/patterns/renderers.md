---
title: Custom content
section: Patterns
order: 5
description: Your own component as a slide, plus a map, a video and a YouTube embed.
---

# Custom content

Besides images, a slide can hold a video, an iframe, or your own content. Custom content is an item with `type: "custom"` and `render: "note"`. The viewer looks up the `note` renderer and draws it into the slide.

<!-- pattern: renderers -->

- **Framework components keep their context.** React and Vue render custom slides through portals inside `Root`, and Solid renders them under `Root`'s owner, so context, provide/inject and stores work. Angular renders an `ng-template`, which keeps the injector of the place you declare it.
- **Plain renderers** are functions that get `{ item, index, target, signal }`, append to `target`, and may return a function that releases their own resources. The viewer empties `target` itself.
- **A YouTube embed** is an iframe item. YouTube won't play an embed that sends no referrer, so the example data sets `referrerPolicy: "strict-origin-when-cross-origin"` on it.
- **Markup.** On custom elements, any element other than an image, video or iframe in a `<fluidbox-item>`'s content template is custom content. With `gallery.items`, set `gallery.renderers`.
- Every type needs `width` and `height` so the viewer can size the slide before anything loads. Videos show their `poster` until they play.

See [Media types](../media.md) for every field, and [Product media](../product-media.md) for YouTube and Vimeo facades, 360° spins and 3D models, and slides that play and pause as they come on show.
