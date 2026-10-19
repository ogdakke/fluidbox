---
title: Custom elements
section: Frameworks
order: 5
description: The fluidbox custom elements, with every element, attribute, property, method and event, and how markup becomes gallery items.
---

# Custom elements

`@ogdakke/fluidbox/elements` registers `<fluidbox-gallery>`, `<fluidbox-item>`, `<fluidbox-filmstrip>` and `<fluidbox-sheet>`. You write the gallery as markup; the gallery reads it into items and owns one fluidbox for them. No framework is needed, and the elements work inside any framework that renders plain HTML.

## Install

```bash
npm install @ogdakke/fluidbox
```

```ts
import "@ogdakke/fluidbox/elements";
import "@ogdakke/fluidbox/styles.css";
```

`@ogdakke/fluidbox/elements` defines the elements when it loads, so import it only in the browser. On a server-rendered page, import it after hydration:

```ts
if (typeof customElements !== "undefined") await import("@ogdakke/fluidbox/elements");
```

## A gallery

```html
<fluidbox-gallery>
  <fluidbox-item item-id="dune">
    <button slot="trigger" type="button">
      <img src="/photos/dune-400.jpg" alt="Dune at dusk" />
    </button>
    <template slot="content">
      <img src="/photos/dune.jpg" alt="Dune at dusk" width="1800" height="1200" />
    </template>
  </fluidbox-item>
  <fluidbox-item item-id="fjord">
    <button slot="trigger" type="button">
      <img src="/photos/fjord-400.jpg" alt="Fjord" />
    </button>
    <template slot="content">
      <img src="/photos/fjord.jpg" alt="Fjord" width="1200" height="1600" />
    </template>
  </fluidbox-item>
</fluidbox-gallery>
```

The gallery adds Previous, Next and Close buttons to the viewer unless you give it viewer content of your own. The same gallery, live, in every framework:

<!-- pattern: basic -->

## Elements

| Element                | Class                      | Role                                                                                        |
| ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| `<fluidbox-gallery>`   | `FluidboxGalleryElement`   | Owns one fluidbox for its `<fluidbox-item>` children, or for the `items` you set.           |
| `<fluidbox-item>`      | `FluidboxItemElement`      | One item: its trigger and its content. A direct child of the gallery.                       |
| `<fluidbox-filmstrip>` | `FluidboxFilmstripElement` | Hidden. As a direct child of the gallery, it turns the filmstrip on.                        |
| `<fluidbox-sheet>`     | `FluidboxSheetElement`     | Hidden. As a direct child of the gallery, it turns the sheet on and holds its content.      |
| `<fluidbox-controls>`  | none                       | Inside `<template slot="viewer">`, stands for the default Previous, Next and Close buttons. |

`@ogdakke/fluidbox/elements` exports the four classes. Importing it adds the tags to `HTMLElementTagNameMap`, so `querySelector("fluidbox-gallery")` is typed, and `fluidbox-preview-change` to `HTMLElementEventMap`.

## `<fluidbox-item>`

| Attribute     | What it does                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `item-id`     | Required, unique in the gallery. The item's id for commands, events and `returns`.                  |
| `returns`     | Space-separated ids of other items whose close flight lands on this trigger, as for an album cover. |
| `placeholder` | An image painted behind an image slide until it decodes, such as a tiny data URI.                   |
| `aria-label`  | The title of custom content (see below). Defaults to `item-id`.                                     |

| Child                       | What it does                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[slot="trigger"]`          | The element that opens the item, usually a `<button>`. Its first `<img>` becomes the item's `thumbnail`. Leave it out for an item with no thumbnail of its own, such as the rest of an album. |
| `<template slot="content">` | Required. One root element: the media (see below). Inert until the viewer shows it.                                                                                                           |
| `<template slot="sheet">`   | This item's sheet content, when the gallery has a `<fluidbox-sheet>`.                                                                                                                         |

### What the content template becomes

The template's root element becomes a flat item, attribute for attribute:

| Root element of the template            | Item type | Read from it                                                                                                                                      |
| --------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<img>`, or `<picture>` with an `<img>` | `img`     | `src`, `srcset`, `sizes`, `alt`, and `width` and `height` (required). Each `<source>` of a `<picture>` becomes one of `sources`.                  |
| `<video>`                               | `video`   | `src`, `width` and `height` (required), `poster`, `autoplay`, `loop`, `muted`, `playsinline`, `controls`, `preload`, and `aria-label` or `title`. |
| `<iframe src>`                          | `iframe`  | `src`, `width` and `height` (required), `title`, `allow`, `referrerpolicy` and `sandbox`.                                                         |
| anything else                           | `custom`  | The template is cloned into the slide. `width` and `height` on the root set its size; without them, the trigger image's size.                     |

A `<video>` reads its boolean attributes as HTML does: present is on. So write `controls` and `playsinline` on it, as you would on the page. See [Media types](./media.md) for what each type does in the viewer.

| Property    | Type                  | What it is                                 |
| ----------- | --------------------- | ------------------------------------------ |
| `itemId`    | `string`              | The `item-id`. Throws when it is empty.    |
| `originIds` | `readonly string[]`   | This item's id, then the ids in `returns`. |
| `trigger`   | `HTMLElement \| null` | The `slot="trigger"` child.                |

| Event                     | `detail`                             | When                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fluidbox-preview-change` | `{ id: string; item: FluidboxItem }` | Before a close flight lands on this trigger, with the item it lands on: its own or one in `returns`. Bubbles. Show that item on the trigger here, synchronously, and mark the trigger `data-fluidbox-dynamic-preview`. |

## `<fluidbox-gallery>`

| Attribute   | What it does                                                 |
| ----------- | ------------------------------------------------------------ |
| `zoom`      | `zoom="off"` turns zoom off.                                 |
| `zoom-step` | The scale of a double-tap or double-click zoom. Default `2`. |
| `zoom-max`  | The largest zoom scale. Default `4`.                         |

The properties are the [`createFluidbox` options](./javascript.md#createfluidboxoptions) the markup can't say, and the [fluidbox's](./javascript.md#the-fluidbox) state and handles:

| Property    | Type                                    | What it is                                                                                                                         |
| ----------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `items`     | `FluidboxItems \| null`                 | Items to use instead of the `<fluidbox-item>` children: an array or a lazy list (see [Items and origins](./items-and-origins.md)). |
| `renderers` | `Record<string, FluidboxRenderer>`      | Draw `custom` items of `items`, by the name in their `render`. Read when a slide mounts.                                           |
| `viewer`    | `FluidboxViewerRenderer \| undefined`   | Your own viewer content. Wins over `<template slot="viewer">` and the default controls.                                            |
| `origins`   | `FluidboxOriginAdapter \| undefined`    | Origins for items with no trigger in the gallery, and `revealOrigin` to scroll one into view.                                      |
| `zoom`      | `false \| { step?, max? } \| undefined` | Zoom options, or `false`. Wins over the zoom attributes.                                                                           |
| `labels`    | `Partial<FluidboxLabels> \| undefined`  | Your strings for the viewer. See [Labels](./api.md#labels).                                                                        |
| `state`     | `FluidboxState`                         | The viewer's state, or a closed state before the gallery is ready.                                                                 |
| `sheet`     | `FluidboxSheet \| null`                 | The sheet, while a `<fluidbox-sheet>` turns it on.                                                                                 |
| `filmstrip` | `FluidboxFilmstrip \| null`             | The filmstrip, while a `<fluidbox-filmstrip>` turns it on.                                                                         |
| `fluidbox`  | `Fluidbox \| null`                      | The fluidbox behind the gallery, or `null` before it is ready. A rebuild replaces it.                                              |

| Method                    | Returns             | What it does                                                                                                                       |
| ------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `open(target?, options?)` | `Promise<boolean>`  | Opens the viewer on an index or id, or moves to it while open.                                                                     |
| `close(options?)`         | `Promise<boolean>`  | Closes the viewer.                                                                                                                 |
| `next(options?)`          | `Promise<boolean>`  | Next item.                                                                                                                         |
| `previous(options?)`      | `Promise<boolean>`  | Previous item.                                                                                                                     |
| `subscribe(listener)`     | `() => void`        | Calls `listener(state)` on every state change. Unlike `fluidbox.subscribe`, it keeps working when the gallery rebuilds its viewer. |
| `whenReady()`             | `Promise<Fluidbox>` | Resolves once the gallery has read its items. Rejects if the gallery is not connected.                                             |

The commands work as [the fluidbox's](./javascript.md#commands) do. Each waits until the gallery has read its items, and rejects if the gallery isn't connected.

### Events

The gallery fires the fluidbox's events: `beforetoggle`, `toggle`, `beforeitemchange`, `itemchange` and `settle`, with the same `reason`, `id`, `index` and `item` fields (see [Events](./javascript.md#events)). They don't bubble, like a popover's. Canceling `beforetoggle` or `beforeitemchange` on the gallery cancels the command.

```ts
import { FluidboxChangeEvent } from "@ogdakke/fluidbox";

const gallery = document.querySelector("fluidbox-gallery")!;
gallery.addEventListener("itemchange", (event) => {
  if (event instanceof FluidboxChangeEvent) console.log("now showing", event.id);
});
gallery.subscribe((state) => console.log(state.status, state.index));
await gallery.open("fjord");
```

The event classes, `FluidboxChangeEvent` and `FluidboxToggleEvent`, are exported from `@ogdakke/fluidbox`.

## Markers

| Attribute                                                             | Put it on                                 | Effect                                                                                                                              |
| --------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `data-fluidbox-origin`                                                | an element inside a trigger               | The flight starts and ends on this element instead of the trigger's image.                                                          |
| `data-fluidbox-preview`, `data-fluidbox-target`                       | a trigger or an element inside it         | Also mark the visible box. `data-fluidbox-origin` wins over both, and `data-fluidbox-target` over `data-fluidbox-preview`.          |
| `data-fluidbox-thumbnail-overlay`                                     | an element inside a trigger               | A thumbnail overlay, one per trigger. It stays on the page and gets `--fluidbox-progress`. `="travel"` makes it fly with the photo. |
| `data-fluidbox-dynamic-preview`                                       | a trigger                                 | Changes inside it don't make the gallery re-read its items. Use it on a trigger whose image you swap.                               |
| `data-fluidbox-item-id="id"`                                          | any element in a gallery with `items` set | Makes the element a trigger for that item.                                                                                          |
| `data-fluidbox-close`, `data-fluidbox-previous`, `data-fluidbox-next` | a button in the viewer content            | Runs that command, with the default control styling. Previous and Next are disabled at the ends, Close while closed.                |
| `data-fluidbox-sheet-stop="N"`                                        | a button in the viewer                    | Moves the sheet to stop `N`.                                                                                                        |

Each trigger also gets `data-fluidbox-trigger`, `aria-haspopup="dialog"` and `aria-expanded`. The trigger's default styles use `:where()`, so your own classes win.

## Viewer content

The viewer's layer is filled by the first of these that exists:

1. the `viewer` property, a renderer called with `{ target, fluidbox, signal }`, as the [`viewer` option](./javascript.md#viewer-content);
2. a `<template slot="viewer">` that is a direct child of the gallery, cloned into the viewer, where `<fluidbox-controls>` expands to the default buttons;
3. the default Previous, Next and Close buttons.

```html
<fluidbox-gallery>
  <!-- items -->
  <template slot="viewer">
    <fluidbox-controls></fluidbox-controls>
    <button type="button" data-fluidbox-sheet-stop="1">Details</button>
  </template>
</fluidbox-gallery>
```

## Filmstrip and sheet

A `<fluidbox-filmstrip>` child turns the filmstrip on, and a `<fluidbox-sheet>` child the sheet. The gallery loads their add-on code itself, so you don't import `@ogdakke/fluidbox/filmstrip` or `/sheet`; the sheet still needs `@ogdakke/fluidbox/sheet.css`.

| `<fluidbox-sheet>` attribute | What it does                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `snap-points`                | The stops above rest, lowest first: `"40% 90%"`, pixels such as `"240"`, or `content`. |
| `dismiss`                    | `flight`, `scroll` or `none`. See [Stops](./filmstrip-and-sheet.md#stops).             |

The sheet shows the active item's `<template slot="sheet">`, else the `<template>` inside `<fluidbox-sheet>`. Set the sheet element's `render` property to draw it yourself, and the filmstrip element's `render` to fill each thumbnail button. Both are [renderers](./media.md#custom) that get `{ item, index, target, signal }`.

```ts
const strip = document.querySelector("fluidbox-filmstrip")!;
strip.render = ({ index, target }) => {
  target.textContent = String(index + 1);
};
```

## Patterns

| Pattern                                            | With custom elements                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Gallery](./patterns/basic.md)                     | A `<fluidbox-item>` per photo. The default controls come with it.                                                                                 |
| [One trigger for an album](./patterns/overlay.md)  | `returns="..."` on the cover item, items without a trigger, `fluidbox-preview-change`, `data-fluidbox-dynamic-preview`, and a travelling overlay. |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` on an element inside the trigger.                                                                                          |
| [Custom content](./patterns/renderers.md)          | Any element in the content template, or `gallery.items` with `gallery.renderers`.                                                                 |
| [Programmatic control](./patterns/programmatic.md) | `gallery.open(2)`, `gallery.subscribe()`, and `beforeitemchange` with `preventDefault()`.                                                         |
| [Zoom](./patterns/zoom.md)                         | `zoom-step`, `zoom-max` and `zoom="off"`, or the `zoom` property.                                                                                 |
| [Filmstrip](./patterns/filmstrip.md)               | A `<fluidbox-filmstrip>` child, with a `render` of your own.                                                                                      |
| [Sheet](./patterns/sheet.md)                       | A `<fluidbox-sheet snap-points>` child, and a `data-fluidbox-sheet-stop` button in `<template slot="viewer">`.                                    |
| [Headless controls](./patterns/headless.md)        | `gallery.viewer`, or `<template slot="viewer">`.                                                                                                  |

## Notes

**Markup changes are picked up.** The gallery watches its children. Adding or removing items, or changing an attribute it reads (`item-id`, `returns`, `src`, `srcset`, `sizes`, `width`, `height`, `alt`, `title`, `poster`, `placeholder`, ...), re-reads the items on the next microtask. An open viewer stays on the same item id if it is still there.

**What rebuilds the viewer.** Setting `viewer`, `zoom` or `labels`, changing the `zoom`, `zoom-step` or `zoom-max` attributes, adding or removing a `<fluidbox-filmstrip>` or `<fluidbox-sheet>`, or changing the sheet's attributes or either element's `render`, destroys the viewer and builds a new one, closing it if it is open. `items`, `origins` and `renderers` change without a rebuild. A rebuild replaces `fluidbox`, so follow the state with `gallery.subscribe` rather than `gallery.fluidbox.subscribe`.

**Focus.** After a close whose trigger is gone, the gallery focuses itself (it gets `tabindex="-1"` unless it has one), so focus doesn't fall to the page.

**Removing the gallery** from the document destroys its viewer.
