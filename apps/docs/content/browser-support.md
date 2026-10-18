---
title: Browser support
section: Reference
order: 3
---

# Browser support

Fluidbox targets recent browsers and keeps a single gesture and portal implementation. Legacy support is not part of the runtime.

## Target window

- **Chrome, Edge, Firefox (desktop):** current and previous stable major versions.
- **Safari (macOS and iOS):** current and previous OS major releases with their latest Safari.
- **Chrome (Android):** current and previous stable versions. Physical Android validation is still a gap.

Embedded webviews, in-app browsers, and older ESR releases are outside the initial guarantee.

## Required capabilities

Native scroll snapping, Web Animations, `inert`, pointer events, and modern viewport units. CSS `@scope` is not required; isolation comes from data attributes and `:where()`.

## What is tested

Playwright runs Chromium, Firefox, and WebKit, plus Pixel 7, iPhone 15 Pro, and iPad Pro 11 emulation. Those are engine checks, not proof that a specific branded browser or physical device passed. Each release records the exact versions it verified.

> This is the intended policy for the first release, not a claim that the full matrix has passed.
