---
title: CSS reference
section: Reference
order: 2
description: Every CSS custom property, part selector and state attribute fluidbox exposes in styles.css, thumbnails.css, sheet.css and baseline.css, read from the stylesheets and the runtime, with defaults and where each is set or read.
---

# CSS reference

The custom properties, parts and state attributes of `@ogdakke/fluidbox/styles.css`, `thumbnails.css`, `sheet.css` and `baseline.css`, read from the stylesheets and the runtime. [Styling](./styling.md) explains how to use them. The stylesheets use other `--fluidbox-*` properties and data attributes internally; anything not listed here can change without notice.

`styles.css`, `thumbnails.css` and `sheet.css` are in no cascade layer, and wrap the viewer's rules in `:where([data-fluidbox-viewer], [data-fluidbox-flight])`, so most weigh one data attribute: more than an element reset, as much as one class of yours. `baseline.css` is in the `fluidbox-baseline` layer and wholly in `:where()`, so a rule of yours outside a layer, or in a later layer, always beats it. The thumbnails' and the sheet's defaults, declared on the dialog, sit wholly inside `:where()`, so `[data-fluidbox-dialog] { … }` overrides them in any order. When the viewer opens, it copies every `--fluidbox-*` property on the trigger onto the overlay as inline styles. So you can set most inputs on `:root`, on the trigger or an ancestor of it, or on `[data-fluidbox-viewer]`; set the ones declared on the dialog on `[data-fluidbox-dialog]`.

## Theme variables

Tokens of `baseline.css`. Without it, nothing reads them.

<!-- css: theme -->

An error message without `--fluidbox-background` and `--fluidbox-color` set is black on white.

### Other baseline tokens

<!-- css: baseline -->

## Inputs

Properties of `styles.css` and `thumbnails.css` that you set. Each is read where the table says, and inherits there from any ancestor.

<!-- css: inputs -->

### Sheet inputs

From `sheet.css`, declared on the dialog at zero specificity. Override them on `[data-fluidbox-dialog]`.

<!-- css: sheet -->

## Published values

Set by the runtime. Read them for your own effects; don't set them.

<!-- css: published -->

The sheet values follow the scroll on the compositor and inherit to everything in the viewer.

## Parts

<!-- css: parts -->

### Sheet parts

<!-- css: sheet-parts -->

## State attributes

<!-- css: states -->

## Events

The sheet's stop changes arrive as the `sheetchange` event on the fluidbox and on `<fluidbox-gallery>`, not on an element in the viewer. See [Thumbnails and sheet](./thumbnails-and-sheet.md#the-sheet-handle).
