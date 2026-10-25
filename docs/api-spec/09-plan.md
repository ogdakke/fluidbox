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
        ────────────────────────────────────────────────────────────────────────────────
Step 7  Motion speed, hotspots, slideshow, reachend, then deep zoom     (after React; a later session)
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

10. **Third-amendment features 1–5** (§2.11–2.15): `setFullscreen` and `state.fullscreen` with
    the popover hand-off over a modal dialog and the close that exits first; `download()` and
    `share()` with their fallbacks; `mediaerror` from every `#fail` site, the last `<source>`,
    the zoom image, and `slide.fail`; `dismiss: { drag, backdrop }` and `wheel` in `#onWheel` and
    the drag and backdrop handlers; the sheet's `dismiss` → `dismissMotion`; item `data` with its
    validation; the new control names and labels (no icons, §2.21). Needs 2 (events) and 4 (the box, for
    `slide.fail`).
11. **Hooks step 7 needs, built now so nothing rules it out.** In 1.4: `slide.onZoom` with
    `FluidboxZoomPose` from both zoom modes, `zoomable({ max, sharpen })`,
    `--fluidbox-zoom-scale` on the media box, media content kept inside the transformed element,
    and every duration and spring `response` read through one `#duration(ms)` helper in the
    driver and the zoom engine. In 1.5: `ready(index, cap)` callable outside an open, and
    `waitUntil` promises kept per slide. In the driver: one `#userInteraction()` point that every
    gesture, key and zoom passes through. None of these is public behaviour yet except `onZoom`
    and `zoomable` options, so their cost is a few hundred bytes of activation JS.

12. **The CSS split and icon removal** (part 10, §2.21). It runs once the engine sub-steps that
    edit `styles.css` (1.4, 1.9) have landed, and before any control or part work. Session I
    finishes the engine and then does this, so step 2's parts are written against the headless
    rule from the start. In one change:
    - Delete `control-icons.ts`, kit's `fluidboxControlIcon`, the icon in `controlButton` and the
      static viewer, and the embed's Play SVG. Controls without content render their label text
      and `data-fluidbox-default`.
    - Add `bindControl`, the `icons` option, `"retry"`, `data-busy` and `data-error`.
    - Split the three stylesheets by the tables of §10.3. The functional rules stay unlayered,
      with today's selectors and specificity, and the `Canvas` surfaces of §10.2 as token
      fallbacks. The look goes into a new `baseline.css` in
      `@layer fluidbox-baseline`, with the glyph tokens and its forced-colours and CSP rules.
      Move the add-ons' injected look rules there too.
    - Add `./baseline.css` to the package exports.
    - Import `baseline.css` in `apps/examples` (every pattern page, the demos, `csp.html` with
      self-hosted glyph tokens) and in the docs site.
    - Update `css-api.ts`, which feeds the CSS reference page and the contract test, with the
      mechanics/look split of §10.5.

    The migration rule: the visual snapshots don't move, except for glyph-edge antialiasing,
    reviewed diff by diff (§10.4).

13. **Trigger video playback and click zoom** (§2.22, §2.23). Two independent pieces:
    - `slide.origin` and `slide.returnPlayback`. `#handBackVideo` reads the closing slide's
      registered source instead of `#media`, and `drawVideo` registers its `<video>`. Needs 1.3
      (the slide contract) and 1.8 (`drawVideo`).
    - `zoom.click` and `zoom.tap` in `handleClick` and `#tapAt` (`fluidbox-zoom.ts:705-750`), with
      `data-fluidbox-zoom-click` on the viewer, live through `update({ zoom })`. Needs 1.4,
      which moves the zoom onto the box.

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
`FrameLayer`; `Thumbnails`, `SheetSnap`, `useFluidboxSheet` → `{ snap, setSnap }`;
`Fullscreen`, `Download`, `Share`; Root `dismiss`, `wheel`, `shareUrl`, `onMediaError` (with
`shareUrl` defaulting to `href`); `useFluidboxSlide().fail` and `.onZoom`; Sheet `dismissMotion`;
`Loading`, `Error`, `Retry`; the `label` prop and the children rule on every control (§3.19), with
`defaultIcon` deleted; `origin` and `returnPlayback` on `useFluidboxSlide()`, and the Root `zoom`
prop's `click` and `tap` (§2.22, §2.23). Delete
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

Each binding in step 4 also gets `Fullscreen`, `Download`, `Share`, the Root's `dismiss`, `wheel`,
`shareUrl` and media-error output, `Loading`, `Error`, `Retry`, and the children rule with its
icon code deleted (§3.19), as React did in
step 2.

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

### Step 7: motion speed, hotspots, slideshow, reachend, deep zoom

A later session, after React (step 2) has landed, so it builds on the final binding code. It
adds nothing to steps 1–3 beyond the hooks of sub-step 1.11. In order:

1. **Motion speed** (§2.16): `--fluidbox-motion-speed` read in `#duration`, clamped; the strip's
   own scroll animation at speeds other than 1; `css-api.ts` entry.
2. **`reachend`** (§2.20): the event and the once-per-count rule in the controller; `withCount`
   on `createItemList` lists; `onReachEnd` in each binding.
3. **Slideshow** (§2.19): the timer in the viewer chunk on `#userInteraction`, `visibilitychange`
   and video `play`/`pause`; `ready(index, interval)` before each advance; the live region off
   while playing; `play`/`pause`/`state.playing`; the `"slideshow"` control and `Slideshow` part;
   `reason: "slideshow"`.
4. **Hotspots** (§2.17): the hotspot layer sized to the painted content rectangle, the
   counter-scale, focus panning, hiding during flights; `slide.hotspot`; `Hotspot` in each binding
   and `<fluidbox-hotspot>`.
5. **Deep zoom** (§2.18), after 1.0: `@ogdakke/fluidbox/deep-zoom` with IIIF and DZI readers, the
   tile layer on `onZoom`, and parts per framework. Its own bundle-check consumer.

Each of 1–4 is a separate, reviewable change, and they can run in parallel. 5 needs only
`onZoom` and `zoomable({ max, sharpen })`.

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

The table above is steps 1–6 before the third and fourth amendments. Those two change the
estimates as follows. The figures are gzip, against the 2026-10-23 baseline.

**What the fourth amendment removes.** The six icon paths are 209 B gzip, and the whole
`control-icons.ts` is 653 B before tree-shaking. They ship in the shared `controls` chunk
(1,227 B, with the control definitions), which the lazy viewer chunk and `kit` import. Every
binding imports `kit` in its main module, so the icons sit in each binding's _initial_ chunk, not
in the core's `index.js`. The bindings' own icon builders (React `defaultIcon`, Vue `controlIcon`,
Solid `defaultIcon`, Angular `#icon()`) come out too. The third amendment's four new icons are
never added.

| Entry                         | Redesign (above) |                + features 1–5 |                                                                                       + fourth amendment |             Step 7 |         Total initial vs today |
| ----------------------------- | ---------------: | ----------------------------: | -------------------------------------------------------------------------------------------------------: | -----------------: | -----------------------------: |
| Root initial                  |    +50 to +150 B |                +120 to +200 B |                                                        +40 to +80 B (`bindControl` stub, `icons` option) |      +60 to +120 B |                 +270 to +550 B |
| React initial                 | +600 to +1,200 B |                +300 to +500 B |             −300 to −500 B (icons, `defaultIcon`), +150 to +250 B (`Loading`, `Error`, `Retry`, `label`) |     +250 to +400 B | **+1,000 to +1,850 B (7–12%)** |
| Vue, Solid initial            | +500 to +1,200 B |                +300 to +500 B |                                                                           −300 to −450 B, +150 to +250 B |     +250 to +400 B |               +900 to +1,900 B |
| Angular initial               | +700 to +1,300 B |                +350 to +550 B |                                                                           −300 to −450 B, +200 to +300 B |     +300 to +450 B |             +1,250 to +2,150 B |
| Elements initial              |   +500 to +900 B |                +300 to +450 B |                −250 to −400 B, +150 to +250 B (`<fluidbox-loading>`, `<fluidbox-error>`, icon templates) |     +250 to +400 B |               +950 to +1,600 B |
| Activation (every core entry) | +550 to +1,050 B | +1,100 to +1,450 B (no icons) | −250 to −350 B (icon builder and paths), +200 to +300 B (`bindControl`, `icons`, default error UI hooks) | +1,550 to +2,000 B |             +3,150 to +4,450 B |
| `styles.css`                  |          3,565 B |                               |                                                                                         2,650 to 2,800 B |                    |                 −750 to −900 B |
| `thumbnails.css`              |          1,372 B |                               |                                                                                         1,050 to 1,150 B |                    |                 −220 to −320 B |
| `sheet.css`                   |          1,310 B |                               |                                                                                         1,000 to 1,050 B |                    |                 −260 to −310 B |
| `baseline.css`                |                — |                               |                                                                                 2,600 to 3,400 B, opt-in |                    |                 its own budget |

**React initial, worked out.** Each new control is one line on the existing `action()` factory
(`react/src/index.ts:685-715`), about 20 B. Removing icons drops the 209 B of paths, the icon
attributes and the `defaultIcon` switch (`:712-729`). In their place a part needs only
`children ?? label`. Features 1–5 now cost their labels (80–100 B), control descriptors
(100–150 B), state and command stubs (60–100 B) and the `Download` and `Share` specifics
(150–200 B). `Loading`, `Error` and `Retry` add about 150–250 B. Altogether React grows by
1.0–1.85 KB including step 7, or 7–12% on 14,864 B. That is down from 11–17% before this
amendment, and it needs no lazy-icon workaround: the `hostOf(fluidbox).icon()` mitigation is
dropped.

A page that also imports `baseline.css` pays its 2.6–3.4 KB of CSS, once and cacheable. A page
that styles the viewer itself pays nothing for looks it replaces. Together with the functional
CSS, `styles.css` plus `baseline.css` is about 1.7–2.6 KB more than today's `styles.css`, almost
all of it the glyph data URLs that replace the JS icons.

**Slideshow and Hotspot entry points: recommendation, keep them in the binding entries.** The
pressure to split them came from the icon cost, which is gone. Each is 150–300 B, and with them
the React total stays within 7–12%. Separate entries would cost every user an import line and the
bundle check two consumers per framework. The fallback stays (§8.20): move them out if step 7's
measurement exceeds the upper estimate.

**Fifth amendment.** `origin`, `returnPlayback` and the click and tap modes add about 150–250 B
to activation (the viewer chunk), and 20–40 B to each binding's initial chunk for the two hook
members. The built-in hand-back gets slightly smaller, since it reads one source.

If the measurement still comes in high:

- The controls (`Toolbar`, `ZoomControls`, `Counter`, `Caption`, the zoom buttons) share one
  `controlPart(kind)` factory, as Angular's parts already share a base directive.
- `Image`, `Video` and `Iframe` are one component with a `kind` prop under three names.

New bundle-check consumers (`tests/bundle/*.ts` and the `entrypoints` list in
`scripts/check-bundles.ts:4`): rename `filmstrip` → `thumbnails` and `embeds` → `embed`; add
`react-embed`, `react-model`, `react-spin`, the same for Vue, Solid and Angular, and
`elements-embed`, `elements-model`, `elements-spin` (15 new), and `hls` and `deep-zoom` once those add-ons exist. `baseline.css` gets its own CSS budget, outside every entry's activation total. Each asserts it carries only its
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
- Video `attach` on a neighbour: a mounted neighbour attaches with `active` and `opening` false
  and fetches no segments; moving to it fires `onActiveChange(true)` and loading starts.
- Embed providers: a provider made in the test plays, pauses and preconnects; a `url()` off its
  `origin` shows the error slide; an item naming an unregistered provider shows the error slide
  and warns.
- Fill boxes: a `fit: "fill"` slide's box equals the stage less its insets, with the thumbnails
  dock and with a sheet's peek; the opening flight's first frame shows the poster at the trigger's
  rectangle; resizing the window resizes the box; a model item from `modelItem()` fills.

Third amendment, steps 1–2:

- Fullscreen, in Chromium, WebKit and Firefox: enter and leave from the control; the control is
  hidden where `fullscreenEnabled` is false (stubbed); closing from fullscreen exits first and the
  close flight lands on the trigger; Escape leaves fullscreen and a second Escape closes; **over a
  modal `<dialog>`**: enter, leave and close all work and the viewer stays above the dialog (the
  popover hand-off, §2.11).
- Download: same-origin anchor with the right `download` filename; cross-origin with CORS saves a
  blob (and revokes the URL); cross-origin without CORS opens a tab; hidden on an item with
  `download: false` and on a model; a move aborts the fetch.
- Share: `navigator.share` called with title and URL (stubbed); cancel does nothing; fallback copies
  and announces `linkCopied`; hidden with no URL.
- `mediaerror`: image, video (every `<source>` failing), URL check, a neighbour failing, Retry
  failing again, `kind: "zoom"` with no error slide, `slide.fail` with Retry re-rendering; in
  each binding through `onMediaError`.
- Gestures: `dismiss.drag: false` springs back; `dismiss.backdrop: false`; Escape still closes;
  each `wheel` mode, including one move per trackpad gesture for `"navigate"`; the sheet's
  `dismissMotion`.
- Item `data`: attributes on the slide, the thumbnail and the server copy; a bad name throws; a
  reused slide drops stale keys.
- `onZoom`: a listener sees the pose during a pinch and at rest, `visible` matches the scroller's
  viewport, and `--fluidbox-zoom-scale` is set on the box.

Fifth amendment (sub-step 1.13):

- **Origin playback.** A trigger with a playing `<video>` opens a custom slide: `origin.video` is
  set on that slide and null on its neighbours; `currentTime` reads live. Opening without a
  trigger, or moving to another slide, gives null.
- **Hand-back.** A custom slide registers a stub player at 7.5 s, playing; closing seeks the
  trigger's video to 7.5 s and plays it. A function source returning null leaves the trigger
  untouched. With nothing registered the trigger is untouched, as today. The built-in video's
  existing hand-back tests pass unchanged through the new path.
- **Bindings.** `useFluidboxSlide().returnPlayback` in an effect unregisters on unmount; Angular's
  `injectFluidboxSlide()` has both members.
- **Click zoom.** `click: "single"`: one click toggles, a double-click toggles once.
  `click: "double"`: one click does nothing and doesn't close, a double-click toggles at the
  pointer. `click: false`: clicks do nothing, and the zoom buttons, keys, pinch and wheel still
  zoom. In every mode a click beside a zoomed image zooms out.
- **Tap zoom.** `tap: "double"` keeps the 350 ms / 40 px test; `tap: false` ignores double taps
  and pinch still zooms.
- **Live.** `update({ zoom: { click: "double" } })` while open applies to the next click, and
  `data-fluidbox-zoom-click` follows it.

Fourth amendment (sub-step 1.12):

- **Snapshots.** `collapsed-visual`, `interactions` and `motion` run with `baseline.css` imported
  and must match today's snapshots. Glyph-edge antialiasing is the only allowed diff, reviewed one
  by one (§10.4).
- **Headless smoke test**, new: the basic pattern with only `styles.css`. Open, swipe, zoom,
  dismiss and close all work; Previous, Next and Close are text buttons named by their text; the
  backdrop is opaque (`Canvas`); axe passes.
- **No icons in the package.** A test greps the built `dist/` for `<svg`, `createElementNS` with
  the SVG namespace, and path data. It allows them only in `baseline.css`'s data URLs.
- **Children and names.** Per binding: a part with no children renders its label text with
  `data-fluidbox-default`; with an icon child it gets `aria-label` from `labels`; `label={false}`
  names it by its content; a consumer `aria-label` wins. `bindControl` wires the command,
  disabled, hidden and the fullscreen label on a page button.
- **`icons` and markup.** The option and `<template data-fluidbox-icon>` put the icon in each
  default button, and `icons` wins over a template. Under Trusted Types (`csp.spec.ts`) neither
  violates.
- **CSP.** `csp.html` with self-hosted glyph tokens shows glyphs and records no violations. With
  `data-fluidbox-glyphs="off"` it shows text.
- **Forced colours** (`a11y.spec.ts`, emulated): baseline controls show their text, and focus
  stays visible.
- **Loading, Error, Retry**: `data-busy` and `data-error` toggle; a custom `Error` replaces the
  default UI; `Retry` reloads; the error is announced once.
- **Layers.** An unlayered app rule overrides a baseline token and a baseline rule. A late
  baseline transition stays off under reduced motion.
- **Resets don't break the mechanics**, new: a fixture page loads typical unlayered resets
  before the package CSS (Tailwind v3 preflight, modern-normalize, and
  `img, video { max-width: 100%; height: auto; display: block }`). The open, fit, fill, zoom and
  close geometry (the flight's start and end rects, the media box, the zoomed box, the strip
  offset) must be identical to the same page without resets.
- **No dead baseline rules**, a build check: no property is set by both `baseline.css` and the
  functional CSS for the same selector, and `baseline.css` has no `!important`.
- **Moved assertions.** `a11y.spec.ts`, `headless.spec.ts`, `frameworks.spec.ts`, `patterns.spec.ts`
  and `tests/public-api.contract.ts` stop expecting icon SVGs and `fluidboxControlIcon`, and
  expect text or `aria-label` names.

Step 7:

- Motion speed: at `--fluidbox-motion-speed: 2` the open, close, release and move take half as
  long (measured from animation timing); reduced motion still has no flights.
- `reachend`: fires within the threshold, once per count, again after `setItems` grows the count,
  never with `loop`; the open `value` doesn't change on `setItems`; `withCount` keeps made items.
- Slideshow: doesn't start without `play()`/`autoplay`; advances after the interval and only once
  the next slide is ready; pauses on a pointer, a key, a zoom, a hidden tab and a playing video,
  and resumes only after the latter two; the live region is off while playing; instant moves under
  reduced motion; axe passes with the control.
- Hotspots: stay on their point at zoom 1, 2 and 4, with `object-fit: contain` and in a fill box;
  keep screen size unless `scaleWithZoom`; tab order; focus pans a zoomed image; hidden during
  flights.

## 9.5 What runs in parallel

| Track                                        | Depends on                                            | Can run with                                                                    |
| -------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1.1 item types, 1.7 renames                  | —                                                     | each other; they touch different names, but rebase often, as both edit fixtures |
| 1.2 state and events                         | 1.1                                                   | 1.3                                                                             |
| 1.3–1.5 slides, Media box, waiting           | 1.1                                                   | 1.2, 1.6                                                                        |
| 1.6 triggers and overlays                    | 1.2                                                   | 1.3–1.5                                                                         |
| 1.8 video sources and `attach`               | 1.3 (`drawVideo`)                                     | 1.4–1.6, 1.9                                                                    |
| 1.9 fill boxes                               | 1.4                                                   | 1.5, 1.6, 1.8                                                                   |
| 2 React                                      | 1's public types (write them first, implement behind) | 3                                                                               |
| 3 plain-JS add-on slides, embed providers    | 1.3's slide contract; `modelItem` fill needs 1.9      | 2                                                                               |
| 4 Vue, Solid, Angular, elements              | 1 done, 2's `Media` portal proven                     | each other                                                                      |
| 5 add-on parts                               | 3, and that framework's step 4                        | the other frameworks                                                            |
| 6 docs and examples                          | each framework's step                                 | per page; patterns per framework                                                |
| 1.10 features 1–5                            | 1.2 (events), 1.4 (the box)                           | 1.6, 1.8, 1.9                                                                   |
| 1.11 hooks for step 7                        | inside 1.4 and 1.5                                    | —                                                                               |
| 1.12 CSS split and icon removal              | 1.4 and 1.9 (they edit `styles.css`)                  | 1.5, 1.6, 1.8; before any control work in step 2                                |
| 1.13 origin playback; click and tap zoom     | 1.3 and 1.8 (playback); 1.4 (zoom)                    | 1.10, 1.12; the two halves run in parallel                                      |
| 7.1–7.4 speed, reachend, slideshow, hotspots | 2 landed, 1.11                                        | each other, and step 4                                                          |
| 7.5 deep zoom                                | `onZoom`, `zoomable({ max, sharpen })`; after 1.0     | anything                                                                        |

With four people or agents: one on 1.3–1.5 (the engine), one on 1.1/1.2/1.6/1.7, one on 2 then
Vue, one on 3 then Angular; Solid and elements follow. The critical path is 1.3 → 1.4 → React
`Media` → the other bindings' `Media`.

CI note: the browser suite runs only for ready (non-draft) PRs and pushes to `master`, and is
skipped for docs-only changes. A test added here runs there, not on every draft push.

## 9.6 Done when

- `bun run test` (Vitest, contracts, Playwright, bundle check) passes with the new limits.
- No old name from part 1 is left in `packages/`, `apps/`, `tests/` or `docs/` (a grep over the
  inventory's left column, in CI once).
- All 13 patterns exist in React, Vue, Solid, Angular, elements and JS, and every docs snippet
  in §6.14 is rewritten.
- `baseline/bundle-budget.md` records the measured sizes.
- Step 7: the four features ship in every binding and the elements, each with its tests, and
  deep zoom is tracked for after 1.0.
