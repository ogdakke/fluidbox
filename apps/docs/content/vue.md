---
title: Vue
section: Frameworks
order: 2
description: The Vue binding for fluidbox, with every component, composable, prop, slot and event, and the Vue-specific behaviour.
---

# Vue

`@ogdakke/fluidbox/vue` builds a gallery from components: `Fluidbox.Root` owns one viewer, `Fluidbox.Trigger` opens it, and the other parts add to the viewer. It needs Vue 3.3 or later.

## Install

```bash
npm install @ogdakke/fluidbox
```

```ts
import { Fluidbox, useFluidbox, useFluidboxSheet } from "@ogdakke/fluidbox/vue";
import "@ogdakke/fluidbox/styles.css";
```

Import `@ogdakke/fluidbox/styles.css` once in your app. Every component is a property of the `Fluidbox` object, so a `<script setup>` template uses `<Fluidbox.Root>`, `<Fluidbox.Trigger>` and so on. To register them globally, name them yourself: `app.component("FluidboxRoot", Fluidbox.Root)`. The `Filmstrip` and `Sheet` parts turn their add-ons on, so there is nothing else to import, except `@ogdakke/fluidbox/sheet.css` for the sheet.

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

| Component                              | Renders                     | Role                                                                                      |
| -------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------- |
| `Fluidbox.Root`                        | its default slot            | Owns one viewer for a list of items. Every other part must be inside it.                  |
| `Fluidbox.Item`                        | its default slot            | Scopes an item for the `Trigger` and `ThumbnailOverlay` inside.                           |
| `Fluidbox.Trigger`                     | a `<button>`, or its child  | Opens an item. Registers itself as the item's origin.                                     |
| `Fluidbox.ThumbnailOverlay`            | a `<span>`                  | A badge or caption on the thumbnail that fades or flies with the photo.                   |
| `Fluidbox.Viewer`                      | its slot, in the viewer     | Your own controls and captions, teleported into the viewer's layer.                       |
| `Fluidbox.Controls`                    | three `<button>`s           | The default Previous, Next and Close, for a `Viewer` with content of its own.             |
| `Fluidbox.Previous`, `.Next`, `.Close` | a `<button>`                | Run the command, with the default icon and label, and disable themselves when they can't. |
| `Fluidbox.Filmstrip`                   | its slot, in each thumbnail | Turns the filmstrip on, with your thumbnails when it has a slot.                          |
| `Fluidbox.Sheet`                       | its slot, in the sheet      | Turns the sheet on, with your content for the active item.                                |
| `Fluidbox.SheetStop`                   | a `<button>`                | Moves the sheet to a stop, or back down when it is there.                                 |

### `Fluidbox.Root`

| Prop        | Type                                                           | Default               | Purpose                                                                                                                                                 |
| ----------- | -------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`     | `readonly TItem[] \| FluidboxItemList<TItem>`                  |                       | Required. The items, or a lazy list `{ count, get, indexOf? }`. See [Items and origins](./items-and-origins.md).                                        |
| `renderers` | `Record<string, (ctx: { item, index, signal }) => VNodeChild>` | `{}`                  | Draw `custom` items, by the name in their `render`. The type is `FluidboxVueRenderer`.                                                                  |
| `zoom`      | `false \| { step?: number; max?: number }`                     | `{ step: 2, max: 4 }` | Zoom steps, or `false` to turn zoom off.                                                                                                                |
| `labels`    | `Partial<FluidboxLabels>`                                      | English               | Your strings for the viewer's names and announcements. See [Labels](./api.md#labels).                                                                   |
| `origins`   | `FluidboxOriginAdapter`                                        | triggers              | Finds the triggers of items without a mounted `Trigger`, as in a virtualized grid. See [The origin adapter](./items-and-origins.md#the-origin-adapter). |

| Event               | Payload               | When                                                                                          |
| ------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `@beforetoggle`     | `FluidboxToggleEvent` | Before the viewer opens or closes. Cancelable: `event.preventDefault()` keeps it as it is.    |
| `@toggle`           | `FluidboxToggleEvent` | The opening or closing motion starts.                                                         |
| `@beforeitemchange` | `FluidboxChangeEvent` | Before the open viewer moves to another item. Cancelable: `event.preventDefault()` stays put. |
| `@itemchange`       | `FluidboxChangeEvent` | The viewer moves to an item, including the one it opens on.                                   |
| `@settle`           | `FluidboxChangeEvent` | The viewer comes to rest on an item.                                                          |

The events are the fluidbox's own; see [Events](./javascript.md#events) for their fields and reasons. `event.item` is your own object, of the type of `items`.

The default slot gets the `useFluidbox()` object: the state and the commands. Use it to drive the viewer from the same template:

```vue
<Fluidbox.Root v-slot="{ status, index, count, open }" :items="photos">
  <button type="button" @click="open(0)">
    {{ status === "closed" ? "Open" : `${(index ?? 0) + 1} / ${count}` }}
  </button>
</Fluidbox.Root>
```

### `Fluidbox.Item`

| Prop   | Type                        | Purpose                                                                                          |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------ |
| `item` | `TItem \| number \| string` | Required. The item, or its index or id, that `Trigger` and `ThumbnailOverlay` inside default to. |

### `Fluidbox.Trigger`

| Prop       | Type                                     | Default | Purpose                                                                                            |
| ---------- | ---------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `item`     | `TItem \| number \| string`              |         | The item to open, or its index or id. Defaults to the first of `items`, then the enclosing `Item`. |
| `items`    | `readonly (TItem \| number \| string)[]` |         | Every item that may return to this trigger on close, as for an album cover.                        |
| `as-child` | `boolean`                                | `false` | Decorate the one child of the slot instead of rendering a `<button>`.                              |

An item's id is its `id`, else its `src`. Other attributes and listeners go to the button, or to the child with `as-child`. The rendered button gets `type="button"` unless you set `type`.

The default slot gets `{ item, index, status }` (`FluidboxTriggerSlotProps`): the item the trigger shows. That is the item the viewer is on while it is open, then the last one it showed, so an album cover reopens on it. `item` is `null` when the trigger's items have left the list.

The trigger adds `data-fluidbox-trigger`, `aria-haspopup="dialog"` and `aria-expanded` to its element, and starts loading the item on pointer down.

### `Fluidbox.ThumbnailOverlay`

| Prop     | Type      | Default | Purpose                                                                                       |
| -------- | --------- | ------- | --------------------------------------------------------------------------------------------- |
| `travel` | `boolean` | `false` | Fly with the photo. Without it, the overlay stays on the page and gets `--fluidbox-progress`. |

It registers for the enclosing `Trigger`'s items, else the enclosing `Item`. With `travel`, the default slot renders a second time in the moving frame. Attributes go to its `<span>`.

### `Fluidbox.Viewer` and `Fluidbox.Controls`

Neither takes props. `Viewer` teleports its slot into the viewer's body-level layer once the viewer exists, and stays there while the viewer opens and closes; the layer fades out as a dismiss starts. With a `Viewer`, the viewer has only what you put in it, so add `<Fluidbox.Controls />` for the default buttons, or `Previous`, `Next` and `Close` one by one.

### `Fluidbox.Previous`, `Fluidbox.Next`, `Fluidbox.Close`

With an empty slot each shows the default icon and an `aria-label` from `labels`. `disabled` follows the viewer's state: `Previous` and `Next` at the ends of the gallery, `Close` while the viewer is closed. Pass `:disabled` to override it. Your `@click` runs first; `event.preventDefault()` stops the command. They work anywhere inside `Root`, in the viewer or on the page.

### `Fluidbox.Filmstrip`

No props. Being there turns the filmstrip on. Without a slot, each thumbnail is the item's `thumbnail`, else its image. With a default slot, it renders into each thumbnail button and gets `{ item, index }` (`FluidboxFilmstripSlotProps`). The strip marks the selected button `data-fluidbox-selected`, so your thumbnail tracks nothing itself:

```vue
<Fluidbox.Filmstrip v-slot="{ index }">
  <span class="thumb">{{ index + 1 }}</span>
</Fluidbox.Filmstrip>
```

### `Fluidbox.Sheet` and `Fluidbox.SheetStop`

| Prop          | Type                                               | Default              | Purpose                                                  |
| ------------- | -------------------------------------------------- | -------------------- | -------------------------------------------------------- |
| `snap-points` | `readonly (number \| "${number}%" \| "content")[]` | `["60%", "content"]` | The stops above the resting one, lowest first.           |
| `dismiss`     | `"flight" \| "scroll" \| "none"`                   | `"flight"`           | What a swipe down on the photo does with the sheet down. |

Being there turns the sheet on. Its default slot is the sheet's content for the active item, and gets `{ item, index, stop, set }` (`FluidboxSheetSlotProps`): `stop` is where the sheet rests, 0 at rest and then one per snap point, and `set(stop)` moves it. The runtime makes the `data-fluidbox-sheet` element around it. Import `@ogdakke/fluidbox/sheet.css` once. See [Filmstrip and sheet](./filmstrip-and-sheet.md).

`Fluidbox.SheetStop` takes a required `stop` and renders a `<button data-fluidbox-sheet-stop>` that moves the sheet there, or back to 0 when it is there, and keeps `aria-expanded` in step. It works in the viewer: in a `Viewer`, or in the sheet.

## Composables

Call them in `setup` of a component inside `Fluidbox.Root`.

| Composable              | Returns              | Purpose                                                                                                                                                                 |
| ----------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useFluidbox()`         | `FluidboxApi<TItem>` | One reactive object: the state (`status`, `id`, `index`, `item`, `count`, `hasPrevious`, `hasNext`) and the commands (`open`, `close`, `next`, `previous`, `setItems`). |
| `useFluidbox(selector)` | `ComputedRef`        | The part of that object the selector picks.                                                                                                                             |
| `useFluidboxSheet()`    | `FluidboxSheetApi`   | One reactive object: the sheet's `stop`, and `set(stop, { animate? })`.                                                                                                 |

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

Read the object's fields where you use them, as `fluidbox.index`: destructuring it in `<script setup>` takes the values once. The commands are the fluidbox's: each resolves `true` once it happened and `false` when it didn't, as when an event listener prevented it. Before the viewer exists, they resolve `false`. A target is an index or an id: `open(2)` or `open("photo-fjord")`.

### Types

The entry exports the parts' types (`FluidboxApi`, `FluidboxCommands`, `FluidboxSheetApi`, `FluidboxTriggerSlotProps`, `FluidboxFilmstripSlotProps`, `FluidboxSheetSlotProps`, `FluidboxVueRenderer`, `FluidboxVueRenderContext`) and the core types you use with them: the item types, `FluidboxItemList`, `FluidboxTarget`, `FluidboxState`, `FluidboxLabels`, `FluidboxOriginAdapter`, `FluidboxToggleEvent` and `FluidboxChangeEvent`. Your own item type flows from `items` to the events and slots, and `useFluidbox<Photo>()` names it in a child component.

## Patterns

| Pattern                                            | In Vue                                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Gallery](./patterns/basic.md)                     | `:items`, and a `Trigger` per item. The default controls come without a `Viewer`.                   |
| [One trigger for an album](./patterns/overlay.md)  | `<Fluidbox.Trigger v-slot="{ item }" :items="album">` and `<Fluidbox.ThumbnailOverlay travel>`.     |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` on an element inside the `Trigger`; `as-child` for your own element.         |
| [Custom content](./patterns/renderers.md)          | `:renderers="{ note: () => h(Note) }"`.                                                             |
| [Programmatic control](./patterns/programmatic.md) | The root slot's `{ status, index, open }`, and `@beforeitemchange` with `event.preventDefault()`.   |
| [Zoom](./patterns/zoom.md)                         | `:zoom="{ step, max }"` or `:zoom="false"`.                                                         |
| [Filmstrip](./patterns/filmstrip.md)               | `<Fluidbox.Filmstrip />`, or with a slot for your own thumbnails.                                   |
| [Sheet](./patterns/sheet.md)                       | `<Fluidbox.Sheet v-slot="{ item, stop, set }">` and `<Fluidbox.SheetStop :stop="1">` in a `Viewer`. |
| [Headless controls](./patterns/headless.md)        | Your own buttons in a `Viewer`, using the root slot's object.                                       |

## Vue notes

**What rebuilds the viewer.** Adding or removing a `Viewer`, `Filmstrip` or `Sheet`, or changing `zoom`, `labels` or the sheet's `snap-points` or `dismiss`, destroys the viewer and builds a new one, closing it if it is open. They are compared by value, so an inline `:zoom="{ step: 3 }"` is fine. `origins`, `renderers` and the event listeners are read when used.

**Reactive items.** `items` can be a plain, `ref` or `reactive` array. Assigning a new array and changing a reactive array in place (`push`, `splice`, replacing an element) both replace the items; an array of the same objects, as an inline `:items="[product]"`, changes nothing. An open viewer stays on the same item id if the new items still have it. `useFluidbox().setItems` replaces them too, until `items` changes.

**Provide and inject reach custom content.** Renderers, viewer content, travelling overlays and the filmstrip and sheet content render through `Teleport` from inside `Fluidbox.Root`, so they see what is provided around it, as the [Custom content](./patterns/renderers.md) example does with a theme.

**`as-child`.** The trigger clones its one slot child and merges your attributes and listeners onto it. A component child works if its root is an element. Your `@click` runs before the open; `event.preventDefault()` stops it. Use an element that can take focus, such as a `<button>` or `<a href>`.

**Server rendering.** The components render their markup on the server; the viewer is created in `onMounted`.

**Previews update before the close flight.** When the viewer closes on a different item of a multi-item trigger, the trigger patches its DOM synchronously so the flight lands on the right picture. The trigger finds its image when it registers, so keep the `<img>` mounted and change its `src`; don't swap in a new element.
