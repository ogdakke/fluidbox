---
title: Roadmap
section: Start
order: 3
description: Where fluidbox stands before its first release, what 1.0 will promise, what comes after it, and how to help.
---

# Roadmap

Fluidbox is pre-release. Everything in these docs works in all six entry points, and the browser suite runs it in Chromium, Firefox and WebKit on the desktop and on emulated phones and tablets. None of it is promised yet. Until 1.0, any release can rename, change or remove something you use.

## Using it before 1.0

- **Pin an exact version.** A 0.x minor release can break your code. Its release notes say what to change.
- **Expect renames more than new features.** The work before 1.0 is hardening what exists.
- **Report what breaks.** Include the device, the browser and its version, and what you were doing with your fingers or the mouse. Most gesture bugs only reproduce on one device, so that detail is often the whole fix.

## Toward 1.0

From 1.0, everything the docs describe keeps working until 2.0.

### A stable API

- The API reference and the CSS reference become the contract. That covers every option, event, part, attribute and custom property they list. Anything they don't list is internal and can change.
- After 1.0, breaking changes wait for a major version. A deprecated API keeps working for at least one minor release and logs a warning in development first.
- Every release before 1.0 gets release notes, with the change to make for each break.

### A browser support promise

- The [browser support](./browser-support.md) table becomes a commitment. It covers the current and previous major versions of Safari on iOS and macOS, Chrome on Android and the desktop, Firefox and Edge.
- Each release gets checked by hand on real hardware in those browsers before it ships.
- Each binding gets tested against the framework versions it claims, including server rendering in Next.js, Nuxt, SolidStart and Angular SSR.

### Real devices

The test suite emulates phones in desktop browsers. Emulation doesn't reproduce momentum scrolling, rubber-banding, Safari's toolbars resizing the viewport mid-gesture, or trackpad pinch. That's where gesture bugs hide. The devices still missing from testing:

- iPhones and iPads on each supported iOS version.
- Cheap Android phones, where a dropped frame shows first. Flagships too.
- Trackpads, mice, styluses and touchscreen laptops on macOS, Windows and Linux.
- Foldables.

This is where help counts most. Sponsorship buys devices and device-cloud time. If you own one of these, an hour of testing or a good bug report from it helps as much.

### Looping galleries

An option to loop a gallery. Swiping past the last item brings the first, and swiping back from the first brings the last. The arrow keys and the Previous and Next buttons wrap the same way.

### Bugs and edge cases

- One gesture starting during another, like a pinch mid-swipe or a drag during the opening animation.
- Rotating the phone or resizing the window while the viewer animates. Page zoom.
- Very tall, very wide and very small media.
- Slow and failing networks.
- Items that change while the viewer is open.
- Right-to-left pages.

### Accessibility

An audit with VoiceOver, TalkBack and NVDA, plus keyboard-only use, reduced motion and forced colours. 1.0 ships with whatever it finds fixed.

### Performance

The opening animation and swipes should hold 60 fps on a mid-range Android phone. CI already enforces bundle size budgets, and those stay. Memory has to stay flat in a gallery of thousands of items.

## After 1.0

1.0 won't support any of these. They come later, probably as add-ons.

- **Sharper images while zooming.** The viewer swaps in a higher resolution once the zoom passes what the current image can show.
- **Tiled images.** Zoom into images too large to download whole, using Deep Zoom (DZI) or IIIF tiles.
- **A Svelte binding.**
- **Panoramas and streaming video** as built-in renderers. You can already write your own renderer for either.

## Helping

- **Sponsor device testing.** Of everything between fluidbox and 1.0, it's the work that costs actual money.
- **Report bugs** on [GitHub](https://github.com/ogdakke/fluidbox/issues) with the device, the browser and its version.
- **Say what you'd build with it** and what's stopping you. That decides what 1.0 promises.
