# Pattern examples contract

Every framework implements the same nine patterns in `src/patterns/<framework>/`, where
`<framework>` is `elements`, `javascript`, `react`, `solid`, `vue` or `angular`. The page
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
  `media`, `theme`, `label`). The docs rewrite
  `../shared` to `./data` and show those exports in the "example data" section of
  `apps/docs/content/patterns/index.md`; keep that section in step when you add or reshape one.
  Import nothing else that is local to the examples. Styles come from
  `src/patterns/patterns.css` (shared class names below); do not add per-framework CSS.

## Shared class names (patterns.css)

`.pattern-grid` (thumbnail grid), `.pattern-thumb` (a trigger button with an image),
`.pattern-card` (rich card), `.pattern-scroller` (horizontal scroller), `.pattern-toolbar`
(row of buttons and status text), `.pattern-log` (event log list), `.pattern-sheet` (sheet
content), `.pattern-caption` (headless caption bar), `.pattern-note` (custom renderer content),
`.pattern-filmstrip-thumb` (custom filmstrip thumbnail), `.pattern-sheet-toggle` (the sheet
pattern's button in the viewer).

## Patterns and hooks

All hooks are scoped to the pattern root `[data-pattern="<name>"]`, except the viewer, which is
in the body portal (`[data-fluidbox-dialog]`). The active slide is
`[data-fluidbox-slide][aria-hidden="false"]` and its `aria-label` is `"Item N of M"`.

1. **basic** — one gallery of `photos` (4). One `button.pattern-thumb[data-test="trigger"]` per
   photo holding its thumbnail `<img>`. Previous, Next and Close controls in the viewer (framework
   control parts; elements and JS use the defaults). Test: click trigger 1 → "Item 1 of 4"; click
   `[data-fluidbox-next]` → "Item 2 of 4"; Escape closes; focus is on trigger 2.
2. **overlay** — one trigger `[data-test="trigger"]` for the whole `album` (5): it opens
   `album[0]`, every album item returns to it (`returns`), and its `<img data-test="preview">` shows the item
   the viewer last showed (preview follows the selection). Inside it, a travel thumbnail overlay
   `[data-test="count"]` with the text `+4`. Test: click → "Item 1 of 5"; ArrowRight → "Item 2
   of 5"; Escape; preview src ends with `/art/canyon.svg`; click again → "Item 2 of 5".
3. **origins** — (a) a product card: one `button.pattern-card[data-test="product"]` whose image
   sits in a wrapper marked `data-fluidbox-origin`, with a title and price beside it; its own
   gallery of `[product]`. (b) A `.pattern-scroller[data-test="scroller"]` with one trigger per
   `strip` item (8), its own gallery. Test: click product → "Item 1 of 1", Escape. Click scroller
   trigger 1, press ArrowRight 7 times → "Item 8 of 8", Escape → the 8th trigger is inside the scroller's visible
   box (the viewer scrolls the trigger into view by default; do not add revealOrigin).
4. **renderers** — a gallery of `media` (custom note, map iframe, video, YouTube iframe) with a trigger per item.
   The `note` renderer is a framework component that reads `theme` from the framework's own
   context mechanism (React context, Solid context, Vue provide/inject, Angular DI token; elements
   and JS read it from a variable) and renders `<article class="pattern-note">Theme: dusk</article>`. Test: click trigger 1 → dialog
   contains `.pattern-note` with text `Theme: dusk`; ArrowRight → an `iframe` slide; ArrowRight → "Item 3 of 4"
   (the video); ArrowRight → a YouTube `iframe` with `referrerpolicy` set.
5. **programmatic** — a gallery of `photos` with a `.pattern-toolbar` holding:
   `button[data-test="open-third"]` (calls `open(2)`), a checkbox
   `input[data-test="lock"]` (while checked, a `beforeitemchange` listener calls `preventDefault()`, so `next`, `previous` and swipes do nothing),
   `output[data-test="status"]` (current state: `status index`, e.g. `open 2`, `closed -`),
   and `ol.pattern-log[data-test="log"]` (one `<li>` per fluidbox event, text = event type, newest last,
   keep 20). Thumbnails as in basic. Test: click open-third → "Item 3 of 4", status `open 2`, log
   contains `itemchange`; Escape → status `closed -`; check lock; click open-third;
   ArrowRight, then a horizontal wheel swipe → still "Item 3 of 4".
6. **zoom** — two galleries of `photos`, each with one trigger per photo, in this order: the first
   with zoom `{ step: 3, max: 6 }`, the second with zoom off. Test: open trigger 1 (zoom on),
   double-click the slide image → dialog has `data-zoomed`; Escape twice; open trigger 5 (zoom
   off), double-click → no `data-zoomed`.
7. **filmstrip** — two galleries of `photos`, in this order: the first with the default
   filmstrip, the second with your own thumbnails (`filmstrip: { render }`, or the framework's
   Filmstrip part with a child) holding
   `<span class="pattern-filmstrip-thumb" data-test="thumb">N</span>` (N = index + 1). The
   strip marks the selected thumbnail button `data-fluidbox-selected`, which patterns.css styles,
   so the thumbnails track nothing themselves. Test: trigger 1 → dialog has
   `[data-fluidbox-filmstrip]`; trigger 5 → 4 `[data-test="thumb"]` in the dialog, the first one's
   button is selected; ArrowRight → the second one's is and the first one's is not.
8. **sheet** — a gallery of `photos` with the sheet on and `snapPoints: ["40%", "90%"]`. The example
   imports `@ogdakke/fluidbox/sheet.css` (the sheet needs its stylesheet). The sheet is the
   runtime's own `<section data-fluidbox-sheet>` (every framework fills it; none draws its own
   sheet element). `.pattern-sheet` is on that section (where the framework's Sheet part passes
   its attributes on) or on a `<div>` inside it. The content shows the active item's title in
   `[data-test="sheet-title"]`, the current stop in `output[data-test="stop"]` (from the
   `sheetchange` event or the framework sheet hook), a
   `button[data-test="expand"]` that moves the sheet to stop 2 (`sheet.set(2)` or a sheet-stop
   button), and an `input[data-test="field"]`.
   Outside the sheet, in the viewer's portal (at stop 0 the sheet is out of sight), a
   `button.pattern-sheet-toggle[data-fluidbox-sheet-stop="1"][data-test="peek"]` that raises it.
   Test: open → stop `0`; click peek → stop `1`; click expand → stop `2`; type in the field (keys
   stay in the field: ArrowRight does not change the slide).
9. **headless** — a gallery of `photos` with no default controls: custom portal content in a
   `.pattern-caption` (the `viewer` option, the gallery's `<template slot="viewer">`, or the framework Viewer part) holding
   the active title `[data-test="title"]`, a counter `[data-test="counter"]` (`1 / 4`), and its
   own `button[data-test="prev"]`, `button[data-test="next"]`, `button[data-test="close"]` that
   call `close()`, `previous()` and `next()`. Test: open trigger 1 → counter `1 / 4`; click next → `2 / 4`; click
   close → dialog gone.
