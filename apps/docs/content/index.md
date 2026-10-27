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

Every entry point uses the same items and the same stylesheets. `@ogdakke/fluidbox/styles.css` holds the rules the viewer needs to work: layout, layers and motion. `@ogdakke/fluidbox/baseline.css` is an opt-in look for the controls, focus rings and fades. The package ships no icons: a control shows its label as text until you give it content of your own. See [Styling](./styling.md).

The add-ons have entries of their own, so a page pays for one only if it uses it: the [thumbnails and the sheet](./thumbnails-and-sheet.md), YouTube and Vimeo embeds, 360° spins and 3D models ([Product media](./product-media.md)), and hover zoom.

## Concepts

- **Item.** A plain object that reads like the element the viewer draws: `{ type: "image", src, alt, width, height }`, a `video`, an `iframe`, or a type of your own. See [Media types](./media.md).
- **Items.** The list the viewer can show: an array, or a lazy list that makes each item on demand, so it can be a thousand items with a dozen thumbnails on the page, and grow as the viewer nears its end. See [Items and origins](./items-and-origins.md).
- **Trigger.** The element that opens an item. The flight starts on it, usually on the thumbnail image inside it, and lands back there on close.
- **Viewer.** One layer at the end of `<body>`. You put your own controls and captions into it.
- **The fluidbox.** What `createFluidbox()` returns: the viewer's state, the commands that open, move and close it, and the events that say what happened and why.

## Patterns

The [pattern pages](./patterns/index.md) show thirteen common setups, each live and in every framework: a [gallery](./patterns/basic.md), [one trigger for an album](./patterns/overlay.md), [rich origins](./patterns/origins.md), [custom content](./patterns/renderers.md), [programmatic control](./patterns/programmatic.md), [zoom](./patterns/zoom.md), [thumbnails](./patterns/thumbnails.md), a [sheet](./patterns/sheet.md), [headless controls](./patterns/headless.md), [right to left](./patterns/rtl.md), the [photo in the address](./patterns/url.md), [hover zoom](./patterns/zoom.md#hover-zoom) and [product media](./product-media.md).

## Guides

- [Items and origins](./items-and-origins.md): arrays, lazy lists, [lists that grow](./items-and-origins.md#lists-that-grow) on `reachend`, and where each flight starts and lands.
- [Media types](./media.md) and [Product media](./product-media.md): every item type, embeds, spins and 3D models, and a [live 3D thumbnail](./live-3d-thumbnails.md) the viewer continues from.
- [Slideshow](./slideshow.md): a timer that moves through the items, with its control and its pauses.
- [Hotspots](./hotspots.md): buttons on points of a photo or video that stay put as it zooms.
- [Styling](./styling.md): the parts, the opt-in baseline, and the [motion speed](./styling.md#motion-speed). The [CSS reference](./css-reference.md) lists every property.
- [Thumbnails and sheet](./thumbnails-and-sheet.md) and [Languages and direction](./languages.md).

## Next

Start with [Getting started](./getting-started.md) to install the package and build a first gallery. Then open the page for your framework, and the [API reference](./api.md) when you need the exact types.
