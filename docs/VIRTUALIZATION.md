# Virtualized host integrations

Fluidbox owns the open viewer's slide window and thumbnails. The application owns its thumbnail grid and chooses its virtualizer. A host may use TanStack Virtual or another library without making it a Fluidbox runtime dependency.

The first external-library pilot is `/photo-library.html` on the main playground server, using [TanStack Virtual's React adapter](https://tanstack.com/virtual/latest/docs/framework/react/react-virtual). It defaults to 10,000 items; `?count=100000` selects the stress dataset. The lockfile pins the tested TanStack dependency, and `tests/browser/photo-library.spec.ts` records the integration scenarios. A second independent implementation, such as [React Virtuoso Grid](https://virtuoso.dev/react-virtuoso/), is planned before making a broad compatibility claim. Listing a library here is not certification of every version or layout mode.

## Photo-library example

Open the “Photo library” link from the playground, or use `/photo-library.html` on the same local/Portless origin. The host is React with TanStack Virtual; the rest of the playground remains vanilla JavaScript.

The example has date sections, responsive fixed-height virtual rows, three-row overscan, and lazy thumbnails. Its controls jump the host grid, open an item by number, reveal the last viewed item after close, and turn the thumbnails on or off for the next opening. The item list stays stable while the grid mounts and unmounts thumbnails.

Assets are repeated local SVG illustrations with landscape, portrait, and square dimensions. This is a deterministic geometry/lifecycle fixture, not photographic decode or transfer evidence. A varied-photo dataset and resource measurements remain separate benchmark work.

## Current public contract

Give `createFluidbox()`, or a framework `Root`, a lazy item list. The photo-library example uses
the React binding's `Root`, `Trigger`, `Viewer` and `Thumbnails` over
`createItemList({ count, item, index })`; it registers no custom elements.

- `count` is the full item count, not the number of mounted thumbnails.
- `get(index)` synchronously returns the item, with a stable, unique id. Keep item lookup
  independent of DOM mounting, and avoid scanning on every scroll or move: give the list an
  `indexOf(id)` (`createItemList`'s `index` option), since without one ids are found by scanning.
- Bind mounted thumbnails with `fluidbox.bind(element, id)` or a framework `Trigger`. For an item
  whose trigger isn't bound, `findTrigger(item, index)` returns the mounted element, or null.
  Recheck identity and connection on each call: a cached element may now show another item.
- `revealTrigger(item, index, { signal, phase })` optionally asks the host to scroll to or mount
  the item. `phase` is `open` before the opening flight and `selection` as the viewer moves. It
  may return a promise, but the viewer's motion never waits for it. Check the signal before
  deferred work changes the host.
- Mount only the virtualizer's visible and overscan range. Fluidbox reads items whether or not
  their thumbnails exist.
- Treat each list as a snapshot. `fluidbox.setItems(list)` supports insertion, removal and
  reordering while open, keeping the open id when it survives. A list that grows as the viewer
  nears its end appends with `setItems(list.withCount(total))` on `reachend`, which keeps the
  items already made and the open slides. Asynchronous item lookup and mutating a list in place
  are outside the contract.

The fluidbox persists independently of thumbnail mounting. A missing origin uses a scale-and-fade
flight. Closing returns focus to the item's trigger when it is mounted, then to the opening
trigger's retained focusable ancestor. Hosts that need a different fallback must keep a focus
target mounted for the session.

## Find triggers by identity

The host owns registration and cleanup. Don't assume a virtualizer destroys a node when its item
changes. The photo library registers each tile in a ref callback and checks the id again on
lookup, which guards against recycled nodes and stale cleanup (`apps/examples/src/demos/photo-library.tsx`):

```tsx
const findTrigger = useCallback((photo: PhotoItem) => {
  const element = origins.current.get(photo.id);
  return element?.isConnected && element.dataset.photoId === photo.id ? element : null;
}, []);
```

```tsx
ref={(node) => {
  if (!node) return;
  origins.current.set(photo.id, node);
  return () => {
    if (origins.current.get(photo.id) === node) origins.current.delete(photo.id);
  };
}}
```

For a card whose visible crop and corners come from a wrapper, mark that wrapper
`data-fluidbox-origin`: the flight starts and ends on its box and radii, while the image inside
it supplies the media. The photo library marks the tile button itself. Without a marker, the
trigger's image, video or live `<model-viewer>` is the flight's box. Retaining a registration
must not retain every unmounted DOM node.

## Scrolling and focus ownership

Opening the lightbox must not replace the host grid or reset its scroll position. The modal keeps background interaction inert. To test recycling while open, change the host's virtual window programmatically rather than disabling modal isolation.

The photo-library example follows the selected item in the background, including distant thumbnails navigation. The runtime calls `revealTrigger` after capturing the opening pose and when a move settles. The application uses its virtualizer's scrolling API and may resolve its promise when the matching origin is mounted. A newer selection aborts previous work immediately, even before that selection settles. `setItems`, close, and teardown also abort it. Host code must honor the signal; the runtime cannot undo arbitrary work performed by a callback.

Without a custom hook, the viewer scrolls a mounted matching origin into view through its native scroll ancestors. A virtualized host needs the hook to mount an absent origin. Before closing, the runtime finds the current trigger again instead of retaining its pre-scroll rectangle. A node clipped outside the viewport or a scroll container cannot supply a useful close target.

Closing never waits for an asynchronous reveal. It cancels pending reveal work and uses an available matching target, or immediately starts the fallback transition with usable focus.

Verify that a revealed selected item receives focus after close and that the host remains at that item. If reveal fails, verify that the fallback gallery can receive focus and that keyboard users can return to the visible grid. A test that only asserts the dialog disappeared misses these integration failures.

## Integration scenarios

Run these against actual virtualizer implementations and public Fluidbox APIs:

| Scenario                                        | Required assertion                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Deep scroll, then open a visible image          | Correct stable ID and thumbnail opening geometry; bounded host DOM                                                  |
| Navigate past the host's mounted range          | Correct viewer selection without mounting the full host collection                                                  |
| Programmatically move the host range while open | Triggers unregister; closing never targets a node now representing another item                                     |
| Close with selected origin initially absent     | Proactive reveal mounts matching target when possible; close never waits and otherwise falls back with usable focus |
| Distant thumbnails selection                    | Host virtualizer follows selection and registers the matching origin; stale reveal work cannot move it back         |
| Change responsive column count                  | Visible range remains valid, item IDs still match registrations, layout stays bounded                               |
| Jump near either end at 10k and 100k items      | Correct range/selection without blank end-of-track states or total-DOM growth proportional to count                 |
| Repeat open/navigate/close                      | Host and viewer DOM return to expected bounds; no orphan viewer layer or persistent inert state                     |
| Strict Mode/remount                             | Framework refs and binding cleanup do not leave stale registrations or active viewers                               |

Measure host rendering and viewer rendering separately. Deterministic synthetic assets test geometry and lifecycle, but do not establish photographic decode cost, real transfer volume, or low-memory-device behavior. Record dataset, candidate sizes, browser, hardware, and raw samples for those benchmarks.

## Scope of compatibility

Initial evidence covers a known-count, stable item list with bounded virtual rows. Unknown-length pagination, masonry measurement, window-scrolling hosts, list mutation while open, and each framework's renderer ownership need their own scenarios. Do not infer those guarantees from one passing grid example.
