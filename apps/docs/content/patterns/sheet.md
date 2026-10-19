---
title: Sheet
section: Patterns
order: 9
description: A panel under the photo with snap points, stop buttons and form fields.
---

# Sheet

The sheet is an optional add-on from `@ogdakke/fluidbox/sheet`. It is a panel the viewer slides up from the bottom, with snap points, for details, comments or a form.

<!-- pattern: sheet -->

- `snapPoints: ["40%", "90%"]` adds stops above the resting stop `0`. Set it in the `sheet` option in plain JavaScript, as the `Sheet` part's prop, or as `snap-points="40% 90%"` on `<fluidbox-sheet>`.
- `fluidbox.sheet.set(stop)` moves the sheet, and a `sheetchange` event reports each new stop. In the frameworks, `useFluidboxSheet()` returns `{ stop, set }` and the root takes `onSheetChange`, `@sheetchange` or `(sheetChange)`. On custom elements, `gallery.sheet` is the same handle and the gallery fires `sheetchange`.
- Any button with `data-fluidbox-sheet-stop="N"` in the viewer moves the sheet to stop `N`, and lowers it again when the sheet is already there. The framework `SheetStop` part renders one.
- Keys typed in the sheet's fields stay there, so arrow keys don't change the slide.
- `import "@ogdakke/fluidbox/sheet"` once to turn the add-on on (the custom elements load it themselves), and import `@ogdakke/fluidbox/sheet.css` with it.
