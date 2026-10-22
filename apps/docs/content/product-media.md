---
title: Product media
section: Guides
order: 4.5
description: YouTube and Vimeo videos that load their player on Play, 360° spins, and 3D models with model-viewer, as add-ons that cost the core nothing. Slides that play and pause as they come on show, and content that keeps its own gestures.
---

# Product media

A product page mixes photos with a video, a spin of the product and a model of it. Three add-on entries draw them as [custom slides](./media.md#custom). Each is a renderer and an item helper, so they add nothing to the core bundle until you import them, and they open from their trigger like a photo: the thumbnail flies, and a sharper poster takes over once it has decoded.

| Entry                      | Exports                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `@ogdakke/fluidbox/embeds` | `youtubeItem`, `vimeoItem`, `renderEmbed`, `createEmbedRenderer`, `parseYouTube`, `parseVimeo` |
| `@ogdakke/fluidbox/spin`   | `spinItem`, `createSpinRenderer`, `spinFrames`                                                 |
| `@ogdakke/fluidbox/model`  | `modelItem`, `createModelRenderer`                                                             |

The entries are safe to import on the server. They add their few rules to the page in `:where()`, so any rule of yours wins.

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import { renderEmbed, youtubeItem } from "@ogdakke/fluidbox/embeds";
import { createModelRenderer, modelItem } from "@ogdakke/fluidbox/model";
import { createSpinRenderer, spinItem } from "@ogdakke/fluidbox/spin";

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
  renderers: {
    embed: renderEmbed,
    spin: createSpinRenderer(),
    model: createModelRenderer({ load: () => import("@google/model-viewer") }),
  },
});
```

The item helpers name the renderer they need in `render`: `"embed"`, `"spin"` and `"model"`. Pass `render` to use another key.

## YouTube and Vimeo

`youtubeItem(source, options)` and `vimeoItem(source, options)` take a URL or an id. They read the forms people paste:

| Provider | Forms                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| YouTube  | `watch?v=`, `youtu.be/`, `shorts/`, `live/`, `embed/` and `youtube-nocookie.com` URLs, with a start from `t=90`, `t=1m30s` or `start=` |
| Vimeo    | `vimeo.com/id`, channel, group, album and showcase pages, `player.vimeo.com/video/id`, a private link's hash, and `#t=1m5s`            |

Anything else throws a `TypeError`; `parseYouTube` and `parseVimeo` return `null` instead. A Short stands upright at 720 × 1280; every other video defaults to 1280 × 720. Options are `title` (required), `id`, `width`, `height`, `thumbnail`, `poster`, `start` and `render`.

The slide shows the `thumbnail`, then the `poster` over it, and a Play button named "Play" and the title. A YouTube video's poster defaults to YouTube's own still. Vimeo has no still at a fixed URL, so give a Vimeo video a `poster` or a `thumbnail`.

Nothing loads from the provider until Play is pressed. Then the slide makes the player's iframe, with focus in it:

- YouTube plays from the privacy-enhanced `https://www.youtube-nocookie.com`, Vimeo from `https://player.vimeo.com` with Do Not Track. Both are https, with the player's script API on.
- The iframe gets `allow="autoplay; fullscreen; picture-in-picture; encrypted-media"`, `allowfullscreen`, a `sandbox` that lets the player run, and `referrerpolicy="strict-origin-when-cross-origin"`, without which YouTube won't play.
- When the viewer moves to another slide, the player pauses through its own postMessage API. When the slide unloads, two slides away or more, the player goes with it. A playing video closes in its frame rather than flying, as an iframe item does, and a closed viewer leaves it on its poster for the next open.

`createEmbedRenderer({ label })` sets the Play button's name: `label: (item) => \`Toista ${item.title}\``.

## 360° spins

`spinItem(options)` takes the frames of one full turn in order: a list of URLs, or a template, `{ src, count, start, digits }`, whose `{index}` is the frame's number. `start` is the first number and `digits` pads it with zeros. Besides `title`, `width` and `height`, it takes `thumbnail`, `id` (the first frame's URL by default) and `autoplay`.

- **Frame 0 shows at once.** It is the poster, over the thumbnail, and what the opening flight lands on. The other frames load at low priority once the spin is first on show, spread round the turn first, so an early drag already passes frames all the way round. A spin beside the slide on show loads only frame 0.
- **A horizontal drag turns it.** A drag across the whole spin is one turn; `createSpinRenderer({ turns })` changes that. A throw keeps it turning, slowing until it settles on a frame. With reduced motion it stops where the pointer lets go.
- **It is a slider.** The spin is focusable with `role="slider"`, named by the item's `title`. The arrow keys step a frame, Home and End go to the first and the last, and the value reads "Frame 12 of 36". `createSpinRenderer({ label: (frame, count) => … })` translates it.
- **`autoplay`** turns it while it is on show, `true` for a turn in six seconds or a number of seconds, until someone drags it or presses a key. Never with reduced motion.
- **Memory stays bounded.** It keeps at most 48 frames decoded, `createSpinRenderer({ keep })`. The rest stay in the browser's cache and decode again on the way past.

The spin's element has `data-fluidbox-spin`, `data-frame` with the frame on show, `data-fluidbox-spin-loaded` once every frame has loaded, and `data-grabbing` while dragged.

## 3D models

The model renderer draws Google's [`<model-viewer>`](https://modelviewer.dev). The add-on doesn't bundle it: it is about 290 kB gzipped. Either load it yourself, or give `createModelRenderer` a `load` function, which it calls when a model slide first comes on show. Either way it waits for `customElements.whenDefined("model-viewer")`.

```ts
createModelRenderer({ load: () => import("@google/model-viewer") });
```

`modelItem(options)` takes `src` (a `.glb` or `.gltf`), `title`, `width` and `height`, and optionally `id` (`src` by default), `thumbnail`, `poster`, `ar`, `arModes` and `iosSrc` for augmented reality, and `attributes` for any other `<model-viewer>` attribute, such as `{ "camera-orbit": "45deg 75deg 2m" }`. The element gets `camera-controls`, `touch-action="none"` and the title as its `alt`.

The thumbnail and the poster show through the opening flight, and until the model has loaded; a slide beside the one on show keeps its poster and loads nothing. The box gets `data-fluidbox-model-ready` once the model shows, and `data-fluidbox-model-error` if it fails, keeping the poster. A closing flight carries the poster home, as a photo, rather than the live model.

On the model, a drag turns it, a pinch or a trackpad pinch zooms it, and the arrow keys turn it while it has focus. None of them swipe, dismiss or zoom the viewer. A swipe that starts beside the model, the buttons, the keys off the model and the filmstrip still move the viewer, and Escape still closes it.

## Content that owns its gestures

The spin and the model keep their gestures through one contract any renderer can use. An element with `data-fluidbox-owns-input`, or inside one, owns the gestures and keys that start on it:

- **Touches.** A touch on it never drags the viewer to dismiss. Give it `touch-action: none` (or `pan-y` to keep vertical swipes) so the browser doesn't scroll the slides either.
- **Pinch.** A two-finger pinch, a trackpad's pinch (a wheel with the control key) and Safari's gesture events reach the element; the viewer doesn't zoom and the page doesn't zoom either.
- **Wheel.** A vertical wheel on it doesn't dismiss the viewer.
- **Keys.** The arrow keys, Page Up and Down, Home and End pressed on it are its own; Escape still belongs to the viewer, and Tab moves focus as it does on any page.

The filmstrip and the sheet use the same attribute.

## Slides that play and pause

A renderer in `renderers` gets two more members than other renderers, which follow whether its slide is the one on show:

<!-- api: FluidboxSlideRenderContext -->

A slide mounts once it is within one slide of the current one, so it often mounts before it shows, and `active` starts false. `onActiveChange` calls back with `true` as it comes on show, as the viewer opens on it or a swipe lands on it, and `false` as the viewer moves away or closes. The slide that leaves hears first, so its player stops before the next one starts. The `signal` aborts when the slide unloads, which ends the listening too.

```ts
const clip: FluidboxSlideRenderer = ({ item, target, active, onActiveChange }) => {
  const video = document.createElement("video");
  video.src = `/clips/${item.id}.mp4`;
  video.muted = true;
  target.append(video);
  if (active) void video.play();
  onActiveChange((now) => (now ? void video.play() : video.pause()));
};
```

The framework bindings hand a custom slide's component the same `active` and `onActiveChange` beside `item`, `index` and `signal`. Angular sets an `active` input on a component that declares one, and `active` on a template's context, as `let-active="active"`.

### The add-ons in a framework

The add-ons' renderers draw into an element. In a framework, give one an element of your own inside the slide's component, as the shop fixture in `apps/examples/fixtures/shop.tsx` does in React:

```tsx
import { useLayoutEffect, useRef } from "react";
import type { FluidboxItem, FluidboxSlideRenderer } from "@ogdakke/fluidbox";
import { renderEmbed } from "@ogdakke/fluidbox/embeds";
import type { FluidboxReactRenderContext, FluidboxReactRenderer } from "@ogdakke/fluidbox/react";

function AddonSlide({
  render,
  context,
}: {
  render: FluidboxSlideRenderer<FluidboxItem>;
  context: FluidboxReactRenderContext;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const target = ref.current!;
    const controller = new AbortController();
    const dispose = render({
      item: context.item,
      index: context.index,
      target,
      signal: AbortSignal.any([context.signal, controller.signal]),
      get active() {
        return context.active;
      },
      onActiveChange: context.onActiveChange,
    });
    return () => {
      controller.abort();
      dispose?.();
      target.replaceChildren();
    };
  }, [render, context]);
  return <span ref={ref} style={{ display: "contents" }} />;
}

const embed: FluidboxReactRenderer = (context) => (
  <AddonSlide render={renderEmbed} context={context} />
);
```
