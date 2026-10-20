---
title: Vue
section: Frameworks
order: 3
description: The Vue binding for fluidbox, with every component, composable, prop, slot and event, and the Vue-specific behaviour.
---

# Vue

`@ogdakke/fluidbox/vue` builds a gallery from components. `Fluidbox.Root` owns one viewer, `Fluidbox.Trigger` opens it, and the other parts add to the viewer. It needs Vue 3.3 or later.

## Install

```bash
npm install @ogdakke/fluidbox
```

```ts
import { Fluidbox, useFluidbox, useFluidboxSheet } from "@ogdakke/fluidbox/vue";
import "@ogdakke/fluidbox/styles.css";
```

Import `@ogdakke/fluidbox/styles.css` once in your app. Every component is a property of the `Fluidbox` object, so a `<script setup>` template uses `<Fluidbox.Root>`, `<Fluidbox.Trigger>` and so on. To register them globally, name them yourself: `app.component("FluidboxRoot", Fluidbox.Root)`. The `Filmstrip` and `Sheet` parts turn their add-ons on, so there is nothing else to import except their stylesheets, `@ogdakke/fluidbox/filmstrip.css` and `@ogdakke/fluidbox/sheet.css`.

## A gallery

```vue
<script setup lang="ts">
import type { FluidboxImageItem } from "@ogdakke/fluidbox/vue";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import "@ogdakke/fluidbox/styles.css";

const photos: FluidboxImageItem[] = [
  {
    type: "img",
    src: "/photos/dune.jpg",
    alt: "Dune at dusk",
    width: 1800,
    height: 1200,
    thumbnail: { src: "/photos/dune-400.jpg", width: 400, height: 267 },
  },
  {
    type: "img",
    src: "/photos/fjord.jpg",
    alt: "Fjord",
    width: 1200,
    height: 1600,
    thumbnail: { src: "/photos/fjord-400.jpg", width: 400, height: 533 },
  },
];
</script>

<template>
  <Fluidbox.Root :items="photos">
    <Fluidbox.Trigger v-for="photo in photos" :key="photo.src" :item="photo">
      <img :src="photo.thumbnail?.src" :alt="photo.alt" />
    </Fluidbox.Trigger>
  </Fluidbox.Root>
</template>
```

Without a `Fluidbox.Viewer`, the viewer has the default Previous, Next and Close buttons. The same gallery, live, in every framework:

<!-- pattern: basic -->

## Components

| Component                              | Renders                     | Role                                                                                       |
| -------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| `Fluidbox.Root`                        | its default slot            | Owns one viewer for a list of items. Every other part must be inside it.                   |
| `Fluidbox.Trigger`                     | a `<button>`, or its child  | Opens an item. Registers itself as the item's origin.                                      |
| `Fluidbox.ThumbnailOverlay`            | a `<span>`                  | A badge or caption on the thumbnail that fades or flies with the photo.                    |
| `Fluidbox.FrameLayer`                  | a `<span>`                  | A layer of a travelling overlay that moves into the flying frame, as one element.          |
| `Fluidbox.Viewer`                      | its slot, in the viewer     | Your own controls and captions, teleported into the viewer's layer.                        |
| `Fluidbox.Controls`                    | three `<button>`s           | The default Previous, Next and Close, for a `Viewer` with content of its own.              |
| `Fluidbox.Previous`, `.Next`, `.Close` | a `<button>`                | Run the command, with the default icon and label, and disable themselves when they can't.  |
| `Fluidbox.Filmstrip`                   | its slot, in each thumbnail | Turns the filmstrip on, with your thumbnails when it has a slot.                           |
| `Fluidbox.Sheet`                       | its slot, in the sheet      | Turns the sheet on, with your content for the active item; its attributes go on the sheet. |
| `Fluidbox.SheetStop`                   | a `<button>`                | Moves the sheet to a stop, or back down when it is there.                                  |

### `Fluidbox.Root`

| Prop        | Type                                                           | Default               | Purpose                                                                                                                                                 |
| ----------- | -------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`     | `readonly TItem[] \| FluidboxItemList<TItem>`                  |                       | Required. The items, or a lazy list `{ count, get, indexOf? }`. See [Items and origins](./items-and-origins.md).                                        |
| `open`      | `boolean`                                                      |                       | Whether the viewer is open, for `v-model:open`. It opens on `index` and closes as this changes. Leave it out to let the triggers own it.                |
| `index`     | `number`                                                       |                       | The item the viewer shows, for `v-model:index`. An index out of range is ignored.                                                                       |
| `renderers` | `Record<string, (ctx: { item, index, signal }) => VNodeChild>` | `{}`                  | Draw `custom` items, by the name in their `render`. The type is `FluidboxVueRenderer`.                                                                  |
| `zoom`      | `false \| { step?: number; max?: number }`                     | `{ step: 2, max: 4 }` | Zoom steps, or `false` to turn zoom off.                                                                                                                |
| `loop`      | `boolean`                                                      | `false`               | Go round: past the last item comes the first, by swipe, key, button and filmstrip. A single item never loops.                                           |
| `labels`    | `Partial<FluidboxLabels>`                                      | English               | Your strings for the viewer's names and announcements. See [Labels](./api.md#labels).                                                                   |
| `origins`   | `FluidboxOriginAdapter<TItem>`                                 | triggers              | Finds the triggers of items without a mounted `Trigger`, as in a virtualized grid. See [The origin adapter](./items-and-origins.md#the-origin-adapter). |
| `loading`   | `"hover" \| "press" \| "eager"`                                | `"hover"`             | When the viewer's code loads. See [Loading the viewer](./getting-started.md#loading-the-viewer).                                                        |

| Event               | Payload                   | When                                                                                          |
| ------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `@beforetoggle`     | `FluidboxToggleEvent`     | Before the viewer opens or closes. Cancelable: `event.preventDefault()` keeps it as it is.    |
| `@toggle`           | `FluidboxToggleEvent`     | The opening or closing motion starts.                                                         |
| `@beforeitemchange` | `FluidboxItemChangeEvent` | Before the open viewer moves to another item. Cancelable: `event.preventDefault()` stays put. |
| `@itemchange`       | `FluidboxItemChangeEvent` | The viewer moves to an item, including the one it opens on.                                   |
| `@settle`           | `FluidboxItemChangeEvent` | The viewer comes to rest on an item.                                                          |
| `@sheetchange`      | `FluidboxSheetEvent`      | The sheet comes to rest at another stop: `event.stop`, 0 at rest.                             |
| `@update:open`      | `boolean`, `{ reason }`   | The viewer opens or closes, from any input. Half of `v-model:open`.                           |
| `@update:index`     | `number`, `{ reason }`    | The viewer moves to another item, opening included. Half of `v-model:index`.                  |

The events are the fluidbox's own; see [Events](./javascript.md#events) for their fields and reasons. `event.item` is your own object, of the type of `items`.

Root makes one viewer when it mounts and keeps it until it unmounts. Changing `zoom` or `labels`, or adding or removing a `Viewer`, `Filmstrip` or `Sheet`, or changing the sheet's `snap-points` or `dismiss`, applies to that viewer in place, through `fluidbox.update()`, without closing it. Root compares these by value, so an inline `:zoom="{ step: 3 }"` changes nothing on each render. A filmstrip or a sheet that changes is drawn again. A sheet that goes or comes back starts at rest. `items` changes go through `setItems`. Root reads `origins`, `renderers` and the event listeners when it uses them.

The default slot gets the `useFluidbox()` object, with the state and the commands. Use it to drive the viewer from the same template:

```vue
<Fluidbox.Root v-slot="{ status, index, count, open }" :items="photos">
  <button type="button" @click="open(0)">
    {{ status === "closed" ? "Open" : `${(index ?? 0) + 1} / ${count}` }}
  </button>
</Fluidbox.Root>
```

### `Fluidbox.Trigger`

| Prop       | Type                               | Default | Purpose                                                                                  |
| ---------- | ---------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `item`     | `FluidboxTarget<TItem>`            |         | Required. The item to open, or its index or id. It closes back onto this trigger.        |
| `returns`  | `readonly FluidboxTarget<TItem>[]` |         | More items that close back onto this trigger, as for an album cover. May include `item`. |
| `as-child` | `boolean`                          | `false` | Decorate the one child of the slot instead of rendering a `<button>`.                    |

An item's id is its `id`, else its `src`. Other attributes and listeners go to the button, or to the child with `as-child`. The rendered button gets `type="button"` unless you set `type`.

The default slot gets `{ item, index, status }` (`FluidboxTriggerPreview`), which describes the item the trigger shows. While the viewer is open, that is the item it is on. After it closes, it is the last one it showed, so an album cover reopens on it. `item` is `null` when the trigger's items have left the list.

The trigger adds `data-fluidbox-trigger`, `aria-haspopup="dialog"` and `aria-expanded` to its element, and starts loading the item on pointer down.

### `Fluidbox.ThumbnailOverlay`

| Prop     | Type      | Default | Purpose                                                                                     |
| -------- | --------- | ------- | ------------------------------------------------------------------------------------------- |
| `travel` | `boolean` | `false` | Fly with the photo. Without it, the overlay stays on the page and gets `--fluidbox-closed`. |

It must be inside a `Trigger`, and registers for that trigger's `item` and `returns`. With `travel`, the default slot renders a second time, live, in the moving frame, so it keeps reacting while it flies. Attributes go to its `<span>`.

### `Fluidbox.FrameLayer`

No props. Inside a travelling `ThumbnailOverlay`, it renders a `<span data-fluidbox-frame-layer>` with its slot and attributes. For the flight, that element itself moves into the flying frame, with a copy left on the card, and goes back after. Use it for what should fly as one piece, such as a border or a frame drawn around the photo. In the overlay's live copy in the frame it renders nothing, so it never shows twice.

```vue
<Fluidbox.Trigger v-slot="{ item }" :item="album[0]" :returns="album">
  <img :src="item?.src" :alt="item?.alt" />
  <Fluidbox.ThumbnailOverlay travel>
    <Fluidbox.FrameLayer class="frame" />
    <span class="count">+{{ album.length - 1 }}</span>
  </Fluidbox.ThumbnailOverlay>
</Fluidbox.Trigger>
```

### `Fluidbox.Viewer` and `Fluidbox.Controls`

Neither takes props. `Viewer` teleports its slot into the viewer's body-level layer once the viewer exists, and stays there while the viewer opens and closes; the layer fades out as a dismiss starts. With a `Viewer`, the viewer has only what you put in it, so add `<Fluidbox.Controls />` for the default buttons, or `Previous`, `Next` and `Close` one by one.

### `Fluidbox.Previous`, `Fluidbox.Next`, `Fluidbox.Close`

With an empty slot each shows the default icon and an `aria-label` from `labels`. `disabled` follows the viewer's state: `Previous` and `Next` at the ends of a gallery that doesn't loop, `Close` while the viewer is closed. Pass `:disabled` to override it. Your `@click` runs first; `event.preventDefault()` stops the command. They work anywhere inside `Root`, in the viewer or on the page.

### `Fluidbox.Filmstrip`

No props. Rendering it turns the filmstrip on. Without a slot, each thumbnail is the item's `thumbnail`, else its image. With a default slot, it renders into each thumbnail button and gets `{ item, index }` (`FluidboxItemContext`). The strip marks the selected button `data-fluidbox-selected`, so your thumbnail tracks nothing itself:

```vue
<Fluidbox.Filmstrip v-slot="{ index }">
  <span class="thumb">{{ index + 1 }}</span>
</Fluidbox.Filmstrip>
```

### `Fluidbox.Sheet` and `Fluidbox.SheetStop`

| Prop          | Type                                | Default              | Purpose                                                  |
| ------------- | ----------------------------------- | -------------------- | -------------------------------------------------------- |
| `snap-points` | `readonly FluidboxSheetSnapPoint[]` | `["60%", "content"]` | The stops above the resting one, lowest first.           |
| `dismiss`     | `"flight" \| "scroll" \| "none"`    | `"flight"`           | What a swipe down on the photo does with the sheet down. |

Rendering it turns the sheet on. The runtime makes the sheet, a `<section data-fluidbox-sheet>` named by `labels.sheet`, and the part's own attributes (`class`, `style`, `data-*`, `aria-*`) go on that section. Its default slot is the section's content for the active item, and gets `{ item, index }` (`FluidboxItemContext`). To read or move the sheet, listen for `@sheetchange` on Root, use a `SheetStop`, or call `useFluidboxSheet()` in a component inside Root. Its `stop` is where the sheet rests, 0 at rest and then one per snap point, and `set(stop)` moves it. Import `@ogdakke/fluidbox/sheet.css` once. See [Filmstrip and sheet](./filmstrip-and-sheet.md).

```vue
<Fluidbox.Root :items="photos" @sheetchange="stop = $event.stop">
  <Fluidbox.Sheet v-slot="{ item }" :snap-points="['40%', '90%']" class="details">
    <h3>{{ item.alt }}</h3>
    <p>Stop {{ stop }}</p>
    <Fluidbox.SheetStop :stop="2">Expand</Fluidbox.SheetStop>
  </Fluidbox.Sheet>
</Fluidbox.Root>
```

`Fluidbox.SheetStop` takes a required `stop` and renders a `<button data-fluidbox-sheet-stop>` that moves the sheet there, or back to 0 when it is there, and keeps `aria-expanded` in step. It works anywhere in the viewer, in a `Viewer` or in the sheet.

## Composables

Call them in `setup` of a component inside `Fluidbox.Root`.

| Composable              | Returns              | Purpose                                                                                                                                                                                    |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useFluidbox()`         | `FluidboxApi<TItem>` | One reactive object: the state (`status`, `id`, `index`, `item`, `count`, `hasPrevious`, `hasNext`) and the commands (`open`, `close`, `next`, `previous`, `setItems`, `preload`, `load`). |
| `useFluidbox(selector)` | `ComputedRef`        | The part of that object the selector picks.                                                                                                                                                |
| `useFluidboxSheet()`    | `FluidboxSheetApi`   | One reactive object: the sheet's `stop`, which follows `sheetchange`, and `set(stop, { animate? })`.                                                                                       |

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

Read the object's fields where you use them, as `fluidbox.index`. Destructuring it in `<script setup>` reads the values once. The commands are the fluidbox's own. Each resolves `true` once it happened and `false` when it didn't, as when an event listener prevented it. Commands made before the viewer exists wait for it, and run once Root has mounted. A target is the item, its index or its id: `open(photo)`, `open(2)` or `open("photo-fjord")`. `preload(target)` starts loading an item a press is likely to open, and returns a function that lets go. `load()` loads the viewer's code now.

### Types

The entry exports the parts' types (`FluidboxApi`, `FluidboxCommands`, `FluidboxSheetApi`, `FluidboxTriggerPreview`, `FluidboxItemContext`, `FluidboxVueRenderer`, `FluidboxVueRenderContext`) and the core types you use with them: the item types, `FluidboxItemList`, `FluidboxTarget`, `FluidboxState`, `FluidboxLabels`, `FluidboxOriginAdapter`, `FluidboxToggleEvent`, `FluidboxItemChangeEvent` and `FluidboxSheetEvent`. Your own item type flows from `items` to the events and slots, and `useFluidbox<Photo>()` names it in a child component.

## Patterns

| Pattern                                            | In Vue                                                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Gallery](./patterns/basic.md)                     | `:items`, and a `Trigger` per item. The default controls come without a `Viewer`.                                                                      |
| [One trigger for an album](./patterns/overlay.md)  | `<Fluidbox.Trigger v-slot="{ item }" :item="album[0]" :returns="album">` and `<Fluidbox.ThumbnailOverlay travel>`.                                     |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` on an element inside the `Trigger`; `as-child` for your own element.                                                            |
| [Custom content](./patterns/renderers.md)          | `:renderers="{ note: () => h(Note) }"`.                                                                                                                |
| [Programmatic control](./patterns/programmatic.md) | The root slot's `{ status, index, open }`, and `@beforeitemchange` with `event.preventDefault()`.                                                      |
| [Zoom](./patterns/zoom.md)                         | `:zoom="{ step, max }"` or `:zoom="false"`.                                                                                                            |
| [Filmstrip](./patterns/filmstrip.md)               | `<Fluidbox.Filmstrip />`, or with a slot for your own thumbnails.                                                                                      |
| [Sheet](./patterns/sheet.md)                       | `<Fluidbox.Sheet v-slot="{ item }">`, `@sheetchange`, and `<Fluidbox.SheetStop :stop="1">` in a `Viewer`.                                              |
| [Headless controls](./patterns/headless.md)        | Your own buttons in a `Viewer`, using the root slot's object.                                                                                          |
| [Right to left](./patterns/rtl.md)                 | Root `labels`, inside a `dir="rtl"` element.                                                                                                           |
| [Photo in the address](./patterns/url.md)          | `:open`, `:index`, `@update:open` and `@update:index` from a ref that follows `?photo=`. `v-model:open` and `v-model:index` when nothing else listens. |

## Vue notes

**Reactive items.** `items` can be a plain, `ref` or `reactive` array. Assigning a new array and changing a reactive array in place (`push`, `splice`, replacing an element) both replace the items. An array of the same objects, as an inline `:items="[product]"`, changes nothing. An open viewer stays on the same item id if the new items still have it. `useFluidbox().setItems` replaces them too, until `items` changes.

**Provide and inject reach custom content.** Renderers, viewer content, travelling overlays and the filmstrip and sheet content render through `Teleport` from inside `Fluidbox.Root`, so they see what is provided around it, as the [Custom content](./patterns/renderers.md) example does with a theme.

**`as-child`.** The trigger clones its one slot child and merges your attributes and listeners onto it. A component child works if its root is an element. Your `@click` runs before the open; `event.preventDefault()` stops it. Use an element that can take focus, such as a `<button>` or `<a href>`.

**Server rendering.** The components render their markup on the server; Root creates the viewer in `onMounted`.

**Previews update before the close flight.** When the viewer closes on a different item of a multi-item trigger, the trigger patches its DOM synchronously so the flight lands on the right picture. The trigger finds its image when it registers, so keep the `<img>` mounted and change its `src`; don't swap in a new element.
