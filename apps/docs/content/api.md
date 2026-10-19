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

<!-- api: Fluidbox, FluidboxTarget, FluidboxCommandOptions, FluidboxUpdateOptions, FluidboxBindOptions, FluidboxOverlayOptions -->

```ts
fluidbox.update({
  labels: finnish,
  zoom: matchMedia("(pointer: coarse)").matches ? false : undefined,
});
```

## FluidboxState

<!-- api: FluidboxState, FluidboxStatus -->

## Events

<!-- api: FluidboxEventMap, FluidboxToggleEvent, FluidboxItemChangeEvent, FluidboxSheetEvent, FluidboxReason, FluidboxToggleState -->

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

## Add-ons

<!-- api: FluidboxFilmstripOptions, FluidboxSheetOptions, FluidboxSheetSnapPoint, FluidboxSheet -->

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
