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

Import `@ogdakke/fluidbox/styles.css` once in your app. The filmstrip and the sheet are parts of the binding: render `Fluidbox.Filmstrip` or `Fluidbox.Sheet` and they are on. Each needs its stylesheet too: `@ogdakke/fluidbox/filmstrip.css` and `@ogdakke/fluidbox/sheet.css`.

## A gallery

```tsx
import type { FluidboxImageItem } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
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
      {photos.map((photo) => (
        <Fluidbox.Trigger key={photo.src} item={photo}>
          <img src={photo.thumbnail!.src} alt={photo.alt} />
        </Fluidbox.Trigger>
      ))}
    </Fluidbox.Root>
  );
}
```

Without a `Fluidbox.Viewer`, the viewer has the default Previous, Next and Close buttons. With one, it has what you put in it. The same gallery, live, in every framework:

<!-- pattern: basic -->

## Parts

All parts are properties of the `Fluidbox` object.

| Part                                                   | Renders                         | Role                                                                                      |
| ------------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------- |
| `Fluidbox.Root`                                        | nothing of its own              | Owns one viewer for its items. Every other part must be inside it.                        |
| `Fluidbox.Trigger`                                     | a `<button>`, or its child      | Opens an item. Registers itself as the item's origin.                                     |
| `Fluidbox.ThumbnailOverlay`                            | a `<span>`                      | A badge or caption on the thumbnail that fades or flies with the photo.                   |
| `Fluidbox.FrameLayer`                                  | a `<span>`                      | Inside a travelling `ThumbnailOverlay`: moves into the flying frame and scales with it.   |
| `Fluidbox.Viewer`                                      | its children, in the viewer     | Your controls and captions, in place of the default controls.                             |
| `Fluidbox.Controls`                                    | three `<button>`s               | The default Previous, Next and Close, for a `Viewer` of your own.                         |
| `Fluidbox.Previous`, `Fluidbox.Next`, `Fluidbox.Close` | a `<button>`                    | Run the command, with the default icon and label, and disable themselves when they can't. |
| `Fluidbox.Filmstrip`                                   | its children, in each thumbnail | Turns the filmstrip on. A render child draws your own thumbnails.                         |
| `Fluidbox.Sheet`                                       | its children, in the sheet      | Turns the sheet on and renders its content for the item on show.                          |
| `Fluidbox.SheetStop`                                   | a `<button>`                    | Moves the sheet to a stop.                                                                |

### `Fluidbox.Root`

| Prop                 | Type                                                          | Default               | Purpose                                                                                          |
| -------------------- | ------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| `items`              | `readonly TItem[] \| FluidboxItemList<TItem>`                 |                       | The gallery's items, or a list read on demand (see [Items and origins](./items-and-origins.md)). |
| `labels`             | `Partial<FluidboxLabels>`                                     | English               | Every string the viewer shows or announces.                                                      |
| `zoom`               | `false \| { step?: number; max?: number }`                    | `{ step: 2, max: 4 }` | Zoom steps, or `false` to turn zoom off.                                                         |
| `renderers`          | `Record<string, (ctx: { item, index, signal }) => ReactNode>` | `{}`                  | Renders `{ type: "custom", render: key }` items. The type is `FluidboxReactRenderer`.            |
| `origins`            | `FluidboxOriginAdapter<TItem>`                                | triggers              | Finds origins for items without a mounted trigger, and `revealOrigin` scrolls one into view.     |
| `onBeforeToggle`     | `(event: FluidboxToggleEvent) => void`                        |                       | Before the viewer opens or closes. `event.preventDefault()` stops it.                            |
| `onToggle`           | `(event: FluidboxToggleEvent) => void`                        |                       | As the viewer starts to open or close. `oldState`, `newState` and `reason`.                      |
| `onBeforeItemChange` | `(event: FluidboxItemChangeEvent<TItem>) => void`             |                       | Before the viewer moves to another item. `event.preventDefault()` stops it.                      |
| `onItemChange`       | `(event: FluidboxItemChangeEvent<TItem>) => void`             |                       | When the active item changes, opening included. `id`, `index`, `item` and `reason`.              |
| `onSettle`           | `(event: FluidboxItemChangeEvent<TItem>) => void`             |                       | When the active item comes to rest.                                                              |
| `onSheetChange`      | `(event: FluidboxSheetEvent) => void`                         |                       | When the sheet comes to rest at another stop. `stop` and `reason`.                               |
| `children`           | `ReactNode`                                                   |                       | Your page content and the other parts.                                                           |

`TItem` flows from `items` to the renderers and the events, and they get your own item objects back, with any fields you added.

A change to `labels`, `zoom`, or the `Viewer`, `Filmstrip` and `Sheet` parts and their props changes the viewer in place, through `update`, even while it is open. The viewer is made once per mount of `Root`.

### `Fluidbox.Trigger`

| Prop       | Type                                                          | Default | Purpose                                                                                                               |
| ---------- | ------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `item`     | `FluidboxTarget<TItem>`                                       |         | Required. The item to open: the item, its id or its index.                                                            |
| `returns`  | `readonly FluidboxTarget<TItem>[]`                            |         | More items that close back onto this trigger, as for an album cover. `item` always does.                              |
| `asChild`  | `boolean`                                                     | `false` | Decorate the single child element instead of rendering a `<button>`.                                                  |
| `children` | `ReactNode \| (preview: FluidboxTriggerPreview) => ReactNode` |         | The trigger's content, or a function of the preview that follows the viewer.                                          |
| ...        | button attributes                                             |         | Passed to the button, or to the child with `asChild`. The rendered button gets `type="button"` unless you set `type`. |

An item's id is its `id`, else its `src`. The render function gets a `FluidboxTriggerPreview`: `item: TItem | null`, `index: number | null` and `status`. `item` is the item the trigger shows: the one the viewer is on while it is open, then the last one it showed, and the trigger opens on it again. It is `null` when the trigger's items have left the list.

The trigger adds `data-fluidbox-trigger`, `aria-haspopup="dialog"` and `aria-expanded` to its element. It starts loading the item on pointer down, so the click opens without waiting.

### `Fluidbox.ThumbnailOverlay`

| Prop     | Type            | Default | Purpose                                                                                     |
| -------- | --------------- | ------- | ------------------------------------------------------------------------------------------- |
| `travel` | `boolean`       | `false` | Fly with the photo. Its children render live into the flying frame, with the app's context. |
| ...      | span attributes |         | `ref` is forwarded.                                                                         |

It gets `--fluidbox-closed` and `data-fluidbox-phase` as the viewer opens and closes, for the enclosing `Trigger`'s `item` and `returns`. Put it inside a `Trigger`; outside one it throws.

### `Fluidbox.FrameLayer`

Takes span attributes and forwards `ref`. It renders a `<span data-fluidbox-frame-layer>` inside a travelling `ThumbnailOverlay`, and for each flight that element itself moves into the flying frame, scales with it, and goes back after, as a scrim or a gradient does. The overlay's live copy in the frame leaves it out, so it never shows twice.

```tsx
<Fluidbox.ThumbnailOverlay travel className="badge">
  <Fluidbox.FrameLayer className="scrim" />+{album.length - 1}
</Fluidbox.ThumbnailOverlay>
```

### `Fluidbox.Viewer` and `Fluidbox.Controls`

`Fluidbox.Viewer` takes only `children`, and renders them into the viewer's layer for controls and captions. It renders nothing until the viewer exists. `Fluidbox.Controls` takes no props: it is `Previous`, `Next` and `Close`, for when you want the default buttons beside your own.

### `Fluidbox.Previous`, `Fluidbox.Next`, `Fluidbox.Close`

Each takes button attributes and forwards `ref`. With no children it shows the default icon and an `aria-label` from `labels`. `disabled` defaults to the viewer's state: `Previous` and `Next` at the ends of the gallery, `Close` while the viewer is closed. Your `onClick` runs first; `event.preventDefault()` stops the command.

### `Fluidbox.Filmstrip`

| Prop       | Type                                             | Purpose                                                                                             |
| ---------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `children` | `(ctx: FluidboxItemContext<TItem>) => ReactNode` | Renders one thumbnail, `{ item, index }`, into its button. Leave it out for the default thumbnails. |

The strip marks the selected button `data-fluidbox-selected`, so your thumbnails don't track the selection. Annotate the item type with `<Fluidbox.Filmstrip<Photo>>` when you need your own fields.

### `Fluidbox.Sheet` and `Fluidbox.SheetStop`

| Prop         | Type                                                | Default              | Purpose                                                                                     |
| ------------ | --------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `snapPoints` | `readonly FluidboxSheetSnapPoint[]`                 | `["60%", "content"]` | The stops above the resting one, lowest first: pixels, a percentage, or `"content"`.        |
| `dismiss`    | `"flight" \| "scroll" \| "none"`                    | `"flight"`           | What a swipe down on the photo does with the sheet down.                                    |
| `children`   | `(ctx: FluidboxItemContext<TItem>) => ReactNode`    |                      | The sheet's content for the item on show, `{ item, index }`.                                |
| ...          | `className`, `style`, `id`, `aria-*`, `data-*`, ... |                      | Set on the viewer's `<section data-fluidbox-sheet>`, which is the sheet. No event handlers. |

The viewer makes the sheet, a `<section data-fluidbox-sheet>` named by `labels.sheet`, and the render child draws into it for the item on show, again when the item changes. Annotate the item type with `<Fluidbox.Sheet<Photo>>` when you need your own fields.

```tsx
<Fluidbox.Sheet snapPoints={["40%", "90%"]} className="details">
  {({ item }) => <h3>{itemLabel(item)}</h3>}
</Fluidbox.Sheet>
```

`Fluidbox.SheetStop` takes `stop` and button attributes, and moves the sheet to that stop, or back to 0 when it is there. It is a button with `data-fluidbox-sheet-stop`, which works anywhere in the viewer.

## Hooks

Call them in a component inside `Fluidbox.Root`.

| Hook                    | Returns              | Purpose                                                                                                                                                                              |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useFluidbox()`         | `FluidboxApi<TItem>` | The state (`status`, `id`, `index`, `item`, `count`, `hasPrevious`, `hasNext`) with `open`, `close`, `next`, `previous`, `setItems` and `preload`. Re-renders on every state change. |
| `useFluidbox(selector)` | the selected value   | The part the selector picks. Re-renders only when that value changes (`Object.is`).                                                                                                  |
| `useFluidboxSheet()`    | `FluidboxSheetApi`   | `{ stop, set }`: the stop the sheet rests at, following `sheetchange`, and `set(stop, { animate? })` to move it. `stop` is 0 without a sheet.                                        |

Commands resolve `true` once they happened, and `false` when they were prevented or superseded. A command made before the viewer exists, as a deep link on mount does, waits for it and then runs. `open` takes the item, its id or its index; without one it opens the current item, else the first. `preload(target)` starts loading an item a press is likely to open, and returns a function that lets go.

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

The entry exports `FluidboxRootProps`, `FluidboxTriggerProps`, `FluidboxTriggerPreview`, `FluidboxThumbnailOverlayProps`, `FluidboxFrameLayerProps`, `FluidboxViewerProps`, `FluidboxActionProps`, `FluidboxFilmstripProps`, `FluidboxSheetProps`, `FluidboxItemContext`, `FluidboxSheetStopProps`, `FluidboxReactRenderer`, `FluidboxReactRenderContext`, `FluidboxCommands`, `FluidboxApi`, `FluidboxSheetApi`, `UseFluidbox` and `FluidboxReactParts` (the type of `Fluidbox`). It also re-exports the item, state and event types from `@ogdakke/fluidbox`, `FluidboxItemChangeEvent` and `FluidboxSheetEvent` among them.

## Patterns

| Pattern                                            | In React                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Gallery](./patterns/basic.md)                     | `Root items`, a `Trigger` per item, `Previous`, `Next` and `Close` in `Viewer`.              |
| [One trigger for an album](./patterns/overlay.md)  | `Trigger item={album[0]} returns={album}` with a render function, `ThumbnailOverlay travel`. |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` on an element inside the `Trigger`; `asChild` for your own element.   |
| [Custom content](./patterns/renderers.md)          | `Root renderers={{ note: () => <Note /> }}`.                                                 |
| [Programmatic control](./patterns/programmatic.md) | `useFluidbox()`, `onBeforeItemChange` and the other event props.                             |
| [Zoom](./patterns/zoom.md)                         | `Root zoom={{ step, max }}` or `zoom={false}`.                                               |
| [Filmstrip](./patterns/filmstrip.md)               | `<Fluidbox.Filmstrip />`, or with a render child for your own thumbnails.                    |
| [Sheet](./patterns/sheet.md)                       | `Fluidbox.Sheet snapPoints` with a render child, `useFluidboxSheet()`, `Fluidbox.SheetStop`. |
| [Headless controls](./patterns/headless.md)        | Your own buttons in `Viewer`, using `useFluidbox`.                                           |

## React notes

**Props change the open viewer in place.** `labels`, `zoom`, and adding or removing `Fluidbox.Viewer`, `Fluidbox.Filmstrip` (or its render child) or `Fluidbox.Sheet`, or changing the sheet's `snapPoints` and `dismiss`, go to the viewer through `update` without closing it. They are compared by value, so inline objects and arrays are fine. `renderers`, `origins`, `labels.position` and the event props are read when used.

**Keep `items` stable.** A new `items` value replaces the items in the next layout effect. Keep the array in state, a module constant or `useMemo`, and replace it when the gallery changes. An open viewer stays on the same item id when the new items still have it.

**Context reaches custom content.** Renderers, the `Viewer`, travelling overlays, and the filmstrip and sheet content render through React portals inside `Root`, so they read context from around `Root`, as the [Custom content](./patterns/renderers.md) example does with a theme.

**`asChild`.** The trigger merges its props and handlers onto your element and composes your `ref` and your `onClick`, `onPointerDown`, `onPointerUp` and `onPointerCancel`. The child must be one element that renders a DOM node and accepts a `ref`. Use an element that can take focus, such as a `<button>` or `<a href>`.

**Stopping an open.** Your `onClick` on the trigger runs before the open. Call `event.preventDefault()` to stop it, or cancel `onBeforeToggle`.

**Server rendering and StrictMode.** The parts render their markup on the server; the viewer is created in a layout effect in the browser. Triggers bind during render to a stand-in, so they work before the viewer exists. `Root` works under `<StrictMode>`: the viewer is torn down and made again with the effects.

**Previews update before the close flight.** When the viewer closes on a different item of a multi-item trigger, the trigger re-renders synchronously (`flushSync`) so the flight lands on the right picture. The trigger finds its image when it registers, so keep the `<img>` mounted and change its `src`; don't swap in a new element.

**Bundle.** The filmstrip and sheet runtimes load when a `Fluidbox.Filmstrip` or `Fluidbox.Sheet` first renders, so they work without an import of their own and cost nothing until then.
