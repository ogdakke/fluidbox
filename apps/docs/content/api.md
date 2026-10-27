---
title: API reference
section: Reference
order: 1
description: Every entry point of @ogdakke/fluidbox and every export of the root, read from the package source: createFluidbox options, the Fluidbox, state, events and reasons, items, lists, renderers, origins, labels, the add-ons, each framework binding, the custom elements and the binding kit.
---

# API reference

Every entry point, and every export of the package root, read from the package source. The guides explain when to use each; this page has the exact types.

## Entry points

<!-- api-entries -->

<!-- api-import: root -->

## createFluidbox(options)

<!-- api: createFluidbox, FluidboxOptions, FluidboxControlName, FluidboxPreload, FluidboxSlideshowOptions -->

`slideshow` is covered in [Slideshow](./slideshow.md), and `reachEndThreshold` in [Lists that grow](./items-and-origins.md#lists-that-grow).

## Fluidbox

<!-- api: Fluidbox, FluidboxTarget, FluidboxCommandOptions, FluidboxZoomCommandOptions, FluidboxUpdateOptions, FluidboxBindOptions, FluidboxOverlayOptions -->

```ts
fluidbox.update({
  labels: finnish,
  zoom: matchMedia("(pointer: coarse)").matches ? false : undefined,
});
```

## FluidboxState

<!-- api: FluidboxState, FluidboxStatus, FluidboxValue, FluidboxZoomState -->

## Events

<!-- api: FluidboxEventMap, FluidboxValueChangeEvent, FluidboxValueChangeAction, FluidboxValueChangeDetails, FluidboxSheetEvent, FluidboxZoomEvent, FluidboxMediaErrorEvent, FluidboxMediaErrorKind, FluidboxReachEndEvent, FluidboxReason -->

## Items

<!-- api: FluidboxItem, FluidboxItemBase, FluidboxImageItem, FluidboxVideoItem, FluidboxVideoSource, FluidboxVideoTrack, FluidboxIframeItem, FluidboxCustomItemBase, FluidboxItemTypes, FluidboxThumbnail, FluidboxPictureSource, idOf, itemLabel, imageItem, FluidboxImageProps -->

## Lists

<!-- api: FluidboxItems, FluidboxItemList, createItemList, FluidboxItemListOptions, FluidboxLazyItemList -->

## Renderers

<!-- api: FluidboxRenderer, FluidboxRenderContext, FluidboxSlides, FluidboxSlideRenderer, FluidboxSlide, FluidboxSlideOrigin, FluidboxPlayback, FluidboxPlaybackSource, FluidboxZoomPose, FluidboxZoomableOptions, FluidboxVideoOptions, FluidboxVideoAttachSlide, videoSlide, FluidboxViewerRenderer, FluidboxViewerContext -->

### Hotspots

`slide.hotspot(options)` puts a button on a point of the media. See [Hotspots](./hotspots.md).

<!-- api: FluidboxHotspotOptions, FluidboxHotspotCoordinate -->

## Triggers

<!-- api: FluidboxTriggerValue, FluidboxBindOptions, FluidboxOverlayOptions, FluidboxRevealContext -->

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

<!-- api: FluidboxThumbnailsOptions, FluidboxSheetOptions, FluidboxSheetSnapPoint, FluidboxSheet -->

### Hover zoom

`@ogdakke/fluidbox/hover-zoom` magnifies a photo on the page under a resting mouse. See [Zoom](./patterns/zoom.md#hover-zoom).

<!-- api: hoverZoom, FluidboxHoverZoomOptions -->

## Media add-ons

YouTube and Vimeo, 360° spins and 3D models. See [Product media](./product-media.md).

<!-- api-summary: embed -->

<!-- api-summary: spin -->

<!-- api-summary: model -->

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
