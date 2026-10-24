# 9. Implementation plan

No deprecation path (§8.13): each step deletes the old names it replaces. The tree must build and
`bun run test` must pass at the end of each step, so a step updates the examples and tests that
use what it renames.

## 9.1 Order

```
Step 1  Core: items, value, events, slides, Media box, layer, waiting, triggers  ─┐
Step 2  React binding                                                  (after 1's types) ─┤ one branch
Step 3  Plain-JS add-on slides (embed, spin, model)                     (after 1's slide contract)
        ────────────────────────────────────────────────────────────────────────────────
Step 4  Vue │ Solid │ Angular │ Elements                                (parallel, each after 1–2)
Step 5  Add-on parts per framework                                      (with each of step 4)
        ────────────────────────────────────────────────────────────────────────────────
Step 6  Docs, examples, patterns, CONTRACT, stale docs, bundle budget
```

React and plain JS go first, as the brief asks. React is the binding with the most tests
(`binding-live`, `headless`, `photo-library`, `shop`) and it proves the portal design for
`Media`, which the other three copy.

## 9.2 Steps

### Step 1: core

In sub-steps that can each be reviewed alone, in this order:

1. **Item types.** `"img"` → `"image"`, `zoom: { src, srcset }`, `caption`, `FluidboxItemTypes` with
   declaration merging, `FluidboxCustomItemBase`; drop `type: "custom"` and the item `render`
   field. Touches `public-api.ts`, `image-item.ts`, `items.ts` (validation), `media-url.ts`,
   `srcset.ts`, `static-viewer.ts`, `hover-zoom.ts`, the add-ons' item builders and every fixture.
   Mechanical; do it first so later diffs are small.
2. **State and events.** `state.value`; `beforevaluechange` / `valuechange` /
   `valuechangecomplete` with `action`; delete the toggle, item-change and settle events.
   `create-fluidbox.ts` (`#command` already knows open/move/close), `events.ts`, `controlled.ts`
   (`createFluidboxSync(value)`, `watchFluidbox` reporting from the before-event with
   `cancel()`). A close's `valuechangecomplete` is new and fires when the closing flight ends.
3. **Slides.** The `slides` option with the lookup order of §2.7; `FluidboxSlide` replacing
   `FluidboxSlideRenderContext`; an error slide for an unknown type. Split
   `ViewerStrip.#makeSlide` (`viewer-strip.ts:428-557`) so the built-in image, video and iframe
   media are drawn by `drawImage` / `drawVideo` / `drawIframe` on the slide, called by the built-in
   slides and by custom ones alike. Keep the built-in DOM byte-identical so the visual and motion
   snapshots don't move.
4. **Media box and layer.** Every slide gets a runtime-owned media box and a slide layer
   (§5.1). The driver's flight and zoom target the box for every type (`#frame`/`#media`,
   `dom-viewer-driver.ts:1024-1030`; `#prepareZoom`, `:1474`, drops the `HTMLImageElement`
   requirement and asks the box's `zoomable` state; `create-fluidbox.ts:482` `#zoomFor` likewise).
   `setItems` suspends a zoomed box rather than dropping it (§5.1 constraints).
5. **Waiting for the opened slide.** Every open waits, with no flag (§5.3). In `ViewerStrip`: a
   commit deferred per slide (resolved synchronously for built-in media and plain-JS renderers,
   and by a `commit(index)` call the bindings make), `slide.waitUntil`, `slide.opening`, and
   `ready(index, cap)`. `ready` awaits the commit, then the box's `<img>` decodes and `<video>`
   frames or posters, plus the `waitUntil` promises, all raced against the 3 s cap. Built-in
   `draw*` media is exempt and keeps today's rules. `DomViewerDriver.open` awaits it through
   `#whileWaiting` in both the flight and instant branches. Development builds warn at the cap and
   when `waitUntil` comes too late.
6. **Triggers.** `bind`/`bindOverlay` take a value (a target or a list); `returns` goes.
   `findTrigger`/`revealTrigger` replace the `origins` adapter (`origin-registry.ts` keeps its
   registrations, and calls the two functions where it called the adapter). Overlays: `flight`
   replaces `travel` and `frameLayer`, and frame overlays register as siblings
   (`thumbnail-overlay-runtime.ts:193`).
7. **Renames.** `filmstrip` → `thumbnails` (files, option, CSS properties, data attributes, labels),
   `loading` → `preload` with `"hover"` → `"intent"`, `resetZoom` → `zoomReset`, sheet `stop` →
   `snap` (with the internal `sheet-snap` → `sheet-mark`), `data-fluidbox-overlay` →
   `data-fluidbox-viewer`, `data-fluidbox-item-id` → `data-fluidbox-value`, new `data-active`,
   `counter` label. `css-api.ts` is the list the CSS reference page is generated from; update it in
   the same commit.

8. **Video sources and attach** (§2.8). In `#makeSlide` and `#load`: `<source>` children from
   `sources` then `src`, with no `src` attribute when there are sources. The error listener goes on
   the last `<source>`. `#unload` removes the sources, and aborts `attach`'s signal before it empties
   the video. `checkItemUrls` covers `sources[].src`. `drawVideo(item, { attach })` and
   `videoSlide({ attach })`. Independent of 3–6 except that `drawVideo` comes from 3.
9. **Fill boxes** (§5.4). `fit` on items, `fitSize` returning the stage size for `"fill"`, no
   `--fluidbox-media-aspect` on a fill box, optional `width`/`height` validation, and the flight's
   start crop at the poster's contained rectangle. Needs 4, because a fill box is a media box.

Sub-steps 1, 2 and 7 are renames and API reshaping; 3–6, 8 and 9 are the engine work and carry the risk
(§5.1 risks table). 3 and 4 must land together for any non-image slide to fly.

### Step 2: React

`packages/react/src/index.ts` (1,121 lines) and `types.ts`. In order: `value`/`defaultValue`/
`onValueChange`/`onValueChangeComplete` on Root; `Trigger value`; `Slides` (a map passed to the
core, replacing the `renderers` proxy at `index.ts:294`); `Media` with `render` and children
(portal into the box); `Image`/`Video`/`Iframe`, with `attach` on `Video`; `useFluidboxSlide` with `waitUntil` and
`opening`; reporting each slide's commit to the core from a layout effect in the slide host, after
the children's effects (so `Media render` and add-ons have called `waitUntil`);
`Toolbar`, `ZoomControls`, `Counter`, `Caption`; `Overlay` replacing `ThumbnailOverlay` and
`FrameLayer`; `Thumbnails`, `SheetSnap`, `useFluidboxSheet` → `{ snap, setSnap }`. Delete
`Controls`, `Filmstrip`, `SheetStop`.

### Step 3: plain-JS add-on slides

`embeds.ts` → `embed.ts` (`createEmbedSlide`, `embedSlide`), `spin.ts`, `model.ts`; package exports
`./embed`; drop the `is*Item` guards and the model marker. Small; can run alongside step 2.

- **Embed providers** (§4.2): `createEmbedProvider` with its URL and origin checks; YouTube and
  Vimeo rebuilt as `youtube` and `vimeo` from today's parsers, URLs, origins, `pause()` and
  poster and referrer rules; `embedItem`; `providers` on `createEmbedSlide`, with lookup by name,
  the error slide for an unknown name, and preconnect. `embeds.spec.ts` moves to the providers and
  gains a third provider made in the test.
- **`modelItem()` sets `fit: "fill"`** (§4.4). Needs step 1.9.
- **Later, low priority: `@ogdakke/fluidbox/hls`** (§4.8), `hlsAttach`, with a bundle-check
  consumer. Needs step 1.8. Nothing else depends on it.

### Step 4: Vue, Solid, Angular, elements

One agent or person each, from step 2's React code and the anatomy (§3.13–3.16).

| Binding  | Size today                             | Main work                                                                                                                                                                                                         |
| -------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vue      | 967 + 73 lines                         | `v-model`, named slots on `Slides`, `Media` with `Teleport`-free portals (the existing mount helper), new parts                                                                                                   |
| Solid    | 834 + 202 lines                        | Accessor `value`, `Slides` props, `Media` via `Portal` into the box, new parts                                                                                                                                    |
| Angular  | ~1,200 lines over six files            | `model()` for `[(value)]`, `ng-template fluidboxSlide`, `fluidboxMedia`, `injectFluidboxSlide`, new parts; delete the renderer-map input. Keep the 17.3 floor.                                                    |
| Elements | `gallery.ts`, `item.ts`, `elements.ts` | `value` attribute, `<template data-fluidbox-slide>`, `defineSlide`/`defineMarkup` registry, `<fluidbox-toolbar>`, `<fluidbox-zoom-controls>`, `<fluidbox-counter>`, `<fluidbox-caption>`, `<fluidbox-thumbnails>` |

### Step 5: add-on parts

`{react,vue,solid,angular}/{embed,model,spin}` and `elements/{embed,model,spin}`: package exports,
tsdown entries, and the private packages' build copying into `dist/<framework>/`. Each is a few
dozen lines (§4.1). Done by whoever does that framework in step 4.

### Step 6: docs and examples

- All 13 patterns in five frameworks plus JS and elements (`apps/examples/src/patterns`), following
  part 6; rename `filmstrip` pattern files to `thumbnails`; update `CONTRACT.md` (§6.0.1).
- Docs pages: 35 files under `apps/docs/content` and `docs/` use old names. Rename
  `filmstrip-and-sheet.md` → `thumbnails-and-sheet.md`. Add URL-sync examples for Vue Router,
  Angular Router and Next.js (§7.1).
- Fix the stale docs listed in §1.19 in the same pass.
- `apps/examples/src/demos/photo-library.tsx` and `pages/fixtures.ts`: the browser specs read them.
- Update `baseline/bundle-budget.md` with the measured numbers and a paragraph on what moved.

## 9.3 Bundle impact

Estimates, gzip, against `baseline/bundle-budget.md` (2026-10-23):

| Entry                      | Initial today | Initial estimate | Activation today | Activation estimate | Why                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------: | ---------------: | ---------------: | ------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root                       |       9,126 B |    +50 to +150 B |         37,231 B |    +550 to +1,050 B | Initial: `value` option and state, item type checks, slide lookup. Activation: media box and layer for every type, zoom on any box, the readiness wait, the drawing split, video sources and `attach`, fill boxes, overlay frame registration. Merging five events into three saves a little. |
| React                      |      14,864 B | +600 to +1,200 B |         42,551 B |  +1,000 to +2,000 B | New parts (`Slides`, `Media`, `Image`/`Video`/`Iframe`, `Toolbar`, `ZoomControls`, `Counter`, `Caption`), `useFluidboxSlide`, the details object; less `Controls`, `FrameLayer` and the open/index double sync. Activation includes the core's.                                               |
| Vue                        |      13,443 B | +600 to +1,200 B |         41,138 B |            as React | Same parts.                                                                                                                                                                                                                                                                                   |
| Solid                      |      12,723 B | +500 to +1,000 B |         40,379 B |            as React | Solid's parts are the smallest.                                                                                                                                                                                                                                                               |
| Angular                    |      13,898 B | +700 to +1,300 B |         41,578 B |            as React | Directive metadata per new part.                                                                                                                                                                                                                                                              |
| Elements                   |      13,082 B |   +500 to +900 B |         40,620 B |    +900 to +1,700 B | Four new elements, the template-slide reader and the registry.                                                                                                                                                                                                                                |
| Thumbnails (was Filmstrip) |       3,644 B |            ±30 B |          3,644 B |               ±30 B | Rename; `data-active`.                                                                                                                                                                                                                                                                        |
| Sheet                      |       7,249 B |            ±30 B |          7,249 B |               ±30 B | `snap` naming.                                                                                                                                                                                                                                                                                |
| Kit                        |       1,635 B |            ±50 B |          1,635 B |               ±50 B | `takeOverFluidbox` takes a value.                                                                                                                                                                                                                                                             |
| Add-ons                    |               |                  |                  |                     | §4.7                                                                                                                                                                                                                                                                                          |

The React figure is the one to watch: 1.2 KB is about 8% on 14.9 KB. Two ways to keep it near the
low end if the measurement comes in high:

- The controls (`Toolbar`, `ZoomControls`, `Counter`, `Caption`, the zoom buttons) share one
  `controlPart(kind)` factory, as Angular's parts already share a base directive.
- `Image`, `Video` and `Iframe` are one component with a `kind` prop under three names.

New bundle-check consumers (`tests/bundle/*.ts` and the `entrypoints` list in
`scripts/check-bundles.ts:4`): rename `filmstrip` → `thumbnails` and `embeds` → `embed`; add
`react-embed`, `react-model`, `react-spin`, the same for Vue, Solid and Angular, and
`elements-embed`, `elements-model`, `elements-spin` (15 new), and `hls` once that add-on exists. Each asserts it carries only its
own add-on and its own framework (§4.7). The new limits are the measurements plus 40 B, rounded up
to the next 50 B, as now.

## 9.4 Tests that move

Counts are lines naming an old API name today (`grep` for `type: "img"`, `zoomSrc`, `filmstrip`,
`itemchange`, `toggle`, `settle`, `renderers`, `origins`, `returns`, `ThumbnailOverlay`,
`FrameLayer`, `travel`, `data-fluidbox-overlay`, `item-id`, `sheet-stop`, `resetZoom`, `loading`,
`onOpenChange`, `onIndexChange`, `"custom"`).

**Contracts** (type-level; they define the public API, so they change first in each step):

| File                                  | Lines | Changes                                                                                                                   |
| ------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------- |
| `tests/public-api.contract.ts`        |    55 | Every rename in part 1; add `FluidboxItemTypes` merging, `FluidboxSlides` narrowing, `FluidboxValueChangeDetails.cancel`. |
| `tests/react-public-api.contract.tsx` |    15 | New parts and props; `Slides` prop types per item type; `useFluidboxSlide` with `waitUntil` and `opening`.                |

**Unit** (`packages/fluidbox/tests`, Vitest):

| File                                                                                    |  Lines | Changes                                                                                                                                                                         |
| --------------------------------------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime.spec.ts`                                                                       |     23 | Events → valuechange family; `value`; cancel; slides lookup; error slide; readiness wait (commit, img decode, video frame, `waitUntil`, cap, Escape, abort, late-call warning). |
| `filmstrip-thumbnail.spec.ts`                                                           |      8 | Rename to `thumbnails-thumbnail.spec.ts`.                                                                                                                                       |
| `static-viewer.spec.ts`                                                                 |      6 | `value`, `href(value)`, `thumbnails`, `data-fluidbox-viewer`.                                                                                                                   |
| `kit.spec.ts`                                                                           |      4 | `takeOverFluidbox(…, value)`.                                                                                                                                                   |
| `origin-registry.spec.ts`                                                               |      2 | Adapter → `findTrigger`/`revealTrigger`.                                                                                                                                        |
| `item-list.spec.ts`, `image-item.spec.ts`, `embeds.spec.ts`, `fluidbox-gesture.spec.ts` | 2 each | Item fields; `embeds` → `embed`.                                                                                                                                                |
| `viewer-ownership.spec.ts`, `media-url.spec.ts`                                         | 1 each | Item type.                                                                                                                                                                      |

**Browser** (`tests/browser`, Playwright), heaviest first:

| File                                                                                             |    Lines | Changes                                                                                                   |
| ------------------------------------------------------------------------------------------------ | -------: | --------------------------------------------------------------------------------------------------------- |
| `headless.spec.ts`                                                                               |       84 | Renderers → slides, events, overlay flight, data attributes.                                              |
| `photo-library.spec.ts`                                                                          |       73 | The demo app's controlled state → `value`; thumbnails.                                                    |
| `interactions.spec.ts`                                                                           |       33 | Events, data attributes.                                                                                  |
| `source-reveal.spec.ts`                                                                          |       27 | `origins` → `findTrigger`/`revealTrigger`.                                                                |
| `lifecycle.spec.ts`                                                                              |       19 | Events (settle → valuechangecomplete), `setItems` with a zoomed box.                                      |
| `sheet.spec.ts`                                                                                  |       15 | `stop` → `snap`, `SheetSnap`.                                                                             |
| `patterns.spec.ts`                                                                               |       14 | §6.0.1.                                                                                                   |
| `axe.spec.ts`                                                                                    |       14 | Selectors; add the new parts to the scanned pages.                                                        |
| `flight.spec.ts`                                                                                 |       11 | `travel`/`frameLayer` → `flight`; add a custom slide with `Media` that flies, and one without that fades. |
| `binding-live.spec.ts`                                                                           |        9 | `value` across all bindings.                                                                              |
| `shop.spec.ts`                                                                                   |        8 | Trigger `value` lists.                                                                                    |
| `zoom.spec.ts`                                                                                   |        6 | `zoom.src`, `zoomReset`, `ZoomControls`; add zoom on a custom `Media`.                                    |
| `baseline.spec.ts`, `motion.spec.ts`, `a11y.spec.ts`, `loading.spec.ts`                          | 4–6 each | Renames; `loading` → `preload`. Snapshots must not change (step 1.3 keeps the DOM).                       |
| `media.spec.ts`, `loop.spec.ts`, `collapsed*.spec.ts`, `security.spec.ts`, `performance.spec.ts` | 1–3 each | Item type, selectors.                                                                                     |
| `frameworks.spec.ts`, `csp.spec.ts`                                                              |        0 | Run unchanged; `frameworks.spec.ts` gains the add-on parts.                                               |

New tests:

- `Media` flight and zoom for a custom slide, per binding (React in step 2, others in step 4), and
  the unmount-while-zoomed case from the spike (§5.1), which must not throw.
- The readiness wait, per binding: a custom slide with an undecoded `<img>` flies only once it
  has decoded; a `waitUntil` promise delays the flight; the cap opens anyway and warns; Escape
  cancels while waiting; a neighbour's slow image doesn't delay the open; reduced motion and the
  instant open still wait.
- **Image-open latency doesn't regress.** In `performance.spec.ts`, measure from click (and from
  pointerdown for a prepared open) to the opening flight's first animation frame for a built-in
  image, before and after step 1.5, over repeated runs. The new time must be within noise of the
  old. A photo open must never wait on the full image's decode.
- Add-ons: the model open waits for a frame (with a stub `<model-viewer>`), spin for its first
  frame, embed for its poster.
- `onValueChange` cancel for open, move and close, per binding.
- `Counter`, `Caption`, `Toolbar` roles and labels in `a11y.spec.ts`.
- An unknown item type shows the error slide with `labels.error`.
- Video `sources`: the browser picks the first playable source (a WebM-or-MP4 fixture), the
  error state shows when every source fails (the event on the last `<source>`), an unloaded slide
  stops downloading, a source with a `javascript:` URL is rejected, and the hand-off from a
  playing trigger video still continues at its time.
- Video `attach`: called once per load with the runtime's `<video>`, no `src` set by the runtime,
  the signal aborts on unload, and autoplay, pause on leave and tracks still work (a stub engine
  that sets a blob URL).
- Embed providers: a provider made in the test plays, pauses and preconnects; a `url()` off its
  `origin` shows the error slide; an item naming an unregistered provider shows the error slide
  and warns.
- Fill boxes: a `fit: "fill"` slide's box equals the stage less its insets, with the thumbnails
  dock and with a sheet's peek; the opening flight's first frame shows the poster at the trigger's
  rectangle; resizing the window resizes the box; a model item from `modelItem()` fills.

## 9.5 What runs in parallel

| Track                                     | Depends on                                            | Can run with                                                                    |
| ----------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1.1 item types, 1.7 renames               | —                                                     | each other; they touch different names, but rebase often, as both edit fixtures |
| 1.2 state and events                      | 1.1                                                   | 1.3                                                                             |
| 1.3–1.5 slides, Media box, waiting        | 1.1                                                   | 1.2, 1.6                                                                        |
| 1.6 triggers and overlays                 | 1.2                                                   | 1.3–1.5                                                                         |
| 1.8 video sources and `attach`            | 1.3 (`drawVideo`)                                     | 1.4–1.6, 1.9                                                                    |
| 1.9 fill boxes                            | 1.4                                                   | 1.5, 1.6, 1.8                                                                   |
| 2 React                                   | 1's public types (write them first, implement behind) | 3                                                                               |
| 3 plain-JS add-on slides, embed providers | 1.3's slide contract; `modelItem` fill needs 1.9      | 2                                                                               |
| 4 Vue, Solid, Angular, elements           | 1 done, 2's `Media` portal proven                     | each other                                                                      |
| 5 add-on parts                            | 3, and that framework's step 4                        | the other frameworks                                                            |
| 6 docs and examples                       | each framework's step                                 | per page; patterns per framework                                                |

With four people or agents: one on 1.3–1.5 (the engine), one on 1.1/1.2/1.6/1.7, one on 2 then
Vue, one on 3 then Angular; Solid and elements follow. The critical path is 1.3 → 1.4 → React
`Media` → the other bindings' `Media`.

## 9.6 Done when

- `bun run test` (Vitest, contracts, Playwright, bundle check) passes with the new limits.
- No old name from part 1 is left in `packages/`, `apps/`, `tests/` or `docs/` (a grep over the
  inventory's left column, in CI once).
- All 13 patterns exist in React, Vue, Solid, Angular, elements and JS, and every docs snippet
  in §6.14 is rewritten.
- `baseline/bundle-budget.md` records the measured sizes.
