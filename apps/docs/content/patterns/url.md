---
title: Photo in the address
section: Patterns
order: 12
description: Keep the open photo in the address, so a link opens it and Back closes it.
---

# Photo in the address

The viewer can follow your state instead of its triggers. Pass `value`, the id of the item on show or `null`, and the viewer opens, moves and closes to match. Clicks, swipes and keys still work at once, and the value-change callback tells your state what happened. Here that state is `?photo=` in the address.

<!-- pattern: url -->

- **One callback.** `onValueChange(value, details)` comes before every open, move and close, from any input, the viewer's own buttons and keys included. Vue binds it with `v-model`, Angular with `[value]` and `(valueChange)` (or `[(value)]` when nothing else listens). On custom elements, set the gallery's `value` and listen for `valuechange`; in plain JavaScript, call `open()` and `close()`, and listen for `valuechange`. `details` has the `action` and the `reason`.
- Opening pushes a history entry and moving replaces it, so Back closes the viewer and Forward opens it again on the same photo. Push on every move instead if you want Back to step through the photos.
- A link with `?photo=2` opens the second photo when the page loads, flying from its thumbnail. A number out of range reads as no photo, so a stale link opens nothing.
- Leave `value` out and the triggers own it; `defaultValue` opens the viewer on an item once.
- Each version reads the address after the first render, in an effect, `onMount`, `onMounted` or `afterNextRender`. The server has no `location`, and its HTML then matches the browser's first render, with the viewer closed. Server-rendered pages, [Next.js](../nextjs.md) among them, take the pattern as it is; the framework pages show the same with a router.
