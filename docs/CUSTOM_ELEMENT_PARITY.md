# Custom-element parity

Every feature of the plain JS API has a form in the custom elements. `<fluidbox-gallery>` owns one
`createFluidbox()` fluidbox and adapts markup, attributes and properties to it; it has no gallery
engine of its own. Gestures, zoom, flights, the strip, origins and the portal stay in the
runtime, so a new interaction lands there first and the elements get it through the same
options. The user documentation is
[Custom elements](../apps/docs/content/custom-elements.md); the parts the elements expand are in
`packages/fluidbox/src/elements-parts.ts`, the gallery in `gallery.ts`, items in `item.ts`.

`tests/browser/patterns.spec.ts` runs the 13 patterns on the elements as on every binding
(`apps/examples/src/patterns/elements/`), and `elements.spec.ts`, `hotspot-parts.spec.ts`,
`hotspots.spec.ts` and `slideshow.spec.ts` cover the parts below.

## Items, triggers and origins

| Plain JS                                   | Custom elements                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `items` (an array or a lazy list)          | `<fluidbox-item>` children read into items, or the gallery's `items` property                        |
| `bind(element, value)`                     | `[slot="trigger"]` in a `<fluidbox-item>`; with `items` set, `data-fluidbox-value` on any descendant |
| a trigger closing back onto several items  | `value="a b c"` on `<fluidbox-item>`, or several ids in `data-fluidbox-value`                        |
| `data-fluidbox-origin`                     | the same attribute, in the trigger                                                                   |
| `findTrigger`, `revealTrigger`             | properties of the same names                                                                         |
| `bindOverlay(element, value, { flight })`  | `data-fluidbox-trigger-overlay="none \| copy \| live \| frame"` in the trigger                       |
| `setItems(items)`, `list.withCount(total)` | `setItems()`, or the `items` property                                                                |
| `onPreviewChange`                          | the `fluidbox-preview-change` event on `<fluidbox-item>`                                             |

## Options

| Plain JS                                                                  | Custom elements                                                                                                                                     |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`                                                                   | the `value` attribute and property                                                                                                                  |
| `zoom`                                                                    | `nozoom`, `zoom-step`, `zoom-max`, `zoom-click`, `zoom-tap`, or `zoom`                                                                              |
| `loop`, `preload`, `wheel`                                                | attributes of the same names                                                                                                                        |
| `reachEndThreshold`                                                       | the `reach-end-threshold` attribute, or the `reachEndThreshold` property                                                                            |
| `dismiss`, `shareUrl`, `slideshow`, `labels`, `icons`, `slides`, `viewer` | properties of the same names                                                                                                                        |
| `thumbnails`, `sheet`                                                     | `<fluidbox-thumbnails>` and `<fluidbox-sheet>` children                                                                                             |
| `controls`, `viewer`                                                      | `<template slot="viewer">`, with `<fluidbox-controls>` for the defaults                                                                             |
| `icons`                                                                   | also `<template data-fluidbox-icon="name">` in the gallery                                                                                          |
| `slides`                                                                  | also `<template data-fluidbox-slide="type">`; the add-on slides through `@ogdakke/fluidbox/elements/embed`, `/model` and `/spin`, and `defineSlide` |

Every option change applies as `update()` does, without closing the viewer.

## Commands, state and events

| Plain JS                                                                                                         | Custom elements                                    |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `open`, `close`, `next`, `previous`, `zoomTo`, `zoomIn`, `zoomOut`, `zoomReset`                                  | methods of the same names                          |
| `setFullscreen`, `download`, `share`, `play`, `pause`, `preload`, `load`                                         | methods of the same names                          |
| `state`, `subscribe`, `sheet`                                                                                    | members of the same names                          |
| `bindControl`, and anything else on the fluidbox                                                                 | on `gallery.fluidbox`, once `whenReady()` resolves |
| `beforevaluechange`, `valuechange`, `valuechangecomplete`, `sheetchange`, `zoomchange`, `mediaerror`, `reachend` | the same events on the gallery, not bubbling       |

## Viewer parts

In `<template slot="viewer">`, and in a slide template's layer:

| Part (React, Vue, Solid)                        | Custom elements                                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `Controls`, `Previous`, `Next`, `Close`         | `<fluidbox-controls>`, or a button marked `data-fluidbox-previous` and so on                 |
| `Toolbar`, `ZoomControls`, `Counter`, `Caption` | `<fluidbox-toolbar>`, `<fluidbox-zoom-controls>`, `<fluidbox-counter>`, `<fluidbox-caption>` |
| `Loading`, `Error`, `Retry`                     | `<fluidbox-loading>`, `<fluidbox-error>`, a button marked `data-fluidbox-retry`              |
| `Fullscreen`, `Download`, `Share`               | `<fluidbox-fullscreen>`, `<fluidbox-download>`, `<fluidbox-share>`                           |
| `Slideshow`                                     | `<fluidbox-slideshow>`                                                                       |
| `label={false}`                                 | `data-fluidbox-label="content"`                                                              |

A part without content shows its label as text and gets `data-fluidbox-default`; content of the
page's goes inside the part. A control that switches gets `data-active` while it is on.

## Slide parts

In `<template data-fluidbox-slide="type">`:

| Part (React, Vue, Solid) | Custom elements                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `Media`                  | `<fluidbox-media>`: its children go in the media box, its attributes on it; `zoom` or `zoom="false"`         |
| `Image`                  | `<fluidbox-image>`, of the item or of its `field`                                                            |
| `Hotspot`                | `<fluidbox-hotspot x y scale-with-zoom>` inside `<fluidbox-media>`; `scale-with-zoom="false"` reads as false |

Everything else in the template goes in the slide's layer. A hotspot takes the remaining
attributes and children of its element, and becomes the `slide.hotspot()` button in its place.

## Not in the elements

The framework-only conveniences: `useFluidbox` selectors, the server copy of an open viewer, and
`href` for URL sync. The elements read a `value` attribute a server renders, and a page keeps the
URL in step through `valuechange`.
