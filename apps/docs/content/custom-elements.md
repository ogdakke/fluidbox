---
title: Custom elements
section: Guides
order: 1
---

# Custom elements

Write markup and the gallery compiles it into the same item model the headless runtime uses. No framework required.

## Markup

```html
<fluidbox-gallery aria-label="Photos">
  <fluidbox-item item-id="mountain">
    <button slot="trigger" type="button">
      <img src="/media/mountain-768w.webp" alt="Mountain" width="768" height="512" />
    </button>
    <template slot="content">
      <picture>
        <source
          type="image/avif"
          srcset="/media/mountain-768w.avif 768w, /media/mountain.avif 1536w"
          sizes="100vw"
        />
        <img src="/media/mountain.webp" width="1536" height="1024" alt="Mountain" />
      </picture>
    </template>
    <span slot="caption">Mountain at dusk</span>
  </fluidbox-item>
  <fluidbox-filmstrip></fluidbox-filmstrip>
</fluidbox-gallery>
```

| Element                                    | Role                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `<fluidbox-gallery>`                       | Owns one controller for every item inside it. Arrow keys, swipes, and the filmstrip move between its items.                                |
| `<fluidbox-item>`                          | Describes one item and its transition origin. Requires a unique `item-id`.                                                                 |
| `[slot="trigger"]`                         | The button that opens the item. Its image is the thumbnail.                                                                                |
| `<template slot="content">`                | The full-size media. Inert until the viewer opens. `src`, `srcset`, `sizes`, `type`, and `media` pass through to the viewer's `<picture>`. |
| `[slot="caption"]`, `[slot="description"]` | Optional text for the item.                                                                                                                |
| `<fluidbox-filmstrip>`                     | Adds a thumbnail strip to the open viewer.                                                                                                 |

Non-image template content, such as an `<iframe>` or a `<section>`, renders as custom media inside the same slide strip.

## The handoff box

By default the trigger's image supplies the flight geometry. When the visible crop and rounded corners come from a wrapper, mark that wrapper so the flight starts and ends on the box people actually see:

```html
<button slot="trigger" type="button" data-fluidbox-preview>
  <img src="/thumb.jpg" alt="" />
</button>
```

- `data-fluidbox-preview` marks the visible preview box. Its `border-radius` carries through the flight.
- `data-fluidbox-target` marks a more precise nested target inside it, and wins over the preview box.
- `data-fluidbox-origin` marks the visual box inside a trigger for indexed galleries and framework triggers.

## Placeholders

Set `placeholder-src` on `<fluidbox-item>` to a tiny data URL or other immediately available image. The runtime paints it behind the preview and the full image, including neighbouring slides during a swipe, until the full image has decoded.

```html
<fluidbox-item item-id="mountain" placeholder-src="data:image/webp;base64,…"></fluidbox-item>
```

## Attributes and properties

| On                   | Name                               | Effect                                                                           |
| -------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `<fluidbox-gallery>` | `hide-close-button`                | Omit the default close control.                                                  |
| `<fluidbox-gallery>` | `source`, `origins`                | Switch to an [indexed source](./sources-and-origins.md) instead of child items.  |
| `<fluidbox-gallery>` | `controller`, `whenReady()`        | The underlying controller. Await `whenReady()` before using it from scripts.     |
| `<fluidbox-gallery>` | `open({ index })` / `open({ id })` | Open an item programmatically.                                                   |
| `<fluidbox-item>`    | `openItemId`                       | Make this trigger open a different gallery item, for example a "+8 more" teaser. |
| preview container    | `data-fluidbox-dynamic-preview`    | Lets a preview change with the selection without rebuilding the gallery.         |

## Opening from code

```ts
import type { FluidboxGalleryElement } from "@ogdakke/fluidbox";

const gallery = document.querySelector<FluidboxGalleryElement>("fluidbox-gallery")!;
const controller = await gallery.whenReady();
await controller.open({ id: "mountain" });
```

See the [API reference](./api.md) for every controller command.
