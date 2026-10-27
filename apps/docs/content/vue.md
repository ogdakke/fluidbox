---
title: Vue
section: Frameworks
order: 3
description: The Vue binding for fluidbox, with every component, composable, prop, slot and event, and the Vue-specific behaviour.
---

# Vue

`@ogdakke/fluidbox/vue` builds a gallery from components: `Fluidbox.Root` owns one viewer for its items, `Fluidbox.Trigger` opens it, and `Fluidbox.Viewer` renders your own controls into it. It needs Vue 3.3 or later.

## Install

```bash
npm install @ogdakke/fluidbox
```

```ts
import { Fluidbox, useFluidbox, useFluidboxSheet, useFluidboxSlide } from "@ogdakke/fluidbox/vue";
import "@ogdakke/fluidbox/styles.css";
import "@ogdakke/fluidbox/baseline.css"; // optional: the default look
```

Import `@ogdakke/fluidbox/styles.css` once in your app. It holds what makes the viewer work, and draws no look of its own: the controls are buttons with their labels as text. `baseline.css` is the default look, round controls with glyphs; leave it out to style the viewer yourself. See [Styling](./styling.md).

Every component is a property of the `Fluidbox` object, so a `<script setup>` template uses `<Fluidbox.Root>`, `<Fluidbox.Trigger>` and so on. To register them globally, name them yourself: `app.component("FluidboxRoot", Fluidbox.Root)`. The thumbnails and the sheet are parts of the binding: rendering `Fluidbox.Thumbnails` or `Fluidbox.Sheet` turns it on. They also need their stylesheets, `@ogdakke/fluidbox/thumbnails.css` and `@ogdakke/fluidbox/sheet.css`.

## A gallery

```vue
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { photos } from "./data";
</script>

<template>
  <Fluidbox.Root :items="photos">
    <Fluidbox.Trigger v-for="photo in photos" :key="photo.id" :value="photo.id">
      <img :src="photo.src" :alt="itemLabel(photo)" />
    </Fluidbox.Trigger>
  </Fluidbox.Root>
</template>
```

Without a `Fluidbox.Viewer`, the viewer has the default Previous, Next and Close buttons. With one, it keeps only Close, until your content has a Close of its own. The same gallery, live, in every framework:

<!-- pattern: basic -->

## Parts

```vue
<template>
  <Fluidbox.Root v-model="photo" :items="items">
    <Fluidbox.Trigger :value="album">
      <img />
      <Fluidbox.Overlay flight="live">+3</Fluidbox.Overlay>
    </Fluidbox.Trigger>

    <Fluidbox.Slides>
      <template #note="{ item }"><Fluidbox.Media>…</Fluidbox.Media></template>
    </Fluidbox.Slides>

    <Fluidbox.Viewer>
      <Fluidbox.Toolbar>
        <Fluidbox.Counter />
        <Fluidbox.ZoomControls />
        <Fluidbox.Slideshow />
        <Fluidbox.Close />
      </Fluidbox.Toolbar>
      <Fluidbox.Previous />
      <Fluidbox.Next />
      <Fluidbox.Caption />
      <Fluidbox.Loading>Loading…</Fluidbox.Loading>
      <Fluidbox.Thumbnails />
    </Fluidbox.Viewer>

    <Fluidbox.Sheet v-slot="{ item }" :snap-points="['40%', '90%']">…</Fluidbox.Sheet>
  </Fluidbox.Root>
</template>
```

| Part                                                   | Renders                              | Role                                                                                        |
| ------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `Fluidbox.Root`                                        | its default slot                     | Owns one viewer for its items. Every other part must be inside it.                          |
| `Fluidbox.Trigger`                                     | a `<button>`, or its child           | Opens an item. Registers itself as the item's origin.                                       |
| `Fluidbox.Overlay`                                     | a `<span>`                           | A badge, caption or scrim on a trigger that fades or flies with the photo.                  |
| `Fluidbox.Slides`                                      | nothing                              | The content of each item type's slide, as named slots.                                      |
| `Fluidbox.Media`                                       | into the slide's box                 | The box that flies and zooms: its slot, or what a plain-JS slide draws.                     |
| `Fluidbox.Image`, `Fluidbox.Video`, `Fluidbox.Iframe`  | the built-in media, in the box       | The viewer's own image, video and iframe, with their loading, zoom and error handling.      |
| `Fluidbox.Hotspot`                                     | a `<button>`, on the media           | A pin at a point of the picture, which follows pan and zoom.                                |
| `Fluidbox.Viewer`                                      | its slot, in the viewer's layer      | Your controls and captions.                                                                 |
| `Fluidbox.Toolbar`, `Fluidbox.ZoomControls`            | a `<div role="group">`               | Groups of controls. Empty, they hold Previous, Next and Close, or the three zoom controls.  |
| `Fluidbox.Previous`, `Next`, `Close`                   | a `<button>`                         | Run the command, and disable themselves when they can't.                                    |
| `Fluidbox.ZoomIn`, `ZoomOut`, `ZoomReset`              | a `<button>`                         | Zoom the image on show. See [Zoom](./patterns/zoom.md#zoom-controls).                       |
| `Fluidbox.Fullscreen`, `Share`                         | a `<button>`                         | Full screen, and the share sheet or the clipboard. Hidden where they can't work.            |
| `Fluidbox.Download`                                    | an `<a download>`                    | Saves the item's file. Hidden when the item has none.                                       |
| `Fluidbox.Slideshow`                                   | a `<button>`                         | Plays and pauses the slideshow.                                                             |
| `Fluidbox.Counter`, `Fluidbox.Caption`                 | a `<span>`, a `<div>`                | Where the viewer is, and the item's caption.                                                |
| `Fluidbox.Loading`, `Fluidbox.Error`, `Fluidbox.Retry` | their slot; a `<button>`             | Your loading and error states for the item on show.                                         |
| `Fluidbox.Thumbnails`                                  | its slot, in each thumbnail          | Turns the thumbnails on. A slot draws your own thumbnails.                                  |
| `Fluidbox.Sheet`, `Fluidbox.SheetSnap`                 | its slot, in the sheet; a `<button>` | Turns the sheet on and renders its content for the item on show; moves the sheet to a snap. |

### `Fluidbox.Root`

| Prop                  | Type                                                        | Default                                               | Purpose                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`               | `readonly TItem[] \| FluidboxItemList<TItem>`               |                                                       | Required. The items, or a list read on demand. Reactive, also in place. See [Items and origins](./items-and-origins.md).                                    |
| `v-model`             | `string \| null`                                            |                                                       | The open item's id, or `null`, when your ref owns it (`modelValue`). A change opens, moves or closes the viewer to match.                                   |
| `default-value`       | `string \| null`                                            | `null`                                                | The item to open with, when the viewer owns its value.                                                                                                      |
| `labels`              | `Partial<FluidboxLabels>`                                   | English                                               | Every string the viewer shows or announces. See [Labels](./api.md#labels).                                                                                  |
| `zoom`                | `false \| { step?, max?, click?, tap? }`                    | `{ step: 2, max: 4, click: "single", tap: "double" }` | Zoom steps, what a click (`"single"`, `"double"`, `false`) and a tap (`"double"`, `false`) on the photo do, or `false` to turn zoom off. Compared by value. |
| `loop`                | `boolean`                                                   | `false`                                               | Go round: past the last item comes the first, by swipe, key, button and thumbnails. A single item never loops. A bare `loop` attribute is true.             |
| `dismiss`             | `{ drag?: boolean; backdrop?: boolean }`                    | both on                                               | Which gestures close the viewer. Escape and Close always do.                                                                                                |
| `wheel`               | `"dismiss" \| "zoom" \| "navigate" \| "none"`               | `"dismiss"`                                           | What a vertical wheel does on an unzoomed slide.                                                                                                            |
| `slideshow`           | `FluidboxSlideshowOptions`                                  |                                                       | `{ interval, loop, autoplay }`: advance on a timer once something plays it. See [Slideshow](#slideshow).                                                    |
| `reach-end-threshold` | `number`                                                    | `2`                                                   | How near the end `@reach-end` fires. A static attribute's string is read as a number.                                                                       |
| `href`                | `(value: string \| null) => string \| undefined`            |                                                       | Where the server-rendered viewer's controls lead before JavaScript runs.                                                                                    |
| `share-url`           | `(item) => string \| undefined`                             | `href` of the id                                      | The link Share shares. Without either, Share hides.                                                                                                         |
| `find-trigger`        | `(item, index) => Element \| null`                          |                                                       | Finds the trigger of an item without a mounted one, as in a virtualized grid. See [Finding triggers](./items-and-origins.md#the-origin-adapter).            |
| `reveal-trigger`      | `(item, index, { signal, phase }) => void \| Promise<void>` |                                                       | Brings an item's trigger into view before the viewer flies back to it.                                                                                      |
| `preload`             | `"intent" \| "press" \| "eager"`                            | `"intent"`                                            | When the viewer's code loads. See [Loading the viewer](./getting-started.md#loading-the-viewer).                                                            |

`v-model` is a request, not a lock. When the viewer changes on its own, by a swipe or Escape, it reports the new value; leave the ref alone and the viewer still changes. To refuse a change, listen for `@value-change` and call `details.cancel()`: a canceled change never reaches the model. The events are under [Events](#events).

The default slot gets the `useFluidbox()` object, with the state and the commands. Use it to drive the viewer from the same template:

```vue
<Fluidbox.Root v-slot="{ status, index, count, open }" :items="photos">
  <button type="button" @click="open(0)">
    {{ status === "closed" ? "Open" : `${(index ?? 0) + 1} / ${count}` }}
  </button>
</Fluidbox.Root>
```

### `Fluidbox.Trigger`

| Prop       | Type                                                        | Default | Purpose                                                                                                               |
| ---------- | ----------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `value`    | `FluidboxTarget<TItem> \| readonly FluidboxTarget<TItem>[]` |         | Required. The item to open: the item, its id or its index. A list opens its first, and every one closes back onto it. |
| `as-child` | `boolean`                                                   | `false` | Decorate the one child of the slot instead of rendering a `<button>`.                                                 |

An item's id is its `id`, else its `src`. Other attributes and listeners go to the button, or to the child with `as-child`. The rendered button gets `type="button"` unless you set `type`.

The default slot gets `{ item, index, status }` (`FluidboxTriggerPreview`), the item the trigger shows. While the viewer is open, that is the item it is on. After it closes, it is the last one it showed, so an album cover reopens on it. `item` is `null` when the trigger's items have left the list.

The trigger adds `data-fluidbox-trigger` and `aria-haspopup="dialog"` to its element, and starts loading the item on pointer down. [A link as the trigger](./getting-started.md#a-link-as-the-trigger) covers a trigger that is a link.

### `Fluidbox.Overlay`

| Prop     | Type                                    | Default  | Purpose                              |
| -------- | --------------------------------------- | -------- | ------------------------------------ |
| `flight` | `"none" \| "copy" \| "live" \| "frame"` | `"none"` | How it goes with the photo's flight. |

`"none"` stays on the card, `"copy"` flies a still copy with the photo, `"live"` renders its slot live in the flying frame, with what is provided around `Root`, and `"frame"` moves the element itself into the frame, scaling with it, as a scrim does. It gets `--fluidbox-closed` and `data-fluidbox-phase` as the viewer opens and closes, for the enclosing `Trigger`'s items. Put it inside a `Trigger`. Outside one, it throws. Attributes go to its `<span>`. Several can sit on one trigger:

```vue
<Fluidbox.Trigger v-slot="{ item }" :value="album">
  <img :src="item?.src" :alt="item ? itemLabel(item) : ''" />
  <Fluidbox.Overlay flight="frame" class="scrim" />
  <Fluidbox.Overlay flight="live" class="count">+{{ album.length - 1 }}</Fluidbox.Overlay>
</Fluidbox.Trigger>
```

### `Fluidbox.Slides` and `Fluidbox.Media`

`Fluidbox.Slides` takes one named slot per item type, your own or the built-in `image`, `video` and `iframe`, and `#default` for any other type. Each slot gets `{ item, index }`, with `item` of that type, and holds the slide's content. It renders nothing: the viewer asks for a slide's content as the slide mounts, and the binding teleports it into the slide's layer, from inside `Root`. A Root takes one `Slides`.

`Fluidbox.Media` is the slide's box, the element that flies, follows a drag to dismiss and zooms. Its slot goes into the box, which the viewer sizes from the item's `width` and `height`, so fill it. Its attributes go onto the box. `render` draws into it with a plain-JS slide renderer, as the add-on parts do. `zoom` lets it zoom: on by default with an `Image` in it, off otherwise. Anything in the slide outside `Media` sits in the slide's layer, over the slide, and doesn't fly or zoom.

```vue
<Fluidbox.Slides>
  <template #product="{ item }">
    <Fluidbox.Media>
      <Fluidbox.Image :item="item.image" />
    </Fluidbox.Media>
    <p class="price">€{{ item.price }}</p>
  </template>
</Fluidbox.Slides>
```

`Fluidbox.Image`, `Fluidbox.Video` and `Fluidbox.Iframe` draw the viewer's own media into the box, for the slide's item or the `item` you give. They keep the built-in media's loading, placeholders, sharper zoom images, error and Retry. Outside a `Media` they draw into the box all the same. `Video` takes `attach`, to load the media yourself, as hls.js does. Pass a stable function: a new one loads the video again.

A slide's content renders inside a `Suspense` of the slide's own. An async component in it holds the open until it resolves, for at most three seconds, and the page around the viewer doesn't suspend.

### `Fluidbox.Hotspot`

| Prop              | Type                        | Default | Purpose                                                          |
| ----------------- | --------------------------- | ------- | ---------------------------------------------------------------- |
| `x`, `y`          | `FluidboxHotspotCoordinate` |         | Required. Where on the picture: `"42%"`, or pixels of the media. |
| `scale-with-zoom` | `boolean`                   | `false` | Grow with the zoom instead of keeping its screen size.           |

A hotspot is a `<button data-fluidbox-hotspot>` placed on the media of its `Media`, and it must be inside one. The default slot is its content: the package ships no icon, so give it text, or an icon and an `aria-label`. Other attributes and listeners go on the button. The hotspots fixture (`apps/examples/fixtures/hotspots-vue.ts`) pins a room's parts this way:

```vue
<script setup lang="ts">
import { idOf, itemLabel, type FluidboxHotspotCoordinate } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { photos } from "./data";

type Pin = { name: string; x: FluidboxHotspotCoordinate; y: FluidboxHotspotCoordinate };
const pins: Record<string, Pin[]> = {
  "photo-fjord": [
    { name: "Boathouse", x: "62%", y: "71%" },
    { name: "Summit", x: "35%", y: "18%" },
  ],
};
</script>

<template>
  <Fluidbox.Root :items="photos">
    <Fluidbox.Trigger v-for="photo in photos" :key="photo.id" :value="photo.id">
      <img :src="photo.src" :alt="itemLabel(photo)" />
    </Fluidbox.Trigger>
    <Fluidbox.Slides>
      <template #image="{ item }">
        <Fluidbox.Media>
          <Fluidbox.Image />
          <Fluidbox.Hotspot
            v-for="pin in pins[idOf(item)] ?? []"
            :key="pin.name"
            :x="pin.x"
            :y="pin.y"
            :aria-label="pin.name"
          >
            <span aria-hidden="true">+</span>
          </Fluidbox.Hotspot>
        </Fluidbox.Media>
      </template>
    </Fluidbox.Slides>
  </Fluidbox.Root>
</template>
```

- **Coordinates.** A percentage of the picture, as `"42%"`, or a number of pixels of the media's declared `width` and `height`, else of its natural size. The types take a number or `"N%"`; only the custom elements' attributes and untyped JavaScript read a bare string as pixels. They follow `object-fit` and `object-position`. Without an image or video in the box, they are relative to the box.
- **Zoom.** A hotspot keeps its screen size as the photo zooms, unless `scale-with-zoom`. Keyboard focus on one pans a zoomed photo to it.
- **Presses.** A press on a hotspot doesn't zoom or close the viewer.
- **Motion.** Hotspots hide during flights and a drag to dismiss, and fade in with the controls.
- **Placement.** Nothing between the hotspot and `Media`'s box may make a containing block (`position`, `transform`, `filter`, `will-change`). Development builds warn about it, and about a hotspot outside `Media`.
- **Size.** The hotspot code is a chunk of its own, loaded with the first hotspot.

`[data-fluidbox-hotspot]` and `[data-scale-with-zoom]` style them; `baseline.css` draws a round pin.

### `Fluidbox.Viewer`, `Fluidbox.Toolbar` and the controls

`Fluidbox.Viewer` takes no props, and teleports its slot into the viewer's layer once the viewer exists. It stays there while the viewer opens and closes; the layer fades out as a dismiss starts.

`Fluidbox.Toolbar` is a `<div role="group" data-fluidbox-toolbar>`; with an empty slot it holds Previous, Next and Close. The stylesheet gives it `display: contents`, so the controls keep their places until you style it. `Fluidbox.ZoomControls` is the zoom group, named like the zoomed image; empty, it holds Zoom in, Zoom out and Fit.

`Previous`, `Next`, `Close`, `ZoomIn`, `ZoomOut`, `ZoomReset`, `Fullscreen`, `Share`, `Download`, `Slideshow`, `Retry` and `SheetSnap` pass their attributes and listeners to their element. With an empty slot a control shows its label from `labels` as text, marked `data-fluidbox-default`. With content, the label becomes its `aria-label`. `label` overrides the label for this control; `:label="false"` names it by its content, for content with visible text. `disabled` follows the viewer's state, and a control that can't work on this device or item gets `hidden`. Pass `:disabled` to override it. Your `@click` runs first; `event.preventDefault()` in it stops the command. They work anywhere inside `Root`, in the viewer or on the page.

```vue
<Fluidbox.Close />
<!-- "Close", as text -->
<Fluidbox.Close><XIcon /></Fluidbox.Close>
<!-- named "Close" by aria-label -->
<Fluidbox.Close :label="false">Done</Fluidbox.Close>
```

`Fluidbox.Counter` shows `labels.counter`, as `1 / 4`, or its scoped slot `{ index, count }`. It is hidden from screen readers, which hear the slide's name. `Fluidbox.Caption` shows the item's `caption`, or its scoped slot `{ item, index }`, and describes the dialog. In a slide it is that slide's item; elsewhere the item on show.

`Fullscreen` gets `data-active` while the viewer is full screen, and `Slideshow` while it plays.

### `Fluidbox.Loading`, `Fluidbox.Error` and `Fluidbox.Retry`

`Loading` renders its slot while the item on show is loading, and `Error` while it failed, in place of the default error message. In a slide they follow that slide. `Error`'s scoped slot gets `{ item, error }`, where `error` is the cause of the last `mediaerror`. `Retry` loads the failed media again. The viewer still announces the error, so your error content needn't be a live region.

```vue
<Fluidbox.Error v-slot="{ item }">
  <p>{{ itemLabel(item) }} didn't load.</p>
  <Fluidbox.Retry />
</Fluidbox.Error>
```

### `Fluidbox.Thumbnails`

No props. Rendering it turns the thumbnails on. Without a slot, each thumbnail is the item's `thumbnail`, else its image. With a default slot, it renders into each thumbnail button and gets `{ item, index, active }` (`FluidboxThumbnailContext`). The strip marks the selected button `data-active` and `data-fluidbox-selected`.

```vue
<Fluidbox.Thumbnails v-slot="{ index, active }">
  <span class="thumb" :class="{ current: active }">{{ index + 1 }}</span>
</Fluidbox.Thumbnails>
```

### `Fluidbox.Sheet` and `Fluidbox.SheetSnap`

| Prop             | Type                                | Default              | Purpose                                                                              |
| ---------------- | ----------------------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| `snap-points`    | `readonly FluidboxSheetSnapPoint[]` | `["60%", "content"]` | The snaps above the resting one, lowest first: pixels, a percentage, or `"content"`. |
| `dismiss-motion` | `"flight" \| "scroll"`              | `"flight"`           | How a swipe down on the photo closes the viewer with the sheet down.                 |

| Event          | Payload              | When                                                              |
| -------------- | -------------------- | ----------------------------------------------------------------- |
| `@snap-change` | `FluidboxSheetEvent` | The sheet comes to rest at another snap: `event.snap`, 0 at rest. |

The viewer makes the sheet, a `<section data-fluidbox-sheet>` named by `labels.sheet`, and the part's own attributes (`class`, `style`, `data-*`, `aria-*`) go on that section. Its default slot is the section's content for the item on show, and gets `{ item, index }` (`FluidboxItemContext`). It renders again when the item changes. See [Thumbnails and sheet](./thumbnails-and-sheet.md).

```vue
<Fluidbox.Sheet v-slot="{ item }" :snap-points="['40%', '90%']" class="details">
  <h3>{{ itemLabel(item) }}</h3>
  <Fluidbox.SheetSnap :to="2">Expand</Fluidbox.SheetSnap>
</Fluidbox.Sheet>
```

`Fluidbox.SheetSnap` takes a required `to` and moves the sheet to that snap, or back to 0 when it is there. It gets `aria-expanded` from the sheet. Its slot names it; empty, it shows `labels.sheet`. It works anywhere in the viewer, in a `Viewer` or in the sheet.

### The add-on parts

`@ogdakke/fluidbox/vue/embed`, `/vue/model` and `/vue/spin` export `Embed`, `Model` and `Spin`, for slides of those types. Each is a `Media` that draws the add-on's slide, and takes its options as props: `<Model :load>`, `<Embed :providers :label>` with the Play button's content in its slot, and `<Spin :label :keep :turns>`. Pass stable functions: a new `load` draws the model afresh. See [Product media](./product-media.md).

```vue
<Fluidbox.Slides>
  <template #embed><Embed /></template>
  <template #spin><Spin /></template>
  <template #model><Model :load="loadModelViewer" /></template>
</Fluidbox.Slides>
```

The add-ons load with their entry, so a page without them pays nothing. `<model-viewer>` itself is about 290 kB gzipped and loads through `load`, when a model first opens or comes on show.

## Composables

Call them in `setup` of a component inside `Fluidbox.Root`, including the content of `Slides`, `Viewer`, `Sheet` and `Thumbnails`.

| Composable              | Returns              | Purpose                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useFluidbox()`         | `FluidboxApi<TItem>` | One reactive object: the state (`status`, `value`, `index`, `item`, `count`, `hasPrevious`, `hasNext`, `zoom`, `fullscreen`, `playing`) and the commands (`open`, `close`, `next`, `previous`, `zoomTo`, `zoomIn`, `zoomOut`, `zoomReset`, `setFullscreen`, `download`, `share`, `play`, `pause`, `setItems`, `preload`, `load`). Root's default slot gets the same object. |
| `useFluidbox(selector)` | `ComputedRef`        | The part of that object the selector picks.                                                                                                                                                                                                                                                                                                                                 |
| `useFluidboxSheet()`    | `FluidboxSheetApi`   | One reactive object: the sheet's `snap`, which follows `@snap-change`, and `setSnap(snap, { animate? })`. `snap` is 0 without a sheet.                                                                                                                                                                                                                                      |
| `useFluidboxSlide()`    | `FluidboxSlideApi`   | Inside a slide: its item and activity, and its hooks into the open. It throws elsewhere.                                                                                                                                                                                                                                                                                    |

```vue
<script setup lang="ts">
import { useFluidbox } from "@ogdakke/fluidbox/vue";

const fluidbox = useFluidbox();
const atEnd = useFluidbox((state) => !state.hasNext);
</script>

<template>
  <button type="button" :disabled="atEnd" @click="fluidbox.next()">Next</button>
</template>
```

Read the object's fields where you use them, as `fluidbox.index`. Destructuring it in `<script setup>` reads the values once. Each command resolves `true` once it happened and `false` when it didn't, as when an event listener prevented it. Commands made before the viewer exists wait for it, and run once Root has mounted. A target is the item, its index or its id: `open(photo)`, `open(2)` or `open("photo-fjord")`. `preload(target)` starts loading an item a press is likely to open, and returns a function that lets go. `load()` loads the viewer's code now.

### `useFluidboxSlide()`

In a component inside a slide, it returns one reactive object:

| Member                     | Purpose                                                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item`, `index`            | The slide's item, and its index. `index` follows new items, which keep a slide whose item moved, so read it where you use it.                                                             |
| `active`                   | Whether the slide is the one on show. Reactive.                                                                                                                                           |
| `opening`                  | True while an open waits for this slide.                                                                                                                                                  |
| `signal`                   | Aborted when the slide unloads.                                                                                                                                                           |
| `onActiveChange(listener)` | Calls back as the slide comes on show and leaves it. See [Slides that play and pause](./product-media.md#slides-that-play-and-pause).                                                     |
| `waitUntil(promise)`       | Makes the opening flight also wait for what the viewer can't see, such as a canvas's first frame, for at most three seconds. Call it in `setup` or `onMounted`.                           |
| `origin`                   | What the trigger showed, on the slide an open started from: `origin.video` reads the trigger's `<video>` live, and `origin.model` is its live `<model-viewer>`. Null on the other slides. |
| `onClose(listener)`        | Calls back once as a close from this slide starts, with the origin of the trigger it lands on. Returns a function that stops listening.                                                   |
| `returnPlayback(source)`   | Hands a player's time back to the trigger's video as the viewer closes from this slide. Returns a function that unregisters it.                                                           |
| `fail(error?)`             | Puts the slide in its error state, with `error` as the `mediaerror`'s cause.                                                                                                              |
| `onZoom(listener)`         | Follows the box's zoom pose. Returns a function that stops listening.                                                                                                                     |

An open waits for the slide's images and videos by itself. A player of your own continues the trigger's video through `origin` and `returnPlayback`, as in [A player of your own continues the trigger's video](./product-media.md#a-player-of-your-own-continues-the-triggers-video). Register it once mounted, and call what it returns as you unmount, as the slides fixture's player does (`apps/examples/fixtures/vue-slides.ts`). Here a `<video>` of the page's own plays every video item, in `<template #video><Reel /></template>`:

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Fluidbox, useFluidboxSlide } from "@ogdakke/fluidbox/vue";
import type { FluidboxVideoItem } from "@ogdakke/fluidbox";

const slide = useFluidboxSlide<FluidboxVideoItem>();
const player = ref<HTMLVideoElement>();
const from = slide.origin?.video;
let release: (() => void) | undefined;
onMounted(() => (release = slide.returnPlayback(player.value!)));
onBeforeUnmount(() => release?.());
</script>

<template>
  <Fluidbox.Media>
    <video
      ref="player"
      :src="slide.item.src"
      :currentTime="from?.currentTime ?? 0"
      :autoplay="from ? !from.paused : false"
      :muted="from?.muted"
      playsinline
    />
  </Fluidbox.Media>
</template>
```

`onClose` is for content that hands state back other than a video's time. The model slide uses it to turn the card's live model to the view the viewer closes on.

## Events

Root emits the fluidbox's events in Vue's form. `event.item` and `details.item` are your own objects, of the type of `items`.

| Event                    | Payload                                               | When                                                                                                 |
| ------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `@update:model-value`    | `value`, `details: FluidboxValueChangeDetails<TItem>` | Once an open, move or close goes through. The half of `v-model` that writes the ref.                 |
| `@value-change`          | `value`, `details: FluidboxValueChangeDetails<TItem>` | Before every open, move and close, from any input. `details.cancel()` stops it.                      |
| `@value-change-complete` | `value`, `details: FluidboxValueChangeDetails<TItem>` | Once the motion of a value change settled: the flight landed, a move came to rest, a close finished. |
| `@zoom-change`           | `FluidboxZoomEvent`                                   | The image on show comes to rest at another zoom: `event.scale`, 1 at fit, and `reason`.              |
| `@media-error`           | `FluidboxMediaErrorEvent<TItem>`                      | A slide's media fails to load, as it shows its error: `kind` and `cause`.                            |
| `@reach-end`             | `FluidboxReachEndEvent<TItem>`                        | The open item comes within `reach-end-threshold` of the last: `value`, `index` and `count`.          |

`details` has the `action` (`"open"`, `"move"` or `"close"`), the `reason`, the `item` and `cancel()`. `v-model` ignores the second argument, so cancel in `@value-change`, which runs first:

```vue
<script setup lang="ts">
import { ref } from "vue";
import {
  Fluidbox,
  type FluidboxValue,
  type FluidboxValueChangeDetails,
} from "@ogdakke/fluidbox/vue";
import { photos } from "./data";

const photo = ref<string | null>(null);
const unsaved = ref(false);

function guard(_: FluidboxValue, details: FluidboxValueChangeDetails) {
  if (unsaved.value && details.action === "close") details.cancel();
}
</script>

<template>
  <Fluidbox.Root v-model="photo" :items="photos" @value-change="guard">…</Fluidbox.Root>
</template>
```

See [Events](./javascript.md#events) for the reasons and the rest of each event's fields.

### Lazy lists and `@reach-end`

`@reach-end` asks for more items. It fires once a move settles within `reach-end-threshold` (2 by default) of the last item, once per item count, and never with `loop`. A close and reopen at the same count doesn't fire it again. Any change of the count arms it again, and it fires at once if the open item is already near the new end.

To append, hand Root a longer list. With an array, a new array keeps the slides of the items that stayed. With a list from `createItemList`, call `withCount` on it: the longer list keeps the items already made, the open item and its slides.

```vue
<script setup lang="ts">
import { shallowRef } from "vue";
import {
  createItemList,
  type FluidboxImageItem,
  type FluidboxReachEndEvent,
} from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";

const photoAt = (index: number): FluidboxImageItem => ({
  type: "image",
  id: `photo-${index}`,
  src: `/photos/${index}.jpg`,
  alt: `Photo ${index + 1}`,
  width: 1600,
  height: 1200,
});
const list = shallowRef(createItemList({ count: 20, item: photoAt }));

function more({ count }: FluidboxReachEndEvent) {
  list.value = list.value.withCount(count + 20);
}
</script>

<template>
  <Fluidbox.Root :items="list" :reach-end-threshold="4" @reach-end="more">…</Fluidbox.Root>
</template>
```

`createItemList` returns a `FluidboxLazyItemList`. See [Lazy lists](./items-and-origins.md#lazy-lists).

## Slideshow

The `slideshow` prop, `{ interval = 5000, loop, autoplay = false }`, lets the viewer advance on a timer. `loop` defaults to Root's `loop`; without it the slideshow stops on the last slide. `autoplay` plays it once per open. `Fluidbox.Slideshow` plays and pauses it, and `useFluidbox()` has `play()`, `pause()` and `playing`. `play()` works without the prop, with the defaults; the Slideshow control hides without the prop, unless it is playing. Its labels are `playSlideshow` and `pauseSlideshow`.

```vue
<template>
  <Fluidbox.Root :items="photos" :slideshow="{ interval: 4000 }">
    <!-- the triggers -->
    <Fluidbox.Viewer>
      <Fluidbox.Slideshow />
      <Fluidbox.Close />
    </Fluidbox.Viewer>
  </Fluidbox.Root>
</template>
```

A hidden tab or a video playing in the slide holds the timer, with `playing` still true, and the interval starts again when the hold ends. A pointer, a key, a wheel or a zoom pauses it until something plays it again. Each move has the reason `"slideshow"`. While it plays, the viewer's live region is quiet, and under reduced motion each move is instant.

## The photo in the URL

The [photo in the address](./patterns/url.md) pattern keeps `?photo=` in step with the viewer through the History API. With Vue Router, bind `v-model` to a computed over the route's query. The id is the item's own, so the link survives a reordering:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { photos } from "./data";

const route = useRoute();
const router = useRouter();

// `?photo=photo-fjord` opens that photo.
const photo = computed({
  get: () => photos.find(({ id }) => id === route.query.photo)?.id ?? null,
  set(id: string | null) {
    const shown = photo.value;
    if (id === shown) return;
    const query = { ...route.query, photo: id ?? undefined };
    if (id === null) {
      // Back past the entry the open added, or drop the photo from a link you came in on.
      if (history.state?.photo) router.back();
      else void router.replace({ query });
    } else if (shown === null) {
      // Opening adds an entry, so Back closes the viewer.
      void router.push({ query, state: { photo: true } });
    } else {
      void router.replace({ query, state: { photo: true } });
    }
  },
});
</script>

<template>
  <Fluidbox.Root v-model="photo" :items="photos">
    <Fluidbox.Trigger v-for="each in photos" :key="each.id" :value="each.id">
      <img :src="each.src" :alt="itemLabel(each)" />
    </Fluidbox.Trigger>
  </Fluidbox.Root>
</template>
```

Back and Forward change the route, and the computed opens, moves or closes the viewer to match. A route that the server renders with `?photo=` opens the viewer on its first render, as [Server rendering](#server-rendering) describes.

## Server rendering

The components render their markup on the server, and Root creates the viewer in `onMounted`, so nothing touches the DOM there. A Root whose `v-model` or `default-value` names an image renders the open viewer's copy after its content, on the server and on the client's first render, and the viewer takes it over as Root mounts, with no motion. `href` gives the copy's controls their links, so they work before JavaScript runs. Other item types open after hydration. See [Server rendering](./getting-started.md#server-rendering).

## Patterns

| Pattern                                            | In Vue                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [Gallery](./patterns/basic.md)                     | `:items`, a `Trigger` per item, `Previous`, `Next` and `Close` in a `Viewer`.                    |
| [One trigger for an album](./patterns/overlay.md)  | `<Fluidbox.Trigger v-slot="{ item }" :value="album">` and `<Fluidbox.Overlay flight="live">`.    |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` on an element inside the `Trigger`; `as-child` for your own element.      |
| [Custom content](./patterns/renderers.md)          | `<template #note>` in `Slides`, with a `Media`.                                                  |
| [Programmatic control](./patterns/programmatic.md) | The root slot's `{ status, index, open }`, `@value-change` with `details.cancel()`.              |
| [Zoom](./patterns/zoom.md)                         | `:zoom="{ step, max }"` or `:zoom="false"`, `Toolbar` and `ZoomControls`.                        |
| [Hover zoom](./patterns/zoom.md#hover-zoom)        | `hoverZoom` from `@ogdakke/fluidbox/hover-zoom`, in `onMounted`.                                 |
| [Thumbnails](./patterns/thumbnails.md)             | `<Fluidbox.Thumbnails />`, or with a slot for your own thumbnails.                               |
| [Sheet](./patterns/sheet.md)                       | `<Fluidbox.Sheet v-slot="{ item }">`, `useFluidboxSheet()`, and `<Fluidbox.SheetSnap :to="1">`.  |
| [Headless controls](./patterns/headless.md)        | Your own buttons in a `Viewer`, using `useFluidbox()`.                                           |
| [Right to left](./patterns/rtl.md)                 | Root `labels`, inside a `dir="rtl"` element.                                                     |
| [Photo in the address](./patterns/url.md)          | `v-model` on a ref that follows `?photo=`; [with Vue Router](#the-photo-in-the-url), a computed. |
| [Product media](./product-media.md)                | `Embed`, `Spin` and `Model` in `Slides`' named slots.                                            |

## Vue notes

**Props change the open viewer in place.** Root makes one viewer when it mounts and keeps it until it unmounts. Changing `labels`, `zoom`, `loop`, `dismiss`, `wheel`, `slideshow` or `reach-end-threshold`, or adding or removing a `Viewer`, `Thumbnails` or `Sheet`, or changing the sheet's `snap-points` or `dismiss-motion`, applies to that viewer through `update()`, without closing it. Root compares these by value, so an inline `:zoom="{ step: 3 }"` changes nothing on each render. Root reads the `Slides` slots, `find-trigger`, `reveal-trigger`, `share-url` and the listeners when it uses them.

**Reactive items.** `items` can be a plain, `ref` or `reactive` array. Assigning a new array and changing a reactive array in place (`push`, `splice`, replacing an element) both replace the items. An array of equal items, as an inline `:items="[product]"` or a fresh `products.map(toItem)`, changes nothing. Changed items keep the slides of the ones that stayed the same. An open viewer stays on the same item id if the new items still have it. `useFluidbox().setItems` replaces them too, until `items` changes.

**Provide and inject reach custom content.** Slides, viewer content, live overlays and the thumbnails and sheet content render through `Teleport` from inside `Fluidbox.Root`, so they see what is provided around it, as the [Custom content](./patterns/renderers.md) example does with a theme.

**`as-child`.** The trigger clones its one slot child and merges your attributes and listeners onto it. A component child works if its root is an element. Your `@click` runs before the open; `event.preventDefault()` stops it. Use an element that can take focus, such as a `<button>` or `<a href>`.

**Previews update before the close flight.** When the viewer closes on a different item of a multi-item trigger, the trigger patches its DOM synchronously so the flight lands on the right picture. The trigger finds its image when it registers, so keep the `<img>` mounted and change its `src`; don't swap in a new element.

**Motion speed.** `--fluidbox-motion-speed` divides the open, close, zoom and slide moves: `2` is twice as fast. Set it on the viewer, or anywhere around the triggers, as the viewer copies `--fluidbox-*` properties from there as it opens. See the [CSS reference](./css-reference.md#inputs).

**Bundle.** The page loads the triggers, the items and the viewer's state. The viewer itself, with its gestures, transitions and slides, loads as `preload` says, by default when a pointer rests on a trigger. See [Loading the viewer](./getting-started.md#loading-the-viewer). The thumbnails, the sheet and the hotspots load when a `Thumbnails`, a `Sheet` or the first `Hotspot` renders, so they cost nothing until then.

### Types

The entry exports the parts' types (`FluidboxRootProps`, `FluidboxTriggerProps`, `FluidboxMediaProps`, `FluidboxHotspotProps`, `FluidboxImageProps`, `FluidboxVideoProps`, `FluidboxIframeProps`, `FluidboxControlProps`, `FluidboxOverlayProps`, `FluidboxSheetProps`, `FluidboxSheetSnapProps`, `FluidboxSlidesSlots`, `FluidboxSlideContent`, `FluidboxItemContext`, `FluidboxThumbnailContext`, `FluidboxTriggerPreview`, `FluidboxCommands`, `FluidboxApi`, `FluidboxSheetApi`, `FluidboxSlideApi`, and `FluidboxVueParts`, the type of `Fluidbox`) and the core types you use with them: the item types, the lists, `FluidboxTarget`, `FluidboxState`, `FluidboxLabels` and the events. Your own item type flows from `items` to the events and slots, and `useFluidbox<Photo>()` names it in a child component.
