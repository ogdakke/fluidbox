# Pattern examples contract

Every framework implements the same thirteen patterns in `src/patterns/<framework>/`, where
`<framework>` is `react`, `vue`, `solid`, `angular`, `elements` or `javascript`. The page
`/<framework>/` mounts them through `mountPatternPage` (`src/patterns/page.ts`), and
`tests/browser/patterns.spec.ts` checks every page against the hooks below. The docs show the same
files, so they are what a consumer would write: idiomatic for the framework, typed, small, with
nothing that only the test needs beyond the `data-test` hooks. The docs strip every `data-test`
attribute (markup, JSX, `h()` props and Angular `host` keys) and `el.dataset.test = ...` lines, so
example code never looks anything up by `data-test`: it holds references, or selects by a class, a
tag, `name`, or a semantic attribute such as `data-action="next"`. Do not pass test names through
props or parameters; the spec finds things by position or by the shared class names instead.

## Files

- `src/patterns/<framework>/index.ts` exports `patterns: Record<PatternName, MountPattern>`
  (`MountPattern = (root: HTMLElement) => void`). It holds the framework's mount glue
  (`createRoot`, `render`, `createApp`, `bootstrapApplication`, ...), nothing else.
- One file per pattern holds the example: `basic.tsx`, `Basic.vue`, `basic.ts`, `basic.html`, ...
  Wrap the part the docs show in a region:
  - TS/TSX/JS: `// #region example` ... `// #endregion example`
  - HTML/Vue templates: `<!-- #region example -->` ... `<!-- #endregion example -->`
    A file may have several regions; the docs show them in order. Keep imports inside the region
    so a snippet is complete.
- Data comes from `src/patterns/shared.ts` (`photos`, `album`, `product`, `strip`,
  `media`, `theme`, `thumbnailSrc`, `arabic`, `zoomPhotos`, `productPhoto`, `productMedia`,
  `modelViewerUrl`). The docs rewrite
  `../shared` to `./data` and show those exports in the "example data" section of
  `apps/docs/content/patterns/index.md`; keep that section in step when you add or reshape one.
- Each pattern has its docs page, `apps/docs/content/patterns/<name>.md`, which embeds it with
  `<!-- pattern: <name> -->` and explains what the code doesn't.
  Import nothing else that is local to the examples. Styles come from
  `src/patterns/patterns.css` (shared class names below); do not add per-framework CSS.
- Stylesheets: an app imports `@ogdakke/fluidbox/styles.css` once, and `baseline.css` for the
  default look; the patterns overview says so, and the examples don't repeat it. A pattern that
  shows an add-on imports that add-on's stylesheet and `@ogdakke/fluidbox/baseline.css`, which
  draws it (thumbnails, sheet, rtl).
- Controls: the short form first. A part with no content renders its label as text, marked
  `data-fluidbox-default`, which `baseline.css` draws; the package ships no icons. Content a
  control needs comes from the page (the sheet's Details button, the headless caption's buttons),
  and the zoom pattern gives its zoom controls icons of its own: an inline SVG marked
  `aria-hidden`, with the label as the button's `aria-label`.

## Shared class names (patterns.css)

`.pattern-grid` (thumbnail grid), `.pattern-thumb` (a trigger button with an image),
`.pattern-card` (rich card), `.pattern-scroller` (horizontal scroller), `.pattern-toolbar`
(row of buttons and status text), `.pattern-log` (event log list), `.pattern-sheet` (sheet
content), `.pattern-caption` (headless caption bar), `.pattern-note` (the note slide's content),
`.pattern-thumbnails-thumb` (custom thumbnail), `.pattern-sheet-toggle` (the sheet
pattern's button in the viewer), `.pattern-zoom-level` (the zoom pattern's readout in the viewer),
`.pattern-product` (the hover pattern's product photo button).

## Patterns and hooks

All hooks are scoped to the pattern root `[data-pattern="<name>"]`, except the viewer, which is
in the body portal (`[data-fluidbox-dialog]`). The active slide is
`[data-fluidbox-slide][aria-hidden="false"]` and its `aria-label` is `"Item N of M"`.

1. **basic** — one gallery of `photos` (4). One `button.pattern-thumb[data-test="trigger"]` per
   photo holding its thumbnail `<img>`. Previous, Next and Close controls in the viewer (framework
   control parts, `<fluidbox-toolbar>` in the elements' viewer template; JS uses the defaults). Test: click trigger 1 → "Item 1 of 4"; click
   `[data-fluidbox-next]` → "Item 2 of 4"; Escape closes; focus is on trigger 2.
2. **overlay** — one trigger `[data-test="trigger"]` for the whole `album` (5): its `value` is the
   whole album, so it opens `album[0]` and every album item closes back onto it, and its
   `<img data-test="preview">` shows the item the viewer last showed (preview follows the
   selection). Inside it, an overlay with `flight="live"` (`flight: "copy"` in JS,
   `data-fluidbox-trigger-overlay="copy"` in elements) `[data-test="count"]` with the text `+4`. Test: click → "Item 1 of 5"; ArrowRight → "Item 2
   of 5"; Escape; preview src ends with `/art/canyon.svg`; click again → "Item 2 of 5".
3. **origins** — (a) a product card: one `button.pattern-card[data-test="product"]` whose image
   sits in a wrapper marked `data-fluidbox-origin`, with a title and price beside it; its own
   gallery of `[product]`. (b) A `.pattern-scroller[data-test="scroller"]` with one trigger per
   `strip` item (8), its own gallery. Test: click product → "Item 1 of 1", Escape. Click scroller
   trigger 1, press ArrowRight 7 times → "Item 8 of 8", Escape → the 8th trigger is inside the scroller's visible
   box (the viewer scrolls the trigger into view by default; do not add revealOrigin).
4. **renderers** — a gallery of `media` (a `note` item, map iframe, video, YouTube iframe) with a
   trigger per item. The `note` slide draws its content in the slide's media box (`Media`,
   `fluidboxMedia`, `<fluidbox-media>`, `slide.media`), so it flies. In the frameworks it is a
   component that reads `theme` from the framework's own context mechanism (React context, Solid
   context, Vue provide/inject, Angular DI token); elements fill the note's
   `<template data-fluidbox-slide="note">` from a variable, and JS reads it from one. It renders
   `<article class="pattern-note">Theme: dusk</article>`. Test: click trigger 1 → dialog
   contains `.pattern-note` with text `Theme: dusk`; ArrowRight → an `iframe` slide; ArrowRight → "Item 3 of 4"
   (the video); ArrowRight → a YouTube `iframe` with `referrerpolicy` set.
5. **programmatic** — a gallery of `photos` with a `.pattern-toolbar` holding:
   `button[data-test="open-third"]` (calls `open(2)`), a checkbox
   `input[data-test="lock"]` (while checked, a value-change handler cancels moves, so `next`, `previous` and swipes do nothing),
   `output[data-test="status"]` (current state: `status index`, e.g. `open 2`, `closed -`),
   and `ol.pattern-log[data-test="log"]` (one `<li>` per value change (`valuechange`) and completion (`valuechangecomplete`), newest last,
   keep 20). Thumbnails as in basic. Test: click open-third → "Item 3 of 4", status `open 2`, log
   contains `valuechange`; Escape → status `closed -`; check lock; click open-third;
   ArrowRight, then a horizontal wheel swipe → still "Item 3 of 4".
6. **zoom** — two galleries, each with one trigger per item, in this order: the first of
   `zoomPhotos` (raster photos with a `srcset` of 640w and 1280w and the full-size file as
   `zoom.src`; the triggers show `thumbnailSrc`) with zoom `{ step: 3, max: 6 }`, the second of
   `photos` with zoom off. The first gallery's viewer has the default controls and the zoom
   controls (`controls` with `zoomIn`, `zoomOut`, `zoomReset` in JS; a `Toolbar` and
   `ZoomControls` in the frameworks; `<fluidbox-toolbar>` and `<fluidbox-zoom-controls>` for
   elements), whose Zoom in, Zoom out and Fit hold the page's SVG icons (`icons` in JS), and an
   `output.pattern-zoom-level[data-test="zoom-level"]` showing `state.zoom.scale` as a rounded
   percentage (`100%`), empty without a zoom, read the framework's way (selector hook, signal,
   the Root's slot, an injected signal; `subscribe` in elements and JS). Test: open trigger 1 →
   level `100%`, Fit disabled; click `[data-fluidbox-zoom-in]` → `data-zoomed`, `150%`; click
   `[data-fluidbox-zoom-reset]` → `100%`, no `data-zoomed`; double-click the slide image →
   `data-zoomed`, `300%`; Escape twice; open trigger 5 (zoom off), double-click → no
   `data-zoomed`. At 1280 × 720 and a pixel ratio of 1 (desktop projects), the image on show
   has `currentSrc` `/photos/1015-1280.webp`, and after Zoom in `/photos/1015.webp`.
7. **thumbnails** — two galleries of `photos`, in this order: the first with the default
   thumbnails (the example imports `@ogdakke/fluidbox/thumbnails.css`, the strip's stylesheet), the second with your own thumbnails (`thumbnails: { render }`, or the framework's
   Thumbnails part with a child) holding
   `<span class="pattern-thumbnails-thumb" data-test="thumb">N</span>` (N = index + 1). The
   strip marks the selected thumbnail button `data-active` (and `data-fluidbox-selected`), which
   patterns.css styles, so the thumbnails track nothing themselves. Test: trigger 1 → dialog has
   `[data-fluidbox-thumbnails]`; trigger 5 → 4 `[data-test="thumb"]` in the dialog, the first one's
   button is selected; ArrowRight → the second one's is and the first one's is not.
8. **sheet** — a gallery of `photos` with the sheet on and `snapPoints: ["40%", "90%"]`. The example
   imports `@ogdakke/fluidbox/sheet.css` (the sheet needs its stylesheet). The sheet is the
   runtime's own `<section data-fluidbox-sheet>` (every framework fills it; none draws its own
   sheet element). `.pattern-sheet` is on that section (where the framework's Sheet part passes
   its attributes on) or on a `<div>` inside it. The content shows the active item's title in
   `[data-test="sheet-title"]`, the current snap in `output[data-test="stop"]` (from the
   `sheetchange` event, the Sheet part's snap-change event, or the framework sheet hook), a
   `button[data-test="expand"]` that moves the sheet to snap 2 (`setSnap(2)` or a `SheetSnap`),
   and an `input[data-test="field"]`.
   Outside the sheet, in the viewer's portal (at snap 0 the sheet is out of sight), a
   `button.pattern-sheet-toggle[data-fluidbox-sheet-snap="1"][data-test="peek"]` that raises it.
   Test: open → snap `0`; click peek → snap `1`; click expand → snap `2`; type in the field (keys
   stay in the field: ArrowRight does not change the slide).
9. **headless** — a gallery of `photos` with no default controls: custom portal content in a
   `.pattern-caption` (the `viewer` option, the gallery's `<template slot="viewer">`, or the
   framework Viewer part) holding the active title `[data-test="title"]`, a counter
   `[data-test="counter"]` (`1 / 4`, the `Counter` part in the frameworks), and its own
   `button[data-test="prev"]`, `button[data-test="next"]`, `button[data-test="close"]` that call
   `previous()`, `next()` and `close()` (in elements, buttons marked `data-fluidbox-previous`,
   `-next` and `-close`, with `<fluidbox-counter>` and a title from `data-fluidbox-text`). It
   shows the commands, not the parts. Test: open trigger 1 → counter `1 / 4`; click next → `2 / 4`; click
   close → dialog gone.
10. **rtl** — a gallery of `photos` with the default thumbnails inside `<div dir="rtl" lang="ar">`,
    with `labels` set to `arabic` from shared.ts (a property on the gallery for elements). One
    `button.pattern-thumb[data-test="trigger"]` per photo. Test: open trigger 1 → the overlay has
    `dir="rtl"` and `lang="ar"`, the slide is `"العنصر ١ من ٤"`; ArrowLeft → `"العنصر ٢ من ٤"` with that
    slide on show; `[data-fluidbox-next]` is labelled `"التالي"` and sits left of centre; ArrowRight →
    back to 1; Next → 2; a horizontal wheel to the left (or ArrowLeft on touch devices) → 3; the
    selected thumbnail is `data-index="2"` and the first thumbnail is right of the
    second; Escape returns focus to trigger 3.
11. **url** — a gallery of `photos` whose open photo lives in the address as `?photo=N` (N =
    index + 1). Frameworks pass `value` from their own state and update it from `onValueChange`
    (`v-model` in Vue, `[value]` and `(valueChange)` in Angular); elements set the gallery's
    `value` and follow `valuechange`; JS calls `open()` and `close()`. Opening pushes a history entry, moving replaces it, closing goes back
    over it (or drops `photo` from an address the page loaded with), and `popstate` brings the
    viewer to the address. Thumbnails as in basic. Test: click trigger 2 → "Item 2 of 4" and
    `photo=2`; ArrowRight → `photo=3`; Back → closed, no `photo`; Forward → "Item 3 of 4";
    Escape → no `photo`; load `?photo=4` → "Item 4 of 4"; Escape → no `photo`, focus on
    trigger 4.
12. **hover** — one `button.pattern-product[data-test="product"]` that opens `productPhoto`
    (a gallery of one), holding the photo at its 640w `thumbnailSrc`, with `hoverZoom` from
    `@ogdakke/fluidbox/hover-zoom` on that `<img>` and removed with the example (effect cleanup,
    `onCleanup`, `ngOnDestroy`, the mount's cleanup). Test, with a mouse (desktop projects):
    hover → the image has `data-fluidbox-hover-zooming` and the `[data-fluidbox-hover-zoom]`
    layer's image ends up at `/products/fjord-wood.webp`. On every project: click → "Item 1 of
    1", the layer is gone; Escape.
13. **media** — a gallery of `productMedia` (a photo, a YouTube facade from `youtubeItem`, a spin
    from `spinItem`, a model from `modelItem`) with a trigger per item (`thumbnailSrc`). The
    slides are the add-ons' parts (`Embed`, `Spin` and `Model` in `Slides`; `fluidbox-embed`,
    `fluidbox-spin` and `fluidbox-model` in Angular's `fluidboxSlide` templates), with `Model`
    loading `modelViewerUrl`. JS passes `embedSlide`, `createSpinSlide()` and
    `createModelSlide({ load })`; elements import `elements/embed`, `elements/spin` and
    `elements/model`, which read a YouTube `<iframe>`, `<img data-spin-frames>` and
    `<model-viewer>` in the items' markup, and set `slides.model` to the slide with `load`. The spec stubs YouTube, its stills and the CDN
    `<model-viewer>` (`tests/browser/support/media.ts`). Test: open trigger 1 → "Item 1 of 4",
    the photo; Next → "Item 2 of 4", no player requested yet; click the slide's "Play" → an
    `iframe` from `https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?`; Next → "Item 3 of 4",
    `[data-fluidbox-spin]` at `data-frame="0"`; focus it, ArrowRight → `data-frame="1"`; Next →
    "Item 4 of 4", `[data-fluidbox-model-ready]` in the slide and `<model-viewer>` requested once
    from `modelViewerUrl`.
    JavaScript and React show the model's trigger as a live `<model-viewer>` of the item (`src`,
    `poster` from `thumbnailSrc`, `camera-controls`, `touch-action="pan-y"`,
    `interaction-prompt="none"`), with the item's label as the trigger's `aria-label`, and load
    `modelViewerUrl` with the page. Test (`media: a live model card opens on its view`): a drag on
    the card turns it and leaves the viewer closed; a click opens on its view; Escape brings the
    slide's view home. Vue, Solid and Angular follow once their slide APIs have `onClose` and
    `origin.model`.
