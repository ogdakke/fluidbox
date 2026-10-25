---
title: Solid
section: Frameworks
order: 4
description: The Solid binding for fluidbox, with every Fluidbox part, hook and prop, and the Solid-specific behaviour.
---

# Solid

`@ogdakke/fluidbox/solid` builds a gallery from parts: `Fluidbox.Root` owns one viewer for its items, `Fluidbox.Trigger` opens it, and `Fluidbox.Viewer` renders your own controls into it. It needs `solid-js` 1.8 or later.

## Install

```bash
npm install @ogdakke/fluidbox
```

```tsx
import { Fluidbox, useFluidbox, useFluidboxSheet } from "@ogdakke/fluidbox/solid";
import "@ogdakke/fluidbox/styles.css";
```

Import `@ogdakke/fluidbox/styles.css` once in your app. The thumbnails and the sheet are parts of the binding. Rendering `Fluidbox.Thumbnails` or `Fluidbox.Sheet` turns it on. They also need their stylesheets, `@ogdakke/fluidbox/thumbnails.css` and `@ogdakke/fluidbox/sheet.css`.

## A gallery

```tsx
import { For } from "solid-js";
import type { FluidboxImageItem } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import "@ogdakke/fluidbox/styles.css";

const photos: FluidboxImageItem[] = [
  {
    id: "dune",
    type: "image",
    src: "/photos/dune.jpg",
    alt: "Dune at dusk",
    width: 1800,
    height: 1200,
    thumbnail: { src: "/photos/dune-400.jpg", width: 400, height: 267 },
  },
  {
    id: "fjord",
    type: "image",
    src: "/photos/fjord.jpg",
    alt: "Fjord",
    width: 1200,
    height: 1600,
    thumbnail: { src: "/photos/fjord-400.jpg", width: 400, height: 533 },
  },
];

export function Photos() {
  return (
    <Fluidbox.Root items={photos}>
      <For each={photos}>
        {(photo) => (
          <Fluidbox.Trigger value={photo.id}>
            <img src={photo.thumbnail!.src} alt={photo.alt} />
          </Fluidbox.Trigger>
        )}
      </For>
    </Fluidbox.Root>
  );
}
```

Without a `Fluidbox.Viewer`, the viewer has the default Previous, Next and Close buttons. With one, it keeps only Close, until your content has a Close of its own. The same gallery, live, in every framework:

<!-- pattern: basic -->

## Parts

All parts are properties of the `Fluidbox` object.

```tsx
<Fluidbox.Root items value onValueChange>
  <Fluidbox.Trigger value>
    <img />
    <Fluidbox.Overlay flight="live">+3</Fluidbox.Overlay>
  </Fluidbox.Trigger>

  <Fluidbox.Slides note={({ item }) => <Fluidbox.Media>…</Fluidbox.Media>} />

  <Fluidbox.Viewer>
    <Fluidbox.Toolbar>
      <Fluidbox.Counter />
      <Fluidbox.ZoomControls />
      <Fluidbox.Close />
    </Fluidbox.Toolbar>
    <Fluidbox.Previous />
    <Fluidbox.Next />
    <Fluidbox.Caption />
    <Fluidbox.Thumbnails />
  </Fluidbox.Viewer>

  <Fluidbox.Sheet snapPoints={["40%", "90%"]}>{({ item }) => …}</Fluidbox.Sheet>
</Fluidbox.Root>
```

| Part                                                   | Renders                               | Role                                                                                        |
| ------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Fluidbox.Root`                                        | its children                          | Owns one viewer for its items. Every other part must be inside it.                          |
| `Fluidbox.Trigger`                                     | a `<button>`, or the `as` element     | Opens an item. Registers itself as the item's origin.                                       |
| `Fluidbox.Overlay`                                     | a `<span>`                            | A badge, caption or scrim on a trigger that fades or flies with the photo.                  |
| `Fluidbox.Slides`                                      | nothing                               | The content of each item type's slide.                                                      |
| `Fluidbox.Media`                                       | into the slide's box                  | The box that flies and zooms: its children, or what a plain-JS slide draws.                 |
| `Fluidbox.Image`, `Fluidbox.Video`, `Fluidbox.Iframe`  | the built-in media, in the box        | The viewer's own image, video and iframe, with their loading, zoom and error handling.      |
| `Fluidbox.Viewer`                                      | its children, in the viewer's layer   | Your controls and captions.                                                                 |
| `Fluidbox.Toolbar`, `Fluidbox.ZoomControls`            | a `<div role="group">`                | Groups of controls. Empty, they hold Previous, Next and Close, or the three zoom controls.  |
| `Fluidbox.Previous`, `Next`, `Close`                   | a `<button>`                          | Run the command, and disable themselves when they can't.                                    |
| `Fluidbox.ZoomIn`, `ZoomOut`, `ZoomReset`              | a `<button>`                          | Zoom the image on show. See [Zoom](./patterns/zoom.md#zoom-controls).                       |
| `Fluidbox.Fullscreen`, `Share`                         | a `<button>`                          | Full screen, and the share sheet or the clipboard. Hidden where they can't work.            |
| `Fluidbox.Download`                                    | an `<a download>`                     | Saves the item's file. Hidden when the item has none.                                       |
| `Fluidbox.Counter`, `Fluidbox.Caption`                 | a `<span>`, a `<div>`                 | Where the viewer is, and the item's caption.                                                |
| `Fluidbox.Loading`, `Fluidbox.Error`, `Fluidbox.Retry` | a `<div>` with its children; a button | Your loading and error states for the item on show.                                         |
| `Fluidbox.Thumbnails`                                  | its children, in each thumbnail       | Turns the thumbnails on. A child function draws your own thumbnails.                        |
| `Fluidbox.Sheet`, `Fluidbox.SheetSnap`                 | its children, in the sheet; a button  | Turns the sheet on and renders its content for the item on show; moves the sheet to a snap. |

### `Fluidbox.Root`

| Prop                    | Type                                                          | Default                                               | Purpose                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`                 | `readonly TItem[] \| FluidboxItemList<TItem>`                 |                                                       | The gallery's items, or a list read on demand (see [Items and origins](./items-and-origins.md)). Tracked.                                                   |
| `value`                 | `string \| null`                                              |                                                       | The open item's id, or `null`, when your signal owns it. A change opens, moves or closes the viewer to match.                                               |
| `defaultValue`          | `string \| null`                                              | `null`                                                | The item to open with, when the viewer owns its value. Read once.                                                                                           |
| `onValueChange`         | `(value, details: FluidboxValueChangeDetails<TItem>) => void` |                                                       | Before every open, move and close, with the value it goes to. `details.cancel()` stops it.                                                                  |
| `onValueChangeComplete` | `(value, details: FluidboxValueChangeDetails<TItem>) => void` |                                                       | Once the motion of a value change settled.                                                                                                                  |
| `labels`                | `Partial<FluidboxLabels>`                                     | English                                               | Every string the viewer shows or announces.                                                                                                                 |
| `zoom`                  | `false \| { step?, max?, click?, tap? }`                      | `{ step: 2, max: 4, click: "single", tap: "double" }` | Zoom steps, what a click (`"single"`, `"double"`, `false`) and a tap (`"double"`, `false`) on the photo do, or `false` to turn zoom off. Compared by value. |
| `loop`                  | `boolean`                                                     | `false`                                               | Go round: past the last item comes the first, by swipe, key, button and thumbnails. A single item never loops.                                              |
| `dismiss`               | `{ drag?: boolean; backdrop?: boolean }`                      | both on                                               | Which gestures close the viewer. Escape and Close always do.                                                                                                |
| `wheel`                 | `"dismiss" \| "zoom" \| "navigate" \| "none"`                 | `"dismiss"`                                           | What a vertical wheel does on an unzoomed slide.                                                                                                            |
| `href`                  | `(value: string \| null) => string \| undefined`              |                                                       | Where the server-rendered viewer's controls lead before JavaScript runs.                                                                                    |
| `shareUrl`              | `(item) => string \| undefined`                               | `href` of the id                                      | The link Share shares. Without either, Share hides.                                                                                                         |
| `findTrigger`           | `(item, index) => Element \| null`                            |                                                       | Finds the trigger of an item without a mounted one, as in a virtualized grid. See [Finding triggers](./items-and-origins.md#the-origin-adapter).            |
| `revealTrigger`         | `(item, index, { signal, phase }) => void \| Promise<void>`   |                                                       | Brings an item's trigger into view before the viewer flies back to it.                                                                                      |
| `preload`               | `"intent" \| "press" \| "eager"`                              | `"intent"`                                            | When the viewer's code loads. See [Loading the viewer](./getting-started.md#loading-the-viewer).                                                            |
| `onZoomChange`          | `(event: FluidboxZoomEvent) => void`                          |                                                       | When the image on show comes to rest at another zoom. `scale` and `reason`.                                                                                 |
| `onMediaError`          | `(event: FluidboxMediaErrorEvent<TItem>) => void`             |                                                       | When a slide's media fails to load. `kind` and `cause`.                                                                                                     |
| `children`              | `JSX.Element`                                                 |                                                       | Your page content and the other parts.                                                                                                                      |

`value` is a request, not a lock. When the viewer changes on its own, by a swipe or Escape, `onValueChange` reports it; leave `value` alone and the viewer still changes. To refuse a change, call `details.cancel()`.

`TItem` flows from `items` to the slides and the events. They get your own item objects back, with any fields you added.

### `Fluidbox.Trigger`

| Prop       | Type                                                                        | Default    | Purpose                                                                                                               |
| ---------- | --------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `value`    | `FluidboxTarget<TItem> \| readonly FluidboxTarget<TItem>[]`                 |            | Required. The item to open: the item, its id or its index. A list opens its first, and every one closes back onto it. |
| `as`       | `ValidComponent`                                                            | `"button"` | The element or component to render instead of a button, such as `"a"`.                                                |
| `ref`      | `HTMLElement \| (element: HTMLElement) => void`                             |            | The rendered element.                                                                                                 |
| `children` | `JSX.Element \| (preview: Accessor<FluidboxTriggerPreview>) => JSX.Element` |            | The trigger's content, or a function of the preview that follows the viewer.                                          |
| ...        | attributes and event handlers                                               |            | Passed to the element. A button gets `type="button"` unless you set `type`.                                           |

An item's id is its `id`, else its `src` (`src#2` and on for a repeated `src`). The preview accessor returns a `FluidboxTriggerPreview`: `item: TItem | null`, `index: number | null` and `status`. `item` is the item the trigger shows. While the viewer is open, that is the item the viewer is on. After it closes, it is the last one the trigger showed, and the trigger opens on that item again. It is `null` when the trigger's items have left the list.

```tsx
<Fluidbox.Trigger value={album}>
  {(preview) => <img src={preview().item?.src} alt={preview().item?.alt ?? ""} />}
</Fluidbox.Trigger>
```

The trigger adds `data-fluidbox-trigger` and `aria-haspopup="dialog"` to its element. It starts loading the item on pointer down, so the click opens without waiting. [A link as the trigger](./getting-started.md#a-link-as-the-trigger) covers a trigger that is a link.

### `Fluidbox.Overlay`

| Prop     | Type                                    | Default  | Purpose                              |
| -------- | --------------------------------------- | -------- | ------------------------------------ |
| `flight` | `"none" \| "copy" \| "live" \| "frame"` | `"none"` | How it goes with the photo's flight. |
| ...      | span attributes                         |          | Including `ref`.                     |

`"none"` stays on the card, `"copy"` flies a still copy with the photo, `"live"` renders its children live in the flying frame, under the same context, and `"frame"` moves the element itself into the frame, scaling with it, as a scrim does. It gets `--fluidbox-closed` and `data-fluidbox-phase` as the viewer opens and closes, for the enclosing `Trigger`'s items. Put it inside a `Trigger`. Outside one, it throws. Several can sit on one trigger:

```tsx
<Fluidbox.Overlay flight="live" class="badge">
  <Fluidbox.Overlay flight="frame" class="scrim" />+{album.length - 1}
</Fluidbox.Overlay>
```

### `Fluidbox.Slides` and `Fluidbox.Media`

`Fluidbox.Slides` takes one prop per item type, your own or the built-in `image`, `video` and `iframe`, and `default` for any other type. Each is a function of `{ item, index }` that returns the slide's content; `item` has that type. It renders nothing: the viewer asks for a slide's content as the slide mounts, and the binding renders it into the slide's layer under `Root`'s owner. A Root takes one `Slides`.

`Fluidbox.Media` is the slide's box, the element that flies, follows a drag to dismiss and zooms. Its children go into the box, which the viewer sizes from the item's `width` and `height`, so fill it. Its attributes go onto the box: `class` is added to the box's own classes, and `style` takes an object or a string. `render` draws into it with a plain-JS slide renderer, as the add-on parts do. `zoom` lets it zoom: on by default with an `Image` in it, off otherwise. Anything in the slide outside `Media` sits in the slide's layer, over the slide, and doesn't fly or zoom.

```tsx
<Fluidbox.Slides
  product={({ item }) => (
    <>
      <Fluidbox.Media>
        <Fluidbox.Image item={item.image} />
      </Fluidbox.Media>
      <p class="price">€{item.price}</p>
    </>
  )}
/>
```

`Fluidbox.Image`, `Fluidbox.Video` and `Fluidbox.Iframe` draw the viewer's own media into the box, for the slide's item or the `item` you give. They keep the built-in media's loading, placeholders, sharper zoom images, error and Retry. Outside a `Media` they draw into the box all the same. `Video` takes `attach`, to load the media yourself, as hls.js does. Pass a stable function: a new one loads the video again.

`useFluidboxSlide()`, in a component inside a slide, returns its `item`, `index`, `active`, `opening`, `signal`, `onActiveChange`, `origin`, `returnPlayback`, `waitUntil`, `fail` and `onZoom`. Its fields are getters, like Solid props: don't destructure them. `active` and `index` are reactive, so read them in JSX or an effect; `index` also follows new items, which keep a slide whose item moved. An open waits for the slide's images and videos by itself; `waitUntil(promise)` makes it wait for what it can't see, such as a canvas's first frame. Call it in the component's body or in `onMount`. See [Slides that play and pause](./product-media.md#slides-that-play-and-pause).

A slide's content renders in a `Suspense` boundary of the slide's own, with no fallback. Content that suspends, as a `lazy` component or a resource read in JSX does, holds the open until it resolves, for at most three seconds; the page around the viewer stays as it is. The open goes ahead once the slide's content has mounted.

A player of your own continues the trigger's video through `origin` and `returnPlayback`, as in [A player of your own continues the trigger's video](./product-media.md#a-player-of-your-own-continues-the-triggers-video). A slide kept from an earlier open reads the trigger of the open that shows it. Register the player in `onMount`, and pass what `returnPlayback` returns to `onCleanup`:

```tsx
function ReelSlide() {
  const slide = useFluidboxSlide<ReelItem>();
  let player!: HTMLVideoElement;
  onMount(() => onCleanup(slide.returnPlayback(player)));
  const from = slide.origin?.video;
  return (
    <Fluidbox.Media>
      <video
        ref={player}
        src={slide.item.src}
        prop:currentTime={from?.currentTime ?? 0}
        autoplay={from ? !from.paused : false}
        muted={from?.muted}
        playsinline
      />
    </Fluidbox.Media>
  );
}
```

### `Fluidbox.Viewer`, `Fluidbox.Toolbar` and the controls

`Fluidbox.Viewer` takes only `children`, and renders them into the viewer's layer. It renders nothing until the viewer exists.

`Fluidbox.Toolbar` is a `<div role="group" data-fluidbox-toolbar>`; with no children it holds Previous, Next and Close. The stylesheet gives it `display: contents`, so the controls keep their places until you style it. `Fluidbox.ZoomControls` is the zoom group, named like the zoomed image; with no children it holds Zoom in, Zoom out and Fit.

`Previous`, `Next`, `Close`, `ZoomIn`, `ZoomOut`, `ZoomReset`, `Fullscreen`, `Share`, `Download`, `Retry` and `SheetSnap` take their element's attributes and `ref`. With no children a control shows its label from `labels` as text, marked `data-fluidbox-default`. With children, the label becomes its `aria-label`. `label` overrides the label for this control; `label={false}` names it by its children, for children with visible text. `disabled` follows the viewer's state, and a control that can't work on this device or item gets `hidden`. Your `onClick` runs first, and `event.preventDefault()` in it stops the command.

```tsx
<Fluidbox.Close />                         // "Close", as text
<Fluidbox.Close><XIcon /></Fluidbox.Close> // named "Close" by aria-label
<Fluidbox.Close label={false}>Done</Fluidbox.Close>
```

`Fluidbox.Counter` shows `labels.counter`, as `1 / 4`, or `children({ index, count })`. It is hidden from screen readers, which hear the slide's name. `Fluidbox.Caption` shows the item's `caption`, or `children({ item, index })`, and describes the dialog. In a slide it is that slide's item; elsewhere the item on show.

### `Fluidbox.Loading`, `Fluidbox.Error` and `Fluidbox.Retry`

`Loading` renders its children while the item on show is loading, and `Error` while it failed, in place of the default error message. In a slide they follow that slide. `Error`'s children can be a function of `{ item, error }`, where `error` is the cause of the last `mediaerror`. `Retry` loads the failed media again. The viewer still announces the error, so your error content needn't be a live region.

```tsx
<Fluidbox.Error>
  {({ item }) => (
    <p>
      {itemLabel(item)} didn't load. <Fluidbox.Retry />
    </p>
  )}
</Fluidbox.Error>
```

### `Fluidbox.Thumbnails`

| Prop       | Type                                                    | Purpose                                                                                                                                    |
| ---------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `children` | `(ctx: FluidboxThumbnailContext<TItem>) => JSX.Element` | Renders one thumbnail, `{ item, index, active }`, into its button. `active` is a reactive getter. Leave it out for the default thumbnails. |

The strip marks the selected button `data-active` and `data-fluidbox-selected`.

### `Fluidbox.Sheet` and `Fluidbox.SheetSnap`

| Prop            | Type                                               | Default              | Purpose                                                                                     |
| --------------- | -------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `snapPoints`    | `readonly FluidboxSheetSnapPoint[]`                | `["60%", "content"]` | The snaps above the resting one, lowest first: pixels, a percentage, or `"content"`.        |
| `dismissMotion` | `"flight" \| "scroll"`                             | `"flight"`           | How a swipe down on the photo closes the viewer with the sheet down.                        |
| `onSnapChange`  | `(event: FluidboxSheetEvent) => void`              |                      | When the sheet comes to rest at another snap. `snap` and `reason`.                          |
| `children`      | `(ctx: FluidboxItemContext<TItem>) => JSX.Element` |                      | The sheet's content for the item on show, `{ item, index }`.                                |
| ...             | `class`, `style`, `id`, `aria-*`, `data-*`, ...    |                      | Set on the viewer's `<section data-fluidbox-sheet>`, which is the sheet. No event handlers. |

The viewer makes the sheet, a `<section data-fluidbox-sheet>` named by `labels.sheet`. The child function draws into it for the item on show, and draws again when the item changes.

```tsx
<Fluidbox.Sheet snapPoints={["40%", "90%"]} class="details">
  {({ item }) => <h3>{itemLabel(item)}</h3>}
</Fluidbox.Sheet>
```

`Fluidbox.SheetSnap` takes `to` and button attributes, and moves the sheet to that snap, or back to 0 when the sheet is already there. It gets `aria-expanded` from the sheet. Its children name it; with none it shows `labels.sheet`.

### The add-on parts

`@ogdakke/fluidbox/solid/embed`, `/solid/model` and `/solid/spin` export `Embed`, `Model` and `Spin`, for slides of those types. Each is a `Media` that draws the add-on's slide, and takes its options as props. See [Product media](./product-media.md).

```tsx
<Fluidbox.Slides
  embed={() => <Embed />}
  spin={() => <Spin />}
  model={() => <Model load={loadModelViewer} />}
/>
```

## Hooks

Call them in a component inside `Fluidbox.Root`, including the content of `Slides`, `Viewer`, `Sheet` and `Thumbnails`.

| Hook                    | Returns              | Purpose                                                                                                                                                                                                                                                                                    |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useFluidbox()`         | `FluidboxApi<TItem>` | The state (`status`, `value`, `index`, `item`, `count`, `hasPrevious`, `hasNext`, `zoom`, `fullscreen`) as reactive getters, with `open`, `close`, `next`, `previous`, `zoomTo`, `zoomIn`, `zoomOut`, `zoomReset`, `setFullscreen`, `download`, `share`, `setItems`, `preload` and `load`. |
| `useFluidbox(selector)` | `Accessor<T>`        | A memo of what the selector picks from that same object.                                                                                                                                                                                                                                   |
| `useFluidboxSheet()`    | `FluidboxSheetApi`   | `{ snap, setSnap }`: `snap()` is the snap the sheet rests at, following `sheetchange`, and `setSnap(snap, { animate? })` moves it. `snap()` is 0 without a sheet.                                                                                                                          |
| `useFluidboxSlide()`    | `FluidboxSlideApi`   | Inside a slide: its item and activity, and its hooks into the open. It throws elsewhere.                                                                                                                                                                                                   |

The state fields of `useFluidbox()` are reactive getters, like Solid props. Read them in JSX or an effect, and don't destructure them. Commands resolve `true` once they happen, and `false` when they were prevented or superseded. A command you call before the viewer exists, such as a deep link on mount, waits for the viewer and then runs. `open` takes the item, its id or its index. Without one, it opens the current item, or the first if there is none. `preload(target)` starts loading an item a press is likely to open, and returns a function that lets go. `load()` loads the viewer's code now.

```tsx
import { useFluidbox } from "@ogdakke/fluidbox/solid";

function Counter() {
  const fluidbox = useFluidbox();
  return (
    <button type="button" onClick={() => fluidbox.open(0)}>
      {fluidbox.index === null
        ? `Open ${fluidbox.count} photos`
        : `${fluidbox.index + 1} / ${fluidbox.count}`}
    </button>
  );
}
```

For a typed item, write `useFluidbox<Photo>()`, or annotate the selector: `useFluidbox((fluidbox: FluidboxApi<Photo>) => fluidbox.item)`. See the [API reference](./api.md) for the state, the events and the items.

### Types

The entry exports the props of every part (`FluidboxRootProps`, `FluidboxTriggerProps`, `FluidboxOverlayProps`, `FluidboxSlidesProps`, `FluidboxMediaProps`, `FluidboxImageProps`, `FluidboxVideoProps`, `FluidboxIframeProps`, `FluidboxViewerProps`, `FluidboxGroupProps`, `FluidboxControlProps`, `FluidboxControlLabel`, `FluidboxDownloadProps`, `FluidboxCounterProps`, `FluidboxCaptionProps`, `FluidboxLoadingProps`, `FluidboxErrorProps`, `FluidboxThumbnailsProps`, `FluidboxSheetProps`, `FluidboxSheetSnapProps`), `FluidboxSlideContent`, `FluidboxItemContext`, `FluidboxThumbnailContext`, `FluidboxTriggerPreview`, `FluidboxCommands`, `FluidboxApi`, `FluidboxSheetApi`, `FluidboxSlideApi`, `UseFluidbox` and `FluidboxSolidParts` (the type of `Fluidbox`). It also re-exports the item, state and event types from `@ogdakke/fluidbox`.

## Patterns

| Pattern                                            | In Solid                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [Gallery](./patterns/basic.md)                     | `Root items`, a `Trigger` per item in `<For>`, `Previous`, `Next` and `Close` in `Viewer`. |
| [One trigger for an album](./patterns/overlay.md)  | `Trigger value={album}` with `{(preview) => ...}`, `Overlay flight="live"`.                |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` on an element inside the `Trigger`; `as` to render another element. |
| [Custom content](./patterns/renderers.md)          | `Slides note={() => <Fluidbox.Media><Note /></Fluidbox.Media>}`.                           |
| [Programmatic control](./patterns/programmatic.md) | `useFluidbox()`, `onValueChange` with `details.cancel()`, `onValueChangeComplete`.         |
| [Zoom](./patterns/zoom.md)                         | `Root zoom={{ step, max }}` or `zoom={false}`, `Toolbar` and `ZoomControls`.               |
| [Thumbnails](./patterns/thumbnails.md)             | `<Fluidbox.Thumbnails />`, or with a child function for your own thumbnails.               |
| [Sheet](./patterns/sheet.md)                       | `Fluidbox.Sheet snapPoints` with `{({ item }) => ...}`, `useFluidboxSheet()`, `SheetSnap`. |
| [Headless controls](./patterns/headless.md)        | Your own buttons in `Viewer`, using `useFluidbox()`.                                       |
| [Right to left](./patterns/rtl.md)                 | Root `labels`, inside a `dir="rtl"` element.                                               |
| [Photo in the address](./patterns/url.md)          | `value` and `onValueChange` from a signal that follows `?photo=`.                          |

## Solid notes

**Props change the open viewer in place.** `Root` makes its viewer once, in the browser. Changes to `labels`, `zoom`, `loop`, `dismiss`, `wheel` and `preload` go to the viewer through `update` without closing it. So does mounting or unmounting `Fluidbox.Viewer`, `Fluidbox.Thumbnails` or `Fluidbox.Sheet`, and changing the sheet's `snapPoints` and `dismissMotion`. `zoom` and `dismiss` are compared by value, so inline objects are fine. The binding reads the `Slides` props, `findTrigger`, `revealTrigger`, `shareUrl`, `href`, `labels.position` and the event props when it uses them.

**Reactive items.** `items` is tracked: pass a signal's value (`items={photos()}`) and set a new array to change the gallery. Changed items keep the slides of the ones that stayed the same. An open viewer stays on the same item id when the new items still have it. `useFluidbox().setItems` does the same from inside.

**Context reaches custom content.** Slides, the `Viewer`, live overlays, and the thumbnails and sheet content render under `Root`'s owner, straight into the viewer's elements. Context provided around `Root` reaches them, as the [Custom content](./patterns/renderers.md) example does with a theme, and so do the hooks.

**`as` instead of `asChild`.** The trigger renders its own element through `Dynamic`. Pass `as="a"` (with `href`) or a component. A component must forward `ref` and the event props (`onClick`, `onPointerDown`, `onPointerUp`, `onPointerCancel`) to a DOM element.

**Event handlers.** On a `Trigger`, `onClick` and the pointer handlers may be a function or Solid's `[handler, data]` form. They run before the trigger's own, so `event.preventDefault()` in `onClick` stops the open, as does `details.cancel()` in `onValueChange`. A control calls your `onClick` from its own native `on:click` listener, so it runs before the viewer sees the click, and `event.preventDefault()` in it stops the command.

**Server rendering.** The parts render their markup on the server, and `Root` creates the viewer in an effect in the browser. A `Root` whose `value` or `defaultValue` names an image renders the open viewer's copy after its children, on the server and on the client's first render, and the viewer takes it over as `Root` mounts, with no motion. Triggers bind as they render, so they work before the viewer exists.

**Previews update before the close flight.** When the viewer closes on a different item of a multi-item trigger, the preview accessor updates synchronously so the flight lands on the right picture. The trigger finds its image when it registers, so keep the `<img>` mounted and change its `src` instead of swapping in a new element.

**Bundle.** The page loads the triggers, the items and the viewer's state. The viewer itself, with its gestures, transitions and slides, loads as `preload` says, by default when a pointer rests on a trigger. See [Loading the viewer](./getting-started.md#loading-the-viewer). The thumbnails and sheet runtimes load when a `Fluidbox.Thumbnails` or `Fluidbox.Sheet` first renders, so they cost nothing until then.
