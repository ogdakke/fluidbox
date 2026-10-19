---
title: Headless controls
section: Patterns
order: 10
description: Your own caption bar and buttons in the viewer, driven by the fluidbox's state and commands.
---

# Headless controls

The viewer's layer is yours to fill. Leave out the default controls and render your own caption, counter and buttons. They read the state and call the commands.

<!-- pattern: headless -->

- The framework `Viewer` part renders into the viewer's layer, above the slides, and `useFluidbox()` gives the state and commands. In plain JavaScript, the `viewer` option draws into it and subscribes to the state. On custom elements, set `gallery.viewer`, or put a `<template slot="viewer">` in the gallery.
- Buttons marked `data-fluidbox-close`, `data-fluidbox-previous` or `data-fluidbox-next` get the default styling, and run their command on the custom elements. Your own buttons call `close()`, `previous()` and `next()` directly.
- Clicks on your buttons, links and inputs inside the viewer never count as zoom taps.
