# Public API contract

The rules every entry point of `@ogdakke/fluidbox` keeps. The types and doc comments in
`packages/fluidbox/src/public-api.ts` and `labels.ts` are the source of truth; the user
documentation is in `apps/docs/content` ([API reference](../apps/docs/content/api.md)).

## Principles

- Platform words: item fields are HTML attribute names by DOM property name (`src`, `srcset`,
  `sizes`, `poster`, `referrerPolicy`). The open item is a **value**, its id, as a form
  control's is: `value`, `beforevaluechange`, `valuechange`, `valuechangecomplete`.
- One word per idea: **item**, **trigger**, **viewer** (the body-level layer), **slide**,
  **controls**, **thumbnails**, **sheet**, **trigger overlay**, **hotspot**, **slideshow**.
- The same shape in every entry point: plain JavaScript, the custom elements and the four
  framework bindings support the same 13 patterns (`apps/examples/src/patterns/CONTRACT.md`).
- Headless: the package draws no icons. A control without content shows its label as text,
  marked `data-fluidbox-default`; the look is in the opt-in `baseline.css`.

## Package exports

| Entry                                       | Contract                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ogdakke/fluidbox`                         | `createFluidbox`, `createItemList`, `imageItem`, `videoSlide`, `idOf`, `itemLabel`, the event classes (`FluidboxValueChangeEvent`, `FluidboxZoomEvent`, `FluidboxSheetEvent`, `FluidboxMediaErrorEvent`, `FluidboxReachEndEvent`) and the types. No side effects, no browser globals on import. |
| `@ogdakke/fluidbox/elements`                | Defines the custom elements on import. Browser only. The only entry that registers elements.                                                                                                                                                                                                    |
| `@ogdakke/fluidbox/elements/<add-on>`       | `embed`, `model`, `spin`: registers that add-on's slide for `<fluidbox-gallery>`. Browser only.                                                                                                                                                                                                 |
| `@ogdakke/fluidbox/thumbnails`              | Registers the thumbnails add-on on import. Exports its types only. SSR-safe. Styles in `thumbnails.css`.                                                                                                                                                                                        |
| `@ogdakke/fluidbox/sheet`                   | Registers the sheet add-on on import. Exports its types only. SSR-safe. Styles in `sheet.css`.                                                                                                                                                                                                  |
| `@ogdakke/fluidbox/hover-zoom`              | `hoverZoom` and its options: magnifies a photo on the page under a resting mouse. No side effects. SSR-safe.                                                                                                                                                                                    |
| `@ogdakke/fluidbox/kit`                     | The binding kit for framework bindings. Not needed by app code.                                                                                                                                                                                                                                 |
| `@ogdakke/fluidbox/embed`                   | Video facades: `embedSlide`, `youtubeItem`, `vimeoItem`, `createEmbedProvider`. No side effects on import. SSR-safe.                                                                                                                                                                            |
| `@ogdakke/fluidbox/spin`                    | 360° spins: `spinItem`, `createSpinSlide`. No side effects on import. SSR-safe.                                                                                                                                                                                                                 |
| `@ogdakke/fluidbox/model`                   | 3D models: `modelItem`, `createModelSlide`. Never bundles `<model-viewer>`; loads it through `load`. SSR-safe.                                                                                                                                                                                  |
| `@ogdakke/fluidbox/<framework>`             | `react`, `solid`, `vue`, `angular`: built on the plain API and the kit only, never the custom elements. Each has `/embed`, `/model` and `/spin` parts entries.                                                                                                                                  |
| `styles.css`, `thumbnails.css`, `sheet.css` | The functional CSS, unlayered.                                                                                                                                                                                                                                                                  |
| `baseline.css`                              | The default look, opt-in, in `@layer fluidbox-baseline`.                                                                                                                                                                                                                                        |

Add-ons register into one registry per page (`Symbol.for`), however many copies a bundler makes.
Turning `thumbnails` or `sheet` on without its import throws an `Error` that names the import.

## Items and lists

Items are flat: `{ type: "image" | "video" | "iframe", ... }`, or a type of your own declared on
`FluidboxItemTypes` with `FluidboxCustomItemBase<"name">` (which needs a `title`), with `id`
(default: `src`), `thumbnail`, `placeholder`, `caption`, `fit`, `download` and `data` on every
type. A video's `tracks` (`{ src, kind?, srclang?, label?,
default? }`) become its `<track>` elements; `<fluidbox-item>` reads them from the `<track>` children
of its `<video>`. Users add their own fields; `TItem extends FluidboxItem`
flows through options, state, events and callbacks, which always hand back the original object.

`items` is an array or a lazy list `{ count, get(index), indexOf?(id) }`. `createItemList({ count,
item, index? })` makes a lazy list (`FluidboxLazyItemList`) whose `withCount(count)` is the same
list at another count, keeping the items already made: `setItems(list.withCount(total))` appends
without remaking the open slide. Arrays are copied and
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
`open`, `close`, `next`, `previous`, `zoomTo`, `zoomIn`, `zoomOut`, `zoomReset`, `setFullscreen`,
`download`, `share`, `play`, `pause`, `update`, `setItems`, `preload`, `load`, `bind`,
`bindOverlay`, `bindControl`, `subscribe` and `destroy`.

- A target is an index, an id or an item. `open(target?)` opens, or moves while open; without a
  target it uses the current item, else the first.
- Commands return `Promise<boolean>`: `true` once the command happened and its motion settled,
  `false` when it was prevented, superseded, aborted, or had nothing to do. An unknown target
  rejects with a `RangeError`. After `destroy()` the commands resolve `false`, and `setItems`,
  `preload`, `bind`, `bindOverlay` and `subscribe` throw an `InvalidStateError`. `play()` and
  `pause()` return nothing.
- `destroy()` releases every `bind`, `bindOverlay` and `bindControl`.
- The zoom commands clamp their scale to `state.zoom`'s bounds and resolve `false` while
  `state.zoom` is `null`. `zoomTo` with a scale that isn't finite rejects with a `RangeError`.
- `update(options)` changes `labels`, `zoom`, `loop`, `controls`, `icons`, `viewer`,
  `thumbnails`, `sheet`, `preload`, `dismiss`, `wheel`, `shareUrl`, `slideshow` and
  `reachEndThreshold` without closing. `slides` is read when a slide mounts, and `findTrigger`
  and `revealTrigger` on each use.
- `controls` defaults to Previous, Next and Close without a `viewer`, and to `["close"]` with
  one; that default Close steps aside while the viewer's layer holds its own
  `data-fluidbox-close` button.

## State and events

`state` is a frozen snapshot: `status`, `value`, `index`, `item`, `count`, `hasPrevious`,
`hasNext`, `zoom`, `fullscreen`, `playing`. `value` (the id), `index` and `item` are where the
viewer is or is going, `null` while closed. `zoom` is `{ scale, min, max }` while open on media
that zooms with zoom on, else `null`; its `scale` is the one the zoom last rested at. `playing`
stays true while a hidden tab or a playing video holds the slideshow's timer.
`subscribe` is called after each new snapshot, never per animation frame; per-frame values stay in
CSS variables.

| Event                 | Class                      | Cancelable | When                                                                                     |
| --------------------- | -------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `beforevaluechange`   | `FluidboxValueChangeEvent` | yes        | Before an open, a move to another item, or a close.                                      |
| `valuechange`         | `FluidboxValueChangeEvent` | no         | The change happens: its motion starts.                                                   |
| `valuechangecomplete` | `FluidboxValueChangeEvent` | no         | The motion settled: the flight landed, a move rested, a close ended.                     |
| `sheetchange`         | `FluidboxSheetEvent`       | no         | The sheet comes to rest at another stop.                                                 |
| `zoomchange`          | `FluidboxZoomEvent`        | no         | The image on show comes to rest at another zoom.                                         |
| `mediaerror`          | `FluidboxMediaErrorEvent`  | no         | A slide enters its error state, or a zoom image fails.                                   |
| `reachend`            | `FluidboxReachEndEvent`    | no         | A move settles within `reachEndThreshold` of the end, once per count; never with `loop`. |

A value change carries `value`, `previousValue`, `index`, `item` and `action` (`open`, `move` or
`close`). Every event has a `reason`: `api`, `trigger`, `keyboard`, `pointer`, `wheel`, `items` or
`slideshow`; a move from the thumbnails has the reason of its input. `beforevaluechange` runs
synchronously for every command, whatever its source; a prevented command resolves `false`. A
change the items force, as a close when they run out, fires it too, not cancelable.
`<fluidbox-gallery>` re-dispatches the same events, non-bubbling; the framework bindings expose
them as event props, emits or outputs, with a controlled `value` and a value-change callback that
can cancel.

## Ownership

The runtime owns the body-level viewer, measured frames, transforms, clipping, the native slide
track, gesture surfaces, focus containment, the inert background and the live status. It is never
replaced with a native `dialog`; opened from inside a modal `dialog`, it mounts inside that dialog
and enters the top layer as a manual popover. Applications own controls, captions, thumbnail
decorations and every framework-created descendant.

The inert background is what was on the page at open, apart from live regions and elements marked
`data-fluidbox-exempt`; nodes added later are left alone, and closing removes only the `inert` the
viewer set. Keys reach the viewer in the document's bubble phase: Escape unless the content
handled it, and the arrow keys, Home, End, `+`, `-` and `0` only when focus is on the dialog, a
default control or the strip of slides. An element marked `data-fluidbox-description` in the
dialog becomes its `aria-describedby`.

One renderer type, `({ item, index, target, signal }) => void | (() => void)`
(`FluidboxRenderer`), draws what an application owns around the slides: thumbnails, the sheet and
live trigger overlays. The runtime calls the returned disposer, then empties `target`; framework
bindings use their own portal or teleport mechanism and the runtime never reparents a
framework-owned node.

Slides have their own renderer, `FluidboxSlideRenderer`, chosen by item type through the `slides`
option. It gets a `FluidboxSlide`: the `item`, a live `index`, the `media` box that flies and
zooms, a `layer` beside it, `signal`, `active` and `onActiveChange`, `opening` and `waitUntil` to
hold the opening flight, `origin` and `onClose` and `returnPlayback` to take state from the
trigger and hand it back, `zoomable` and `onZoom`, `fail`, `drawImage`, `drawVideo`,
`drawIframe` and `hotspot`. Mount, activate, deactivate and dispose are distinct. A slide mounts
within one slide of the current one, inactive; it activates as it becomes the one on show in an
open viewer, and deactivates as the viewer moves away or closes, the leaving slide first. The
`signal` aborts on dispose. The framework bindings give their slide content the same through
`useFluidboxSlide()` (React, Vue, Solid) and `injectFluidboxSlide()` (Angular).
Content outside the bounded slide window is disposed and may mount again as a new instance.

Content marked `data-fluidbox-owns-input` owns the touches, pinches (touch, trackpad and Safari
gesture events), wheel and navigation keys that start on it: the viewer neither swipes, dismisses,
zooms nor steps from them. Escape stays the viewer's, and Tab is the browser's. The content sets its own
`touch-action`. Custom content that holds an iframe, a video or an audio element closes in its
frame rather than in the flight, as embedded media items do.

## Labels

Every string the viewer shows or announces is in `FluidboxLabels` (`viewer`, `close`, `previous`,
`next`, `position`, `announcement`, `slides`, `carousel`, `slide`, `thumbnails`, `thumbnailsList`,
`counter`, `zoomed`, `zoomIn`, `zoomOut`, `zoomReset`, `zoomLevel`, `sheet`, `error`, `retry`,
`enterFullscreen`, `exitFullscreen`, `download`, `share`, `linkCopied`, `playSlideshow`,
`pauseSlideshow`), with English defaults, overridden through `labels`.

## Styling hooks

The public selectors, state attributes and custom properties are the ones listed in the
[CSS reference](../apps/docs/content/css-reference.md). Undocumented generated nodes, attributes,
inline properties and internal CSS variables are not extension points. Geometry, scrolling,
clipping, touch behaviour, focus visibility and modal isolation stay structural even when the
appearance is replaced.

## Versioning

The package is private at `0.0.0` and has no consumers outside this repository and
`portfolio-v4`. Until a release, the API changes in place: old names are deleted, not deprecated.
