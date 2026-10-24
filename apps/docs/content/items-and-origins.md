---
title: Items and origins
section: Guides
order: 3
description: How fluidbox takes a collection (arrays, lazy lists of any size, setItems) and finds the element each item flies from and back to (triggers, data-fluidbox-origin, the origin adapter for virtualized grids, reveal on close).
---

# Items and origins

Fluidbox keeps two things apart. The **items** say what the viewer can show. The **origins** say where each item sits on the page, so the opening flight can start there and the closing flight can land there.

## Items

An item is a plain object: `{ type: "img", src, alt, width, height }`, a `video`, an `iframe`, or `custom` content. [Media types](./media.md) covers every field. Each item is known by its `id`, which defaults to its `src`. `idOf(item)` from the package root returns it. Events report ids and triggers register them, so they must be unique in a list. Commands and triggers take the item itself, its index or its id. The viewer matches an item by its id, so a fresh copy of it works too.

The viewer takes its items as an array or as a lazy list. Pass them as the `items` option of `createFluidbox`, the `items` prop of each framework root, or the `items` property of `<fluidbox-gallery>`.

### Arrays

For a list you already have in memory, pass the array:

```ts
import { createFluidbox } from "@ogdakke/fluidbox";

const fluidbox = createFluidbox({ items: photos });
```

The viewer copies the array, so later changes to `photos` don't reach it. It throws a `TypeError` for an item with neither an `id` nor a `src`, and for two items with the same `id` of their own. Items without an `id` may share a `src`, as product media that shows one photo twice: the first is known by its `src`, the next by `src#2`, then `src#3`, counted in order and skipping ids items name themselves by. Such an id depends on the item's place in the array, so a copy of a later one names the first; target it by index, or give it an `id`. An empty array is a valid, empty gallery.

### Lazy lists

When the items come from a database, an API or a formula, make a lazy list with `createItemList`. You give it a count and a function that makes the item at an index.

```ts
import { createItemList } from "@ogdakke/fluidbox";

export const library = createItemList({
  count: 1000,
  item: (index) => ({
    type: "img",
    id: `photo-${index}`,
    src: `/photos/${index}.jpg`,
    alt: `Photo ${index + 1}`,
    width: 1600,
    height: 1200,
    thumbnail: { src: `/photos/${index}-thumb.jpg`, width: 320, height: 240 },
  }),
  index: (id) => Number(id.slice("photo-".length)),
});
```

- `item(index)` runs once per index. The list keeps what it returns, so `state.item` and every event get the same object for the same item, and your effects and memos keyed on it don't run again.
- `index(id)` says where an id is, and it can be a rough guess. The list ignores an index out of range, and an index whose item has a different id, so `"photo-01"` and `"photo-x"` find nothing. Leave it out and the list scans for ids, which is fine for a few hundred items and slow for a hundred thousand.
- The list is a snapshot. To change the items, make a new list and pass it in.

`createItemList` returns a plain `FluidboxItemList`. You can also write one yourself, when you need control the factory doesn't give:

```ts
interface FluidboxItemList<TItem> {
  readonly count: number;
  get(index: number): TItem;
  indexOf?(id: string): number;
}
```

- `count` is a non-negative integer. The viewer throws a `RangeError` otherwise.
- `get(index)` returns the item at an index from `0` to `count - 1`, synchronously, and the same object each time.
- `indexOf(id)` returns the index of an id, or `-1`. Without it, the viewer finds an id by calling `get` for each index in turn.
- Don't change a list the viewer holds.

The viewer asks for items only as it needs them: the slides near the current one, and the thumbnails in view. The viewer checks only arrays for duplicate ids, so a lazy list has to keep its own ids unique. Render triggers for the items you show, such as the rows of a virtual list. The viewer can still open, and swipe through, every item.

### Replacing the items

Pass new items with `fluidbox.setItems(items)`, a new `items` prop in a framework, or a new `items` property on the gallery. While the viewer is open:

- If the current item's id is still in the new list, the viewer stays on it, even if its index moved.
- If it isn't, the viewer moves to the item now at the same index, or the last one.
- If the new list is empty, the viewer closes.

A move fires `itemchange` and `settle` with the reason `"items"`. A command still running when the items change resolves `false`.

Items equal to the current ones change nothing: an array whose items match the current ones in order, field by field (`thumbnail`, `sources` and other plain objects and arrays by their contents). So a framework can pass `items={products.map(toItem)}` on every render without interrupting a move or reloading a slide; `setItems` resolves `false`. When the items do change, a slide whose item is unchanged stays, loaded, wherever its item moved to, and only the changed ones are made again. Swapping a product's variant keeps the photos the variants share. To change an item, pass a new object: one changed in place compares equal to itself.

## Origins

An origin is where an item lives on the page: the trigger that opens it, the visual the flight starts and ends on, and optionally a thumbnail already loaded on the page, shown while the full media loads. Focus returns to the trigger when the viewer closes.

You never build one by hand. Every trigger (`fluidbox.bind`, the framework `Trigger` parts, the `[slot="trigger"]` child of `<fluidbox-item>`) makes its element the origin of its items while it is bound, and `findTrigger` below finds the rest.

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

The closing flight needs an origin that is in the document and visible inside the window and every scrolling ancestor. Without one, the viewer shrinks the picture a little and fades it out where it is. With `prefers-reduced-motion: reduce`, the viewer opens and closes without flights at all.

### Several items, one origin

One element can stand for several items, such as an album cover with a "+4" badge. Give the trigger a list as its value: the first item opens, and every one may close back onto it. Pass the list to `fluidbox.bind`, or as `data-fluidbox-value="a b c"` in a `<fluidbox-gallery>` with `items`. The bind option `onPreviewChange` runs before the closing flight measures the trigger, so the cover can show the item it lands on:

```ts
fluidbox.bind(cover, ["dune", "canyon", "coast"], {
  onPreviewChange(item) {
    coverImage.src = item.thumbnail?.src ?? coverImage.src;
  },
});
```

A trigger bound for one id wins over one bound for several. Both win over `findTrigger` below. [One trigger for an album](./patterns/overlay.md) shows a cover whose image follows the selection.

## The origin adapter

Triggers cover items that have a bound element. For the rest, as in a virtualized grid that recycles its rows, give the viewer `findTrigger(item, index)`. It returns the item's trigger, or `null` when the item isn't on the page, and the viewer finds the visual and thumbnail inside it as it does for a bound trigger. A virtualizer may reuse a node for another item, so look the element up on each call instead of caching it.

```ts
import { createFluidbox } from "@ogdakke/fluidbox";

const fluidbox = createFluidbox({
  items: library,
  findTrigger: (item) => grid.querySelector<HTMLElement>(`[data-id="${CSS.escape(item.id!)}"]`),
});
```

The framework roots take the same functions as `findTrigger` and `revealTrigger` props, and `<fluidbox-gallery>` as properties. They read the newest ones on each call, so changing them doesn't rebuild the viewer.

### Reveal on close

The viewer brings the current item's trigger into view, so the closing flight has somewhere to land. It does this after the viewer opens, each time the selection settles, and when it closes on an item it hasn't revealed yet.

Without `revealTrigger`, the viewer scrolls the item's trigger into view, to the nearest edge, in every scrolling ancestor. That trigger is the bound one, or the one `findTrigger` returns. In a horizontal scroller the strip follows the viewer, so the flight lands on the right thumbnail.

With `revealTrigger(item, index, { signal, phase })`, you do the scrolling. Scroll a virtual list to the item's row so its trigger mounts:

```ts
const fluidbox = createFluidbox({
  items: library,
  findTrigger,
  async revealTrigger(item, index, { signal }) {
    virtualizer.scrollToIndex(index, { align: "auto" });
    await mounted(item.id!, signal);
  },
});
```

- `phase` is `"open"` after an opening and `"selection"` after a move.
- The viewer's motion never waits for the promise. When it resolves, the viewer hides the item's thumbnail on the page, so the picture doesn't show twice.
- `signal` aborts when the selection moves on, the viewer closes, the items change or the fluidbox is destroyed. Check it before late work.
- The viewer ignores errors thrown here.

## Custom elements

A `<fluidbox-gallery>` builds its items from its `<fluidbox-item>` children. For an array or a lazy list made in JavaScript, set `gallery.items` instead. Mark any element inside the gallery with `data-fluidbox-value` to make it a trigger for that item:

```ts
import "@ogdakke/fluidbox/elements";
import { library } from "./library";

const gallery = document.querySelector("fluidbox-gallery")!;
gallery.items = library;

for (let index = 0; index < 12; index++) {
  const item = library.get(index);
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.fluidboxValue = item.id!;
  button.append(Object.assign(new Image(), { src: item.thumbnail!.src, alt: "" }));
  gallery.append(button);
}
```

With `items` set, the gallery ignores its `<fluidbox-item>` children. See [Custom elements](./custom-elements.md).
