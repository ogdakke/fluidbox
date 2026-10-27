---
title: Media types
section: Guides
order: 4
description: Every item type (image, video, iframe, and types of your own) with all their fields, responsive images with srcset, sizes and sources, zoom images, video sources and streaming, thumbnails, placeholders, slides of your own, and fields of your own.
---

# Media types

An item is an image, a video, an iframe, or a type of your own. They share one slide strip, one set of gestures and the same flights. The built-in types' fields are the attributes of the element the viewer draws, by DOM property name, so `srcset`, `poster` and `referrerPolicy` mean what they mean on `<img>`, `<video>` and `<iframe>`.

Every built-in type needs `width` and `height` in pixels. The viewer uses their ratio to size the slide before anything loads. A photo fills the stage at that ratio, even past its own size; to show small photos no larger than their `width` and `height`, set `--fluidbox-max-upscale: 1` (or `2` to allow twice their size) on the trigger or the page, and give the items their real pixel sizes.

Every type can also have:

| Field         | Type                                    | What it does                                                                                                                                                                               |
| ------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`          | `string`                                | The item's identity across updates, for `open("id")`, events and triggers. Defaults to `src`, or `src#2`, `src#3` for an item in an array that repeats an earlier `src`. Unique in a list. |
| `thumbnail`   | `FluidboxThumbnail`                     | A small image of the item. See [Thumbnails and placeholders](#thumbnails-and-placeholders).                                                                                                |
| `placeholder` | `string`                                | An image URL, such as a data URI, painted at once behind an image slide.                                                                                                                   |
| `caption`     | `string`                                | Text a caption part shows. It becomes the dialog's description.                                                                                                                            |
| `fit`         | `"contain" \| "fill"`                   | How the media box is sized: to `width` and `height`, fitted in the stage (`"contain"`, the default), or to the whole stage (`"fill"`), as a 3D view or a map wants. Ignored on images.     |
| `download`    | `string \| false \| { src, filename? }` | The file Download saves. Defaults to an image's `zoom.src ?? src` and a video's `src`; other types have none.                                                                              |
| `data`        | `Readonly<Record<string, string>>`      | Becomes `data-*` on the slide, its thumbnail and the server copy's slide: `{ tone: "light" }` gives `data-tone="light"`.                                                                   |

## Image

`FluidboxImageItem`, drawn as an `<img>`, or a `<picture>` when it has `sources`:

| Field     | Type                      | What it does                                                                                                  |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `type`    | `"image"`                 | Required.                                                                                                     |
| `src`     | `string`                  | Required. The full image.                                                                                     |
| `alt`     | `string`                  | Required. Alt text. Also the thumbnail button's name.                                                         |
| `width`   | `number`                  | Required. Intrinsic width.                                                                                    |
| `height`  | `number`                  | Required. Intrinsic height.                                                                                   |
| `srcset`  | `string`                  | The `<img>`'s `srcset`.                                                                                       |
| `sizes`   | `string`                  | The `<img>`'s `sizes`. `"auto"` works too.                                                                    |
| `sources` | `FluidboxPictureSource[]` | `<source>` elements of a `<picture>`, such as AVIF and WebP.                                                  |
| `zoom`    | `{ src?, srcset? }`       | Larger images for zoom and [hover zoom](./patterns/zoom.md). See [Sharper when zoomed](#sharper-when-zoomed). |

Each `FluidboxPictureSource` has `srcset` (required), and `sizes`, `media` and `type`, as on `<source>`.

```ts
import type { FluidboxImageItem } from "@ogdakke/fluidbox";

const photo: FluidboxImageItem = {
  type: "image",
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

The viewer loads the full image for the current slide and the one on each side, and keeps the picture it already shows until the sharper one has decoded. If the full image fails, the slide shows the `error` label, "Unable to load media.", and a Retry control, and the fluidbox fires `mediaerror`.

### Sharper when zoomed

Images zoom by default. `zoom.src` is a master file kept apart from the `srcset`, loaded once a zoom shows more pixels than the slide's own source has. `zoom.srcset` lists larger candidates with width descriptors, of which the viewer loads the smallest that is sharp at the scale the zoom rests at.

```ts
import type { FluidboxImageItem } from "@ogdakke/fluidbox";

const harbour: FluidboxImageItem = {
  type: "image",
  src: "/photos/harbour-1280.webp",
  srcset: "/photos/harbour-640.webp 640w, /photos/harbour-1280.webp 1280w",
  zoom: { src: "/photos/harbour.webp" },
  alt: "The harbour at dawn",
  width: 4000,
  height: 3000,
};
```

[Zoom](./patterns/zoom.md) shows it live, with the zoom options and hover zoom.

## Video

`FluidboxVideoItem`, drawn as a `<video>`:

| Field         | Type                             | Default      | What it does                                                                                                                              |
| ------------- | -------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `type`        | `"video"`                        |              | Required.                                                                                                                                 |
| `src`         | `string`                         |              | Required. The video file: an http(s), relative or `blob:` URL. With `sources`, the last resort, drawn as the last `<source>`.             |
| `title`       | `string`                         |              | Required. The video's accessible name, and the thumbnail button's.                                                                        |
| `width`       | `number`                         |              | Required. Intrinsic width.                                                                                                                |
| `height`      | `number`                         |              | Required. Intrinsic height.                                                                                                               |
| `sources`     | `readonly FluidboxVideoSource[]` |              | Encodings to try first, in order: `{ src, type?, media? }`, each a `<source>`, such as AV1, then WebM, then `src` as MP4.                 |
| `poster`      | `string`                         |              | The poster frame's URL, with the same schemes as `src`.                                                                                   |
| `autoplay`    | `boolean`                        | `false`      | Plays when its slide comes into view, and pauses when it leaves.                                                                          |
| `loop`        | `boolean`                        | `false`      | Starts again at the end.                                                                                                                  |
| `muted`       | `boolean`                        | `false`      | Starts muted. Browsers let a video autoplay only when it is muted.                                                                        |
| `playsInline` | `boolean`                        | `true`       | Plays in the slide rather than full screen on iOS.                                                                                        |
| `controls`    | `boolean`                        | `true`       | Shows the browser's playback controls.                                                                                                    |
| `preload`     | `"none" \| "metadata" \| "auto"` | `"metadata"` | How much to load before it plays.                                                                                                         |
| `tracks`      | `readonly FluidboxVideoTrack[]`  |              | Captions and other text tracks: `{ src, kind?, srclang?, label?, default? }`, each a `<track>`, its `src` with the same schemes as `src`. |

```ts
import type { FluidboxVideoItem } from "@ogdakke/fluidbox";

const clip: FluidboxVideoItem = {
  type: "video",
  src: "/video/harbour.mp4",
  sources: [{ src: "/video/harbour.webm", type: "video/webm" }],
  title: "Harbour timelapse",
  width: 1920,
  height: 1080,
  poster: "/video/harbour.jpg",
  thumbnail: { src: "/video/harbour-thumb.jpg", width: 480, height: 270 },
};
```

Give a video with speech `tracks` of kind `"captions"`, which the browser's controls let viewers turn on. A track on another origin needs CORS. A video pauses when its slide leaves, and unloads when it leaves the loaded window. Moving a video into the flight would reset its playback, so a video closes inside its own frame instead.

When a trigger shows a playing `<video>` of the item, the viewer's video picks up at the trigger's time, and hands its time back as the viewer closes. [Product media](./product-media.md#a-player-of-your-own-continues-the-triggers-video) does the same for a player of your own.

### Streaming

To load the media yourself, as hls.js or dash.js do, give the built-in video an `attach` function through `videoSlide`. The runtime then sets no `src` and no `<source>`, and calls `attach(video, signal, item, slide)` when the slide loads, neighbours too. Start fetching segments once `slide.active` or `slide.opening` is true, or `slide.onActiveChange` says so, and stop when `signal` aborts.

```ts
import { createFluidbox, videoSlide, type FluidboxVideoItem } from "@ogdakke/fluidbox";

declare const clips: FluidboxVideoItem[];
declare function stream(video: HTMLVideoElement, url: string, signal: AbortSignal): void;

createFluidbox({
  items: clips,
  slides: {
    video: videoSlide({
      attach: (video, signal, item) => stream(video, item.src, signal),
    }),
  },
});
```

The item's URLs are still checked; what `attach` loads is yours to trust.

## Iframe

`FluidboxIframeItem`, drawn as an `<iframe>`:

| Field            | Type             | What it does                                                   |
| ---------------- | ---------------- | -------------------------------------------------------------- |
| `type`           | `"iframe"`       | Required.                                                      |
| `src`            | `string`         | Required. The embedded page: an http(s) or relative URL.       |
| `title`          | `string`         | Required. The iframe's `title`.                                |
| `width`          | `number`         | Required. The frame's width.                                   |
| `height`         | `number`         | Required. The frame's height.                                  |
| `allow`          | `string`         | The iframe's `allow` attribute.                                |
| `referrerPolicy` | `ReferrerPolicy` | The iframe's `referrerpolicy`.                                 |
| `sandbox`        | `string`         | The iframe's `sandbox` attribute. See [Safe URLs](#safe-urls). |

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

For YouTube and Vimeo, the [embed add-on](./product-media.md#youtube-and-vimeo) shows a poster and loads the player only on Play.

## Safe URLs

Embed and video URLs often come from merchants or users, so the viewer only loads what can't run script in your page. An iframe's `src` must be an `http:`, `https:` or relative URL; a video's `src`, `sources` and `poster` may also be `blob:` object URLs. Anything else (`javascript:`, `data:`, `vbscript:`, `file:`, an iframe's `blob:`) throws a `TypeError` naming the item when the items are read, in `createFluidbox`, `setItems`, `createItemList` and `<fluidbox-item>`. A list of your own that skips those checks shows the slide's load error instead.

An iframe item without `sandbox` gets

```text
allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation
```

which YouTube, Vimeo and map embeds need, and which stops the embedded page navigating your page, opening dialogs or starting downloads. Fullscreen comes from `allow="fullscreen"` and `allowfullscreen`, not the sandbox. A `sandbox` of your own replaces the default as written; `sandbox: ""` turns everything off. The sandbox is a boundary only for a page on another origin: a same-origin page with `allow-scripts allow-same-origin` can lift it, so frame untrusted pages from their own origin.

## Types of your own

An item of your own has a `type` of your choosing, a `title` (the slide's and the dialog's accessible name), and a `width` and `height` for its media box, which `fit: "fill"` makes optional. `FluidboxCustomItemBase<"note">` is that shape. Add the type to `FluidboxItemTypes` by declaration merging, so `slides`, events and state know it:

```ts
import {
  createFluidbox,
  type FluidboxCustomItemBase,
  type FluidboxSlideRenderer,
} from "@ogdakke/fluidbox";

interface NoteItem extends FluidboxCustomItemBase<"note"> {
  readonly text: string;
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    note: NoteItem;
  }
}

const note: FluidboxSlideRenderer<NoteItem> = (slide) => {
  const article = document.createElement("article");
  article.textContent = slide.item.text;
  slide.media.append(article);
  return () => article.remove();
};

createFluidbox({
  items: [{ type: "note", id: "note", title: "A note", text: "Hello", width: 800, height: 600 }],
  slides: { note },
});
```

### Slides

The `slides` option draws slides by item type. A type looks up its own entry, then the built-in slide of images, videos and iframes, then `default`. A type with none shows the slide's error. A slide renderer gets a `FluidboxSlide` and may return a function that releases your own resources, such as timers or listeners. The runtime empties the box afterwards, and `slide.signal` aborts at the same moment.

| Member                                          | What it is                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `item`, `index`                                 | The item, and its index, read live: new items keep a slide whose item moved.                                                   |
| `media`                                         | The media box: the element that flies, follows a drag to dismiss and zooms. Draw your media here.                              |
| `layer`                                         | A layer over the whole slide, beside the box. It doesn't fly or zoom, and shows and hides with the controls.                   |
| `drawImage()`, `drawVideo()`, `drawIframe()`    | Draw the built-in media into the box, of the item or of another item: it loads, sharpens and fails as the built-in slides do.  |
| `zoomable(on)`                                  | Let the box zoom, or stop it. Off for your own media, on for `drawImage`.                                                      |
| `onZoom(listener)`                              | Follow the box's zoom pose.                                                                                                    |
| `waitUntil(promise)`                            | Make the opening flight also wait for something the runtime can't see, such as a canvas having painted. At most three seconds. |
| `fail(error?)`                                  | Put the slide in its error state, with Retry, and fire `mediaerror` of kind `"custom"`.                                        |
| `hotspot(options)`                              | Add a button on a point of the media. See [Hotspots](./hotspots.md).                                                           |
| `active`, `opening`, `onActiveChange`, `signal` | Whether it is on show, and when that changes. See [Slides that play and pause](./product-media.md#slides-that-play-and-pause). |
| `origin`, `returnPlayback`, `onClose`           | What the trigger showed, and handing state back to it on close. See [Live 3D thumbnails](./live-3d-thumbnails.md).             |

A slide mounts when it comes within one slide of the current one, and its cleanup runs when it moves further away. Keep state you need in your app, not in the mounted nodes. Content marked `data-fluidbox-owns-input` keeps its own drags, pinches and arrow keys; see [Content that owns its gestures](./product-media.md#content-that-owns-its-gestures).

A slide can also draw a built-in type its own way, as `slides: { image: (slide) => slide.drawImage() }` with your own parts beside it. The framework bindings take slides as their own content, with `Media` as the box; see [React](./react.md), [Vue](./vue.md), [Solid](./solid.md), [Angular](./angular.md) and [Custom elements](./custom-elements.md). [Custom content](./patterns/renderers.md) shows a framework component, a map, a video and a YouTube embed in every framework. [Product media](./product-media.md) has add-ons for YouTube and Vimeo videos that load their player on Play, 360° spins and 3D models.

## Thumbnails and placeholders

`thumbnail` is a `FluidboxThumbnail`: `src`, plus optional `srcset`, `sizes`, `width` and `height`.

| Field         | Used for                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `thumbnail`   | The thumbnails, the iframe still, and the picture shown while the full image loads.                 |
| `placeholder` | Image items only. Painted at once behind the slide, such as a blurred 32-pixel image or a data URI. |

While an image opens, the slide paints, from the bottom up: the `placeholder`, then the trigger's image or the `thumbnail`, then the full image once it has decoded. With `baseline.css`, `--fluidbox-image-placeholder-background` shows when there is none of them.

The [thumbnails](./thumbnails-and-sheet.md#thumbnails) try the `thumbnail`, then the full image or the video's poster, the smallest `srcset` candidate of each first. The slide and the iframe still show the thumbnail with its `srcset` and `sizes`, so the browser picks the candidate that fits.

## Items from `<img>` props

`imageItem(image, thumbnail?, zoom?)` from `@ogdakke/fluidbox` builds an image item from the props an `<img>` takes, in React's spelling (`srcSet`) or the HTML one (`srcset`). `image` is the full-size picture for the viewer. `thumbnail`, at the triggers' `sizes`, becomes the item's `thumbnail`. A `url()` in either one's `style.backgroundImage` becomes the `placeholder`. That is where `next/image` puts its blur. `zoom` becomes the item's `zoom`.

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

It throws a `TypeError` without a width and height. It returns a plain item, so spread it into an object of your own to add fields. [Next.js](./nextjs.md) shows it with `getImageProps`.

## Fields of your own

Items are your own objects. Add any field, and the viewer hands your object back in every state, event and callback. Type them by extending an item type, and the type flows through:

```ts
import { createFluidbox, type FluidboxImageItem } from "@ogdakke/fluidbox";

interface Photo extends FluidboxImageItem {
  readonly credit: string;
}

declare const photos: Photo[];

createFluidbox<Photo>({
  items: photos,
  viewer({ target, fluidbox }) {
    const credit = document.createElement("p");
    target.append(credit);
    return fluidbox.subscribe(({ item }) => {
      if (item) credit.textContent = item.credit;
    });
  },
});
```

Content in the viewer fades in and out with the controls. See [Styling](./styling.md). [Headless controls](./patterns/headless.md) builds a caption bar in every framework.
