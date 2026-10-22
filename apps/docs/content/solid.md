---
title: Solid
section: Frameworks
order: 4
description: The Solid binding for fluidbox, with every Fluidbox part, hook and prop, and the Solid-specific behaviour.
---

# Solid

`@ogdakke/fluidbox/solid` builds a gallery from parts: `Fluidbox.Root` owns one viewer, `Fluidbox.Trigger` opens it, and `Fluidbox.Viewer`, `Fluidbox.Filmstrip` and `Fluidbox.Sheet` render your components into it. It needs `solid-js` 1.8 or later.

## Install

```bash
npm install @ogdakke/fluidbox
```

```tsx
import { Fluidbox, useFluidbox, useFluidboxSheet } from "@ogdakke/fluidbox/solid";
import "@ogdakke/fluidbox/styles.css";
```

Import `@ogdakke/fluidbox/styles.css` once in your app. `Fluidbox.Filmstrip` and `Fluidbox.Sheet` turn their add-ons on by themselves. Each also needs its stylesheet, `@ogdakke/fluidbox/filmstrip.css` or `@ogdakke/fluidbox/sheet.css`.

## A gallery

```tsx
import { For } from "solid-js";
import type { FluidboxImageItem } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
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

export function Photos() {
  return (
    <Fluidbox.Root items={photos}>
      <For each={photos}>
        {(photo) => (
          <Fluidbox.Trigger item={photo}>
            <img src={photo.thumbnail!.src} alt={photo.alt} />
          </Fluidbox.Trigger>
        )}
      </For>
    </Fluidbox.Root>
  );
}
```

With no `Fluidbox.Viewer`, the viewer has the default Previous, Next and Close buttons. The same gallery, live, in every framework:

<!-- pattern: basic -->

## Parts

All parts are properties of the `Fluidbox` object.

| Part                                                   | Renders                           | Role                                                                                           |
| ------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Fluidbox.Root`                                        | its children                      | Owns one viewer for its items. Every other part must be inside it.                             |
| `Fluidbox.Trigger`                                     | a `<button>`, or the `as` element | Opens an item. Registers itself as the item's origin.                                          |
| `Fluidbox.ThumbnailOverlay`                            | a `<span>`                        | A badge or caption on the thumbnail that fades or flies with the photo.                        |
| `Fluidbox.FrameLayer`                                  | a `<span>`                        | A layer of a travelling overlay, such as a scrim, that moves into the flying frame.            |
| `Fluidbox.Viewer`                                      | its children, in the viewer       | Your controls and captions, in place of the default controls.                                  |
| `Fluidbox.Controls`                                    | three `<button>`s                 | The default Previous, Next and Close, for a `Viewer` of your own.                              |
| `Fluidbox.Previous`, `Fluidbox.Next`, `Fluidbox.Close` | a `<button>`                      | Run the command, with the default icon and label, and disable themselves when they can't.      |
| `Fluidbox.Filmstrip`                                   | its children, in each thumbnail   | Turns the filmstrip on, with the default thumbnails or yours.                                  |
| `Fluidbox.Sheet`                                       | its children, in the sheet        | Turns the sheet on, with your content for the active item, and gives the sheet its attributes. |
| `Fluidbox.SheetStop`                                   | a `<button>`                      | Moves the sheet to a stop, and back down when it is there. Put it in the viewer or sheet.      |

### `Fluidbox.Root`

| Prop                 | Type                                                            | Default               | Purpose                                                                                                                                       |
| -------------------- | --------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`              | `readonly TItem[] \| FluidboxItemList<TItem>`                   |                       | The gallery's items, or a lazy list (see [Items and origins](./items-and-origins.md)).                                                        |
| `open`               | `boolean`                                                       |                       | Whether the viewer is open, when your state owns it. It opens on `index` and closes as this changes. Leave it out to let the triggers own it. |
| `index`              | `number`                                                        |                       | The item the viewer shows, when your state owns it. An index out of range is ignored.                                                         |
| `labels`             | `Partial<FluidboxLabels>`                                       | English               | Every string the viewer shows or announces. Changes apply to an open viewer.                                                                  |
| `zoom`               | `false \| { step?: number; max?: number }`                      | `{ step: 2, max: 4 }` | Zoom steps, or `false` to turn zoom off. Changes apply to an open viewer.                                                                     |
| `loop`               | `boolean`                                                       | `false`               | Go round: past the last item comes the first, by swipe, key, button and filmstrip. A single item never loops.                                 |
| `renderers`          | `Record<string, (ctx: { item, index, signal }) => JSX.Element>` | `{}`                  | Renders `type: "custom"` items by their `render` key. The type is `FluidboxSolidRenderer`.                                                    |
| `origins`            | `FluidboxOriginAdapter<TItem>`                                  | triggers              | Finds origins for items without a mounted trigger, and `revealOrigin` scrolls one into view.                                                  |
| `loading`            | `"hover" \| "press" \| "eager"`                                 | `"hover"`             | When the viewer's code loads. See [Loading the viewer](./getting-started.md#loading-the-viewer).                                              |
| `onBeforeToggle`     | `(event: FluidboxToggleEvent) => void`                          |                       | Before the viewer opens or closes. `event.preventDefault()` cancels it.                                                                       |
| `onToggle`           | `(event: FluidboxToggleEvent) => void`                          |                       | As the viewer starts to open or close.                                                                                                        |
| `onBeforeItemChange` | `(event: FluidboxItemChangeEvent<TItem>) => void`               |                       | Before the viewer moves to another item. `event.preventDefault()` keeps it still.                                                             |
| `onItemChange`       | `(event: FluidboxItemChangeEvent<TItem>) => void`               |                       | When the active item changes, opening included.                                                                                               |
| `onSettle`           | `(event: FluidboxItemChangeEvent<TItem>) => void`               |                       | When the active item comes to rest.                                                                                                           |
| `onSheetChange`      | `(event: FluidboxSheetEvent) => void`                           |                       | When the sheet comes to rest at another stop: `event.stop`, `event.reason`.                                                                   |
| `onOpenChange`       | `(open: boolean, details: { reason }) => void`                  |                       | As the viewer opens or closes, from any input. Set `open` from it.                                                                            |
| `onIndexChange`      | `(index: number, details: { reason }) => void`                  |                       | As the viewer moves to another item, opening included. Set `index` from it.                                                                   |
| `children`           | `JSX.Element`                                                   |                       | Your page content and the other parts.                                                                                                        |

A renderer's `ctx` also has `active` and `onActiveChange`, to play and pause as its slide comes on show and leaves it. See [Slides that play and pause](./product-media.md#slides-that-play-and-pause).

`TItem` comes from `items`, so the events hand back your own item objects. The [API reference](./api.md) describes the events and their `reason`.

### `Fluidbox.Trigger`

| Prop       | Type                                                                         | Default    | Purpose                                                                                  |
| ---------- | ---------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `item`     | `FluidboxTarget<TItem>`                                                      |            | Required. The item to open, its id or its index.                                         |
| `returns`  | `readonly FluidboxTarget<TItem>[]`                                           |            | More items that close back onto this trigger, as for an album cover. `item` always does. |
| `as`       | `ValidComponent`                                                             | `"button"` | The element or component to render instead of a button, such as `"a"`.                   |
| `ref`      | `HTMLElement \| (element: HTMLElement) => void`                              |            | The rendered element.                                                                    |
| `children` | `JSX.Element \| (preview: Accessor<{ item, index, status }>) => JSX.Element` |            | Content, or a function of the preview that follows the viewer.                           |
| ...        | attributes and event handlers                                                |            | Passed to the element. A button gets `type="button"`.                                    |

The preview accessor returns `FluidboxTriggerPreview<TItem>`: `item: TItem | null`, `index: number | null` and `status`. `item` is the item the trigger shows. While the viewer is open on `item` or one of `returns`, that is the item the viewer is on. Otherwise it is the last one the trigger showed. It is `null` when the trigger's items have left the list.

```tsx
<Fluidbox.Trigger item={album[0]} returns={album}>
  {(preview) => <img src={preview().item?.src} alt={preview().item?.alt ?? ""} />}
</Fluidbox.Trigger>
```

The trigger adds `data-fluidbox-trigger`, `aria-haspopup="dialog"` and `aria-expanded` to its element, and starts loading the item on pointer down.

### `Fluidbox.ThumbnailOverlay`

| Prop     | Type            | Default | Purpose                                                                                     |
| -------- | --------------- | ------- | ------------------------------------------------------------------------------------------- |
| `travel` | `boolean`       | `false` | Fly with the photo. Without it, the overlay stays on the page and gets `--fluidbox-closed`. |
| ...      | span attributes |         | Including `ref`.                                                                            |

It must be inside a `Fluidbox.Trigger`, and registers for that trigger's `item` and `returns`. It gets `data-fluidbox-phase` as the viewer opens and closes. With `travel`, its children also render live in the flying frame, under the same context.

### `Fluidbox.FrameLayer`

It goes inside a travelling `ThumbnailOverlay` and renders a `<span data-fluidbox-frame-layer>` with its children and span attributes. On each flight, the element itself moves into the flying frame, scales with it, and then goes back. Use it for a scrim or a border. The frame's live copy of the overlay leaves it out, so it never shows twice.

```tsx
<Fluidbox.ThumbnailOverlay travel class="badge">
  <Fluidbox.FrameLayer class="scrim" />+{album.length - 1}
</Fluidbox.ThumbnailOverlay>
```

### `Fluidbox.Viewer` and `Fluidbox.Controls`

`Fluidbox.Viewer` takes only `children` and renders them into the viewer's layer while the viewer exists. While a `Viewer` is mounted, the viewer has no default controls. Put `Fluidbox.Controls`, or `Previous`, `Next` and `Close`, where you want them. `Fluidbox.Controls` takes no props.

### `Fluidbox.Previous`, `Fluidbox.Next`, `Fluidbox.Close`

Each takes button attributes. With no children it shows the default icon and an `aria-label` from `labels`. `disabled` follows the viewer's state: `Previous` and `Next` at the ends of a gallery that doesn't loop, `Close` while the viewer is closed. Pass `disabled` to override it. Your `onClick` runs first, and `event.preventDefault()` in it stops the command.

### `Fluidbox.Filmstrip`

| Prop       | Type                                      | Purpose                                                                                      |
| ---------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `children` | `(thumb: { item, index }) => JSX.Element` | Optional. Renders one thumbnail into its button. Without it, the strip shows default images. |

The strip marks the selected button `data-fluidbox-selected`, so your thumbnail doesn't track the selection.

### `Fluidbox.Sheet` and `Fluidbox.SheetStop`

| Prop         | Type                                       | Default              | Purpose                                                                          |
| ------------ | ------------------------------------------ | -------------------- | -------------------------------------------------------------------------------- |
| `snapPoints` | `readonly FluidboxSheetSnapPoint[]`        | `["60%", "content"]` | The stops above the resting one, lowest first.                                   |
| `dismiss`    | `"flight" \| "scroll" \| "none"`           | `"flight"`           | What a swipe down on the photo does while the sheet is down.                     |
| `children`   | `(active: { item, index }) => JSX.Element` |                      | The content for the active item. It renders again when the active item changes.  |
| ...          | section attributes                         |                      | `class`, `style`, `data-*`, `aria-*` and the rest go on the sheet's `<section>`. |

The runtime makes the sheet, a `<section data-fluidbox-sheet>` named by `labels.sheet`. The content renders straight into it with no wrapper of its own, and the section gets the `Sheet`'s attributes. `active` is a `FluidboxItemContext<TItem>`, as a `Filmstrip` thumbnail's is. `Fluidbox.SheetStop` takes `stop: number` and button attributes. It is a button with `data-fluidbox-sheet-stop`, which works anywhere in the viewer. Pressed at its own stop, it lowers the sheet to 0.

## Hooks

Call them in a component inside `Fluidbox.Root`, including the content of `Viewer`, `Sheet`, `Filmstrip` and renderers.

| Hook                    | Returns                                                                  | Purpose                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useFluidbox()`         | `FluidboxApi<TItem>`                                                     | The state (`status`, `id`, `index`, `item`, `count`, `hasPrevious`, `hasNext`) and `open`, `close`, `next`, `previous`, `setItems`, `preload`, `load`. |
| `useFluidbox(selector)` | `Accessor<T>`                                                            | A memo of the part of `FluidboxState` the selector picks.                                                                                              |
| `useFluidboxSheet()`    | `FluidboxSheetApi`: `{ stop: Accessor<number>, set(stop, { animate }) }` | The stop the sheet rests at, following `sheetchange`, and a command to move it. Needs a `Fluidbox.Sheet`.                                              |

The state fields of `useFluidbox()` are reactive getters, like Solid props. Read them in JSX or an effect, and don't destructure them. `open` takes the item, its id or its index. Commands return a `Promise<boolean>` that resolves `true` once the command happened, and `false` when it was prevented or superseded. A command made before the viewer exists waits for it. `preload(target)` starts loading an item a press is likely to open, and returns a function that lets go. `load()` loads the viewer's code now.

```tsx
import { useFluidbox } from "@ogdakke/fluidbox/solid";

function Counter() {
  const fluidbox = useFluidbox();
  return (
    <button type="button" onClick={() => fluidbox.open(0)}>
      {fluidbox.index === null ? "Open" : `${fluidbox.index + 1} / ${fluidbox.count}`}
    </button>
  );
}
```

For a typed item, write `useFluidbox<Photo>()`, or annotate the selector: `useFluidbox((state: FluidboxState<Photo>) => state.item)`.

### Types

The entry exports `FluidboxRootProps`, `FluidboxTriggerProps`, `FluidboxTriggerPreview`, `FluidboxThumbnailOverlayProps`, `FluidboxFrameLayerProps`, `FluidboxViewerProps`, `FluidboxActionProps`, `FluidboxFilmstripProps`, `FluidboxSheetProps`, `FluidboxSheetStopProps`, `FluidboxItemContext`, `FluidboxSolidRenderer`, `FluidboxSolidRenderContext`, `FluidboxApi`, `FluidboxSheetApi` and `FluidboxSolidParts` (the type of `Fluidbox`). It re-exports the item, list, label, origin, state and event types of `@ogdakke/fluidbox`, including `FluidboxItemChangeEvent` and `FluidboxSheetEvent`.

## Patterns

| Pattern                                            | In Solid                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [Gallery](./patterns/basic.md)                     | `Root items`, a `Trigger` per item in `<For>`, and `Previous`, `Next` and `Close` in `Viewer`.                     |
| [One trigger for an album](./patterns/overlay.md)  | `Trigger item={album[0]} returns={album}` with `{(preview) => ...}`, and `ThumbnailOverlay travel`.                |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` on an element inside the `Trigger`; `as` to render another element.                         |
| [Custom content](./patterns/renderers.md)          | `Root renderers={{ note: () => <Note /> }}`.                                                                       |
| [Programmatic control](./patterns/programmatic.md) | `useFluidbox()`, `open(2)`, and `onBeforeItemChange` with `preventDefault()`.                                      |
| [Zoom](./patterns/zoom.md)                         | `Root zoom={{ step, max }}` or `zoom={false}`.                                                                     |
| [Filmstrip](./patterns/filmstrip.md)               | `<Fluidbox.Filmstrip />`, or with a child function for your own thumbnails.                                        |
| [Sheet](./patterns/sheet.md)                       | `Fluidbox.Sheet snapPoints class` with `{({ item }) => ...}`, `useFluidboxSheet()`, and a `SheetStop` in `Viewer`. |
| [Headless controls](./patterns/headless.md)        | Your own buttons in `Viewer`, using `useFluidbox()`.                                                               |
| [Right to left](./patterns/rtl.md)                 | Root `labels`, inside a `dir="rtl"` element.                                                                       |
| [Photo in the address](./patterns/url.md)          | `open`, `index`, `onOpenChange` and `onIndexChange` from a signal that follows `?photo=`.                          |

## Solid notes

**Options apply live.** `Root` makes its viewer once, in the browser. A change to `labels` or `zoom` goes to `fluidbox.update()`. So does mounting or unmounting a `Filmstrip` or `Sheet`, and changing the sheet's `snapPoints` or `dismiss`. An open viewer stays open, and only the filmstrip or sheet whose options changed draws again. Mounting or unmounting a `Viewer` swaps the viewer's controls in place. The binding reads `origins`, `renderers` and the event props when it uses them.

**Reactive items.** `items` is tracked: pass a signal's value (`items={photos()}`) and set a new array to change the gallery. An open viewer stays on the same item id if the new items still have it. `useFluidbox().setItems` does the same from inside.

**Context reaches custom content.** Renderers, travelling overlays and the viewer, filmstrip and sheet content render under `Root`, straight into the viewer's elements with no wrapper. Context provided around `Root` reaches them, as the [Custom content](./patterns/renderers.md) example does with a theme, and so do the hooks.

**`as` instead of `asChild`.** The trigger renders its own element through `Dynamic`. Pass `as="a"` (with `href`) or a component. A component must forward `ref` and the event props (`onClick`, `onPointerDown`, `onPointerUp`, `onPointerCancel`) to a DOM element.

**Event handlers.** `onClick` and the pointer handlers may be a function or Solid's `[handler, data]` form. They run before the trigger's own, so `event.preventDefault()` in `onClick` stops the open. The trigger doesn't compose native `on:click` listeners with its own.

**Server rendering.** The parts render their markup on the server, and `Root` creates the viewer in an effect in the browser.

**Previews update before the close flight.** When the viewer closes on a different item of a multi-item trigger, the preview accessor updates synchronously so the flight lands on the right picture. The trigger finds its image when it registers, so keep the `<img>` mounted and change its `src` instead of swapping in a new element.
