# API redesign spec

Status: draft for review. Nothing here is implemented. The package is unpublished at `0.0.0`, so
old names are deleted, not deprecated.

The spec is split by topic:

| Part | File                                                                     | What it settles                                                         |
| ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 1    | [Inventory and mapping](api-spec/01-inventory.md)                        | Every current public name and what it becomes.                          |
| 2    | [Core API](api-spec/02-core.md)                                          | Options, item types, the instance, events, the plain-JS slide contract. |
| 3    | [Anatomy](api-spec/03-anatomy.md)                                        | Every part, in React, Vue, Solid, Angular and the custom elements.      |
| 4    | [Add-ons](api-spec/04-addons.md)                                         | Hover zoom, embed, spin, model; entry points; the bundle split.         |
| 5    | [Engine additions](api-spec/05-engine.md)                                | `Fluidbox.Media` as the flight and zoom target, and holding the open.   |
| 6    | [Patterns](api-spec/06-patterns.md)                                      | All 13 patterns in React and Angular, plus the docs snippets.           |
| 7    | [State, server, lists, labels](api-spec/07-state-server-lists-labels.md) | Controlled state and URL sync, server rendering, lazy lists, i18n.      |
| 8    | [Open decisions](api-spec/08-decisions.md)                               | Each with a recommendation.                                             |
| 9    | [Implementation plan](api-spec/09-plan.md)                               | Order, scope, bundle impact, tests, parallel work.                      |

## Summary

`items` stays the source of truth. Everything the viewer shows is a part. One vocabulary is
used everywhere: plain JS, the four bindings and the custom elements.

```tsx
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { Model } from "@ogdakke/fluidbox/react/model";
import { Embed } from "@ogdakke/fluidbox/react/embed";

<Fluidbox.Root items={media} value={photoId} onValueChange={setPhotoId}>
  {products.map((p) => (
    <Fluidbox.Trigger key={p.id} value={p.mediaIds}>
      {({ item }) => <img src={item.thumbnail.src} alt={item.alt} />}
    </Fluidbox.Trigger>
  ))}
  <Fluidbox.Viewer>
    <Fluidbox.Slides
      model={() => <Model load={() => import("@google/model-viewer")} />}
      embed={() => <Embed />}
    />
    <Fluidbox.Toolbar>
      <Fluidbox.Counter />
      <Fluidbox.ZoomOut />
      <Fluidbox.ZoomIn />
      <Fluidbox.ZoomReset />
      <Fluidbox.Close />
    </Fluidbox.Toolbar>
    <Fluidbox.Previous />
    <Fluidbox.Next />
    <Fluidbox.Caption />
    <Fluidbox.Thumbnails />
  </Fluidbox.Viewer>
</Fluidbox.Root>;
```

The main changes:

- **State is one value.** `value` is the open item's id, or `null` when closed. It replaces
  `open`, `index`, `onOpenChange`, `onIndexChange` and the toggle and item-change events at the
  binding level. `onValueChange(value, details)` can cancel through `details.cancel()`.
- **Items are typed by kind.** `type` is `"image" | "video" | "iframe" | "embed" | "spin" |
"model"` or a type of your own. `type: "custom"` and `render` go away. The zoom image is
  `zoom: { src, srcset }`.
- **Slides are framework children.** `<Fluidbox.Slides>` takes one prop per item type. Slide
  content reads `useFluidboxSlide()`. The add-ons are parts (`Model`, `Embed`, `Spin`) imported
  from their own entries.
- **`<Fluidbox.Media>` is the box that flies and zooms.** Built-in media and add-ons render one.
  This is the largest engine change (part 5).
- **Every control is a part**, including the new `Counter`, `Caption` and `ZoomControls`.
  `Controls` and its `zoom` flag go away.
- **Renames:** `Filmstrip` → `Thumbnails`, `ThumbnailOverlay` + `FrameLayer` + `travel` →
  `Overlay flight`, `origins` → `findTrigger`, `loading` → `preload`, `returns` → a list in
  the trigger's `value`.

The engine stays: the headless runtime, the lazy driver, the virtualised strip, flights,
gestures, zoom, the server-rendered open viewer and the accessibility work.

## Where the agreed direction changed

These are argued in [part 8](api-spec/08-decisions.md). In short:

1. **`ready()` on its own can't work.** The engine must know _before_ the flight starts that it
   should wait. The spec uses an opt-in: `useFluidboxSlide({ holdOpen: true })` returns
   `ready`. Plain JS calls `slide.holdOpen()`.
2. **`<Fluidbox.Media>` can't make a framework element the transform target.** The zoom moves
   its target into a scroller. A spike showed that React then throws `removeChild` when the slide
   unmounts, and leaves the node behind (part 5, "Spike"). So the runtime keeps owning the box,
   and `Media` puts framework content _inside_ it.
3. **A slide has two layers.** Content in `Media` flies and zooms. Content beside it sits in the
   slide's layer and fades with the controls. Without a split, `<Fluidbox.Image />` inside a
   custom slide has nowhere to put a caption.
4. **Trigger takes `value`, not `items`.** On the Root, `items` is data. On the trigger it would
   be ids. `value` matches the Root's `value`.
5. **Hooks keep the `Fluidbox` prefix:** `useFluidboxSlide`, not `useSlide`, as `useFluidbox` and
   `useFluidboxSheet` already do, and to avoid clashing with carousel libraries.
6. **Custom-element slide templates use `data-fluidbox-slide="type"`, not `slot="type"`.** The
   gallery already reserves the slots `trigger`, `content`, `sheet` and `viewer`.
7. **`<Fluidbox.Overlay>` clashes with the viewer root's `data-fluidbox-overlay`.** That
   attribute becomes `data-fluidbox-viewer`.
