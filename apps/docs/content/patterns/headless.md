---
title: Headless controls
section: Patterns
order: 10
description: Your own caption bar and buttons in the viewer, driven by the fluidbox's state and commands.
---

# Headless controls

The viewer's layer is yours to fill. Give the viewer content of your own and the default controls go: render your own caption, counter and buttons, which read the state and call the commands.

<!-- pattern: headless -->

- The framework `Viewer` part (`<ng-template fluidboxViewer>` in Angular) renders into the viewer's layer, above the slides, and `useFluidbox()` (the Root's slot in Vue, `injectFluidbox()` in Angular) gives the state and the commands. In plain JavaScript, the `viewer` option draws into the layer and subscribes to the state. On custom elements, put a `<template slot="viewer">` in the gallery, or set `gallery.viewer`.
- Your own buttons call `previous()`, `next()` and `close()`. Markup has no commands to call, so on custom elements the buttons are marked `data-fluidbox-previous`, `-next` and `-close`, and the gallery runs the command and disables them as the state changes.
- The `Counter` part shows "1 / 4" from the `counter` label (`<fluidbox-counter>`, `fluidboxCounter`).
- The parts are there when you want them: `Previous`, `Next`, `Close` and `Toolbar` work in your layout as they do in the default one, with the label as text or with your own content. See [Gallery](./basic.md).
- Clicks on your buttons, links and inputs inside the viewer never count as zoom taps.
