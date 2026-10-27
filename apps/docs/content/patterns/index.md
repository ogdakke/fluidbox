---
title: Overview
section: Patterns
order: 0
description: Thirteen common lightbox setups, each live and in every framework.
---

# Patterns

Each pattern is a small, complete example. Pick your framework in any tab, and every page remembers the choice. The live example above the code runs that code.

The examples leave out what an app does once. They assume `@ogdakke/fluidbox/styles.css` is imported, plus `@ogdakke/fluidbox/baseline.css` for the default look (see [Styling](../styling.md)). A pattern that shows an add-on imports the add-on's stylesheet, and `baseline.css` with it, since that is where the add-on's look is. With no `baseline.css`, the viewer still works, and its controls are plain text buttons.

| Pattern                                   | Shows                                                         |
| ----------------------------------------- | ------------------------------------------------------------- |
| [Gallery](./basic.md)                     | A trigger per photo and the default controls                  |
| [One trigger for an album](./overlay.md)  | Several items behind one thumbnail that follows the selection |
| [Rich origins](./origins.md)              | A photo inside a card, and a scroller that reveals on close   |
| [Custom content](./renderers.md)          | A slide of your own beside an iframe and a video              |
| [Programmatic control](./programmatic.md) | Open from code, read state, log changes, cancel moves         |
| [Zoom](./zoom.md)                         | Zoom controls and readout, a sharper image, or zoom off       |
| [Thumbnails](./thumbnails.md)             | The default strip, and your own thumbnails                    |
| [Sheet](./sheet.md)                       | A panel under the photo with snap points                      |
| [Headless controls](./headless.md)        | Your own caption bar and buttons                              |
| [Right to left](./rtl.md)                 | An Arabic gallery: the viewer reads right to left             |
| [Photo in the address](./url.md)          | `?photo=` opens a photo, and Back closes it                   |
| [Hover zoom](./hover.md)                  | A product photo that magnifies under a resting mouse          |
| [Product media](./media.md)               | A photo, a YouTube video, a 360° spin and a 3D model          |

## The example data

The examples import their items from `./data`. Each item is a plain object with an `id`, which triggers and `value` name it by; `WithId` makes the optional `id` required. Here is that module, with the longer lists cut short:

```ts
import type {
  FluidboxCustomItemBase,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxLabels,
} from "@ogdakke/fluidbox";
import { youtubeItem } from "@ogdakke/fluidbox/embed";
import { modelItem } from "@ogdakke/fluidbox/model";
import { spinItem } from "@ogdakke/fluidbox/spin";

/** An item with its id, which triggers and `value` name it by. */
export type WithId<T extends FluidboxItem = FluidboxImageItem> = T & { readonly id: string };

/** An image with its own id. The thumbnails on the page show the same file. */
const image = (id: string, src: string, alt: string, width: number, height: number): WithId => ({
  id,
  type: "image",
  src,
  alt,
  width,
  height,
});

/** Gallery, programmatic control, zoom off, thumbnails, sheet, headless controls and right to left. */
export const photos: WithId[] = [
  image("photo-aurora", "/art/aurora.svg", "Aurora over the tundra", 1100, 1650),
  image("photo-ridge", "/art/ridge.svg", "Night ridge", 1200, 1500),
  image("photo-fjord", "/art/fjord.svg", "Fjord in the blue hour", 1200, 1600),
  image("photo-lagoon", "/art/lagoon.svg", "Lagoon after sunset", 1800, 1200),
];

/** One trigger for an album: five items behind one thumbnail. */
export const album: WithId[] = [
  image("album-dune", "/art/dune.svg", "Dune at golden hour", 1800, 1200),
  image("album-canyon", "/art/canyon.svg", "Canyon walls", 1400, 1400),
  image("album-coast", "/art/coast.svg", "Coastline panorama", 2400, 1000),
  // …two more
];

/** Rich origins: a product card and a horizontal scroller. */
export const product: WithId = image(
  "runner",
  "/runner.svg",
  "Illustrated coral running shoe",
  1000,
  700,
);
export const strip: WithId[] = [
  image("strip-alpine", "/art/alpine.svg", "Alpine ridge at dawn", 1920, 1080),
  image("strip-meadow", "/art/meadow.svg", "Meadow hills", 1600, 1200),
  // …six more
];

/** Custom content: a note, an item type of the app's own. */
export interface NoteItem extends FluidboxCustomItemBase<"note"> {
  readonly id: string;
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    note: NoteItem;
  }
}

/** Custom content: a note, a map, a video and a YouTube embed. */
export const media: WithId<FluidboxItem>[] = [
  {
    type: "note",
    id: "media-note",
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

/**
 * Zoom: photos at two widths in `srcset`, and the full-size file as `zoom.src`,
 * which the viewer loads once a zoom shows more pixels than the 1280w has.
 */
const ladder = (id: string, alt: string, width: number, height: number): WithId => ({
  id: `zoom-${id}`,
  type: "image",
  src: `/photos/${id}-1280.webp`,
  srcset: `/photos/${id}-640.webp 640w, /photos/${id}-1280.webp 1280w`,
  zoom: { src: `/photos/${id}.webp` },
  alt,
  width,
  height,
  thumbnail: { src: `/photos/${id}-thumb.webp` },
});
export const zoomPhotos: WithId[] = [
  ladder("1015", "Fjord from the cliff edge", 1800, 1200),
  ladder("883", "Still lake", 1800, 1200),
  // …two more
];

/** Hover zoom: a product photo, shown on the page at 640w, magnified from the 1600w. */
export const productPhoto: WithId = {
  id: "fjord-wood",
  type: "image",
  src: "/products/fjord-wood.webp",
  srcset: "/products/fjord-wood-640.webp 640w, /products/fjord-wood.webp 1600w",
  alt: "The print in a wood frame",
  width: 1600,
  height: 1600,
  thumbnail: { src: "/products/fjord-wood-640.webp", width: 640, height: 640 },
};

/** Product media: a photo, a video, a 360° spin and a 3D model, from the add-ons' helpers. */
export const productMedia: WithId<FluidboxItem>[] = [
  productPhoto,
  youtubeItem("https://www.youtube.com/watch?v=M7lc1UVf-VE", {
    id: "product-video",
    title: "How the print is made",
    thumbnail: { src: "https://i.ytimg.com/vi/M7lc1UVf-VE/mqdefault.jpg", width: 320, height: 180 },
  }),
  spinItem({
    id: "product-spin",
    title: "The framed print, all the way round",
    frames: { src: "/products/spin/fjord-{index}.webp", count: 36, digits: 2 },
    width: 800,
    height: 800,
    thumbnail: { src: "/products/spin/fjord-00-thumb.webp", width: 160, height: 160 },
  }),
  modelItem({
    id: "product-model",
    // Khronos's glTF sample: CC BY-NC 4.0 © 2016 theblueturtle_, CC BY 4.0 © 2018 ctxwing.
    title: "Damaged Helmet, a 3D model",
    src: "/products/damaged-helmet/damaged-helmet.glb",
    poster: "/products/damaged-helmet/damaged-helmet.webp",
    width: 800,
    height: 800,
    thumbnail: {
      src: "/products/damaged-helmet/damaged-helmet-thumb.webp",
      width: 160,
      height: 160,
    },
  }),
];

/**
 * The model add-on draws Google's <model-viewer>, which it doesn't bundle. The
 * examples load a pinned build from its CDN; an app would `import("@google/model-viewer")`.
 */
export const modelViewerUrl =
  "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";

/** The value each framework passes down through its own context, read by the note slide. */
export const theme = "dusk";

/** The picture a trigger shows for an item: its thumbnail, a video's poster, or the image. */
export const thumbnailSrc = (item: FluidboxItem) =>
  item.thumbnail?.src ??
  (item.type === "video" ? item.poster : item.type === "image" ? item.src : "");

/** Right to left: the viewer's words in Arabic, with Arabic-Indic digits in the position. */
// Plain "ar" now formats with Western digits; nu-arab asks for Arabic-Indic ones.
const arabicNumber = new Intl.NumberFormat("ar-u-nu-arab");
export const arabic: Partial<FluidboxLabels> = {
  viewer: "عارض الوسائط",
  close: "إغلاق",
  previous: "السابق",
  next: "التالي",
  position: (index, count) =>
    `العنصر ${arabicNumber.format(index + 1)} من ${arabicNumber.format(count)}`,
  slides: "عناصر المعرض",
  thumbnails: "شريط الصور المصغّرة",
  thumbnailsList: "اختر عنصرًا من المعرض",
  zoomed: "صورة مكبّرة",
  sheet: "التفاصيل",
  error: "تعذّر تحميل الوسائط.",
  retry: "إعادة المحاولة",
};
```

The class names (`pattern-grid`, `pattern-thumb`, …) belong to the examples. Use your own.
