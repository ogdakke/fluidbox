---
title: Introduction
section: Start
order: 1
---

# Fluidbox

A lightbox that moves like the page is physical. Media flies out of its thumbnail, follows your fingers, and lands back where it came from.

<div data-demo="gallery" data-scenes="dune,fjord,alpine,canyon,coast,aurora" data-filmstrip aria-label="Try it"></div>

Open any image above, then swipe, pinch or scroll to zoom, and drag down or press <kbd>Esc</kbd> to close.

## What you get

- **Shared-element flights.** Opening and closing animate between the thumbnail and the viewer, including the thumbnail's crop and corner radius.
- **Gestures that hand off.** Swipe between slides with native scrolling and momentum, pinch or wheel to zoom with continuous handoff, and drag to dismiss.
- **Indexed sources.** Describe a collection by index. The host renders only the thumbnails it shows, and the viewer keeps a small window of slides mounted.
- **Any media.** Images, video, iframes, and your own renderers share one slide strip.
- **One runtime, several entry points.** Custom elements, a headless controller, and bindings for React, Solid, Vue, and Angular all drive the same runtime.

## Pick an entry point

| You are building with                | Start with                                                    |
| ------------------------------------ | ------------------------------------------------------------- |
| Plain HTML or a server-rendered site | [Custom elements](./custom-elements.md)                       |
| Your own components and controls     | [Headless runtime](./headless.md)                             |
| React                                | [React](./react.md)                                           |
| Solid, Vue, or Angular               | [Solid](./solid.md), [Vue](./vue.md), [Angular](./angular.md) |

Every entry point shares the same [sources and origins](./sources-and-origins.md) model and the same [styling contract](./styling.md).

> Fluidbox is pre-release. The package is private while its API settles; this documentation tracks the current workspace.
