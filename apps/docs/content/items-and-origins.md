---
title: Items and origins
section: Guides
order: 3
description: How fluidbox takes a collection (arrays, lazy lists of any size, setItems) and finds the element each item flies from and back to (triggers, data-fluidbox-origin, the origin adapter for virtualized grids, reveal on close).
---

# Items and origins

Fluidbox keeps two things apart. The **items** say what the viewer can show. The **origins** say where each item sits on the page, so the opening flight can start there and the closing flight can land there.

## Items

An item is a plain object: `{ type: "img", src, alt, width, height }`, a `video`, an `iframe`, or `custom` content. [Media types](./media.md) covers every field. Each item is known by its `id`, which defaults to its `src`; `idOf(item)` from the package root gives it. Ids are what events report and what triggers register, so they must be unique in a list. Commands and triggers take the item itself, its index or its id; an item is matched by its id, so a fresh copy of it works too.

The viewer takes its items as an array or as a lazy list: the `items` option of `createFluidbox`, the `items` prop of each framework root, or the `items` property of `<fluidbox-gallery>`.

### Arrays

For a list you already have in memory, pass the array:

```ts
import { createFluidbox } from "@ogdakke/fluidbox";

const fluidbox = createFluidbox({ items: photos });
```

The viewer copies the array, so later changes to `photos` don't reach it. It throws a `TypeError` for an item with neither an `id` nor a `src`, and for a duplicate id. An empty array is a valid, empty gallery.

### Lazy lists

When the items come from a database, an API or a formula, describe them by index and make each one on demand, `FluidboxItemList`:

```ts
interface FluidboxItemList<TItem> {
  readonly count: number;
  get(index: number): TItem;
  indexOf?(id: string): number;
}
```

- `count` is a non-negative integer. The viewer throws a `RangeError` otherwise.
- `get(index)` returns the item at an index from `0` to `count - 1`, synchronously, and the same item each time.
- `indexOf(id)` returns the index of an id, or `-1`. Without it, ids are found by calling `get` for each index in turn, so give a long list an `indexOf`.
- A list is a snapshot. To change it, make a new one and pass it in. Don't change one the viewer holds.

```ts
import type { FluidboxImageItem, FluidboxItemList } from "@ogdakke/fluidbox";

const count = 1000;

export const library: FluidboxItemList<FluidboxImageItem> = {
  count,
  get: (index) => ({
    type: "img",
    id: `photo-${index}`,
    src: `/photos/${index}.jpg`,
    alt: `Photo ${index + 1}`,
    width: 1600,
    height: 1200,
    thumbnail: { src: `/photos/${index}-thumb.jpg`, width: 320, height: 240 },
  }),
  indexOf(id) {
    const index = Number(id.replace("photo-", ""));
    return Number.isInteger(index) && index >= 0 && index < count ? index : -1;
  },
};
```

The viewer asks for items only as it needs them: the slides near the current one, and the filmstrip thumbnails in view. A lazy list keeps its ids unique itself; only arrays are checked. Render triggers for the items you show, such as the rows of a virtual list. The viewer can still open, and swipe through, every item.

### Replacing the items

Pass new items with `fluidbox.setItems(items)`, a new `items` prop in a framework, or a new `items` property on the gallery. While the viewer is open:

- If the current item's id is still in the new list, the viewer stays on it, even if its index moved.
- If it isn't, the viewer moves to the item now at the same index, or the last one.
- If the new list is empty, the viewer closes.

A move fires `itemchange` and `settle` with the reason `"items"`. A command still running when the items change resolves `false`.

## Origins

An origin is where an item lives on the page, `FluidboxOrigin<TItem>`:

| Field             | Type                                   | What it does                                                                               |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `trigger`         | `HTMLElement`                          | The element that opens the item. Focus returns here when the viewer closes.                |
| `visual`          | `HTMLElement`                          | The box the flight starts and ends on. Its size, crop and corner radius are copied.        |
| `thumbnail`       | `HTMLImageElement`                     | Optional. An image already loaded on the page, shown while the full media loads.           |
| `onPreviewChange` | `(item: TItem, index: number) => void` | Optional. Called before the closing flight measures the origin, with the item it lands on. |

You rarely build one by hand. Every trigger (`fluidbox.bind`, the framework `Trigger` parts, the `[slot="trigger"]` child of `<fluidbox-item>`) makes its element the origin of its items while it is bound.

### Which element the flight uses

For a trigger, the viewer picks the visual in this order:

1. The trigger itself or a descendant, marked `data-fluidbox-origin`.
2. The trigger itself if it is an `<img>` or `<video>`, else its first `<img>` or `<video>`.
3. The trigger.

The flight's thumbnail is the visual if it is an `<img>`, else the first `<img>` inside it. Mark the element that clips the picture. If a rounded wrapper crops a square image, mark the wrapper, or the flight lands with square corners:

```html
<button type="button" class="card">
  <span data-fluidbox-origin class="card-photo">
    <img src="/shoe-thumb.jpg" alt="Coral running shoe" />
  </span>
  <span>Coral runner, €120</span>
</button>
```

[Rich origins](./patterns/origins.md) has this card in every framework.

### No origin

The closing flight needs an origin that is in the document and visible: inside the window and every scrolling ancestor. Without one, the viewer shrinks the picture a little and fades it out where it is. With `prefers-reduced-motion: reduce`, the viewer opens and closes without flights at all.

### Several items, one origin

One element can stand for several items, such as an album cover with a "+4" badge. The trigger opens its own item, and `returns` lists the rest that may close back onto it: `returns` in `fluidbox.bind`, on the framework triggers (`fluidboxReturns` in Angular), and `returns="b c"` on a `<fluidbox-item>`. `returns` may hold the trigger's own item too, so a whole album works as is. Its `onPreviewChange` runs before the closing flight measures it, so the cover can show the item it lands on:

```ts
fluidbox.bind(cover, "dune", {
  returns: ["canyon", "coast"],
  onPreviewChange(item) {
    coverImage.src = item.thumbnail?.src ?? coverImage.src;
  },
});
```

An origin bound for one id wins over one bound for several. Both win over the adapter below. [One trigger for an album](./patterns/overlay.md) shows a cover whose image follows the selection.

## The origin adapter

Triggers cover items that have a bound element. For the rest, as in a virtualized grid that recycles its rows, give the viewer an `origins` adapter, `FluidboxOriginAdapter`:

```ts
interface FluidboxOriginAdapter<TItem extends FluidboxItem = FluidboxItem> {
  getOrigin(id: string): FluidboxOrigin<TItem> | null;
  revealOrigin?(
    id: string,
    index: number,
    context: { signal: AbortSignal; phase: "open" | "selection" },
  ): void | Promise<void>;
}
```

`getOrigin` is called whenever the viewer needs the origin of an item no trigger is bound to. Return `null` when the item isn't on the page. A virtualizer may reuse a node for another item, so look the element up by id each time rather than caching it.

```ts
import { createFluidbox } from "@ogdakke/fluidbox";

const fluidbox = createFluidbox({
  items: library,
  origins: {
    getOrigin(id) {
      const button = grid.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
      const image = button?.querySelector("img");
      return button && image ? { trigger: button, visual: image, thumbnail: image } : null;
    },
  },
});
```

The framework roots take the same object as an `origins` prop, and `<fluidbox-gallery>` as its `origins` property. They read the newest one on each call, so changing it doesn't rebuild the viewer.

### Reveal on close

The viewer brings the current item's origin into view, so the closing flight has somewhere to land. It does this after the viewer opens, each time the selection settles, and when it closes on an item it hasn't revealed yet.

Without `revealOrigin`, the viewer scrolls the item's origin (its bound trigger, or the one `getOrigin` returns) into view, to the nearest edge, in every scrolling ancestor. In a horizontal scroller this means the strip follows the viewer, and the flight lands on the right thumbnail.

With `revealOrigin`, you do the scrolling. Scroll a virtual list to the item's row so its trigger mounts:

```ts
import type { FluidboxOriginAdapter } from "@ogdakke/fluidbox";

const origins: FluidboxOriginAdapter = {
  getOrigin,
  async revealOrigin(id, index, { signal }) {
    virtualizer.scrollToIndex(index, { align: "auto" });
    await mounted(id, signal);
  },
};
```

- `phase` is `"open"` after an opening and `"selection"` after a move.
- The viewer's motion never waits for the promise. When it resolves, the viewer hides the item's thumbnail on the page, so the picture doesn't show twice.
- `signal` aborts when the selection moves on, the viewer closes, the items change or the fluidbox is destroyed. Check it before late work.
- Errors thrown here are ignored.

## Custom elements

A `<fluidbox-gallery>` builds its items from its `<fluidbox-item>` children. For an array or a lazy list made in JavaScript, set `gallery.items` instead, and mark any element inside the gallery with `data-fluidbox-item-id` to make it a trigger for that item:

```ts
import "@ogdakke/fluidbox/elements";
import { library } from "./library";

const gallery = document.querySelector("fluidbox-gallery")!;
gallery.items = library;

for (let index = 0; index < 12; index++) {
  const item = library.get(index);
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.fluidboxItemId = item.id!;
  button.append(Object.assign(new Image(), { src: item.thumbnail!.src, alt: "" }));
  gallery.append(button);
}
```

With `items` set, the gallery ignores its `<fluidbox-item>` children. See [Custom elements](./custom-elements.md).
