# Public API contract

This document is the implementation contract for the headless Fluidbox beta. The plain JavaScript
runtime and composed React binding described here are implemented. Solid, Vue, and Angular still
use compatibility adapters and are not part of the locked composed-binding contract yet.

## Package exports

`@ogdakke/fluidbox` is SSR-safe. Importing it does not read `window`, `document`, `HTMLElement`, or
register custom elements.

The stable headless root exports:

- `arraySource()` and the source, media, origin, controller, event, renderer, and overlay types in
  `src/public-api.ts`.
- `createLightbox()`. Calling it requires a DOM; importing it does not.

The existing `registerLightboxElements`, `bindGallerySource`, `AppGallery`, `AppLightbox`,
`LightboxGallerySource`, `LightboxSourceItem`, and `GalleryItem` exports are compatibility APIs.
They remain usable during migration, but their current class members and internal item shape are
not the headless contract. `@ogdakke/fluidbox/elements` remains the only eager custom-element
registration entry.

Framework bindings remain subpath exports. React is the first composed binding. Solid, Vue, and
Angular keep their current adapters until equivalent composed bindings pass their own ownership and
hydration tests.

`@ogdakke/fluidbox/styles.css` continues to provide behavior and default appearance during the
migration. A later split may add `structural.css` and `theme.css`; it will not remove `styles.css`
without a migration release.

## Source snapshots

`LightboxSource` is pure synchronous metadata. It never contains DOM nodes or framework children.
The runtime may load media asynchronously, but `count`, `getItem(index)`, and `getIndex(id)` are
synchronous for a source revision.

```ts
const source = arraySource([
  {
    id: "photo-1",
    media: {
      type: "image",
      src: "/full/photo-1.jpg",
      alt: "A footpath through tall grass",
      width: 2400,
      height: 1600,
      candidates: [
        { src: "/full/photo-1-1200.jpg", width: 1200 },
        { src: "/full/photo-1-2400.jpg", width: 2400 },
      ],
    },
    thumbnail: { src: "/thumb/photo-1.jpg", width: 480, height: 320 },
    caption: "Late summer",
  },
]);
```

IDs are non-empty and unique within a snapshot. `arraySource()` copies the input array, builds its ID
map once, and throws for an empty or duplicate item ID. An empty source is valid. `getItem()` throws
`RangeError` for an invalid index. `getIndex()` returns `null` when the ID is absent.

Image, video, iframe, and custom descriptors use the same bounded strip. A custom descriptor stores
a renderer key, never a React, Vue, Solid, or Angular node. Automated lifecycle checks cover mount,
eviction, teardown, native interaction ownership, and live-content close flight. Physical mobile
video/fullscreen behavior remains a release check.

`setSource(snapshot)` creates a new source revision. It preserves the active ID if present. If the ID
was removed, it selects the old index clamped to the new range. An empty source closes with reason
`source-empty`. Reordering preserves identity. Pending loads and origin reveals from the old revision
are aborted and cannot commit into the new revision.

Unknown-length sources, asynchronous metadata lookup, and mutation of a live snapshot are outside
the beta contract.

## Origins and virtualized hosts

DOM ownership is separate from source metadata. `LightboxOriginAdapter` resolves and reveals host
elements. `LightboxOrigin` names three roles explicitly:

| Field       | Purpose                                                              |
| ----------- | -------------------------------------------------------------------- |
| `trigger`   | Activation semantics and focus return                                |
| `visual`    | Visible clipped box, transition geometry, and corner radius          |
| `thumbnail` | Optional decoded preview while the selected media is becoming usable |

Composed `Item` and `Trigger` parts call `registerOrigin()`. Unregistering removes only the exact
registration represented by its returned disposer, so a stale virtualizer cleanup cannot remove a
new node for the same ID. A live registered origin takes precedence over `origins.getOrigin()`;
unregistering it exposes the adapter result again.

`revealOrigin(id, index, { signal, reason })` asks a host virtualizer to scroll or mount an origin.
The runtime calls it after the opening pose is captured and after selection settles. A new accepted
selection aborts the previous signal immediately, even before the new selection settles. Source
replacement, close, and destroy also abort it.

Viewer motion never waits for reveal. Close reads the current origin once and starts immediately. It
uses a connected origin that intersects the window and each clipping ancestor, or uses the fallback
transition and gallery focus target. Host callbacks must check `signal.aborted` before deferred
scrolling; the runtime cannot undo arbitrary host work performed after cancellation.

## Controller

The root package exports the plain runtime through the `CreateLightbox` signature:

```ts
const viewer = createLightbox({
  source,
  origins,
  portal: {
    mount({ target, controller, signal }) {
      const close = document.createElement("button");
      close.textContent = "Close";
      close.addEventListener("click", () => void controller.close(), { signal });
      target.append(close);
      return () => close.remove();
    },
  },
  onBeforeCommand(event) {
    if (event.command === "close" && formIsDirty) event.preventDefault();
  },
  onEvent(event) {
    analytics.record(event);
  },
});

const cancelPreparation = viewer.prepare({ id: "photo-1" });
await viewer.open({ id: "photo-1" });
cancelPreparation();
await viewer.next({ reason: "api" });
await viewer.close();
viewer.destroy();
```

`prepare(target)` is the optional pointer-down latency path. It synchronously validates the target,
mounts and measures a hidden portal, prepares the opening preview, and pauses the opening animations
at time zero. It does not publish state, hide the thumbnail, isolate the document, or claim active
viewer ownership. Its disposer cancels unused preparation; calling it after `open()` has consumed the
preparation is a no-op. Bindings should prepare only for a primary activation pointer and discard on
pointer cancellation. `open()` works identically without prior preparation.

Commands validate their target before returning a promise. An invalid or missing target throws
`RangeError`; a destroyed controller throws `InvalidStateError`. A valid command resolves only when
it settles or loses ownership:

| Result       | Meaning                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| `completed`  | The requested state settled; `changed` is false for an accepted no-op       |
| `superseded` | A newer incompatible command took ownership                                 |
| `prevented`  | `onBeforeCommand` synchronously prevented the application/user request      |
| `aborted`    | Its `AbortSignal`, source replacement, or destruction cancelled the command |

Repeated requests for the same pending destination share the pending operation. A newer
incompatible command resolves the earlier result as `superseded` and continues from the painted
pose. `destroy()` is synchronous and idempotent. It cannot be prevented and leaves no command
pending. An unexpected runtime or renderer failure rejects the command promise; it is not reported
as `aborted`, because cancellation and implementation failure require different recovery.

The default reason for direct controller calls is `api`. Runtime input uses `trigger`, `keyboard`,
`pointer`, `wheel`, or `filmstrip`. Source reconciliation uses `source-update`, `source-empty`, or
`teardown`.

### State and event order

`controller.state` is an immutable snapshot. `subscribe(listener)` calls the listener only after a
new snapshot commits and returns an idempotent disposer. State publishes discrete semantic changes;
per-frame gesture and transition values stay in CSS variables.

For an accepted open or navigation, event order is:

1. `onBeforeCommand` runs synchronously and may prevent the request.
2. `open-request` or `change-request` is emitted.
3. Requested ID/index enters state.
4. `selection-change` is emitted when the active identity commits.
5. `selection-settle` is emitted after navigation and reveal scheduling settle.
6. The command resolves `completed`.

Status changes emit `status-change`. Opening changes `closed → opening → open`; closing changes
`open → closing → closed`. Reversal changes direction from the current painted pose and supersedes
the incompatible pending command. A prevented command emits no request or state event. A completed
no-op emits its request but no selection or status event.

## Renderer ownership

The runtime owns the body portal, measured frame, transforms, clipping, native slide track, gesture
surfaces, focus containment, inert background, and accessibility status. Applications own controls,
captions, thumbnail decorations, and every framework-created descendant.

An indexed `LightboxSource` is also the gallery API. The runtime renders a bounded native-scrolling
window around the active item, so callers do not create a second gallery object or mount every item.

`LightboxOptions.portal` mounts application controls and captions once into a stable target inside the
body portal. It receives the controller and a lifetime signal and may return an idempotent disposer.
The runtime calls the disposer before removing the target. Plain JavaScript appends DOM there; React,
Vue, Solid, and Angular bindings use their native portal or teleport mechanism.

`LightboxRenderer.mount()` receives a stable target, item, index, and abort signal. It may return a
disposer. The adapter invokes the disposer before removing the target. Framework adapters use their
native portal/teleport mechanism; the runtime never manually reparents a framework-owned node.

Custom content can be evicted outside the bounded slide window. Eviction disposes it, and revisiting
may mount a new instance. Persisted component state belongs in application state unless a later
bounded retention policy explicitly says otherwise.

## Thumbnail overlays

`ThumbnailOverlay` is the composed part for a badge, play icon, count, caption, or other content over
a thumbnail. The plain controller uses `registerThumbnailOverlay()`.

Two behaviors are supported:

- `host` keeps the overlay on its thumbnail card. The runtime publishes phase/progress to its element
  so it can hide or transform while the viewer moves.
- `travel` renders an application-owned copy into a runtime transition target. It requires a
  renderer. This supports content that follows the image without moving framework-owned DOM.

The overlay target exposes `data-lightbox-phase="preview|opening|open|dragging|closing"` and
`--lightbox-progress`, where `1` is the preview pose and `0` is fully open. This supports both
immediate and continuous behavior:

```css
.photo-badge {
  opacity: var(--lightbox-progress, 1);
}

.photo-caption[data-lightbox-phase="opening"] {
  visibility: hidden;
}
```

Progress reverses from its painted value when motion reverses. Framework state does not update per
frame. Overlay content is non-interactive during flight by default. A host overlay keeps the
semantics it had on the card; decorative content should use `aria-hidden="true"`.

If virtualization unmounts the source card, its origin and host overlay unregister. A mounted travel
renderer may finish the active transition, but closing uses the newly resolved selected origin or
the fallback. Selecting another item disposes the old traveling renderer once it no longer paints.

## React composition

The first composed React contract is:

```tsx
<Lightbox.Root source={source} origins={origins}>
  <Lightbox.Item id="photo-1">
    <Lightbox.Trigger asChild>
      <button>
        <img src="/thumb/photo-1.jpg" alt="A footpath through tall grass" />
        <Lightbox.ThumbnailOverlay behavior="host" className="photo-badge">
          1 of 20
        </Lightbox.ThumbnailOverlay>
      </button>
    </Lightbox.Trigger>
  </Lightbox.Item>

  <Lightbox.Portal>
    <Lightbox.Content />
    <Lightbox.Previous>Previous</Lightbox.Previous>
    <Lightbox.Next>Next</Lightbox.Next>
    <Lightbox.Close>Close</Lightbox.Close>
  </Lightbox.Portal>
</Lightbox.Root>
```

`useLightbox()` returns stable controller commands. `useLightboxState(selector)` uses stable external
store snapshots. `asChild` accepts one element, composes its ref and event handler, and does not run
the part action when the consumer prevents the event. `Previous` and `Next` expose native disabled
state at finite ends.

Controlled `open` and `activeId` props are intentionally absent from the first locked React surface.
They will be added only after delayed acceptance, rejection, interrupted motion, and teardown tests
define their callback order. The controller and source replacement APIs cover the initial beta.

## Public styling hooks

The supported public selectors during migration are the parts listed in `LIGHTBOX.md`: trigger,
preview, target, overlay, container, backdrop, dialog, slides, slide, frame, media, content, close,
filmstrip, filmstrip item, transition layer, and transition content. `data-lightbox-state`,
`data-lightbox-phase`, `data-open`, `data-closed`, `data-starting-style`, `data-ending-style`,
`data-dragging`, `data-dismissing`, `data-zoomed`, `aria-hidden`, and `aria-selected` are public state
hooks where that document lists them.

The documented custom properties in `LIGHTBOX.md` are public with their listed owner, units, and
lifetime. Undocumented generated nodes, attributes, inline properties, class names, and internal
CSS variables are not extension points. Required geometry, scrolling, clipping, touch behavior,
focus visibility, and modal isolation remain structural behavior even when appearance is replaced.

## Compatibility and versioning

`createLightbox()` and the composed React binding are the implemented beta contract. Changes to
command results, source semantics, event ordering, renderer ownership, public selectors, or
custom-property meaning require a documented migration. Additive media descriptor fields and new
optional parts may ship in a minor release. Internal DOM, animation objects, and unlisted styling
hooks may change without notice.
