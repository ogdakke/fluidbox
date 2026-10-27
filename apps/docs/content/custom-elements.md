---
title: Custom elements
section: Frameworks
order: 6
description: The fluidbox custom elements, with every element, attribute, property, method and event, how markup becomes gallery items, the viewer and slide templates and their parts, hotspots, the slideshow, a gallery that grows, and the add-on entries.
---

# Custom elements

`@ogdakke/fluidbox/elements` registers `<fluidbox-gallery>`, `<fluidbox-item>`, `<fluidbox-thumbnails>` and `<fluidbox-sheet>`. You write the gallery as markup. The gallery reads it into items and owns one fluidbox for them. The elements need no framework, and work inside any framework that renders plain HTML.

## Install

```bash
npm install @ogdakke/fluidbox
```

```ts
import "@ogdakke/fluidbox/elements";
import "@ogdakke/fluidbox/styles.css";
// Optional: the package's look. Without it the viewer is unstyled, its controls plain buttons with text.
import "@ogdakke/fluidbox/baseline.css";
```

`@ogdakke/fluidbox/elements` defines the elements when it loads, so import it only in the browser. On a server-rendered page, import it after hydration:

```ts
if (typeof customElements !== "undefined") await import("@ogdakke/fluidbox/elements");
```

## A gallery

<!-- pattern: basic -->

Each `<fluidbox-item>` has a `value`, its id, a `slot="trigger"` button and a `<template slot="content">` with the media. Without a `<template slot="viewer">`, the gallery adds Previous, Next and Close buttons, which show their labels as text.

## Elements

| Element                 | Interface                   | Role                                                                                   |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| `<fluidbox-gallery>`    | `FluidboxGalleryElement`    | Owns one fluidbox for its `<fluidbox-item>` children, or for the `items` you set.      |
| `<fluidbox-item>`       | `FluidboxItemElement`       | One item: its trigger and its content. A direct child of the gallery.                  |
| `<fluidbox-thumbnails>` | `FluidboxThumbnailsElement` | Hidden. As a direct child of the gallery, it turns the thumbnails on.                  |
| `<fluidbox-sheet>`      | `FluidboxSheetElement`      | Hidden. As a direct child of the gallery, it turns the sheet on and holds its content. |

`@ogdakke/fluidbox/elements` exports the four classes, `defineSlide` and `defineMarkup`. Importing it adds the tags to `HTMLElementTagNameMap`, so `querySelector("fluidbox-gallery")` is typed, and `fluidbox-preview-change` to `HTMLElementEventMap`.

The viewer and slide templates also take [parts](#parts), such as `<fluidbox-toolbar>` and `<fluidbox-hotspot>`. They are placeholders the gallery expands, not registered elements.

## `<fluidbox-item>`

| Attribute     | What it does                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`       | Required. The item's id, unique in the gallery. More ids after it, separated by spaces, are items whose close flight lands on this trigger, as on an album cover. |
| `type`        | Makes the item one of that type's slide, keeping what its content reads as. See [Slide templates](#slide-templates).                                              |
| `placeholder` | An image painted behind an image slide until it decodes, such as a tiny data URI.                                                                                 |
| `caption`     | The item's `caption`, which a caption part shows.                                                                                                                 |
| `aria-label`  | The title of other markup content (see below). Defaults to the content's own `aria-label`, then the trigger's name.                                               |

| Child                       | What it does                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[slot="trigger"]`          | The element that opens the item, usually a `<button>`. Its first `<img>` becomes the item's `thumbnail`. Leave it out for an item with no thumbnail of its own, such as the rest of an album. |
| `<template slot="content">` | Required. One root element: the media (see below). Inert until the viewer shows it.                                                                                                           |
| `<template slot="sheet">`   | This item's sheet content, when the gallery has a `<fluidbox-sheet>`.                                                                                                                         |

### What the content template becomes

The template's root element becomes an item, attribute for attribute:

| Root element of the template            | Item type | Read from it                                                                                                                                                                               |
| --------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<img>`, or `<picture>` with an `<img>` | `image`   | `src`, `srcset`, `sizes`, `alt`, and `width` and `height` (required); `data-zoom-src` and `data-zoom-srcset` as `zoom`. Each `<source>` of a `<picture>` becomes one of `sources`.         |
| `<video>`                               | `video`   | `src`, `width` and `height` (required), `poster`, `autoplay`, `loop`, `muted`, `playsinline`, `controls`, `preload`, `aria-label` or `title`, and each `<track>` child as one of `tracks`. |
| `<iframe src>`                          | `iframe`  | `src`, `width` and `height` (required), `title`, `allow`, `referrerpolicy` and `sandbox`.                                                                                                  |
| anything else                           | its own   | A slide of the item's own, which shows the markup. `width` and `height` on the root set its size; without them, the trigger image's size.                                                  |

An add-on entry reads its own markup first: see [Add-ons](#add-ons). The gallery reads the boolean attributes of a `<video>` as HTML does, so an attribute that is present is on. Write `controls` and `playsinline` on it, as you would on the page. See [Media types](./media.md) for what each type does in the viewer.

| Property  | Type                  | What it is                  |
| --------- | --------------------- | --------------------------- |
| `value`   | `string`              | The `value` attribute.      |
| `trigger` | `HTMLElement \| null` | The `slot="trigger"` child. |

| Event                     | `detail`                             | When                                                                                                                                                                            |
| ------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fluidbox-preview-change` | `{ id: string; item: FluidboxItem }` | Before a close flight lands on this trigger, with the item it lands on: its own or one of the other ids in `value`. Bubbles. Show that item on the trigger here, synchronously. |

## `<fluidbox-gallery>`

| Attribute             | What it does                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `value`               | The open item's id. Setting it opens, moves or closes the viewer; leave it off to let the triggers own the viewer. The viewer moving on its own leaves it, as `valuechange` reports. |
| `nozoom`              | Turns zoom off.                                                                                                                                                                      |
| `zoom-step`           | The scale of a click or double-tap zoom. Default `2`.                                                                                                                                |
| `zoom-max`            | The largest zoom scale. Default `4`.                                                                                                                                                 |
| `zoom-click`          | What a mouse click on the photo does: `single`, `double` or `off`. Default `single`.                                                                                                 |
| `zoom-tap`            | What a touch tap does: `double` or `off`. Default `double`.                                                                                                                          |
| `loop`                | Go round: past the last item comes the first, by swipe, key, button and thumbnails. A single item never loops.                                                                       |
| `preload`             | When the viewer's code loads: `intent` (the default), `press` or `eager`. See [Getting started](./getting-started.md).                                                               |
| `wheel`               | What a vertical wheel does on an unzoomed slide: `dismiss` (the default), `zoom`, `navigate` or `none`.                                                                              |
| `reach-end-threshold` | How near the end `reachend` fires. Default `2`. See [A gallery that grows](#a-gallery-that-grows).                                                                                   |

The properties are the [`createFluidbox` options](./javascript.md) the markup can't say, and the fluidbox's state and handles:

| Property            | Type                                    | What it is                                                                                                                         |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `items`             | `FluidboxItems \| null`                 | Items to use instead of the `<fluidbox-item>` children: an array or a lazy list (see [Items and origins](./items-and-origins.md)). |
| `slides`            | `Record<string, FluidboxSlideRenderer>` | Slides by item type, over the gallery's slide templates and the slides registered for the page. Read when a slide mounts.          |
| `value`             | `string \| null`                        | The `value` attribute.                                                                                                             |
| `viewer`            | `FluidboxViewerRenderer \| undefined`   | Your own viewer content. Wins over `<template slot="viewer">` and the default controls.                                            |
| `icons`             | `FluidboxOptions["icons"]`              | Your icons for the default controls, over any `<template data-fluidbox-icon>`.                                                     |
| `labels`            | `Partial<FluidboxLabels> \| undefined`  | Your strings for the viewer. See [Languages and direction](./languages.md).                                                        |
| `zoom`              | `FluidboxOptions["zoom"]`               | Zoom options, or `false`. Wins over `nozoom` and the zoom attributes.                                                              |
| `dismiss`           | `FluidboxOptions["dismiss"]`            | `{ drag, backdrop }`: turn off dragging to dismiss, or closing on a backdrop tap.                                                  |
| `wheel`             | `FluidboxOptions["wheel"]`              | The `wheel` attribute.                                                                                                             |
| `reachEndThreshold` | `number \| undefined`                   | The `reach-end-threshold` attribute.                                                                                               |
| `shareUrl`          | `FluidboxOptions["shareUrl"]`           | The link Share shares for an item. Without one, Share hides.                                                                       |
| `slideshow`         | `FluidboxSlideshowOptions \| undefined` | Advance on a timer. See [Slideshow](#slideshow).                                                                                   |
| `findTrigger`       | `FluidboxOptions["findTrigger"]`        | Finds the trigger of an item with no trigger in the gallery.                                                                       |
| `revealTrigger`     | `FluidboxOptions["revealTrigger"]`      | Brings an item's trigger into view.                                                                                                |
| `state`             | `FluidboxState`                         | The viewer's state, or a closed state before the gallery is ready.                                                                 |
| `sheet`             | `FluidboxSheet \| null`                 | The sheet, while a `<fluidbox-sheet>` turns it on.                                                                                 |
| `fluidbox`          | `Fluidbox \| null`                      | The fluidbox behind the gallery, or `null` before it is ready.                                                                     |

| Method                                                            | Returns             | What it does                                                                           |
| ----------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `open(target?, options?)`                                         | `Promise<boolean>`  | Opens the viewer on an index or id, or moves to it while open.                         |
| `close(options?)`                                                 | `Promise<boolean>`  | Closes the viewer.                                                                     |
| `next(options?)`                                                  | `Promise<boolean>`  | Next item.                                                                             |
| `previous(options?)`                                              | `Promise<boolean>`  | Previous item.                                                                         |
| `zoomTo(scale, options?)`, `zoomIn()`, `zoomOut()`, `zoomReset()` | `Promise<boolean>`  | Zoom the image on show. See [Zoom](./patterns/zoom.md).                                |
| `setFullscreen(on?)`                                              | `Promise<boolean>`  | Enter or leave full screen; without an argument, switch.                               |
| `download()`, `share()`                                           | `Promise<boolean>`  | Save the item on show's file, or share its link.                                       |
| `play()`, `pause()`                                               | `void`              | Start or stop the slideshow on the open viewer.                                        |
| `setItems(items)`                                                 | `Promise<boolean>`  | Replaces the items, as the `items` property does, and resolves once they apply.        |
| `preload(target)`                                                 | `() => void`        | Starts loading an item a press is likely to open. Call the result to let go.           |
| `load()`                                                          | `Promise<boolean>`  | Loads the viewer's code now.                                                           |
| `subscribe(listener)`                                             | `() => void`        | Calls `listener(state)` on every state change.                                         |
| `whenReady()`                                                     | `Promise<Fluidbox>` | Resolves once the gallery has read its items. Rejects if the gallery is not connected. |

The commands work as [the fluidbox's](./javascript.md) do, with an item, an index or an id as the target. Each waits until the gallery has read its items, and rejects if the gallery isn't connected.

### Events

The gallery fires the fluidbox's events: `beforevaluechange`, `valuechange`, `valuechangecomplete`, `sheetchange`, `zoomchange`, `mediaerror` and `reachend`, with the same fields (see [JavaScript](./javascript.md)). They don't bubble. Canceling `beforevaluechange` on the gallery cancels the open, move or close.

<!-- pattern: programmatic -->

The listeners are typed through the gallery's event map, `FluidboxGalleryEventMap`. `@ogdakke/fluidbox` exports the event classes.

## Markers

| Attribute                                                             | Put it on                                 | Effect                                                                                                                                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-fluidbox-origin`                                                | an element inside a trigger               | The flight starts and ends on this element instead of the trigger's image.                                                                                                                      |
| `data-fluidbox-trigger-overlay`                                       | an element inside a trigger               | An overlay on the card, such as a count. `copy` flies a still copy of it with the photo; `frame` moves it into the flying frame; without a value it stays on the card with `--fluidbox-closed`. |
| `data-fluidbox-value="id"`                                            | any element in a gallery with `items` set | Makes the element a trigger for that item, or for several ids separated by spaces, of which the first opens.                                                                                    |
| `data-fluidbox-close`, `data-fluidbox-previous`, `data-fluidbox-next` | a button in the viewer content            | Runs that command. Every control of [`FluidboxControlName`](./api.md) has its attribute, such as `data-fluidbox-zoom-in` and `data-fluidbox-slideshow`.                                         |
| `data-fluidbox-sheet-snap="N"`                                        | a button in the viewer                    | Moves the sheet to stop `N`.                                                                                                                                                                    |
| `data-fluidbox-text="field"`                                          | an element in a viewer or slide template  | Shows that field of the item as text, such as `alt` or `caption`.                                                                                                                               |

Each trigger also gets `data-fluidbox-trigger` and `aria-haspopup="dialog"`. Make the `slot="trigger"` element a `<button>` or an `<a href>`; any other element needs its own `role` and `tabindex`, and warns in development without them. The trigger's default styles use `:where()`, so your own classes win.

## Viewer content

The gallery fills the viewer's layer with the first of these that exists:

1. the `viewer` property, a renderer called with `{ target, fluidbox, signal }`, as the `viewer` option of [`createFluidbox`](./javascript.md);
2. a `<template slot="viewer">` that is a direct child of the gallery, cloned into the viewer, with its [parts](#parts) expanded;
3. the default Previous, Next and Close buttons.

<!-- pattern: headless -->

A control button of yours that is empty shows its label as text, marked `data-fluidbox-default`, as a default one does. To give the default buttons an icon of yours, add a `<template data-fluidbox-icon="close">` child to the gallery; its content goes into every default button of that control, and the label names it.

### Parts

These placeholders expand in a `<template slot="viewer">` and in [slide templates](#slide-templates):

| Part                                                               | Becomes                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `<fluidbox-toolbar>`                                               | A `role="group"` with Previous, Next and Close, or with the children you give it.                             |
| `<fluidbox-zoom-controls>`                                         | A group with Zoom in, Zoom out and Fit to screen, or your children.                                           |
| `<fluidbox-counter>`                                               | The counter, as "2 / 5".                                                                                      |
| `<fluidbox-caption>`                                               | The item's `caption`, or your children, and the dialog's description. Absent for an item without a caption.   |
| `<fluidbox-loading>`                                               | Its children, while the slide on show loads.                                                                  |
| `<fluidbox-error>`                                                 | Its children, while the slide on show has failed. A `data-fluidbox-retry` button in it loads the media again. |
| `<fluidbox-fullscreen>`, `<fluidbox-download>`, `<fluidbox-share>` | That control, with your children as its content, or its label as text.                                        |
| `<fluidbox-slideshow>`                                             | The slideshow control. See [Slideshow](#slideshow).                                                           |

A part keeps the attributes you write on it, such as `class`.

## Slide templates

A `<template data-fluidbox-slide="type">` in the gallery draws the slides of that item type, as the `slides` option does. Give an item `type="room"` to use the `room` template; its content keeps what it reads as, so an `<img>` stays the item's image.

- `<fluidbox-media>` is the media box. Its children go in the box, and its attributes on it; `zoom` or `zoom="false"` turns the box's zoom on or off.
- `<fluidbox-image>` draws the built-in image there: the item's own, or with `field="image"` the image item in that field.
- Everything else goes in the slide's layer, over the slide, which doesn't fly or zoom.

The gallery's `slides` property comes first, then its slide templates, then the slides registered with `defineSlide(type, slide)` for every gallery on the page.

### Hotspots

A `<fluidbox-hotspot x y>` inside `<fluidbox-media>` becomes a hotspot: a button on that point of the painted image, with your attributes and children. `x` and `y` are percentages, or pixels of the image as its `width` and `height` count them. `scale-with-zoom`, present or `="true"`, makes it grow with the zoom; `="false"` keeps its screen size, as leaving it off does.

```html
<fluidbox-gallery>
  <template data-fluidbox-slide="room">
    <fluidbox-media>
      <fluidbox-image></fluidbox-image>
      <fluidbox-hotspot x="50%" y="28%" class="hotspot-pin" aria-label="Framed print">
        <span aria-hidden="true">+</span>
      </fluidbox-hotspot>
      <fluidbox-hotspot x="360" y="950" class="hotspot-pin" aria-label="Books">
        <span aria-hidden="true">+</span>
      </fluidbox-hotspot>
    </fluidbox-media>
  </template>
  <fluidbox-item value="room" type="room">
    <button slot="trigger" type="button">
      <img src="/products/fjord-room-thumb.webp" alt="" width="320" height="320" />
    </button>
    <template slot="content">
      <img
        src="/products/fjord-room.webp"
        alt="A framed fjord print over a sideboard"
        width="1600"
        height="1600"
      />
    </template>
  </fluidbox-item>
</fluidbox-gallery>
```

Name each hotspot with text or `aria-label`. [Hotspots](./hotspots.md) covers the coordinates, the placement rules and the behaviour.

## Slideshow

A `<fluidbox-slideshow>` in the viewer template is the button that plays and pauses the slideshow. Without children it shows the `playSlideshow` or `pauseSlideshow` label as text; with children, such as an icon, the label names it. It has `data-active` while the slideshow plays. [Slideshow](./slideshow.md) covers the timer, its pauses and its holds.

```html
<fluidbox-gallery>
  <template slot="viewer">
    <fluidbox-toolbar></fluidbox-toolbar>
    <fluidbox-slideshow></fluidbox-slideshow>
  </template>
  <!-- items -->
</fluidbox-gallery>
```

Set the gallery's `slideshow` property to `{ interval, loop, autoplay }` to change the timing, loop past the last slide, or start as the viewer opens. Without it the control hides unless it plays, and `gallery.play()` still plays with the defaults. `gallery.pause()` stops it, and `gallery.state.playing` says whether it plays.

```ts
const gallery = document.querySelector("fluidbox-gallery")!;
gallery.slideshow = { interval: 4000, autoplay: true };
```

## A gallery that grows

The gallery fires `reachend` once the viewer settles within `reach-end-threshold` items of the end, once per item count, and never with `loop`. Append items there, as `<fluidbox-item>` children or through `setItems`; the open viewer stays on its item. This is the growing gallery of the elements fixture, which the browser tests run:

```ts
const gallery = document.querySelector("fluidbox-gallery")!;
gallery.reachEndThreshold = 1;
gallery.addEventListener("reachend", (event) => {
  console.log(`near the end: ${event.index + 1} of ${event.count}`);
  // Append the next page of <fluidbox-item> children here.
});
```

[Items and origins](./items-and-origins.md) explains the event and lazy lists that grow.

## Thumbnails and sheet

A `<fluidbox-thumbnails>` child turns the thumbnails on, and a `<fluidbox-sheet>` child the sheet. The gallery loads their code the first time it needs it. Each needs its stylesheet, `@ogdakke/fluidbox/thumbnails.css` or `@ogdakke/fluidbox/sheet.css`.

| `<fluidbox-sheet>` attribute | What it does                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `snap-points`                | The stops above rest, lowest first: `"40% 90%"`, pixels such as `"240"`, or `content`. |
| `dismiss-motion`             | `flight` or `scroll`. See [Stops](./thumbnails-and-sheet.md#stops).                    |

The sheet shows the active item's `<template slot="sheet">`, else the `<template>` inside `<fluidbox-sheet>`. Set the sheet element's `render` property to draw it yourself, and the thumbnails element's `render` to fill each thumbnail button. Both are renderers that get `{ item, index, target, signal }`.

<!-- pattern: thumbnails -->

## Add-ons

Three entries register the [product media](./product-media.md) add-ons for every gallery on the page: the slide of their items, and a reading of their markup in a content template.

| Entry                              | Reads                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ogdakke/fluidbox/elements/embed` | An `<iframe>` whose `src` is a YouTube or Vimeo video, as an embed that loads its player on Play.                                                    |
| `@ogdakke/fluidbox/elements/spin`  | `<img data-spin-frames="/mug/{index}.webp" data-spin-count="36" width height>`, with `data-spin-start`, `data-spin-digits` and `data-spin-autoplay`. |
| `@ogdakke/fluidbox/elements/model` | `<model-viewer src>`, with `poster`, `alt`, `ar`, `ar-modes`, `ios-src`, `width` and `height`; its other attributes stay on the viewer's model.      |

The model entry doesn't load `<model-viewer>`: load it with Google's `<script>`, and the slide waits for it to be defined. For a slide that loads it, set `gallery.slides = { model: createModelSlide({ load }) }`. A trigger can hold a live `<model-viewer>` too; see [Live 3D thumbnails](./live-3d-thumbnails.md).

<!-- pattern: media -->

`defineMarkup(selector, read)` registers a reading of your own: `read(content, context)` returns an item for a content root that matches `selector`, or null to leave it to the next reader. Readers run in the order they were registered, before the built-in reading of `<img>`, `<video>` and `<iframe>`.

## Patterns

| Pattern                                            | With custom elements                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Gallery](./patterns/basic.md)                     | A `<fluidbox-item>` per photo, and a `<fluidbox-toolbar>` in the viewer template.                  |
| [One trigger for an album](./patterns/overlay.md)  | All the album's ids in the cover's `value`, items without a trigger, and a `copy` overlay.         |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` on an element inside the trigger.                                           |
| [Custom content](./patterns/renderers.md)          | A `<template data-fluidbox-slide>`, and triggers marked `data-fluidbox-value`.                     |
| [Programmatic control](./patterns/programmatic.md) | `gallery.open(2)`, `gallery.subscribe()`, and `beforevaluechange` with `preventDefault()`.         |
| [Zoom](./patterns/zoom.md)                         | `zoom-step`, `zoom-max` and `nozoom`, or the `zoom` property; hover zoom on a product photo.       |
| [Thumbnails](./patterns/thumbnails.md)             | A `<fluidbox-thumbnails>` child, with a `render` of your own.                                      |
| [Sheet](./patterns/sheet.md)                       | A `<fluidbox-sheet>` child, and a `data-fluidbox-sheet-snap` button in `<template slot="viewer">`. |
| [Headless controls](./patterns/headless.md)        | Buttons of your own and `<fluidbox-counter>` in `<template slot="viewer">`.                        |
| [Right to left](./patterns/rtl.md)                 | A `dir="rtl"` ancestor, and the `labels` property.                                                 |
| [Photo in the address](./patterns/url.md)          | The `value` property, set from `?photo=` and from `valuechange`.                                   |
| [Product media](./product-media.md)                | The add-on entries, which read an `<iframe>`, spin frames and a `<model-viewer>`.                  |

## Notes

**Markup changes are picked up.** The gallery watches its children. Adding or removing items, or changing an item's `value`, `type`, `placeholder`, `caption`, `aria-label` or `slot`, re-reads the items on the next microtask. An open viewer stays on the same item id if it is still there. The content inside a trigger is yours. Swapping its picture, as an album cover does, changes nothing in the gallery.

**Options change live.** Setting `viewer`, `zoom`, `labels` or the other option properties, changing the gallery's attributes, adding or removing a `<fluidbox-thumbnails>`, `<fluidbox-sheet>` or `<template slot="viewer">`, and changing the sheet's attributes or either element's `render` update the viewer without closing it. New slides, from `slides` or a slide template, apply at once while closed, else as the viewer closes.

**Focus.** After a close whose trigger is gone, the gallery focuses itself, so focus doesn't fall to the page. For that it sets `tabindex="-1"` on itself, unless it already has one.

**Removing the gallery** from the document destroys its viewer.
