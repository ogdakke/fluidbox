---
title: Sheet
section: Patterns
order: 9
description: A panel under the photo with snap points, snap buttons and form fields.
---

# Sheet

The sheet is an optional add-on from `@ogdakke/fluidbox/sheet`: a panel the viewer slides up from the bottom, with snap points, for details, comments or a form.

<!-- pattern: sheet -->

- `snapPoints: ["40%", "90%"]` adds snaps above the resting snap `0`, where the sheet sits below the photo. Pass it to the `Sheet` part (`<ng-template fluidboxSheet [snapPoints]>` in Angular), as `snap-points="40% 90%"` on `<fluidbox-sheet>`, or in the `sheet` option in plain JavaScript.
- `setSnap(snap)` moves the sheet. In the frameworks, `useFluidboxSheet()` (`injectFluidboxSheet()` in Angular) returns `snap` and `setSnap`, and the `Sheet` part reports each snap it comes to rest at through `onSnapChange` (`@snap-change`, `(snapChange)`). On a fluidbox or a `<fluidbox-gallery>`, `sheet` is the same handle, and a `sheetchange` event reports `{ snap, reason }`.
- A `SheetSnap` part (`button[fluidboxSheetSnap]` in Angular), or any button with `data-fluidbox-sheet-snap="N"` in the viewer, moves the sheet to snap `N`, and lowers it again when the sheet is already there. Its content is yours, here the word "Details".
- Keys typed in the sheet's fields stay there, so arrow keys don't change the slide.
- Import `@ogdakke/fluidbox/sheet.css` with it. In plain JavaScript, also `import "@ogdakke/fluidbox/sheet"` once; the framework parts and the custom elements load it themselves. It is about 7.3 kB gzip. See [Thumbnails and sheet](../thumbnails-and-sheet.md) for its styling and dismiss motions.
