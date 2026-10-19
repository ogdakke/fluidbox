---
title: Sheet
section: Patterns
order: 9
description: A panel under the photo with snap points, stop buttons and form fields.
---

# Sheet

The sheet is an optional add-on from `@ogdakke/fluidbox/sheet`: a panel the viewer slides up from the bottom, with snap points. It suits details, comments or a form.

<!-- pattern: sheet -->

- `snapPoints: ["40%", "90%"]` adds stops above the resting stop `0`: the `sheet` option in plain JavaScript, the `Sheet` part's prop, or `snap-points="40% 90%"` on `<fluidbox-sheet>`.
- `fluidbox.sheet.set(stop)` moves the sheet, and `fluidbox.sheet.subscribe` reports the current stop. In the frameworks, `useFluidboxSheet()` returns `{ stop, set }`; on custom elements, `gallery.sheet` is the same handle.
- Any button with `data-fluidbox-sheet-stop="N"` in the viewer moves the sheet to stop `N`, and lowers it again when the sheet is already there. The framework `SheetStop` part renders one.
- Keys typed in the sheet's fields stay there: arrow keys don't change the slide.
- `import "@ogdakke/fluidbox/sheet"` once to turn the add-on on (the custom elements load it themselves), and import `@ogdakke/fluidbox/sheet.css` with it.
