---
title: Custom elements
section: Frameworks
order: 6
description: The fluidbox custom elements, with every element, attribute, property, method and event, and how markup becomes gallery items.
---

# Custom elements

`@ogdakke/fluidbox/elements` registers `<fluidbox-gallery>`, `<fluidbox-item>`, `<fluidbox-filmstrip>` and `<fluidbox-sheet>`. You write the gallery as markup. The gallery reads it into items and owns one fluidbox for them. The elements need no framework, and work inside any framework that renders plain HTML.

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

| Element                | Class                      | Role                                                                                                                               |
| ---------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `<fluidbox-gallery>`   | `FluidboxGalleryElement`   | Owns one fluidbox for its `<fluidbox-item>` children, or for the `items` you set.                                                  |
| `<fluidbox-item>`      | `FluidboxItemElement`      | One item: its trigger and its content. A direct child of the gallery.                                                              |
| `<fluidbox-filmstrip>` | `FluidboxFilmstripElement` | Hidden. As a direct child of the gallery, it turns the filmstrip on.                                                               |
| `<fluidbox-sheet>`     | `FluidboxSheetElement`     | Hidden. As a direct child of the gallery, it turns the sheet on and holds its content.                                             |
| `<fluidbox-controls>`  | `zoom`                     | Inside `<template slot="viewer">`, stands for the default Previous, Next and Close buttons, and with `zoom` the zoom controls too. |

`@ogdakke/fluidbox/elements` exports the four classes. Importing it adds the tags to `HTMLElementTagNameMap`, so `querySelector("fluidbox-gallery")` is typed, and `fluidbox-preview-change` to `HTMLElementEventMap`.

## `<fluidbox-item>`

| Attribute     | What it does                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `item-id`     | Required, unique in the gallery. The item's id for commands, events and `returns`.                 |
| `returns`     | Space-separated ids of more items whose close flight lands on this trigger, as for an album cover. |
| `placeholder` | An image painted behind an image slide until it decodes, such as a tiny data URI.                  |
| `aria-label`  | The title of custom content (see below). Defaults to `item-id`.                                    |

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

The gallery reads the boolean attributes of a `<video>` as HTML does, so an attribute that is present is on. Write `controls` and `playsinline` on it, as you would on the page. See [Media types](./media.md) for what each type does in the viewer.

| Property  | Type                  | What it is                              |
| --------- | --------------------- | --------------------------------------- |
| `itemId`  | `string`              | The `item-id`. Throws when it is empty. |
| `returns` | `readonly string[]`   | The ids in `returns`.                   |
| `trigger` | `HTMLElement \| null` | The `slot="trigger"` child.             |

| Event                     | `detail`                             | When                                                                                                                                                             |
| ------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fluidbox-preview-change` | `{ id: string; item: FluidboxItem }` | Before a close flight lands on this trigger, with the item it lands on: its own or one in `returns`. Bubbles. Show that item on the trigger here, synchronously. |

## `<fluidbox-gallery>`

| Attribute   | What it does                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nozoom`    | Turns zoom off.                                                                                                                                                                 |
| `zoom-step` | The scale of a click or double-tap zoom. Default `2`.                                                                                                                           |
| `zoom-max`  | The largest zoom scale. Default `4`.                                                                                                                                            |
| `loop`      | Go round: past the last item comes the first, by swipe, key, button and filmstrip. A single item never loops.                                                                   |
| `loading`   | When the viewer's code loads: `hover` (the default), `press` or `eager`. The `loading` property reflects it. See [Loading the viewer](./getting-started.md#loading-the-viewer). |
| `open`      | Opens the viewer on `index` as it is added, and closes it as it is removed. Leave it off to let the triggers own the viewer.                                                    |
| `index`     | The item the viewer shows while `open` is set, as an index. Changing it moves the open viewer. An index out of range is ignored.                                                |

The properties are the [`createFluidbox` options](./javascript.md#createfluidboxoptions) the markup can't say, and the [fluidbox's](./javascript.md#the-fluidbox) state and handles:

| Property    | Type                                    | What it is                                                                                                                         |
| ----------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `items`     | `FluidboxItems \| null`                 | Items to use instead of the `<fluidbox-item>` children: an array or a lazy list (see [Items and origins](./items-and-origins.md)). |
| `renderers` | `Record<string, FluidboxRenderer>`      | Draw `custom` items of `items`, by the name in their `render`. Read when a slide mounts.                                           |
| `viewer`    | `FluidboxViewerRenderer \| undefined`   | Your own viewer content. Wins over `<template slot="viewer">` and the default controls.                                            |
| `origins`   | `FluidboxOriginAdapter \| undefined`    | Origins for items with no trigger in the gallery, and `revealOrigin` to scroll one into view.                                      |
| `zoom`      | `false \| { step?, max? } \| undefined` | Zoom options, or `false`. Wins over `nozoom` and the zoom attributes.                                                              |
| `labels`    | `Partial<FluidboxLabels> \| undefined`  | Your strings for the viewer. See [Labels](./api.md#labels).                                                                        |
| `state`     | `FluidboxState`                         | The viewer's state, or a closed state before the gallery is ready.                                                                 |
| `sheet`     | `FluidboxSheet \| null`                 | The sheet, while a `<fluidbox-sheet>` turns it on.                                                                                 |
| `fluidbox`  | `Fluidbox \| null`                      | The fluidbox behind the gallery, or `null` before it is ready.                                                                     |

| Method                                                            | Returns             | What it does                                                                           |
| ----------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `open(target?, options?)`                                         | `Promise<boolean>`  | Opens the viewer on an index or id, or moves to it while open.                         |
| `close(options?)`                                                 | `Promise<boolean>`  | Closes the viewer.                                                                     |
| `next(options?)`                                                  | `Promise<boolean>`  | Next item.                                                                             |
| `previous(options?)`                                              | `Promise<boolean>`  | Previous item.                                                                         |
| `zoomTo(scale, options?)`, `zoomIn()`, `zoomOut()`, `resetZoom()` | `Promise<boolean>`  | Zoom the image on show. See [Zoom](./patterns/zoom.md).                                |
| `setItems(items)`                                                 | `Promise<boolean>`  | Replaces the items, as the `items` property does, and resolves once they apply.        |
| `preload(target)`                                                 | `() => void`        | Starts loading an item a press is likely to open. Call the result to let go.           |
| `load()`                                                          | `Promise<boolean>`  | Loads the viewer's code now, once the gallery has read its items.                      |
| `subscribe(listener)`                                             | `() => void`        | Calls `listener(state)` on every state change.                                         |
| `whenReady()`                                                     | `Promise<Fluidbox>` | Resolves once the gallery has read its items. Rejects if the gallery is not connected. |

The commands work as [the fluidbox's](./javascript.md#commands) do, with an item, an index or an id as the target. Each waits until the gallery has read its items, and rejects if the gallery isn't connected.

### Events

The gallery fires the fluidbox's events: `beforetoggle`, `toggle`, `beforeitemchange`, `itemchange`, `settle`, `sheetchange` and `zoomchange`, with the same fields (see [Events](./javascript.md#events)). They don't bubble, like a popover's. Canceling `beforetoggle` or `beforeitemchange` on the gallery cancels the command.

```ts
const gallery = document.querySelector("fluidbox-gallery")!;
gallery.addEventListener("itemchange", (event) => console.log("now showing", event.id));
gallery.subscribe((state) => console.log(state.status, state.index));
await gallery.open("fjord");
```

The listeners are typed through the gallery's event map. `@ogdakke/fluidbox` exports the event classes, `FluidboxItemChangeEvent`, `FluidboxSheetEvent` and `FluidboxToggleEvent`.

## Markers

| Attribute                                                             | Put it on                                 | Effect                                                                                                                            |
| --------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `data-fluidbox-origin`                                                | an element inside a trigger               | The flight starts and ends on this element instead of the trigger's image.                                                        |
| `data-fluidbox-thumbnail-overlay`                                     | an element inside a trigger               | A thumbnail overlay, one per trigger. It stays on the page and gets `--fluidbox-closed`. `="travel"` makes it fly with the photo. |
| `data-fluidbox-frame-layer`                                           | a travelling overlay, or an element in it | Moves into the flying frame for the flight and scales with it, as a scrim does.                                                   |
| `data-fluidbox-item-id="id"`                                          | any element in a gallery with `items` set | Makes the element a trigger for that item.                                                                                        |
| `data-fluidbox-close`, `data-fluidbox-previous`, `data-fluidbox-next` | a button in the viewer content            | Runs that command, with the default control styling. Previous and Next are disabled at the ends, Close while closed.              |
| `data-fluidbox-sheet-stop="N"`                                        | a button in the viewer                    | Moves the sheet to stop `N`.                                                                                                      |

Each trigger also gets `data-fluidbox-trigger`, `aria-haspopup="dialog"` and `aria-expanded`. The trigger's default styles use `:where()`, so your own classes win.

## Viewer content

The gallery fills the viewer's layer with the first of these that exists:

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

A `<fluidbox-filmstrip>` child turns the filmstrip on, and a `<fluidbox-sheet>` child the sheet. The gallery loads their add-on code itself, so you don't import `@ogdakke/fluidbox/filmstrip` or `/sheet`. Each still needs its stylesheet, `@ogdakke/fluidbox/filmstrip.css` or `@ogdakke/fluidbox/sheet.css`.

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

| Pattern                                            | With custom elements                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Gallery](./patterns/basic.md)                     | A `<fluidbox-item>` per photo. The default controls come with it.                                                |
| [One trigger for an album](./patterns/overlay.md)  | `returns="..."` on the cover item, items without a trigger, `fluidbox-preview-change`, and a travelling overlay. |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` on an element inside the trigger.                                                         |
| [Custom content](./patterns/renderers.md)          | Any element in the content template, or `gallery.items` with `gallery.renderers`.                                |
| [Programmatic control](./patterns/programmatic.md) | `gallery.open(2)`, `gallery.subscribe()`, and `beforeitemchange` with `preventDefault()`.                        |
| [Zoom](./patterns/zoom.md)                         | `zoom-step`, `zoom-max` and `nozoom`, or the `zoom` property.                                                    |
| [Filmstrip](./patterns/filmstrip.md)               | A `<fluidbox-filmstrip>` child, with a `render` of your own.                                                     |
| [Sheet](./patterns/sheet.md)                       | A `<fluidbox-sheet snap-points>` child, and a `data-fluidbox-sheet-stop` button in `<template slot="viewer">`.   |
| [Headless controls](./patterns/headless.md)        | `gallery.viewer`, or `<template slot="viewer">`.                                                                 |
| [Right to left](./patterns/rtl.md)                 | A `dir="rtl"` ancestor, and the `labels` property.                                                               |
| [Photo in the address](./patterns/url.md)          | The `open` and `index` attributes, set from `?photo=` and from `toggle` and `itemchange`.                        |

## Notes

**Markup changes are picked up.** The gallery watches its children. Adding or removing items, or changing an item's `item-id`, `returns`, `placeholder`, `aria-label` or `slot`, re-reads the items on the next microtask. An open viewer stays on the same item id if it is still there. The content inside a trigger is yours. Swapping its picture, as an album cover does, changes nothing in the gallery. The gallery reads the trigger's thumbnail when it reads the item, and reads a `<template slot="content">` when it re-reads the items.

**Options change live.** Setting `viewer`, `zoom` or `labels`, changing `nozoom`, `zoom-step`, `zoom-max` or `loading`, adding or removing a `<fluidbox-filmstrip>` or `<fluidbox-sheet>`, and changing the sheet's attributes or either element's `render` update the viewer through [`update`](./javascript.md#update), without closing it. The gallery keeps one fluidbox for as long as it is connected.

**Focus.** After a close whose trigger is gone, the gallery focuses itself, so focus doesn't fall to the page. For that it sets `tabindex="-1"` on itself, unless it already has one.

**Removing the gallery** from the document destroys its viewer.
