---
title: Overview
section: Patterns
order: 0
description: Nine common lightbox setups, each live and in every framework.
---

# Patterns

Each pattern is a small, complete example. Pick your framework in any tab; every page remembers the choice. The live example above the code is the code.

| Pattern                                   | Shows                                                         |
| ----------------------------------------- | ------------------------------------------------------------- |
| [Gallery](./basic.md)                     | A trigger per photo and the default controls                  |
| [One trigger for an album](./overlay.md)  | Several items behind one thumbnail that follows the selection |
| [Rich origins](./origins.md)              | A photo inside a card, and a scroller that reveals on close   |
| [Custom content](./renderers.md)          | Your own component, an iframe and a video                     |
| [Programmatic control](./programmatic.md) | Open from code, read state, log events, veto navigation       |
| [Zoom](./zoom.md)                         | Zoom steps, or zoom off                                       |
| [Filmstrip](./filmstrip.md)               | The default strip, and your own thumbnails                    |
| [Sheet](./sheet.md)                       | A panel under the photo with snap points                      |
| [Headless controls](./headless.md)        | Your own caption bar and buttons                              |

## The example data

The examples import their items from `./data`. Each item is a plain object; this is that module, with the longer lists cut short:

```ts
import type { FluidboxImageItem, FluidboxItem } from "@ogdakke/fluidbox";

/** An image with its own id. The thumbnails on the page show the same file. */
const image = (
  id: string,
  src: string,
  alt: string,
  width: number,
  height: number,
): FluidboxImageItem => ({ id, type: "img", src, alt, width, height });

/** Gallery, programmatic control, zoom, filmstrip, sheet and headless controls. */
export const photos: FluidboxImageItem[] = [
  image("photo-aurora", "/art/aurora.svg", "Aurora over the tundra", 1100, 1650),
  image("photo-ridge", "/art/ridge.svg", "Night ridge", 1200, 1500),
  image("photo-fjord", "/art/fjord.svg", "Fjord in the blue hour", 1200, 1600),
  image("photo-lagoon", "/art/lagoon.svg", "Lagoon after sunset", 1800, 1200),
];

/** One trigger for an album: five items behind one thumbnail. */
export const album: FluidboxImageItem[] = [
  image("album-dune", "/art/dune.svg", "Dune at golden hour", 1800, 1200),
  image("album-canyon", "/art/canyon.svg", "Canyon walls", 1400, 1400),
  image("album-coast", "/art/coast.svg", "Coastline panorama", 2400, 1000),
  // …two more
];

/** Rich origins: a product card and a horizontal scroller. Its id is its src. */
export const product: FluidboxImageItem = {
  type: "img",
  src: "/runner.svg",
  alt: "Illustrated coral running shoe",
  width: 1000,
  height: 700,
};
export const strip: FluidboxImageItem[] = [
  image("strip-alpine", "/art/alpine.svg", "Alpine ridge at dawn", 1920, 1080),
  image("strip-meadow", "/art/meadow.svg", "Meadow hills", 1600, 1200),
  // …six more
];

/** Custom content: your own renderer, a map, a video and a YouTube embed. */
export const media: FluidboxItem[] = [
  {
    type: "custom",
    id: "media-note",
    // Names the renderer the example registers.
    render: "note",
    title: "A note",
    width: 800,
    height: 600,
    thumbnail: { src: "/art/meadow.svg", width: 1200, height: 800 },
  },
  {
    type: "iframe",
    id: "media-map",
    src: "https://www.openstreetmap.org/export/embed.html?bbox=24.93104%2C60.16003%2C24.97396%2C60.17497&layer=mapnik&marker=60.1675%2C24.9525",
    title: "Helsinki Market Square on OpenStreetMap",
    width: 1000,
    height: 700,
    thumbnail: { src: "/map/preview.svg", width: 1000, height: 700 },
  },
  {
    type: "video",
    id: "media-video",
    src: "/video/drift.webm",
    title: "Drifting clouds",
    width: 960,
    height: 540,
    poster: "/video/drift-poster.jpg",
  },
  {
    type: "iframe",
    id: "media-youtube",
    src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    title: "Rick Astley - Never Gonna Give You Up",
    width: 1280,
    height: 720,
    allow: "autoplay; encrypted-media; picture-in-picture",
    // YouTube won't play an embed that sends no referrer.
    referrerPolicy: "strict-origin-when-cross-origin",
    thumbnail: {
      src: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      width: 1280,
      height: 720,
    },
  },
];

/** The value each framework passes down through its own context, read by the custom renderer. */
export const theme = "dusk";

/** The picture a trigger shows for an item: its thumbnail, a video's poster, or the image. */
export const thumbnailSrc = (item: FluidboxItem) =>
  item.thumbnail?.src ??
  (item.type === "video" ? item.poster : item.type === "img" ? item.src : "");
```

Import `@ogdakke/fluidbox/styles.css` once in your app (see [Getting started](../getting-started.md)). The class names (`pattern-grid`, `pattern-thumb`, …) are the examples' own styling; use yours.
