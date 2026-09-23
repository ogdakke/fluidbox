# Virtualized host integrations

Fluidbox owns the open viewer's slide window and filmstrip. The application owns its thumbnail grid and chooses its virtualizer. A host may use TanStack Virtual or another library without making it a Fluidbox runtime dependency.

The first external-library pilot is `/photo-library.html` on the main playground server, using [TanStack Virtual's React adapter](https://tanstack.com/virtual/latest/docs/framework/react/react-virtual). It defaults to 10,000 items; `?count=100000` selects the stress dataset. The lockfile pins the tested TanStack dependency, and `tests/browser/photo-library.spec.ts` records the integration scenarios. A second independent implementation, such as [React Virtuoso Grid](https://virtuoso.dev/react-virtuoso/), is planned before making a broad compatibility claim. Listing a library here is not certification of every version or layout mode.

## Photo-library example

Open the “Photo library” link from the playground, or use `/photo-library.html` on the same local/Portless origin. The host is React with TanStack Virtual; the rest of the playground remains vanilla JavaScript.

The example has date sections, responsive fixed-height virtual rows, three-row overscan, and lazy thumbnails. Its controls jump the host grid, open an item by number, reveal the last viewed item after close, and enable/disable the filmstrip for the next opening. The source object stays stable while the grid mounts and unmounts thumbnails.

Assets are repeated local SVG illustrations with landscape, portrait, and square dimensions. This is a deterministic geometry/lifecycle fixture, not photographic decode or transfer evidence. A varied-photo dataset and resource measurements remain separate benchmark work.

## Current public contract

Use `LightboxGallerySource` and a gallery element or the existing framework binding. The composed framework APIs and controller in ROADMAP.md are still proposed.

- `count` is the full source count, not the number of mounted thumbnails.
- `getItem(index)` synchronously returns image metadata with a stable, unique ID. Keep metadata lookup independent of DOM mounting and avoid scanning every item during a scroll or navigation.
- `getOrigin(id)` returns the currently mounted matching origin, or `null`. Recheck identity and connection on each lookup; a cached element reference may now represent a different item.
- `revealOrigin(id, index, { signal, reason })` optionally asks the host to scroll or mount the selected item. Reasons are `open` and `selection`. It may return a promise, but viewer motion never waits for it. Check the abort signal before deferred work changes the host.
- Mount only the host virtualizer's visible/overscan range. Fluidbox resolves source items even when their thumbnails are absent.
- Keep the source object, count, IDs, and metadata stable while open. Live insertion/removal/reordering and asynchronous metadata lookup are not supported by the current contract. Fetch data separately and update while closed until the planned snapshot-update API exists.

The gallery uses a persistent controller independent of thumbnail mounting. A missing image origin uses a scale-and-fade transition. Closing returns focus to the selected origin if available, or to the gallery fallback. The host should keep that gallery mounted for the session lifetime.

## Register origins by identity

The host owns registration and unregistration. Do not assume a virtualizer always destroys a node when its item changes. This framework-independent pattern guards against recycled nodes and stale cleanup:

```ts
const origins = new Map<string, HTMLElement>();

function registerOrigin(id: string, element: HTMLElement) {
  element.dataset.photoId = id;
  origins.set(id, element);
  return () => {
    if (origins.get(id) === element) origins.delete(id);
  };
}

function getOrigin(id: string) {
  const element = origins.get(id);
  return element?.isConnected && element.dataset.photoId === id ? element : null;
}
```

For a card whose visible crop and corners come from a wrapper, mark that wrapper with `data-lightbox-preview`. Use `data-lightbox-target` for a more precise nested visual target. The origin is still the interactive trigger for focus; the marked visual box supplies handoff geometry and radii while the child image supplies media. This avoids guessing which ancestor provides clipping.

Use the virtualizer's stable item-key API and the framework's own mounting/ref lifecycle to call registration and cleanup. A button containing an image can be the origin; without an explicit visual marker, its descendant image supplies transition geometry. Retaining a thumbnail registration must not retain every unmounted DOM node.

## Scrolling and focus ownership

Opening the lightbox must not replace the host grid or reset its scroll position. The modal keeps background interaction inert. To test recycling while open, change the host's virtual window programmatically rather than disabling modal isolation.

The photo-library example follows the selected item in the background, including distant filmstrip navigation. The runtime calls `revealOrigin` after capturing the opening pose and when navigation settles. The application uses its virtualizer's scrolling API and may resolve its promise when the matching origin is mounted. A newer selection aborts previous work immediately, even before that selection settles. Source replacement, close, and teardown also abort it. Host code must honor the signal; the runtime cannot undo arbitrary work performed by a callback.

Without a custom hook, indexed galleries scroll a mounted matching origin into view through its native scroll ancestors. A virtualized host needs the hook to mount an absent origin. Before closing, the runtime resolves the current origin again instead of retaining its pre-scroll rectangle. A node clipped outside the viewport or a scroll container cannot supply a useful close target.

Closing never waits for an asynchronous reveal. It cancels pending reveal work and uses an available matching target, or immediately starts the fallback transition with usable focus.

Verify that a revealed selected item receives focus after close and that the host remains at that item. If reveal fails, verify that the fallback gallery can receive focus and that keyboard users can return to the visible grid. A test that only asserts the dialog disappeared misses these integration failures.

## Integration scenarios

Run these against actual virtualizer implementations and public Fluidbox APIs:

| Scenario                                        | Required assertion                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Deep scroll, then open a visible image          | Correct stable ID and thumbnail opening geometry; bounded host DOM                                                  |
| Navigate past the host's mounted range          | Correct viewer selection without mounting the full host collection                                                  |
| Programmatically move the host range while open | Origins unregister; closing never targets a node now representing another item                                      |
| Close with selected origin initially absent     | Proactive reveal mounts matching target when possible; close never waits and otherwise falls back with usable focus |
| Distant filmstrip selection                     | Host virtualizer follows selection and registers the matching origin; stale reveal work cannot move it back         |
| Change responsive column count                  | Visible range remains valid, item IDs still match registrations, layout stays bounded                               |
| Jump near either end at 10k and 100k items      | Correct range/selection without blank end-of-track states or total-DOM growth proportional to count                 |
| Repeat open/navigate/close                      | Host and viewer DOM return to expected bounds; no orphan portal or persistent inert state                           |
| Strict Mode/remount                             | Framework refs and source binding cleanup do not leave stale registrations or active viewers                        |

Measure host rendering and viewer rendering separately. Deterministic synthetic assets test geometry and lifecycle, but do not establish photographic decode cost, real transfer volume, or low-memory-device behavior. Record dataset, candidate sizes, browser, hardware, and raw samples for those benchmarks.

## Scope of compatibility

Initial evidence covers a known-count, stable source with bounded virtual rows. Unknown-length pagination, masonry measurement, window-scrolling hosts, source mutation while open, and each framework's renderer ownership need their own scenarios. Do not infer those guarantees from one passing grid example.
