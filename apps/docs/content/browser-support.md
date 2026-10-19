---
title: Browser support
section: Reference
order: 3
description: Which browsers fluidbox supports, the platform features it relies on, and how the sheet degrades without scroll-driven animations.
---

# Browser support

Fluidbox targets current browsers. Its gestures, flights and body-level viewer each have one implementation, with no legacy fallbacks.

## Supported browsers

| Browser                  | Versions                                                  |
| ------------------------ | --------------------------------------------------------- |
| Chrome and Edge, desktop | The current and previous stable major versions.           |
| Firefox, desktop         | The current and previous stable major versions.           |
| Safari, macOS and iOS    | The Safari of the current and previous OS major releases. |
| Chrome, Android          | The current and previous stable major versions.           |

The table doesn't cover embedded web views, in-app browsers or Firefox ESR.

## What the browser needs

The viewer uses these platform features. Every supported browser has them.

- CSS: scroll snapping, `:has()`, `:where()`, `@property`, container query units (`cqw`), small viewport units (`svh`), `env(safe-area-inset-*)`.
- DOM: Pointer Events, Web Animations, the `inert` attribute, `ResizeObserver`, `IntersectionObserver`, `HTMLImageElement.decode()`.
- The sheet also uses `AbortSignal.any()`.

The package root and the add-on entries touch no browser globals on import, so they also load in Node, Bun, Deno and edge runtimes for server rendering. See [Getting started](./getting-started.md#server-rendering).

## Progressive features

The viewer uses these where the browser has them, and works without them:

| Feature                                                   | Without it                                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scroll-driven animations (`animation-timeline: scroll()`) | The sheet still scrolls and snaps between its stops, but the photo keeps its size behind it and the backdrop doesn't fade with a scroll dismiss. |
| The `scrollend` event                                     | The viewer waits for a short pause in scroll events instead.                                                                                     |
| `visualViewport`                                          | The sheet doesn't make room for the software keyboard.                                                                                           |

## Motion preferences

With `prefers-reduced-motion: reduce`, the viewer opens and closes without flights and moves between slides, zoom levels and sheet stops without animation. See [Styling](./styling.md#reduced-motion).
