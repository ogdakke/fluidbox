# Public API contract

The rules every entry point of `@ogdakke/fluidbox` keeps. The types and doc comments in
`packages/fluidbox/src/public-api.ts` and `labels.ts` are the source of truth; the user
documentation is in `apps/docs/content` ([API reference](../apps/docs/content/api.md)).

## Principles

- Platform words: item fields are HTML attribute names by DOM property name (`src`, `srcset`,
  `sizes`, `poster`, `referrerPolicy`), and the events follow a popover's (`beforetoggle`,
  `toggle`, `oldState`, `newState`).
- One word per idea: **item**, **trigger**, **viewer** (the body-level layer), **controls**,
  **filmstrip**, **sheet**, **thumbnail overlay**.
- The same shape in every entry point: plain JavaScript, the custom elements and the four
  framework bindings support the same nine patterns (`apps/examples/src/patterns/CONTRACT.md`).

## Package exports

| Entry                           | Contract                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@ogdakke/fluidbox`             | `createFluidbox`, `FluidboxToggleEvent`, `FluidboxChangeEvent` and the types. No side effects, no browser globals on import. |
| `@ogdakke/fluidbox/elements`    | Defines the custom elements on import. Browser only. The only entry that registers elements.                                 |
| `@ogdakke/fluidbox/filmstrip`   | Registers the filmstrip add-on on import. Exports its types only. SSR-safe.                                                  |
| `@ogdakke/fluidbox/sheet`       | Registers the sheet add-on on import. Exports its types only. SSR-safe. Styles in `sheet.css`.                               |
| `@ogdakke/fluidbox/hover-zoom`  | `hoverZoom` and its options: magnifies a photo on the page under a resting mouse. No side effects. SSR-safe.                 |
| `@ogdakke/fluidbox/kit`         | The binding kit for framework bindings. Not needed by app code.                                                              |
| `@ogdakke/fluidbox/embeds`      | YouTube and Vimeo facades: `youtubeItem`, `vimeoItem`, `renderEmbed`. No side effects on import. SSR-safe.                   |
| `@ogdakke/fluidbox/spin`        | 360° spins: `spinItem`, `createSpinRenderer`. No side effects on import. SSR-safe.                                           |
| `@ogdakke/fluidbox/model`       | 3D models: `modelItem`, `createModelRenderer`. Never bundles `<model-viewer>`; loads it through `load`. SSR-safe.            |
| `@ogdakke/fluidbox/<framework>` | `react`, `solid`, `vue`, `angular`: built on the plain API and the kit only, never the custom elements.                      |

Add-ons register into one registry per page (`Symbol.for`), however many copies a bundler makes.
Turning `filmstrip` or `sheet` on without its import throws an `Error` that names the import.

## Items and lists

Items are flat: `{ type: "img" | "video" | "iframe" | "custom", ... }`, with `id` (default: `src`),
`thumbnail` and `placeholder` on every type. Users add their own fields; `TItem extends FluidboxItem`
flows through options, state, events and callbacks, which always hand back the original object.

`items` is an array or a lazy list `{ count, get(index), indexOf?(id) }`. Arrays are copied and
checked: an empty id, or a duplicate of an id an item names itself by, throws a `TypeError`. In an
array, an item without an `id` whose `src` an earlier item already has gets the next free
`src#2`, `src#3` (in order, around the ids items name themselves by), so media that repeats a
photo needs no ids; the same object twice is handed back as a copy the second time. Lazy lists are read synchronously and keep
their ids unique themselves; without `indexOf`, ids are found by scanning. An iframe's `src`
must be http(s) or relative, and a video's `src` and `poster` http(s), relative or `blob:`; any other
scheme throws a `TypeError` when the item is read. An iframe without `sandbox` gets a default one
([Safe URLs](../apps/docs/content/media.md#safe-urls)). A list is a snapshot:
`setItems` replaces it, keeping an open viewer on the same id when it survives. An array of items
equal field by field (plain objects and arrays by content) to the current ones is a no-op that
resolves `false` and interrupts nothing; otherwise the viewer keeps the slides of unchanged items
and remakes only the rest. Bindings pass their `items` straight through.

## The fluidbox

`createFluidbox(options)` returns a `Fluidbox`, an `EventTarget` with `state`, `items`, `sheet`,
`filmstrip`, `open`, `close`, `next`, `previous`, `zoomTo`, `zoomIn`, `zoomOut`, `resetZoom`, `setItems`, `preload`, `bind`, `bindOverlay`,
`subscribe` and `destroy`.

- A target is an index or an id. `open(target?)` opens, or moves while open; without a target it
  uses the current item, else the first.
- Commands return `Promise<boolean>`: `true` once the command happened and its motion settled,
  `false` when it was prevented, superseded, aborted, or had nothing to do. An unknown target
  rejects with a `RangeError`. After `destroy()` the commands resolve `false`, and `setItems`,
  `preload`, `bind`, `bindOverlay` and `subscribe` throw an `InvalidStateError`.
- `destroy()` releases every `bind` and `bindOverlay`.
- The zoom commands clamp their scale to `state.zoom`'s bounds and resolve `false` while
  `state.zoom` is `null`. `zoomTo` with a scale that isn't finite rejects with a `RangeError`.
- Options are read once, except `renderers` (read when a slide mounts) and `origins` (read on each
  use).

## State and events

`state` is a frozen snapshot: `status`, `id`, `index`, `item`, `count`, `hasPrevious`,
`hasNext`, `zoom`. `id`, `index` and `item` are where the viewer is or is going, `null` while closed.
`zoom` is `{ scale, min, max }` while open on an image with zoom on, else `null`; its `scale` is the
one the zoom last rested at.
`subscribe` is called after each new snapshot, never per animation frame; per-frame values stay in
CSS variables.

| Event              | Class                 | Cancelable | When                                               |
| ------------------ | --------------------- | ---------- | -------------------------------------------------- |
| `beforetoggle`     | `FluidboxToggleEvent` | yes        | Before an open or a close.                         |
| `toggle`           | `FluidboxToggleEvent` | no         | The opening or closing motion starts.              |
| `beforeitemchange` | `FluidboxChangeEvent` | yes        | Before the open viewer moves to another item.      |
| `itemchange`       | `FluidboxChangeEvent` | no         | The active item changes, the opening one included. |
| `settle`           | `FluidboxChangeEvent` | no         | The viewer comes to rest on an item.               |
| `sheetchange`      | `FluidboxSheetEvent`  | no         | The sheet comes to rest at another stop.           |
| `zoomchange`       | `FluidboxZoomEvent`   | no         | The image on show comes to rest at another zoom.   |

Every event has a `reason`: `api`, `trigger`, `keyboard`, `pointer`, `wheel`, `filmstrip` or
`items`. The before-events run synchronously for every command, whatever its source; a prevented
command resolves `false`. `<fluidbox-gallery>` re-dispatches the same events, non-bubbling; the
framework bindings expose them as event props, emits or outputs.

## Ownership

The runtime owns the body-level viewer, measured frames, transforms, clipping, the native slide
track, gesture surfaces, focus containment, the inert background and the live status. It is never
replaced with a native `dialog`. Applications own controls, captions, thumbnail decorations and
every framework-created descendant.

One renderer type, `({ item, index, target, signal }) => void | (() => void)`, draws everything an
application owns inside the viewer: custom slides, filmstrip thumbnails, the sheet and travelling
overlays. The runtime calls the returned disposer, then empties `target`; framework bindings use
their own portal or teleport mechanism and the runtime never reparents a framework-owned node.
Custom content outside the bounded slide window is disposed and may mount again as a new instance.

A custom slide's renderer (`FluidboxSlideRenderer`) also gets `active` and
`onActiveChange(listener)`: mount, activate, deactivate and dispose are distinct. A slide mounts
within one slide of the current one, inactive; it activates as it becomes the one on show in an
open viewer, and deactivates as the viewer moves away or closes, the leaving slide first. The
`signal` aborts on dispose. The framework bindings pass `active` and `onActiveChange` to their
renderers; Angular as an `active` input or template context field.

Content marked `data-fluidbox-owns-input` owns the touches, pinches (touch, trackpad and Safari
gesture events), wheel and navigation keys that start on it: the viewer neither swipes, dismisses,
zooms nor steps from them. Escape and Tab stay the viewer's. The content sets its own
`touch-action`. Custom content that holds an iframe, a video or an audio element closes in its
frame rather than in the flight, as embedded media items do.

## Labels

Every string the viewer shows or announces is in `FluidboxLabels` (`viewer`, `close`, `previous`,
`next`, `position`, `slides`, `filmstrip`, `filmstripList`, `zoomed`, `zoomIn`, `zoomOut`,
`zoomReset`, `zoomLevel`, `sheet`, …), with English
defaults, overridden through `labels`.

## Styling hooks

The public selectors, state attributes and custom properties are the ones listed in the
[CSS reference](../apps/docs/content/css-reference.md). Undocumented generated nodes, attributes,
inline properties and internal CSS variables are not extension points. Geometry, scrolling,
clipping, touch behaviour, focus visibility and modal isolation stay structural even when the
appearance is replaced.

## Versioning

The package is private at `0.0.0` and has no consumers outside this repository and
`portfolio-v4`. Until a release, the API changes in place: old names are deleted, not deprecated.
