---
title: Product media
section: Patterns
order: 14
description: A photo, a YouTube video that loads on Play, a 360° spin and a 3D model in one gallery, drawn by the add-ons' slides.
---

# Product media

One gallery mixes a photo with a YouTube video, a spin of the product and a 3D model of it. The add-ons draw the three: each item's `type` (`"embed"`, `"spin"`, `"model"`) names the slide that draws it. Press Play on the video: only then does YouTube's player load. Drag the spin, or focus it and press the arrow keys. The model loads `<model-viewer>` the first time it comes on show.

<!-- pattern: media -->

<small>3D model: <a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DamagedHelmet">Damaged Helmet</a>, from the Khronos glTF Sample Assets. © 2016 theblueturtle\_, <a href="https://creativecommons.org/licenses/by-nc/4.0/">CC BY-NC 4.0</a>; glTF rebuild © 2018 ctxwing, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. For non-commercial use only.</small>

- **The items** come from the add-ons' helpers, `youtubeItem`, `spinItem` and `modelItem` (see [the example data](./index.md#the-example-data)).
- **The slides** are the add-ons' parts in `Slides`: `Embed`, `Spin` and `Model` from `@ogdakke/fluidbox/react/embed`, `/spin` and `/model` (and the same under `vue/`, `solid/` and `angular/`). Plain JavaScript passes `embedSlide`, `createSpinSlide()` and `createModelSlide({ load })` as the `slides` option. The custom elements import `@ogdakke/fluidbox/elements/embed`, `/spin` and `/model`, which read a YouTube `<iframe>`, `<img data-spin-frames>` and `<model-viewer>` in the items' markup.
- **`<model-viewer>`** isn't bundled. `load` imports it when a model first comes on show; the examples load a pinned 4.0.0 build from its CDN, and an app would `import("@google/model-viewer")`.
- **A live model as the trigger.** The JavaScript and React versions show the model's card as a `<model-viewer>` of the item: a trigger with the item's label as its `aria-label`, around `<model-viewer camera-controls touch-action="pan-y" interaction-prompt="none">` with the thumbnail as its `poster`. A drag turns it, a click opens the viewer on the same view, and a close hands the slide's view back to the card. Leave `auto-rotate` off cards. The card loads `<model-viewer>` with the page. Vue, Solid and Angular get the same card once their slides have `onClose` and `origin.model`.
- **Size.** Each add-on is its own entry, so a page that doesn't import one loads none of it.

[Product media](../product-media.md) covers each add-on's options, Vimeo and other providers, slides that play and pause as they come on show, and content that keeps its own gestures.
