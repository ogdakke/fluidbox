---
title: Gallery
section: Patterns
order: 1
description: A trigger per photo, with Previous, Next and Close in the viewer.
---

# Gallery

One viewer for a set of items, and a trigger for each. A trigger can be any element, usually a button holding the thumbnail. Its `value` names the item it opens: the item's `id`, the item itself, or its index. When the viewer closes, it flies back to the trigger of the item it shows, and focus returns there.

<!-- pattern: basic -->

- With no viewer content of your own, the viewer has Previous, Next and Close. Once you give it content (`Viewer`, `<ng-template fluidboxViewer>`, `<template slot="viewer">` or the `viewer` option), you place the controls you want: the `Previous`, `Next` and `Close` parts, or a `Toolbar` with all three.
- A part with no content shows its label as text, "Previous", "Next" and "Close", marked `data-fluidbox-default`. `baseline.css` draws a glyph over that text. Give the part content of your own, such as an icon component, and the label becomes its `aria-label`. The package ships no icons.
- In plain JavaScript, `fluidbox.bind(button, value)` makes each button a trigger, and `fluidbox.destroy()` unbinds them all.
- The trigger's image is where the flight starts and ends. Mark another element with `data-fluidbox-origin` to fly from it instead (see [Rich origins](./origins.md)).
