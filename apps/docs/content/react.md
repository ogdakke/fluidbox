---
title: React
section: Frameworks
order: 1
description: The React binding for fluidbox, with every Fluidbox part, hook and prop, and the React-specific behaviour.
---

# React

`@ogdakke/fluidbox/react` builds a gallery from parts: `Fluidbox.Root` owns one viewer for its items, `Fluidbox.Trigger` opens it, and `Fluidbox.Viewer` renders your own controls into it. It needs `react` and `react-dom` 18 or later.

## Install

```bash
npm install @ogdakke/fluidbox
```

```tsx
import { Fluidbox, useFluidbox, useFluidboxSheet } from "@ogdakke/fluidbox/react";
import "@ogdakke/fluidbox/styles.css";
```

Import `@ogdakke/fluidbox/styles.css` once in your app. The thumbnails and the sheet are parts of the binding. Rendering `Fluidbox.Thumbnails` or `Fluidbox.Sheet` turns it on. They also need their stylesheets, `@ogdakke/fluidbox/thumbnails.css` and `@ogdakke/fluidbox/sheet.css`.

## A gallery

```tsx
import type { FluidboxImageItem } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
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
      {photos.map((photo) => (
        <Fluidbox.Trigger key={photo.id} value={photo.id}>
          <img src={photo.thumbnail!.src} alt={photo.alt} />
        </Fluidbox.Trigger>
      ))}
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

| Part                                                   | Renders                              | Role                                                                                        |
| ------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `Fluidbox.Root`                                        | nothing of its own                   | Owns one viewer for its items. Every other part must be inside it.                          |
| `Fluidbox.Trigger`                                     | a `<button>`, or its child           | Opens an item. Registers itself as the item's origin.                                       |
| `Fluidbox.Overlay`                                     | a `<span>`                           | A badge, caption or scrim on a trigger that fades or flies with the photo.                  |
| `Fluidbox.Slides`                                      | nothing                              | The content of each item type's slide.                                                      |
| `Fluidbox.Media`                                       | into the slide's box                 | The box that flies and zooms: its children, or what a plain-JS slide draws.                 |
| `Fluidbox.Image`, `Fluidbox.Video`, `Fluidbox.Iframe`  | the built-in media, in the box       | The viewer's own image, video and iframe, with their loading, zoom and error handling.      |
| `Fluidbox.Viewer`                                      | its children, in the viewer's layer  | Your controls and captions.                                                                 |
| `Fluidbox.Toolbar`, `Fluidbox.ZoomControls`            | a `<div role="group">`               | Groups of controls. Empty, they hold Previous, Next and Close, or the three zoom controls.  |
| `Fluidbox.Previous`, `Next`, `Close`                   | a `<button>`                         | Run the command, and disable themselves when they can't.                                    |
| `Fluidbox.ZoomIn`, `ZoomOut`, `ZoomReset`              | a `<button>`                         | Zoom the image on show. See [Zoom](./patterns/zoom.md#zoom-controls).                       |
| `Fluidbox.Fullscreen`, `Share`                         | a `<button>`                         | Full screen, and the share sheet or the clipboard. Hidden where they can't work.            |
| `Fluidbox.Download`                                    | an `<a download>`                    | Saves the item's file. Hidden when the item has none.                                       |
| `Fluidbox.Counter`, `Fluidbox.Caption`                 | a `<span>`, a `<div>`                | Where the viewer is, and the item's caption.                                                |
| `Fluidbox.Loading`, `Fluidbox.Error`, `Fluidbox.Retry` | their children; a `<button>`         | Your loading and error states for the item on show.                                         |
| `Fluidbox.Thumbnails`                                  | its children, in each thumbnail      | Turns the thumbnails on. A render child draws your own thumbnails.                          |
| `Fluidbox.Sheet`, `Fluidbox.SheetSnap`                 | its children, in the sheet; a button | Turns the sheet on and renders its content for the item on show; moves the sheet to a snap. |

### `Fluidbox.Root`

| Prop                    | Type                                                          | Default                                               | Purpose                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`                 | `readonly TItem[] \| FluidboxItemList<TItem>`                 |                                                       | The gallery's items, or a list read on demand (see [Items and origins](./items-and-origins.md)).                                                            |
| `value`                 | `string \| null`                                              |                                                       | The open item's id, or `null`, when your state owns it. A change opens, moves or closes the viewer to match.                                                |
| `defaultValue`          | `string \| null`                                              | `null`                                                | The item to open with, when the viewer owns its value.                                                                                                      |
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
| `children`              | `ReactNode`                                                   |                                                       | Your page content and the other parts.                                                                                                                      |

`value` is a request, not a lock. When the viewer changes on its own, by a swipe or Escape, `onValueChange` reports it; leave `value` alone and the viewer still changes. To refuse a change, call `details.cancel()`.

`TItem` flows from `items` to the slides and the events. They get your own item objects back, with any fields you added.

### `Fluidbox.Trigger`

| Prop       | Type                                                          | Default | Purpose                                                                                                               |
| ---------- | ------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `value`    | `FluidboxTarget<TItem> \| readonly FluidboxTarget<TItem>[]`   |         | Required. The item to open: the item, its id or its index. A list opens its first, and every one closes back onto it. |
| `asChild`  | `boolean`                                                     | `false` | Decorate the single child element instead of rendering a `<button>`.                                                  |
| `children` | `ReactNode \| (preview: FluidboxTriggerPreview) => ReactNode` |         | The trigger's content, or a function of the preview that follows the viewer.                                          |
| ...        | button attributes                                             |         | Passed to the button, or to the child with `asChild`. The rendered button gets `type="button"` unless you set `type`. |

An item's id is its `id`, else its `src` (`src#2` and on for a repeated `src`). The render function gets a `FluidboxTriggerPreview`: `item: TItem | null`, `index: number | null` and `status`. `item` is the item the trigger shows. While the viewer is open, that is the item the viewer is on. After it closes, it is the last one the trigger showed, and the trigger opens on that item again. It is `null` when the trigger's items have left the list.

The trigger adds `data-fluidbox-trigger` and `aria-haspopup="dialog"` to its element. It starts loading the item on pointer down, so the click opens without waiting. An `asChild` `<a href>` stays on the page when the viewer opens; see [A link as the trigger](./getting-started.md#a-link-as-the-trigger).

### `Fluidbox.Overlay`

| Prop     | Type                                    | Default  | Purpose                              |
| -------- | --------------------------------------- | -------- | ------------------------------------ |
| `flight` | `"none" \| "copy" \| "live" \| "frame"` | `"none"` | How it goes with the photo's flight. |
| ...      | span attributes                         |          | `ref` is forwarded.                  |

`"none"` stays on the card, `"copy"` flies a still copy with the photo, `"live"` renders its children live in the flying frame, with the app's context, and `"frame"` moves the element itself into the frame, scaling with it, as a scrim does. It gets `--fluidbox-closed` and `data-fluidbox-phase` as the viewer opens and closes, for the enclosing `Trigger`'s items. Put it inside a `Trigger`. Outside one, it throws. Several can sit on one trigger:

```tsx
<Fluidbox.Overlay flight="live" className="badge">
  <Fluidbox.Overlay flight="frame" className="scrim" />+{album.length - 1}
</Fluidbox.Overlay>
```

### `Fluidbox.Slides` and `Fluidbox.Media`

`Fluidbox.Slides` takes one prop per item type, your own or the built-in `image`, `video` and `iframe`, and `default` for any other type. Each is a function of `{ item, index }` that returns the slide's content; `item` has that type. It renders nothing: the viewer asks for a slide's content as the slide mounts, and renders it into the slide's layer, through a portal inside `Root`. A Root takes one `Slides`.

`Fluidbox.Media` is the slide's box, the element that flies, follows a drag to dismiss and zooms. Its children go into the box, which the viewer sizes from the item's `width` and `height`, so fill it. Its HTML attributes go onto the box. `render` draws into it with a plain-JS slide renderer, as the add-on parts do. `zoom` lets it zoom: on by default with an `Image` in it, off otherwise. Anything in the slide outside `Media` sits in the slide's layer, over the slide, and doesn't fly or zoom.

```tsx
<Fluidbox.Slides
  product={({ item }) => (
    <>
      <Fluidbox.Media>
        <Fluidbox.Image item={item.image} />
      </Fluidbox.Media>
      <p className="price">€{item.price}</p>
    </>
  )}
/>
```

`Fluidbox.Image`, `Fluidbox.Video` and `Fluidbox.Iframe` draw the viewer's own media into the box, for the slide's item or the `item` you give. They keep the built-in media's loading, placeholders, sharper zoom images, error and Retry. Outside a `Media` they draw into the box all the same. `Video` takes `attach`, to load the media yourself, as hls.js does. Pass a stable function: a new one loads the video again.

`useFluidboxSlide()`, in a component inside a slide, returns its `item`, `index`, `active` (it re-renders as this changes), `opening`, `signal`, `onActiveChange`, `origin`, `returnPlayback`, `waitUntil`, `fail` and `onZoom`. An open waits for the slide's images and videos by itself; `waitUntil(promise)` makes it wait for what it can't see, such as a canvas's first frame. Call it during render or in a layout effect. See [Slides that play and pause](./product-media.md#slides-that-play-and-pause). `index`, `opening` and `origin` are read live: new items keep a slide whose item moved, so read `index` where you use it.

A slide whose content suspends, as `lazy` or a data hook does, waits in a Suspense boundary of the slide's own, with no fallback, and the open waits for it, for at most three seconds; the page around the viewer stays as it is. Under React 18's legacy `ReactDOM.render`, a suspended boundary commits what is beside it, so the open goes ahead without the content: use `createRoot`.

A player of your own continues the trigger's video through `origin` and `returnPlayback`, as in [A player of your own continues the trigger's video](./product-media.md#a-player-of-your-own-continues-the-triggers-video). A slide kept from an earlier open reads the trigger of the open that shows it. Register the player in an effect, and return what `returnPlayback` returns as the cleanup:

```tsx
function MuxSlide() {
  const slide = useFluidboxSlide<MuxItem>();
  const player = useRef<MuxPlayerRefAttributes>(null);
  useEffect(() => slide.returnPlayback(player.current!), [slide]);
  const from = slide.origin?.video;
  return (
    <Fluidbox.Media>
      <MuxPlayer
        ref={player}
        playbackId={slide.item.playbackId}
        startTime={from?.currentTime}
        autoPlay={from ? !from.paused : false}
        muted={from?.muted}
      />
    </Fluidbox.Media>
  );
}
```

### `Fluidbox.Viewer`, `Fluidbox.Toolbar` and the controls

`Fluidbox.Viewer` takes only `children`, and renders them into the viewer's layer. It renders nothing until the viewer exists.

`Fluidbox.Toolbar` is a `<div role="group" data-fluidbox-toolbar>`; with no children it holds Previous, Next and Close. The stylesheet gives it `display: contents`, so the controls keep their places until you style it. `Fluidbox.ZoomControls` is the zoom group, named like the zoomed image; with no children it holds Zoom in, Zoom out and Fit.

`Previous`, `Next`, `Close`, `ZoomIn`, `ZoomOut`, `ZoomReset`, `Fullscreen`, `Share`, `Download`, `Retry` and `SheetSnap` take their element's attributes and forward `ref`. With no children a control shows its label from `labels` as text, marked `data-fluidbox-default`. With children, the label becomes its `aria-label`. `label` overrides the label for this control; `label={false}` names it by its children, for children with visible text. `disabled` follows the viewer's state, and a control that can't work on this device or item gets `hidden`. Your `onClick` runs first, and `event.preventDefault()` in it stops the command.

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

| Prop       | Type                                                  | Purpose                                                                                                     |
| ---------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `children` | `(ctx: FluidboxThumbnailContext<TItem>) => ReactNode` | Renders one thumbnail, `{ item, index, active }`, into its button. Leave it out for the default thumbnails. |

The strip marks the selected button `data-active` and `data-fluidbox-selected`. Annotate the item type with `<Fluidbox.Thumbnails<Photo>>` when you need your own fields.

### `Fluidbox.Sheet` and `Fluidbox.SheetSnap`

| Prop            | Type                                                | Default              | Purpose                                                                                     |
| --------------- | --------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `snapPoints`    | `readonly FluidboxSheetSnapPoint[]`                 | `["60%", "content"]` | The snaps above the resting one, lowest first: pixels, a percentage, or `"content"`.        |
| `dismissMotion` | `"flight" \| "scroll"`                              | `"flight"`           | How a swipe down on the photo closes the viewer with the sheet down.                        |
| `onSnapChange`  | `(event: FluidboxSheetEvent) => void`               |                      | When the sheet comes to rest at another snap. `snap` and `reason`.                          |
| `children`      | `(ctx: FluidboxItemContext<TItem>) => ReactNode`    |                      | The sheet's content for the item on show, `{ item, index }`.                                |
| ...             | `className`, `style`, `id`, `aria-*`, `data-*`, ... |                      | Set on the viewer's `<section data-fluidbox-sheet>`, which is the sheet. No event handlers. |

The viewer makes the sheet, a `<section data-fluidbox-sheet>` named by `labels.sheet`. The render child draws into it for the item on show, and draws again when the item changes. Annotate the item type with `<Fluidbox.Sheet<Photo>>` when you need your own fields.

```tsx
<Fluidbox.Sheet snapPoints={["40%", "90%"]} className="details">
  {({ item }) => <h3>{itemLabel(item)}</h3>}
</Fluidbox.Sheet>
```

`Fluidbox.SheetSnap` takes `to` and button attributes, and moves the sheet to that snap, or back to 0 when the sheet is already there. It gets `aria-expanded` from the sheet. Its children name it; with none it shows `labels.sheet`.

### The add-on parts

`@ogdakke/fluidbox/react/embed`, `/react/model` and `/react/spin` export `Embed`, `Model` and `Spin`, for slides of those types. Each is a `Media` that draws the add-on's slide, and takes its options as props. See [Product media](./product-media.md).

```tsx
<Fluidbox.Slides
  embed={() => <Embed />}
  spin={() => <Spin />}
  model={() => <Model load={loadModelViewer} />}
/>
```

## Hooks

Call them in a component inside `Fluidbox.Root`.

| Hook                    | Returns              | Purpose                                                                                                                                                                                                                                                                                                 |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useFluidbox()`         | `FluidboxApi<TItem>` | The state (`status`, `value`, `index`, `item`, `count`, `hasPrevious`, `hasNext`, `zoom`, `fullscreen`) with `open`, `close`, `next`, `previous`, `zoomTo`, `zoomIn`, `zoomOut`, `zoomReset`, `setFullscreen`, `download`, `share`, `setItems`, `preload` and `load`. Re-renders on every state change. |
| `useFluidbox(selector)` | the selected value   | The part the selector picks. Re-renders only when that value changes (`Object.is`).                                                                                                                                                                                                                     |
| `useFluidboxSheet()`    | `FluidboxSheetApi`   | `{ snap, setSnap }`: the snap the sheet rests at, following `sheetchange`, and `setSnap(snap, { animate? })` to move it. `snap` is 0 without a sheet.                                                                                                                                                   |
| `useFluidboxSlide()`    | `FluidboxSlideApi`   | Inside a slide: its item and activity, and its hooks into the open. It throws elsewhere.                                                                                                                                                                                                                |

Commands resolve `true` once they happen, and `false` when they were prevented or superseded. A command you call before the viewer exists, such as a deep link on mount, waits for the viewer and then runs. `open` takes the item, its id or its index. Without one, it opens the current item, or the first if there is none. `preload(target)` starts loading an item a press is likely to open, and returns a function that lets go. `load()` loads the viewer's code now.

```tsx
import { useFluidbox } from "@ogdakke/fluidbox/react";

function Counter() {
  const { index, count, open } = useFluidbox();
  return (
    <button type="button" onClick={() => open(0)}>
      {index === null ? `Open ${count} photos` : `${index + 1} / ${count}`}
    </button>
  );
}
```

See the [API reference](./api.md) for the state, the events and the items.

### Types

The entry exports the props of every part (`FluidboxRootProps`, `FluidboxTriggerProps`, `FluidboxOverlayProps`, `FluidboxSlidesProps`, `FluidboxMediaProps`, `FluidboxImageProps`, `FluidboxVideoProps`, `FluidboxIframeProps`, `FluidboxViewerProps`, `FluidboxGroupProps`, `FluidboxControlProps`, `FluidboxDownloadProps`, `FluidboxCounterProps`, `FluidboxCaptionProps`, `FluidboxLoadingProps`, `FluidboxErrorProps`, `FluidboxThumbnailsProps`, `FluidboxSheetProps`, `FluidboxSheetSnapProps`), `FluidboxSlideContent`, `FluidboxItemContext`, `FluidboxThumbnailContext`, `FluidboxTriggerPreview`, `FluidboxCommands`, `FluidboxApi`, `FluidboxSheetApi`, `FluidboxSlideApi`, `UseFluidbox` and `FluidboxReactParts` (the type of `Fluidbox`). It also re-exports the item, state and event types from `@ogdakke/fluidbox`.

## Patterns

| Pattern                                            | In React                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Gallery](./patterns/basic.md)                     | `Root items`, a `Trigger` per item, `Previous`, `Next` and `Close` in `Viewer`.              |
| [One trigger for an album](./patterns/overlay.md)  | `Trigger value={album}` with a render function, `Overlay flight="live"`.                     |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` on an element inside the `Trigger`; `asChild` for your own element.   |
| [Custom content](./patterns/renderers.md)          | `Slides note={() => <Fluidbox.Media><Note /></Fluidbox.Media>}`.                             |
| [Programmatic control](./patterns/programmatic.md) | `useFluidbox()`, `onValueChange` with `details.cancel()`, `onValueChangeComplete`.           |
| [Zoom](./patterns/zoom.md)                         | `Root zoom={{ step, max }}` or `zoom={false}`, `Toolbar` and `ZoomControls`.                 |
| [Thumbnails](./patterns/thumbnails.md)             | `<Fluidbox.Thumbnails />`, or with a render child for your own thumbnails.                   |
| [Sheet](./patterns/sheet.md)                       | `Fluidbox.Sheet snapPoints` with a render child, `useFluidboxSheet()`, `Fluidbox.SheetSnap`. |
| [Headless controls](./patterns/headless.md)        | Your own buttons in `Viewer`, using `useFluidbox`.                                           |
| [Right to left](./patterns/rtl.md)                 | Root `labels`, inside a `dir="rtl"` element.                                                 |
| [Photo in the address](./patterns/url.md)          | `value` and `onValueChange` from state that follows `?photo=`.                               |

## React notes

**Props change the open viewer in place.** Changes to `labels`, `zoom`, `loop`, `dismiss` and `wheel` go to the viewer through `update` without closing it. So does adding or removing `Fluidbox.Viewer`, `Fluidbox.Thumbnails` or its render child, or `Fluidbox.Sheet`, and so does changing the sheet's `snapPoints` and `dismissMotion`. The binding compares these by value, so inline objects and arrays are fine. It reads the `Slides` props, `findTrigger`, `revealTrigger`, `shareUrl`, `labels.position` and the event props when it uses them, so a new function each render is fine.

**New `items` are compared, not just replaced.** A new `items` value goes to `setItems` in the next layout effect. Items equal to the current ones, field by field, change nothing, so `items={products.map(toItem)}` can be a fresh array on every render. Changed items keep the slides of the ones that stayed the same. An open viewer stays on the same item id when the new items still have it.

**Context reaches custom content.** Slides, the `Viewer`, live overlays, and the thumbnails and sheet content render through React portals inside `Root`. They read context provided around `Root`, as the [Custom content](./patterns/renderers.md) example does with a theme.

**`asChild`.** The trigger merges its props and handlers onto your element and composes your `ref` and your `onClick`, `onPointerDown`, `onPointerUp` and `onPointerCancel`. The child must be one element that renders a DOM node and accepts a `ref`. Use an element that can take focus, such as a `<button>` or `<a href>`.

**Stopping an open.** Your `onClick` on the trigger runs before the open. Call `event.preventDefault()` to stop it, or `details.cancel()` in `onValueChange`.

**Server rendering and StrictMode.** The parts render their markup on the server, and `Root` creates the viewer in a layout effect in the browser. A `Root` whose `value` or `defaultValue` names an image renders the open viewer's copy on the server, and the viewer takes it over. Triggers bind to a stand-in during render, so they work before the viewer exists. `Root` works under `<StrictMode>`. When StrictMode runs the effects again, `Root` tears the viewer down and makes it again. For Next.js, see [Next.js](./nextjs.md).

**Previews update before the close flight.** When the viewer closes on a different item of a multi-item trigger, the trigger re-renders synchronously (`flushSync`) so the flight lands on the right picture. The trigger finds its image when it registers, so keep the `<img>` mounted and change its `src` instead of swapping in a new element.

**Bundle.** The page loads the triggers, the items and the viewer's state. The viewer itself, with its gestures, transitions and slides, loads as `preload` says, by default when a pointer rests on a trigger. See [Loading the viewer](./getting-started.md#loading-the-viewer). The thumbnails and sheet runtimes load when a `Fluidbox.Thumbnails` or `Fluidbox.Sheet` first renders, so they work without an import of their own and cost nothing until then.
