---
title: Introduction
section: Start
order: 1
description: What fluidbox is, which entry point to use for your stack, and where to read next.
---

# Fluidbox

Fluidbox is a lightbox for photos, video, iframes and your own content. The picture flies out of its thumbnail, follows your finger, zooms with a pinch or a double-tap, and flies back to the thumbnail it came from when it closes.

It ships as one package, `@ogdakke/fluidbox`. One runtime does the gestures, flights, zoom and the body-level viewer. Each entry point is a thin layer over it.

## Entry points

| You build with                  | Read                                    | Import from                  |
| ------------------------------- | --------------------------------------- | ---------------------------- |
| React                           | [React](./react.md)                     | `@ogdakke/fluidbox/react`    |
| Next.js                         | [Next.js](./nextjs.md)                  | `@ogdakke/fluidbox/react`    |
| Vue                             | [Vue](./vue.md)                         | `@ogdakke/fluidbox/vue`      |
| Solid                           | [Solid](./solid.md)                     | `@ogdakke/fluidbox/solid`    |
| Angular                         | [Angular](./angular.md)                 | `@ogdakke/fluidbox/angular`  |
| Plain HTML, any server template | [Custom elements](./custom-elements.md) | `@ogdakke/fluidbox/elements` |
| Plain JavaScript or TypeScript  | [JavaScript](./javascript.md)           | `@ogdakke/fluidbox`          |

Every entry point uses the same items, the same stylesheet (`@ogdakke/fluidbox/styles.css`) and the same optional add-ons: `@ogdakke/fluidbox/thumbnails` and `@ogdakke/fluidbox/sheet`.

## Concepts

- **Item.** A plain object that reads like the element the viewer draws: `{ type: "img", src, alt, width, height }`, a `video`, an `iframe`, or `custom` content. See [Media types](./media.md).
- **Items.** The list the viewer can show: an array, or a lazy list that makes each item on demand, so it can be a thousand items with a dozen thumbnails on the page. See [Items and origins](./items-and-origins.md).
- **Trigger.** The element that opens an item. The flight starts on it, usually on the thumbnail image inside it, and lands back there on close.
- **Viewer.** One layer at the end of `<body>`. You put your own controls and captions into it.
- **The fluidbox.** What `createFluidbox()` returns: the viewer's state, the commands that open, move and close it, and the events that say what happened and why.

## Patterns

The [pattern pages](./patterns/index.md) show nine common setups, each live and in every framework: a [gallery](./patterns/basic.md), [one trigger for an album](./patterns/overlay.md), [rich origins](./patterns/origins.md), [custom content](./patterns/renderers.md), [programmatic control](./patterns/programmatic.md), [zoom](./patterns/zoom.md), a [thumbnails](./patterns/thumbnails.md), a [sheet](./patterns/sheet.md) and [headless controls](./patterns/headless.md).

## Next

Start with [Getting started](./getting-started.md) to install the package and build a first gallery. Then open the page for your framework, and the [API reference](./api.md) when you need the exact types.
