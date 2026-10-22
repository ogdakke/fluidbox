---
title: API reference
section: Reference
order: 1
description: Every entry point of @ogdakke/fluidbox and every export of the root, read from the package source: createFluidbox options, the Fluidbox, state, events and reasons, items, lists, renderers, origins, labels, the add-ons, each framework binding, the custom elements and the binding kit.
---

# API reference

Complete API reference

## Entry points

<!-- api-entries -->

<!-- api-import: root -->

## createFluidbox(options)

<!-- api: createFluidbox, FluidboxOptions, FluidboxControlName -->

## Fluidbox

<!-- api: Fluidbox, FluidboxTarget, FluidboxCommandOptions, FluidboxZoomCommandOptions, FluidboxUpdateOptions, FluidboxBindOptions, FluidboxOverlayOptions -->

```ts
fluidbox.update({
  labels: finnish,
  zoom: matchMedia("(pointer: coarse)").matches ? false : undefined,
});
```

## FluidboxState

<!-- api: FluidboxState, FluidboxStatus, FluidboxZoomState -->

## Events

<!-- api: FluidboxEventMap, FluidboxToggleEvent, FluidboxItemChangeEvent, FluidboxSheetEvent, FluidboxZoomEvent, FluidboxReason, FluidboxToggleState -->

## Items

<!-- api: FluidboxItem, FluidboxItemBase, FluidboxImageItem, FluidboxVideoItem, FluidboxIframeItem, FluidboxCustomItem, FluidboxThumbnail, FluidboxPictureSource, idOf, itemLabel -->

## Lists

<!-- api: FluidboxItems, FluidboxItemList, createItemList, FluidboxItemListOptions -->

## Renderers

<!-- api: FluidboxRenderer, FluidboxRenderContext, FluidboxViewerRenderer, FluidboxViewerContext -->

## Origins

<!-- api: FluidboxOrigin, FluidboxOriginAdapter, FluidboxRevealContext -->

## Labels

<!-- api: FluidboxLabels, defaultLabels -->

```ts
createFluidbox({
  items: photos,
  labels: {
    close: "Sulje",
    previous: "Edellinen",
    next: "Seuraava",
    position: (index, count) => `Kuva ${index + 1}/${count}`,
  },
});
```

[Languages and direction](./languages.md) covers translating with an i18n library and running the viewer right to left.

## Add-ons

<!-- api: FluidboxFilmstripOptions, FluidboxSheetOptions, FluidboxSheetSnapPoint, FluidboxSheet -->

### Hover zoom

`@ogdakke/fluidbox/hover-zoom` magnifies a photo on the page under a resting mouse. See [Zoom](./patterns/zoom.md#hover-zoom).

<!-- api: hoverZoom, FluidboxHoverZoomOptions -->

## Custom elements

<!-- api-entry: elements -->

## React

<!-- api-entry: react -->

## Vue

<!-- api-entry: vue -->

## Solid

<!-- api-entry: solid -->

## Angular

<!-- api-entry: angular -->

## Binding kit

<!-- api-summary: kit -->

## Type index

<!-- api-index: root -->
