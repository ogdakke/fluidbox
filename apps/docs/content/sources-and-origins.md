---
title: Sources and origins
section: Guides
order: 3
---

# Sources and origins

Fluidbox separates **what** a gallery contains from **where** its thumbnails are. A source describes items by index; an origin adapter finds the element each item flies from and lands on.

## Sources

A `LightboxSource` is synchronous metadata. It never holds DOM nodes or framework children.

```ts
import type { LightboxSource } from "@ogdakke/fluidbox";

const source: LightboxSource = {
  count: photos.length,
  getItem(index) {
    const photo = photos[index]!;
    return {
      id: photo.id,
      media: {
        type: "image",
        src: photo.full,
        alt: photo.alt,
        width: photo.width,
        height: photo.height,
      },
      thumbnail: { src: photo.thumb, width: 480, height: 320 },
      caption: photo.caption,
    };
  },
  getIndex(id) {
    return indexById.get(id) ?? null;
  },
};
```

For in-memory lists, `arraySource(items)` builds the same shape. It copies the array, indexes IDs once, and throws on empty or duplicate IDs.

- IDs are non-empty and unique within a source.
- `getItem()` throws `RangeError` for an invalid index; `getIndex()` returns `null` for an unknown ID.
- Treat a source as an immutable snapshot. Replace it with `controller.setSource(next)`; the active item is kept when its ID survives.

## Origins

The origin adapter answers "which element is item `id` right now?"

```ts
const origins: LightboxOriginAdapter = {
  getOrigin(id) {
    const trigger = mounted.get(id);
    if (!trigger?.isConnected) return null;
    return {
      trigger, // activation and focus return
      visual: trigger.querySelector("[data-lightbox-origin]") ?? trigger, // geometry and corner radius
      thumbnail: trigger.querySelector("img") ?? undefined, // decoded preview while the full image loads
    };
  },
};
```

| Field                       | Purpose                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `trigger`                   | The interactive element. Receives focus when the viewer closes.                       |
| `visual`                    | The visible, clipped box. Flights start and end on its rectangle and `border-radius`. |
| `thumbnail`                 | An optional decoded image shown while the full media loads.                           |
| `prepareClose(item, index)` | Optional. Update an authored preview right before the close target is measured.       |

Pick the element that actually clips the image as `visual`. If a rounded wrapper clips a square image, the wrapper is the visual; pointing at the bare `<img>` would land with square corners.

## Large collections

With an indexed source, a page can hold a million items and mount twelve thumbnails. The viewer renders a small window of slides around the active one, and the filmstrip virtualizes itself.

On a custom-element gallery, assign the source and adapter as properties:

```ts
const gallery = document.querySelector<AppGallery>("app-gallery")!;
gallery.source = source;
gallery.origins = origins;
gallery.open({ index: 49_999 });
```

## Virtualized hosts

When the host grid is virtualized, the selected item's thumbnail may not be mounted. Implement `revealOrigin` to scroll the grid so it is:

```ts
const origins: LightboxOriginAdapter = {
  getOrigin,
  revealOrigin(id, index, { signal }) {
    virtualizer.scrollToIndex(rowFor(index), { align: "center" });
    return waitForMounted(id, signal);
  },
};
```

- The runtime calls it after capturing the opening pose and whenever navigation settles. Reasons are `open` and `selection`.
- Motion never waits for it. A newer selection, source replacement, close, or teardown aborts the signal; check `signal.aborted` before deferred work.
- Re-check identity on every lookup. A virtualizer may recycle a node for a different item.

```ts
function register(id: string, element: HTMLElement) {
  element.dataset.photoId = id;
  mounted.set(id, element);
  return () => {
    if (mounted.get(id) === element) mounted.delete(id);
  };
}
```

If no usable origin is mounted and visible when the viewer closes, it falls back to a scale-and-fade and returns focus to the gallery.

## Grouped origins

One element can stand in for several items, such as a cover card that represents a whole album:

```ts
const dispose = controller.registerOrigin(
  photos.map((photo) => photo.id),
  {
    trigger: card,
    visual: preview,
    thumbnail: preview,
    prepareClose(item) {
      preview.src = item.thumbnail?.src ?? "";
    },
  },
);
```

A matching single-item origin wins over a grouped one. In React, `Lightbox.Trigger` with `items` does this for you; see [React](./react.md).
