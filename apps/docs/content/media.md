---
title: Media types
section: Guides
order: 4
description: Every item type (img, video, iframe, custom) with all their fields, responsive images with srcset, sizes and sources, thumbnails, placeholders, renderers, and fields of your own.
---

# Media types

An item is one of four types: `"img"`, `"video"`, `"iframe"` or `"custom"`. They share one slide strip, one set of gestures and the same flights. Their fields are the attributes of the element the viewer draws, by DOM property name, so `srcset`, `poster` and `referrerPolicy` mean what they mean on `<img>`, `<video>` and `<iframe>`.

Every type needs `width` and `height` in pixels. The viewer uses their ratio to size the slide before anything loads. A photo fills the stage at that ratio, even past its own size; to show small photos no larger than their `width` and `height`, as PhotoSwipe does, set `--fluidbox-max-upscale: 1` (or `2` to allow twice their size) on the trigger or the page, and give the items their real pixel sizes.

Every type can also have:

| Field         | Type                | What it does                                                                                                                                                                               |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`          | `string`            | The item's identity across updates, for `open("id")`, events and triggers. Defaults to `src`, or `src#2`, `src#3` for an item in an array that repeats an earlier `src`. Unique in a list. |
| `thumbnail`   | `FluidboxThumbnail` | A small image of the item. See [Thumbnails and placeholders](#thumbnails-and-placeholders).                                                                                                |
| `placeholder` | `string`            | An image URL, such as a data URI, painted at once behind an image slide.                                                                                                                   |

## Image

`FluidboxImageItem`, drawn as an `<img>`, or a `<picture>` when it has `sources`:

| Field     | Type                      | What it does                                                 |
| --------- | ------------------------- | ------------------------------------------------------------ |
| `type`    | `"img"`                   | Required.                                                    |
| `src`     | `string`                  | Required. The full image.                                    |
| `alt`     | `string`                  | Required. Alt text. Also the filmstrip button's label.       |
| `width`   | `number`                  | Required. Intrinsic width.                                   |
| `height`  | `number`                  | Required. Intrinsic height.                                  |
| `srcset`  | `string`                  | The `<img>`'s `srcset`.                                      |
| `sizes`   | `string`                  | The `<img>`'s `sizes`. `"auto"` works too.                   |
| `sources` | `FluidboxPictureSource[]` | `<source>` elements of a `<picture>`, such as AVIF and WebP. |

Each `FluidboxPictureSource` has `srcset` (required), and `sizes`, `media` and `type`, as on `<source>`.

```ts
import type { FluidboxImageItem } from "@ogdakke/fluidbox";

const photo: FluidboxImageItem = {
  type: "img",
  id: "footpath",
  src: "/photos/footpath-2400.jpg",
  srcset: "/photos/footpath-1200.jpg 1200w, /photos/footpath-2400.jpg 2400w",
  sizes: "100vw",
  alt: "A footpath through tall grass",
  width: 2400,
  height: 1600,
  sources: [
    {
      type: "image/avif",
      srcset: "/photos/footpath-1200.avif 1200w, /photos/footpath-2400.avif 2400w",
    },
  ],
  thumbnail: { src: "/photos/footpath-400.jpg", width: 400, height: 267 },
};
```

Only images zoom. The viewer loads the full image for the current slide and the one on each side, and keeps the picture it already shows until the sharper one has decoded. If the full image fails, the slide shows "Unable to load media." with a Retry button.

## Video

`FluidboxVideoItem`, drawn as a `<video>`:

| Field         | Type                             | Default      | What it does                                                       |
| ------------- | -------------------------------- | ------------ | ------------------------------------------------------------------ |
| `type`        | `"video"`                        |              | Required.                                                          |
| `src`         | `string`                         |              | Required. The video file.                                          |
| `title`       | `string`                         |              | Required. The video's accessible name, and the filmstrip button's. |
| `width`       | `number`                         |              | Required. Intrinsic width.                                         |
| `height`      | `number`                         |              | Required. Intrinsic height.                                        |
| `poster`      | `string`                         |              | The poster frame's URL.                                            |
| `autoplay`    | `boolean`                        | `false`      | Plays when its slide comes into view, and pauses when it leaves.   |
| `loop`        | `boolean`                        | `false`      | Starts again at the end.                                           |
| `muted`       | `boolean`                        | `false`      | Starts muted. Browsers let a video autoplay only when it is muted. |
| `playsInline` | `boolean`                        | `true`       | Plays in the slide rather than full screen on iOS.                 |
| `controls`    | `boolean`                        | `true`       | Shows the browser's playback controls.                             |
| `preload`     | `"none" \| "metadata" \| "auto"` | `"metadata"` | How much to load before it plays.                                  |

```ts
import type { FluidboxVideoItem } from "@ogdakke/fluidbox";

const clip: FluidboxVideoItem = {
  type: "video",
  src: "/video/harbour.mp4",
  title: "Harbour timelapse",
  width: 1920,
  height: 1080,
  poster: "/video/harbour.jpg",
  thumbnail: { src: "/video/harbour-thumb.jpg", width: 480, height: 270 },
};
```

A video pauses when its slide leaves, and unloads when it leaves the loaded window. Moving a playing video would restart it, so a video closes inside its own frame instead of in the flight.

## Iframe

`FluidboxIframeItem`, drawn as an `<iframe>`:

| Field            | Type             | What it does                      |
| ---------------- | ---------------- | --------------------------------- |
| `type`           | `"iframe"`       | Required.                         |
| `src`            | `string`         | Required. The embedded page.      |
| `title`          | `string`         | Required. The iframe's `title`.   |
| `width`          | `number`         | Required. The frame's width.      |
| `height`         | `number`         | Required. The frame's height.     |
| `allow`          | `string`         | The iframe's `allow` attribute.   |
| `referrerPolicy` | `ReferrerPolicy` | The iframe's `referrerpolicy`.    |
| `sandbox`        | `string`         | The iframe's `sandbox` attribute. |

```ts
import type { FluidboxIframeItem } from "@ogdakke/fluidbox";

const map: FluidboxIframeItem = {
  type: "iframe",
  id: "market-map",
  src: "https://www.openstreetmap.org/export/embed.html?bbox=24.94,60.16,24.96,60.17",
  title: "Market Square on OpenStreetMap",
  width: 1000,
  height: 700,
  thumbnail: { src: "/map/market.png", width: 1000, height: 700 },
};
```

The iframe gets `loading="lazy"` and `allowfullscreen`. An embedded page paints well after the opening flight starts, so the viewer covers the frame with a still image until the page has loaded, then fades it out. On close it fades the still back in, so the frame lands as the picture it left from. The still is the item's `thumbnail`, else the trigger's image. Use a screenshot of what the embed first shows.

## Custom

`FluidboxCustomItem` names a renderer that draws your own content into the slide:

| Field    | Type       | What it does                                           |
| -------- | ---------- | ------------------------------------------------------ |
| `type`   | `"custom"` | Required.                                              |
| `id`     | `string`   | Required. Custom content has no `src` to fall back on. |
| `render` | `string`   | Required. The key of a renderer in `renderers`.        |
| `title`  | `string`   | Required. The content's accessible name.               |
| `width`  | `number`   | Required. The width the content is laid out at.        |
| `height` | `number`   | Required. The height the content is laid out at.       |

### Renderers

A renderer is a function. It gets `{ item, index, target, signal }` and draws into `target`, the slide's element. You may return a function that releases your own resources, such as timers or listeners. The viewer empties `target` itself afterwards. `signal` aborts at the same moment.

```ts
import { createFluidbox, type FluidboxRenderer } from "@ogdakke/fluidbox";

const note: FluidboxRenderer = ({ item, target }) => {
  const article = document.createElement("article");
  const tick = () => (article.textContent = `${item.id}, ${new Date().toLocaleTimeString()}`);
  tick();
  const timer = setInterval(tick, 1000);
  target.append(article);
  return () => clearInterval(timer);
};

const fluidbox = createFluidbox({
  items: [{ type: "custom", id: "note", render: "note", title: "A note", width: 800, height: 600 }],
  renderers: { note },
});
```

The same renderer shape fills filmstrip thumbnails, the sheet and travelling overlays. The framework roots take `renderers` as framework components, keyed the same way, and they keep your app's context. When a binding needs a wrapper, as React does, the wrapper has `data-fluidbox-mount` and `display: contents`, so your component's element still sizes to the slide as plain content does. An item whose renderer is missing throws a `TypeError` when its slide loads.

A custom slide mounts when it comes within one slide of the current one, and its cleanup runs when it moves further away. Keep state you need in your app, not in the mounted nodes. Clicks on buttons, links and fields inside custom content never count as zoom taps.

[Custom content](./patterns/renderers.md) shows a framework component, a map, a video and a YouTube embed in every framework.

## Thumbnails and placeholders

`thumbnail` is a `FluidboxThumbnail`: `src`, plus optional `srcset`, `sizes`, `width` and `height`.

| Field         | Used for                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `thumbnail`   | The filmstrip, the iframe still, and the picture shown while the full image loads.                  |
| `placeholder` | Image items only. Painted at once behind the slide, such as a blurred 32-pixel image or a data URI. |

While an image opens, the slide paints, from the bottom up: the `placeholder`, then the trigger's image or the `thumbnail`, then the full image once it has decoded. The frame's background, `--fluidbox-image-placeholder-background`, shows when there is none of them.

The filmstrip tries the `thumbnail`, then the full image or the video's poster, the smallest `srcset` candidate of each first. The slide and the iframe still show the thumbnail with its `srcset` and `sizes`, so the browser picks the candidate that fits.

## Items from `<img>` props

`imageItem(image, thumbnail?)` from `@ogdakke/fluidbox` builds an image item from the props an `<img>` takes, in React's spelling (`srcSet`) or the HTML one (`srcset`). `image` is the full-size picture for the viewer. `thumbnail`, at the triggers' `sizes`, becomes the item's `thumbnail`. A `url()` in either one's `style.backgroundImage` becomes the `placeholder`. That is where `next/image` puts its blur.

```ts
import { imageItem } from "@ogdakke/fluidbox";

const item = imageItem(
  {
    src: "/harbour-1600.jpg",
    srcSet: "/harbour-800.jpg 800w, /harbour-1600.jpg 1600w",
    sizes: "100vw",
    width: 1600,
    height: 1200,
    alt: "Harbour",
  },
  { src: "/harbour-400.jpg", sizes: "25vw" },
);
```

It throws a `TypeError` without a width and height. It returns a plain item, so spread it into an object of your own to add fields. [Next.js](./nextjs.md#the-items-from-the-optimizer) shows it with `getImageProps`.

## Fields of your own

Items are your own objects. Add any field, and the viewer hands your object back in every state, event and callback. Type them by extending an item type, and the type flows through:

```ts
import { createFluidbox, type FluidboxImageItem } from "@ogdakke/fluidbox";

interface Photo extends FluidboxImageItem {
  readonly caption: string;
}

declare const photos: Photo[];

createFluidbox<Photo>({
  items: photos,
  viewer({ target, fluidbox }) {
    const caption = document.createElement("p");
    target.append(caption);
    return fluidbox.subscribe(({ item }) => {
      if (item) caption.textContent = item.caption;
    });
  },
});
```

Content in the viewer fades in and out with the controls. See [Styling](./styling.md#your-own-controls). [Headless controls](./patterns/headless.md) builds a caption bar in every framework.
