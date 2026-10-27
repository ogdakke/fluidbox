---
title: Product media
section: Guides
order: 4.5
description: YouTube and Vimeo videos that load their player on Play, 360° spins, and 3D models with model-viewer, as add-ons that cost the core nothing. Slides that play and pause as they come on show, and content that keeps its own gestures.
---

# Product media

A product page mixes photos with a video, a spin of the product and a model of it. Three add-on entries draw them as [slides of their own types](./media.md#types-of-your-own). Each is a slide and an item helper, so they add nothing to the core bundle until you import them, and they open from their trigger like a photo: the thumbnail flies, and a sharper poster takes over once it has decoded.

| Entry                     | Exports                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `@ogdakke/fluidbox/embed` | `embedSlide`, `createEmbedSlide`, `youtubeItem`, `vimeoItem`, `embedItem`, `createEmbedProvider`, `youtube`, `vimeo` |
| `@ogdakke/fluidbox/spin`  | `spinItem`, `createSpinSlide`, `spinFrames`                                                                          |
| `@ogdakke/fluidbox/model` | `modelItem`, `createModelSlide`                                                                                      |

Here is one gallery with all three beside a photo. Press Play on the video: only then does YouTube's player load. Drag the spin, or focus it and press the arrow keys. The model's card is a live `<model-viewer>`: drag it to turn it, then click it, and the viewer opens on the view you left. The example loads `<model-viewer>` 4.0.0 from Google's CDN with the page, since the card draws it.

<!-- pattern: media -->

<small>3D model: <a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DamagedHelmet">Damaged Helmet</a>, from the Khronos glTF Sample Assets. © 2016 theblueturtle\_, <a href="https://creativecommons.org/licenses/by-nc/4.0/">CC BY-NC 4.0</a>; glTF rebuild © 2018 ctxwing, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. For non-commercial use only. It is a sample for these docs: don't ship it in a product page of your own.</small>

The entries are safe to import on the server. They add their few rules to the page in `:where()`, so any rule of yours wins.

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import { embedSlide, youtubeItem } from "@ogdakke/fluidbox/embed";
import { createModelSlide, modelItem } from "@ogdakke/fluidbox/model";
import { createSpinSlide, spinItem } from "@ogdakke/fluidbox/spin";

createFluidbox({
  items: [
    ...photos,
    youtubeItem("https://youtu.be/M7lc1UVf-VE", { title: "How the print is made" }),
    spinItem({
      title: "The print, all the way round",
      frames: { src: "/spin/print-{index}.webp", count: 36, digits: 2 },
      width: 800,
      height: 800,
    }),
    modelItem({
      title: "The print in 3D",
      src: "/print.glb",
      poster: "/print-model.webp",
      width: 800,
      height: 800,
      ar: true,
    }),
  ],
  slides: {
    embed: embedSlide,
    spin: createSpinSlide(),
    model: createModelSlide({ load: () => import("@google/model-viewer") }),
  },
});
```

The items' types name the slide that draws them: `"embed"`, `"spin"` and `"model"`.

## YouTube and Vimeo

`youtubeItem(source, options)` and `vimeoItem(source, options)` take a URL or an id. They read the forms people paste:

| Provider | Forms                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| YouTube  | `watch?v=`, `youtu.be/`, `shorts/`, `live/`, `embed/` and `youtube-nocookie.com` URLs, with a start from `t=90`, `t=1m30s` or `start=` |
| Vimeo    | `vimeo.com/id`, channel, group, album and showcase pages, `player.vimeo.com/video/id`, a private link's hash, and `#t=1m5s`            |

Anything else throws a `TypeError`; `youtube.parse` and `vimeo.parse` return `null` instead. A Short stands upright at 720 × 1280; every other video defaults to 1280 × 720. Options are `title` (required), `id`, `width`, `height`, `thumbnail`, `poster` and `start`.

The slide shows the `thumbnail`, then the `poster` over it, and a Play button named "Play" and the title, as text: the package ships no icon. A YouTube video's poster defaults to YouTube's own still. Vimeo has no still at a fixed URL, so give a Vimeo video a `poster` or a `thumbnail`.

Nothing loads from the provider until Play is pressed. Then the slide makes the player's iframe, with focus in it:

- YouTube plays from the privacy-enhanced `https://www.youtube-nocookie.com`, Vimeo from `https://player.vimeo.com` with Do Not Track. Both are https, with the player's script API on.
- The iframe gets `allow="autoplay; fullscreen; picture-in-picture; encrypted-media"`, `allowfullscreen`, a `sandbox` that lets the player run, and `referrerpolicy="strict-origin-when-cross-origin"`, without which YouTube won't play.
- When the viewer moves to another slide, the player pauses through its own postMessage API. When the slide unloads, two slides away or more, the player goes with it. A playing video closes in its frame rather than flying, as an iframe item does, and a closed viewer leaves it on its poster for the next open.

`createEmbedSlide({ label })` sets the Play button's name and text: ``label: (item) => `Toista ${item.title}` ``. `play: () => icon` gives the button content of your own, and the label becomes its `aria-label`.

### Another video site

A provider is a name, the player's https origin, and how to read a URL and make the player's. `createEmbedProvider` checks them: the player's URL must be on the origin, or the slide shows its error rather than load another page. Give the slide every provider it plays, and make items with `embedItem`:

```ts
import { createEmbedProvider, createEmbedSlide, embedItem, youtube } from "@ogdakke/fluidbox/embed";

const wistia = createEmbedProvider({
  name: "wistia",
  origin: "https://fast.wistia.net",
  parse: (source) => {
    const video =
      /(?:medias|iframe)\/(\w+)/.exec(source)?.[1] ?? (/^\w+$/.test(source) ? source : null);
    return video ? { video } : null;
  },
  url: (item, { autoplay }) =>
    `https://fast.wistia.net/embed/iframe/${item.video}?autoPlay=${autoplay}`,
});

const slide = createEmbedSlide({ providers: [youtube, wistia] });
const tour = embedItem(wistia, "https://example.wistia.com/medias/abc123", { title: "A tour" });
```

A provider without `pause` sends the slide back to its poster when the viewer moves away. An item whose provider the slide doesn't have shows the slide's error.

## 360° spins

`spinItem(options)` takes the frames of one full turn in order: a list of URLs, or a template, `{ src, count, start, digits }`, whose `{index}` is the frame's number. `start` is the first number and `digits` pads it with zeros. Besides `title`, `width` and `height`, it takes `thumbnail`, `id` (the first frame's URL by default) and `autoplay`.

- **Frame 0 shows at once.** It is the poster, over the thumbnail, and what the opening flight lands on. The other frames load at low priority once the spin is first on show, spread round the turn first, so an early drag already passes frames all the way round. A spin beside the slide on show loads only frame 0.
- **A horizontal drag turns it.** A drag across the whole spin is one turn; `createSpinSlide({ turns })` changes that. A throw keeps it turning, slowing until it settles on a frame. With reduced motion it stops where the pointer lets go.
- **It is a slider.** The spin is focusable with `role="slider"`, named by the item's `title`. The arrow keys step a frame, Home and End go to the first and the last, and the value reads "Frame 12 of 36". `createSpinSlide({ label: (frame, count) => … })` translates it.
- **`autoplay`** turns it while it is on show, `true` for a turn in six seconds or a number of seconds, until someone drags it or presses a key. Never with reduced motion.
- **Memory stays bounded.** It keeps at most 48 frames decoded, `createSpinSlide({ keep })`. The rest stay in the browser's cache and decode again on the way past.

The spin's element has `data-fluidbox-spin`, `data-frame` with the frame on show, `data-fluidbox-spin-loaded` once every frame has loaded, and `data-grabbing` while dragged.

## 3D models

The model slide draws Google's [`<model-viewer>`](https://modelviewer.dev). The add-on is tested against `<model-viewer>` 4.0.0; pin that version. It doesn't bundle it: it is about 290 kB gzipped. Either load it yourself, or give `createModelSlide` a `load` function, which it calls when a model is first opened or comes on show. Either way it waits for `customElements.whenDefined("model-viewer")`.

```ts
createModelSlide({ load: () => import("@google/model-viewer") });
```

`modelItem(options)` takes `src` (a `.glb` or `.gltf`) and `title`, and optionally `id` (`src` by default), `thumbnail`, `poster`, `ar`, `arModes` and `iosSrc` for augmented reality, and `attributes` for any other `<model-viewer>` attribute, such as `{ "camera-orbit": "45deg 75deg 2m" }`. It sets `fit: "fill"`, so the model fills the stage; `width` and `height` then only shape the poster. The element gets `camera-controls`, `touch-action="none"` and the title as its `alt`.

The model being opened starts loading at once, and the opening flight waits for its first frame, at most three seconds; on a slow connection it flies on the poster. The thumbnail and the poster show until the model has loaded; a slide beside the one on show keeps its poster and loads nothing. The box gets `data-fluidbox-model-ready` once the model shows, and `data-fluidbox-model-error` if it fails, keeping the poster. A close carries home a snapshot of the view the model shows, rather than the live model.

A card can show the model live, for the user to turn before opening it. [Live 3D thumbnails](./live-3d-thumbnails.md) gives the card's markup and what the viewer does with it.

On the model, a drag turns it, a pinch or a trackpad pinch zooms it, and the arrow keys turn it while it has focus. None of them swipe, dismiss or zoom the viewer. A swipe that starts beside the model, the buttons, the keys off the model and the thumbnails still move the viewer, and Escape still closes it.

## Content that owns its gestures

The spin and the model keep their gestures through one contract any slide can use. An element with `data-fluidbox-owns-input`, or inside one, owns the gestures and keys that start on it:

- **Touches.** A touch on it never drags the viewer to dismiss. Give it `touch-action: none` (or `pan-y` to keep vertical swipes) so the browser doesn't scroll the slides either.
- **Pinch.** A two-finger pinch, a trackpad's pinch (a wheel with the control key) and Safari's gesture events reach the element; the viewer doesn't zoom and the page doesn't zoom either.
- **Wheel.** A vertical wheel on it doesn't dismiss the viewer.
- **Keys.** The arrow keys, Page Up and Down, Home and End pressed on it are its own; Escape still belongs to the viewer, and Tab moves focus as it does on any page.

The thumbnails and the sheet use the same attribute.

## Slides that play and pause

A slide renderer gets members that follow whether its slide is the one on show:

<!-- api: FluidboxSlide -->

A slide mounts once it is within one slide of the current one, so it often mounts before it shows, and `active` starts false. `onActiveChange` calls back with `true` as it comes on show, as the viewer opens on it or a swipe lands on it, and `false` as the viewer moves away or closes. The slide that leaves hears first, so its player stops before the next one starts. The `signal` aborts when the slide unloads, which ends the listening too.

```ts
import type { FluidboxSlideRenderer } from "@ogdakke/fluidbox";

const clip: FluidboxSlideRenderer = ({ item, media, active, onActiveChange }) => {
  const video = document.createElement("video");
  video.src = `/clips/${item.id}.mp4`;
  video.muted = true;
  media.append(video);
  if (active) void video.play();
  onActiveChange((now) => (now ? void video.play() : video.pause()));
};
```

In the frameworks, a component inside a slide reads the same members from `useFluidboxSlide()` (React, Vue and Solid) or `injectFluidboxSlide()` (Angular), with `active` in the framework's reactive form. See [React](./react.md), [Vue](./vue.md), [Solid](./solid.md) and [Angular](./angular.md).

### A player of your own continues the trigger's video

The built-in video picks up where a playing trigger video is, and hands its time back as the viewer closes. A player of your own, such as Mux Player, Vidstack or Video.js, gets the same through two members of its slide:

- `origin` is set on the slide an open starts from a trigger whose picture is a `<video>`: `origin.video` reads that video's `currentTime`, `paused` and `muted` live. It is null on the neighbours, on slides reached by moving, and for an open with no trigger.
- `returnPlayback(source)` registers what a close from this slide reads once, before its flight: anything with `currentTime` and `paused`, or a function that returns them or null. The trigger's video seeks to that time and plays unless it is paused. With nothing registered, the trigger's video is left alone.

```ts
import type { FluidboxSlideRenderer } from "@ogdakke/fluidbox";
import videojs from "video.js";

const film: FluidboxSlideRenderer = (slide) => {
  const element = document.createElement("video");
  slide.media.append(element);
  const player = videojs(element);
  const from = slide.origin?.video;
  if (from) {
    player.ready(() => {
      player.muted(from.muted);
      player.currentTime(from.currentTime);
      if (!from.paused) void player.play();
    });
  }
  return slide.returnPlayback(() => ({
    currentTime: player.currentTime(),
    paused: player.paused(),
  }));
};
```

An open doesn't wait for your player's seek. To land the flight on the trigger's frame, wrap the seek in `slide.waitUntil`. `returnPlayback` is the video form of `slide.onClose(listener)`, which hears every close from the slide with what the trigger it lands on shows; the model slide uses it to hand its view back to a live card. See [Live 3D thumbnails](./live-3d-thumbnails.md#slides-of-your-own).

### The add-ons in a framework

The add-ons' slides are plain slide renderers: they draw into the slide's media box. The plain JS API takes them as they are, in `slides`. Each binding has a part per add-on, in an entry of its own, which draws it as its framework's `Media` and takes the add-on's options as props or inputs. A component of your own in a slide gets the whole slide API from `useFluidboxSlide()` (React, Vue and Solid) or `injectFluidboxSlide()` (Angular), the same in every binding: `item`, `index`, `active`, `opening`, `signal`, `onActiveChange`, `origin`, `returnPlayback`, `onClose`, `waitUntil`, `fail` and `onZoom`. See [React](./react.md), [Vue](./vue.md), [Solid](./solid.md) and [Angular](./angular.md) for the code.

| Binding         | Parts                                                     | From                                                                    |
| --------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| React           | `Embed`, `Spin`, `Model`                                  | `@ogdakke/fluidbox/react/embed`, `/react/spin`, `/react/model`          |
| Vue             | `Embed`, `Spin`, `Model`                                  | `@ogdakke/fluidbox/vue/embed`, `/vue/spin`, `/vue/model`                |
| Solid           | `Embed`, `Spin`, `Model`                                  | `@ogdakke/fluidbox/solid/embed`, `/solid/spin`, `/solid/model`          |
| Angular         | `<fluidbox-embed>`, `<fluidbox-spin>`, `<fluidbox-model>` | `@ogdakke/fluidbox/angular/embed`, `/angular/spin`, `/angular/model`    |
| Custom elements | markup readers and slides                                 | `@ogdakke/fluidbox/elements/embed`, `/elements/spin`, `/elements/model` |

The elements entries read a YouTube or Vimeo `<iframe>`, an `<img data-spin-frames>` and a `<model-viewer>` in an item's content template as the add-on's item. See [Custom elements](./custom-elements.md#add-ons).

Pick the tab of your framework above for the code. The loading of `<model-viewer>` is the same everywhere: the example loads a pinned build from Google's CDN, as `load: () => import(/* @vite-ignore */ url)`. In an app, install `@google/model-viewer@4.0.0` and pass `load: () => import("@google/model-viewer")`, or load it yourself.
