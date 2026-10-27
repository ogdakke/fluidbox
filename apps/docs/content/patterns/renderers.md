---
title: Custom content
section: Patterns
order: 5
description: A slide of your own that reads the app's context, beside a map, a video and a YouTube embed.
---

# Custom content

Besides images, a slide can hold a video, an iframe, or content of your own. Your own content is an item of a type you name, here `type: "note"`. You declare the type once, so TypeScript checks its items (see [the example data](./index.md#the-example-data)), and give the viewer a slide for it.

<!-- pattern: renderers -->

- **A slide per type.** The viewer looks up each item's `type`: your slide for it first, then the built-in image, video and iframe. A type with no slide shows an error slide, and development builds say which type is missing. In the frameworks, `Slides` takes one per type (`note={…}`, `<template #note>`, `<ng-template fluidboxSlide="note">`); on custom elements, `<template data-fluidbox-slide="note">`; in plain JavaScript, the `slides` option.
- **The media box flies.** Content in `Media` (`fluidboxMedia`, `<fluidbox-media>`, `slide.media` in plain JavaScript) is what flies from the trigger, follows a drag to dismiss and can zoom. Content beside it, in the slide's layer, fades in with the controls instead.
- **Framework components keep their context.** React and Vue render slides through portals inside `Root`, and Solid renders them under `Root`'s owner, so context, provide/inject and stores work. Angular renders the `ng-template`, which keeps the injector of the place you declare it.
- **Plain slides** are functions that get the slide (`item`, `index`, `media`, `layer`, `signal`, `active`, `onActiveChange` and more), draw into `slide.media`, and may return a function that releases what they made. The viewer empties the box itself.
- **A YouTube embed** is an iframe item. YouTube won't play an embed that sends no referrer, so the example data sets `referrerPolicy: "strict-origin-when-cross-origin"` on it.
- Every item needs `width` and `height`, so the viewer can size its slide before anything loads. Videos show their `poster` until they play.

See [Media types](../media.md) for every field and what a slide can do, and [Product media](./media.md) for YouTube and Vimeo facades, 360° spins and 3D models.
